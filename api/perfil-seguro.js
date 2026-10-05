// api/perfil-seguro.js
// Devolve o perfil e o saldo de tokens SOMENTE do usuário autenticado.
// A service_role fica no servidor (Vercel) e nunca vai ao navegador.

const TOKENS_INICIAIS = 100;

async function validarUsuario(supabaseUrl, anonKey, accessToken) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!resp.ok) return null;
  const user = await resp.json();
  return user && user.id ? user : null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[perfil-seguro] Variáveis de ambiente ausentes.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // 1) Exige login: token do usuário no cabeçalho Authorization.
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  try {
    // 2) O Supabase confirma quem é o dono do token.
    const user = await validarUsuario(supabaseUrl, anonKey, match[1]);
    if (!user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const restHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    };

    // 3) Busca APENAS o perfil do próprio usuário.
    const consulta = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,tokens_balance`,
      { headers: restHeaders }
    );
    if (!consulta.ok) {
      console.error('[perfil-seguro] Falha ao consultar profiles:', consulta.status);
      return res.status(500).json({ error: 'Não foi possível carregar o perfil.' });
    }

    let perfil = (await consulta.json())[0];

    // 4) Primeiro acesso (inclui login com Google): cria o perfil com saldo inicial.
    if (!perfil) {
      const meta = user.user_metadata || {};
      const criar = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
        method: 'POST',
        headers: { ...restHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({
          id: user.id,
          full_name: meta.full_name || meta.name || null,
          tokens_balance: TOKENS_INICIAIS
        })
      });
      if (!criar.ok) {
        console.error('[perfil-seguro] Falha ao criar profile:', criar.status);
        return res.status(500).json({ error: 'Não foi possível criar o perfil.' });
      }
      perfil = (await criar.json())[0];
    }

    // 5) Resposta mínima, só do próprio usuário.
    return res.status(200).json({
      id: user.id,
      email: user.email,
      nome: perfil.full_name || 'Usuário Elayon',
      tokens: perfil.tokens_balance ?? 0
    });
  } catch (err) {
    console.error('[perfil-seguro] Erro inesperado:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};