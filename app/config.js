export default function handler(req, res) {
    // Configura os cabeçalhos para permitir requisições seguras
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ 
            error: 'Variáveis de ambiente do Supabase não configuradas na Vercel.' 
        });
    }

    return res.status(200).json({
        supabaseUrl,
        supabaseAnonKey
    });
}
