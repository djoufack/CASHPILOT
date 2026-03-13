#!/usr/bin/env node

import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}

const DEMOS = [
  {
    email: 'pilotage.fr.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_FR_PASSWORD,
    label: 'FR',
  },
  {
    email: 'pilotage.be.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_BE_PASSWORD,
    label: 'BE',
  },
  {
    email: 'pilotage.ohada.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_OHADA_PASSWORD,
    label: 'OHADA',
  },
];

for (const demo of DEMOS) {
  if (!demo.password) {
    throw new Error(`Missing password env for ${demo.label}`);
  }
}

async function auditDemo(demo) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: demo.email,
    password: demo.password,
  });
  if (signInError) {
    return { demo: demo.label, error: `auth failed: ${signInError.message}` };
  }

  const userId = signInData.user?.id;
  if (!userId) {
    return { demo: demo.label, error: 'no user id after sign in' };
  }

  const { data: pref, error: prefError } = await client
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', userId)
    .single();
  if (prefError || !pref?.active_company_id) {
    return { demo: demo.label, error: `active company missing: ${prefError?.message || 'N/A'}` };
  }

  const companyId = pref.active_company_id;

  const [{ count: ticketCount, error: ticketCountError }, { count: slaCount, error: slaCountError }, { data: sampleTickets, error: sampleError }] = await Promise.all([
    client
      .from('crm_support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
    client
      .from('crm_support_sla_policies')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
    client
      .from('crm_support_tickets')
      .select('ticket_number,title,status,priority')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  if (ticketCountError || slaCountError || sampleError) {
    return {
      demo: demo.label,
      companyId,
      error: ticketCountError?.message || slaCountError?.message || sampleError?.message,
    };
  }

  await client.auth.signOut();

  return {
    demo: demo.label,
    companyId,
    ticketCount: ticketCount ?? 0,
    slaCount: slaCount ?? 0,
    sampleTickets: sampleTickets || [],
  };
}

const results = [];
for (const demo of DEMOS) {
  results.push(await auditDemo(demo));
}

console.log(JSON.stringify(results, null, 2));

if (results.some((row) => row.error || !row.ticketCount || !row.slaCount)) {
  process.exitCode = 1;
}
