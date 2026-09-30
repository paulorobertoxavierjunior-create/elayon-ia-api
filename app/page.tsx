'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Inicialização do cliente Supabase com as suas chaves oficiais
const supabaseUrl = 'https://xlktkelumptugiidnecbj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsa3RrZWx1bXRwdWdpZG5lY2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzU4OTgsImV4cCI6MjEwNjM1MTg5OH0.EIn9oiFl7PmhYhaMlvYKljeFVZflRCbxD_HT65-88XM'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function ElayonHome() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [saldoTokens, setSaldoTokens] = useState<number | null>(null)
  const [codigoResgate, setCodigoResgate] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) buscarPerfil(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) buscarPerfil(session.user.id)
      else setSaldoTokens(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const buscarPerfil = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('saldo_tokens')
      .eq('id', userId)
      .single()
    
    if (data) setSaldoTokens(data.saldo_tokens)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setMessage(`Erro no cadastro: ${error.message}`)
    else setMessage('Cadastro realizado! Verifique seu e-mail ou faça login.')
    setLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(`Erro no login: ${error.message}`)
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  // Função para simular o resgate do código no botão [+]
  const handleResgatarCodigo = async () => {
    if (!codigoResgate) return
    setMessage('Processando código...')
    
    // Busca o código na tabela de recarga
    const { data: codigoData, error: erroBusca } = await supabase
      .from('codigos_recarga')
      .select('*')
      .eq('codigo', codigoResgate)
      .eq('usado', false)
      .single()

    if (erroBusca || !codigoData) {
      setMessage('Código inválido ou já utilizado.')
      return
    }

    // Atualiza o saldo do usuário
    const novoSaldo = (saldoTokens || 0) + codigoData.valor_tokens
    const { error: erroUpdatePerfil } = await supabase
      .from('profiles')
      .update({ saldo_tokens: novoSaldo })
      .eq('id', session.user.id)

    if (erroUpdatePerfil) {
      setMessage('Erro ao atualizar saldo.')
      return
    }

    // Marca o código como usado
    await supabase
      .from('codigos_recarga')
      .update({ usado: true, usado_por: session.user.id })
      .eq('id', codigoData.id)

    setSaldoTokens(novoSaldo)
    setCodigoResgate('')
    setMessage(`Sucesso! Adicionados ${codigoData.valor_tokens} tokens.`)
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', color: '#333' }}>
      <h1>Elayon Space - elayon-ia-api</h1>
      <p>Núcleo de Inteligência Artificial e Gestão de Acessos</p>
      <hr style={{ margin: '1.5rem 0' }} />

      {!session ? (
        <div>
          <h2>Identificação de Acesso</h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              type="email" 
              placeholder="Seu e-mail" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '10px', fontSize: '16px' }}
            />
            <input 
              type="password" 
              placeholder="Sua senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '10px', fontSize: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSignIn} disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Entrar
              </button>
              <button onClick={handleSignUp} disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Cadastrar
              </button>
            </div>
          </form>
          {message && <p style={{ marginTop: '10px', color: 'red' }}>{message}</p>}
        </div>
      ) : (
        <div>
          <h2>Perfil do Usuário</h2>
          <p><strong>E-mail:</strong> {session.user.email}</p>
          <div style={{ background: '#f4f4f4', padding: '15px', borderRadius: '8px', margin: '15px 0' }}>
            <p style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
              <strong>Saldo de Tokens:</strong> {saldoTokens !== null ? saldoTokens : 'Carregando...'}
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Código único de recarga" 
                value={codigoResgate}
                onChange={(e) => setCodigoResgate(e.target.value)}
                style={{ padding: '8px', fontSize: '14px' }}
              />
              <button onClick={handleResgatarCodigo} style={{ padding: '8px 15px', cursor: 'pointer', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>
                +
              </button>
            </div>
          </div>

          {/* Botão de Iniciar Conexão (Conforme alinhado: estático por enquanto) */}
          <div style={{ margin: '20px 0' }}>
            <button disabled style={{ padding: '12px 20px', fontSize: '16px', background: '#ccc', color: '#666', border: 'none', borderRadius: '5px', cursor: 'not-allowed' }}>
              Iniciar Conexão (Aguardando próxima etapa)
            </button>
          </div>

          <button onClick={handleSignOut} style={{ padding: '8px 15px', background: '#d9534f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Sair da Conta
          </button>
          {message && <p style={{ marginTop: '10px', color: 'blue' }}>{message}</p>}
        </div>
      )}
    </main>
  )
}
