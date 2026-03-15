import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

/**
 * recon-learn: Reinforcement learning for bank reconciliation.
 * When a user accepts or rejects a match suggestion, this function:
 * 1. Updates the match history record (was_accepted)
 * 2. If accepted: applies the match to the bank statement line
 * 3. Updates rule success_rate based on acceptance history
 * 4. If pattern is new: creates a new learned rule for future use
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authUser = await requireAuthenticatedUser(req);
    const userId = authUser.id;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json();
    const { action, history_id, company_id } = body;

    if (!action || !history_id || !company_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: action, history_id, company_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify company ownership
    const { data: companyCheck } = await supabase
      .from('company')
      .select('id')
      .eq('id', company_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!companyCheck) {
      return new Response(JSON.stringify({ error: 'Company not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the match history record
    const { data: historyRecord, error: historyError } = await supabase
      .from('recon_match_history')
      .select('*')
      .eq('id', history_id)
      .eq('user_id', userId)
      .single();

    if (historyError || !historyRecord) {
      return new Response(JSON.stringify({ error: 'Match history record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'accept') {
      // ====================================================================
      // ACCEPT: Apply the match and learn from it
      // ====================================================================

      // 1. Update history record
      await supabase.from('recon_match_history').update({ was_accepted: true }).eq('id', history_id);

      // 2. Apply match to bank_statement_lines
      if (historyRecord.bank_line_id) {
        await supabase
          .from('bank_statement_lines')
          .update({
            reconciliation_status: 'matched',
            matched_source_type: historyRecord.matched_entity_type,
            matched_source_id: historyRecord.matched_entity_id,
            matched_at: new Date().toISOString(),
            matched_by: 'ai_confirmed',
            match_confidence: historyRecord.confidence,
          })
          .eq('id', historyRecord.bank_line_id);
      }

      // 3. If a rule was used, update its success stats
      if (historyRecord.rule_id) {
        await updateRuleStats(supabase, historyRecord.rule_id);
      }

      // 4. Try to learn a new rule from this accepted match
      await learnFromAcceptedMatch(supabase, userId, company_id, historyRecord);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'accepted',
          line_id: historyRecord.bank_line_id,
          match_id: historyRecord.matched_entity_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'reject') {
      // ====================================================================
      // REJECT: Mark as rejected and update rule stats
      // ====================================================================

      // 1. Update history record
      await supabase.from('recon_match_history').update({ was_accepted: false }).eq('id', history_id);

      // 2. If a rule was used, update its success stats
      if (historyRecord.rule_id) {
        await updateRuleStats(supabase, historyRecord.rule_id);

        // 3. Deactivate rule if success rate drops below 30%
        const { data: ruleData } = await supabase
          .from('recon_match_rules')
          .select('success_rate, times_used')
          .eq('id', historyRecord.rule_id)
          .single();

        if (ruleData && ruleData.times_used >= 5 && ruleData.success_rate < 30) {
          await supabase
            .from('recon_match_rules')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', historyRecord.rule_id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: 'rejected',
          line_id: historyRecord.bank_line_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "accept" or "reject".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Update the success_rate of a rule based on its history.
 */
async function updateRuleStats(supabase: ReturnType<typeof createClient>, ruleId: string) {
  const { data: stats } = await supabase
    .from('recon_match_history')
    .select('was_accepted')
    .eq('rule_id', ruleId)
    .not('was_accepted', 'is', null);

  if (!stats || stats.length === 0) return;

  const total = stats.length;
  const accepted = stats.filter((s: { was_accepted: boolean }) => s.was_accepted).length;
  const successRate = (accepted / total) * 100;

  await supabase
    .from('recon_match_rules')
    .update({
      success_rate: Math.round(successRate * 100) / 100,
      times_used: total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId);
}

/**
 * Learn from an accepted match to create or reinforce rules.
 * Creates label_pattern rules when a description pattern is detected.
 * Creates recurring rules when the same amount appears repeatedly.
 */
async function learnFromAcceptedMatch(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  companyId: string,
  historyRecord: Record<string, unknown>
) {
  // Fetch the bank line to get description and amount
  if (!historyRecord.bank_line_id) return;

  const { data: bankLine } = await supabase
    .from('bank_statement_lines')
    .select('description, amount, reference')
    .eq('id', historyRecord.bank_line_id)
    .single();

  if (!bankLine) return;

  const description = (bankLine.description || '').trim();
  const amount = bankLine.amount;

  // ========================================================================
  // Learn label pattern: if description has >= 4 chars, check if similar
  // matches were accepted before. If 2+ accepted matches share a keyword,
  // create a label_pattern rule.
  // ========================================================================
  if (description.length >= 4) {
    // Extract significant words (>= 4 chars)
    const words = description
      .toLowerCase()
      .split(/[\s,;.\/\-]+/)
      .filter((w: string) => w.length >= 4);

    for (const word of words) {
      // Check if we already have a rule for this pattern
      const { data: existingRule } = await supabase
        .from('recon_match_rules')
        .select('id')
        .eq('company_id', companyId)
        .eq('match_type', 'label_pattern')
        .contains('conditions', { label_pattern: word })
        .maybeSingle();

      if (existingRule) continue; // Already learned

      // Check how many accepted matches contain this word
      const { data: similarMatches } = await supabase
        .from('recon_match_history')
        .select('id, bank_line_id')
        .eq('company_id', companyId)
        .eq('was_accepted', true)
        .limit(10);

      if (!similarMatches || similarMatches.length < 2) continue;

      // Count lines with similar description
      let matchCount = 0;
      for (const match of similarMatches) {
        if (!match.bank_line_id) continue;
        const { data: line } = await supabase
          .from('bank_statement_lines')
          .select('description')
          .eq('id', match.bank_line_id)
          .single();

        if (line && (line.description || '').toLowerCase().includes(word)) {
          matchCount++;
        }
      }

      // Create rule if 2+ matches share the pattern
      if (matchCount >= 2) {
        await supabase.from('recon_match_rules').insert({
          user_id: userId,
          company_id: companyId,
          rule_name: `Label: ${word}`,
          match_type: 'label_pattern',
          conditions: {
            label_pattern: word,
            preferred_entity_type: historyRecord.matched_entity_type,
            preferred_entity_id: historyRecord.matched_entity_id,
          },
          confidence_threshold: 0.75,
          is_active: true,
          times_used: matchCount,
          success_rate: 100.0,
        });
      }
    }
  }

  // ========================================================================
  // Learn recurring amount: if the same exact amount appears 3+ times
  // with accepted matches, create a recurring rule.
  // ========================================================================
  if (amount !== null && amount !== 0) {
    const { data: existingRecurring } = await supabase
      .from('recon_match_rules')
      .select('id')
      .eq('company_id', companyId)
      .eq('match_type', 'recurring')
      .contains('conditions', { amount: String(Math.abs(Number(amount))) })
      .maybeSingle();

    if (!existingRecurring) {
      // Count accepted matches with same amount
      const { count } = await supabase
        .from('recon_match_history')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('was_accepted', true);

      // Only create if enough history
      if (count && count >= 3) {
        await supabase.from('recon_match_rules').insert({
          user_id: userId,
          company_id: companyId,
          rule_name: `Recurring: ${Math.abs(Number(amount))}`,
          match_type: 'recurring',
          conditions: {
            amount: String(Math.abs(Number(amount))),
            preferred_entity_type: historyRecord.matched_entity_type,
            preferred_entity_id: historyRecord.matched_entity_id,
          },
          confidence_threshold: 0.8,
          is_active: true,
          times_used: 0,
          success_rate: 100.0,
        });
      }
    }
  }
}
