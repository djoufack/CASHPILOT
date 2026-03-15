import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createServiceClient();

  try {
    const authUser = await requireAuthenticatedUser(req);
    const userId = authUser.id;

    const { declarationId } = await req.json();

    if (!declarationId) {
      throw new HttpError(400, 'Missing declarationId');
    }

    // Fetch the declaration and verify ownership
    const { data: declaration, error: fetchError } = await supabase
      .from('tax_declarations')
      .select('*, company:company(id, user_id, company_name, country)')
      .eq('id', declarationId)
      .single();

    if (fetchError || !declaration) {
      throw new HttpError(404, 'Declaration not found');
    }

    if (declaration.company?.user_id !== userId) {
      throw new HttpError(403, 'Access denied: you do not own this declaration');
    }

    // Validate the declaration is in a submittable state
    if (!['computed', 'validated'].includes(declaration.status)) {
      throw new HttpError(
        422,
        `Cannot submit declaration in status "${declaration.status}". Must be "computed" or "validated".`
      );
    }

    // Validate required fields
    if (!declaration.tax_base && declaration.tax_base !== 0) {
      throw new HttpError(422, 'Declaration has no computed tax_base');
    }

    // Generate filing reference
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = Math.random().toString(36).substring(2, 8).toUpperCase();
    const filingReference = `${declaration.country_code}-${declaration.declaration_type.toUpperCase()}-${year}${month}${day}-${seq}`;

    // Simulate submission: in production, this would call the tax authority API
    const responseData = {
      submission_id: filingReference,
      submitted_at: now.toISOString(),
      authority: getAuthorityName(declaration.country_code),
      channel: 'electronic',
      acknowledgment: `Declaration ${declaration.declaration_type} received and registered`,
      estimated_processing_days: getProcessingDays(declaration.country_code),
    };

    // Update the declaration
    const { data: updated, error: updateError } = await supabase
      .from('tax_declarations')
      .update({
        status: 'submitted',
        filing_reference: filingReference,
        filed_at: now.toISOString(),
        response_data: responseData,
      })
      .eq('id', declarationId)
      .select()
      .single();

    if (updateError) {
      throw new HttpError(500, `Failed to update declaration: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        declaration: updated,
        filing_reference: filingReference,
        response: responseData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getAuthorityName(countryCode: string): string {
  const authorities: Record<string, string> = {
    FR: 'Direction Generale des Finances Publiques (DGFiP)',
    BE: 'Service Public Federal Finances (SPF Finances)',
    CI: "Direction Generale des Impots (DGI - Cote d'Ivoire)",
    CM: 'Direction Generale des Impots (DGI - Cameroun)',
  };
  return authorities[countryCode] || `Tax Authority (${countryCode})`;
}

function getProcessingDays(countryCode: string): number {
  const processingDays: Record<string, number> = {
    FR: 5,
    BE: 7,
    CI: 14,
    CM: 14,
  };
  return processingDays[countryCode] || 10;
}
