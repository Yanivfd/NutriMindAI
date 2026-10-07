import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.slice('Bearer '.length)
  );
  if (userError || !userData.user) return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  const userId = userData.user.id;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  // Error logs use ON DELETE SET NULL; wipe them so nothing remains linked to the user.
  const { error: logsError } = await admin.from('app_error_logs').delete().eq('user_id', userId);
  if (logsError) {
    console.error('app_error_logs delete failed', logsError.code);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }

  // Cascades profiles → weekly_plans, weight_logs, cheat_logs, meal_logs.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('auth deleteUser failed', deleteError.message);
    return jsonResponse({ error: 'INTERNAL' }, 500);
  }

  return jsonResponse({ ok: true });
});
