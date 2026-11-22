// Edge Function: convites e desactivação de contas.
// Única peça que usa a SUPABASE_SERVICE_ROLE_KEY, que existe só no servidor (secrets do Supabase).
// A autorização é verificada com o JWT de quem chama, nunca com dados enviados pelo cliente.
import { createClient } from 'npm:@supabase/supabase-js@2';

type InviteBody = {
  action: 'invite';
  pharmacyId: string;
  email: string;
  displayName: string;
  role: 'manager' | 'stock_operator' | 'viewer' | 'owner';
};
type StatusBody = { action: 'set_active'; pharmacyId: string; memberId: string; isActive: boolean };
type Body = InviteBody | StatusBody;

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
const ROLES = new Set(['owner', 'manager', 'stock_operator', 'viewer']);

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return reply(origin, 405, { error: 'Método não suportado.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Cliente com a identidade de quem chama (RLS activo).
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return reply(origin, 401, { error: 'Sessão inválida.' });
  const callerId = userData.user.id;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return reply(origin, 400, { error: 'Pedido inválido.' });
  }
  if (!body || typeof body.pharmacyId !== 'string' || !UUID.test(body.pharmacyId)) {
    return reply(origin, 400, { error: 'Farmácia inválida.' });
  }

  // Confirmar que quem chama é administradora activa desta farmácia.
  const { data: own, error: ownError } = await caller
    .from('pharmacy_members')
    .select('id')
    .eq('pharmacy_id', body.pharmacyId)
    .eq('user_id', callerId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .maybeSingle();
  if (ownError || !own) return reply(origin, 403, { error: 'Só a administradora pode gerir a equipa.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === 'invite') {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const displayName = String(body.displayName ?? '')
      .trim()
      .slice(0, 120);
    if (!EMAIL.test(email)) return reply(origin, 400, { error: 'Email inválido.' });
    if (displayName.length < 2) return reply(origin, 400, { error: 'Indique o nome do funcionário.' });
    if (!ROLES.has(body.role)) return reply(origin, 400, { error: 'Perfil inválido.' });

    const redirectTo = `${origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]}/definir-palavra-passe`;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo,
    });
    let userId = invited?.user?.id;
    if (inviteError) {
      // Utilizador já existente (ex.: trabalha noutra farmácia): associar sem novo convite.
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!userId)
        return reply(origin, 400, { error: 'Não foi possível enviar o convite. Verifique o email.' });
    }

    const { error: memberError } = await admin.from('pharmacy_members').upsert(
      { pharmacy_id: body.pharmacyId, user_id: userId, role: body.role, is_active: true },
      {
        onConflict: 'pharmacy_id,user_id',
      },
    );
    if (memberError) return reply(origin, 500, { error: 'Não foi possível associar o funcionário.' });

    await admin.from('audit_logs').insert({
      pharmacy_id: body.pharmacyId,
      actor_user_id: callerId,
      action: 'member_invited',
      entity_type: 'pharmacy_members',
      entity_id: userId,
      metadata: { role: body.role },
    });
    return reply(origin, 200, { ok: true });
  }

  if (body.action === 'set_active') {
    if (
      typeof body.memberId !== 'string' ||
      !UUID.test(body.memberId) ||
      typeof body.isActive !== 'boolean'
    ) {
      return reply(origin, 400, { error: 'Pedido inválido.' });
    }
    // A RPC aplica as regras (não alterar o próprio acesso, manter uma administradora) com a identidade de quem chama.
    const { data: member, error } = await caller.rpc('update_member', {
      p_pharmacy_id: body.pharmacyId,
      p_member_id: body.memberId,
      p_role: null,
      p_is_active: body.isActive,
    });
    if (error) return reply(origin, 400, { error: error.message });

    // Bloquear o início de sessão se o utilizador ficar sem nenhuma farmácia activa; desbloquear ao reactivar.
    const { count } = await admin
      .from('pharmacy_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', member.user_id)
      .eq('is_active', true);
    // Com o bloqueio, a sessão deixa de ser renovada; o acesso aos dados já foi cortado pelo RLS.
    await admin.auth.admin.updateUserById(member.user_id, {
      ban_duration: (count ?? 0) === 0 ? '876000h' : 'none',
    });
    return reply(origin, 200, { ok: true });
  }

  return reply(origin, 400, { error: 'Acção desconhecida.' });
});
