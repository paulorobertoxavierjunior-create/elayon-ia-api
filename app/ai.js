export default function handler(req, res) {
  res.status(200).json({ 
    status: "online", 
    message: "Elayon Space AI Gateway ativo com sucesso.",
    timestamp: new Date().toISOString()
  });
}
