// api/config.js
// Entrega ao front-end SOMENTE a configuração pública do Supabase.
// Nunca inclua service_role ou outros segredos aqui.

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[config] SUPABASE_URL ou SUPABASE_ANON_KEY ausentes na Vercel.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // Mesma origem do site: não precisa de CORS aberto.
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
};