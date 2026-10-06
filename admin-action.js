// api/admin-action.js (Backend na Vercel)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // A chave SUPABASE_SERVICE_ROLE_KEY só existe aqui no servidor da Vercel!
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Exemplo de ação administrativa segura (ex: alterar tokens ou gerir utilizadores)
    if (req.method === 'POST') {
        // Faz a operação sensível aqui...
        return res.status(200).json({ success: true, message: "Ação executada com privilégios de admin no servidor!" });
    }

    return res.status(405).json({ error: 'Método não permitido' });
}
