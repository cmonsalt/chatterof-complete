import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function ChatView() {
  const { fanId } = useParams()
  const { modelId } = useAuth()
  const navigate = useNavigate()
  
  const [fan, setFan] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [message, setMessage] = useState('')
  const [aiResponse, setAiResponse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadFanData()
    loadChatHistory()
  }, [fanId])

  const loadFanData = async () => {
    try {
      const { data, error } = await supabase
        .from('fans')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .single()

      if (error) throw error
      setFan(data)
    } catch (error) {
      console.error('Error loading fan:', error)
      alert('Fan not found')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chat')
        .select('*')
        .eq('fan_id', fanId)
        .order('ts', { ascending: true })

      if (error) throw error
      setChatHistory(data || [])
    } catch (error) {
      console.error('Error loading chat:', error)
    }
  }

  const handleGenerate = async () => {
    if (!message.trim()) {
      alert('Please enter a message')
      return
    }

    setGenerating(true)
    setAiResponse(null)

    try {
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          message: message.trim()
        }
      })

      if (error) throw error

      if (data.success) {
        setAiResponse(data.response)
        loadChatHistory()
      } else {
        throw new Error(data.error || 'Failed to generate response')
      }
    } catch (error) {
      console.error('Error generating response:', error)
      alert('Error: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyAndClear = () => {
    if (aiResponse) {
      navigator.clipboard.writeText(aiResponse.texto)
      setMessage('')
      setAiResponse(null)
    }
  }

  const handleReactivate = async () => {
    setGenerating(true)
    setAiResponse(null)

    try {
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          message: 'Hey! How have you been?',
          mode: 'reactivacion'
        }
      })

      if (error) throw error

      if (data.success) {
        setAiResponse(data.response)
        loadChatHistory()
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleOfferCustom = async () => {
    setGenerating(true)
    setAiResponse(null)

    try {
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          message: 'Would you be interested in custom content?',
          mode: 'ofrecer_custom'
        }
      })

      if (error) throw error

      if (data.success) {
        setAiResponse(data.response)
        loadChatHistory()
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      </>
    )
  }

  const getAccionColor = (accion) => {
    switch(accion) {
      case 'SOLO_TEXTO': return '#10b981'
      case 'CONTENIDO_SUGERIDO': return '#f59e0b'
      case 'ENVIAR_DESBLOQUEADO': return '#8b5cf6'
      case 'CUSTOM_REQUEST': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getAccionText = (accion) => {
    switch(accion) {
      case 'SOLO_TEXTO': return '💬 SOLO TEXTO'
      case 'CONTENIDO_SUGERIDO': return '📦 CONTENIDO SUGERIDO'
      case 'ENVIAR_DESBLOQUEADO': return '💰 ENVIAR GRATIS'
      case 'CUSTOM_REQUEST': return '🎨 CUSTOM REQUEST'
      default: return accion
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: '900px' }}>
        {/* Header con info del fan */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                {fan.name || 'Unknown'}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {fan.fan_id}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
                  ${fan.spent_total || 0}
                </div>
                <span className={`badge badge-${fan.tier.toLowerCase()}`}>
                  {fan.tier}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={handleReactivate}
            disabled={generating}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#8b5cf6',
              color: 'white',
              borderRadius: '0.375rem',
              fontWeight: 500
            }}
          >
            🔄 Reactivate Fan
          </button>
          <button
            onClick={handleOfferCustom}
            disabled={generating}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#f59e0b',
              color: 'white',
              borderRadius: '0.375rem',
              fontWeight: 500
            }}
          >
            🎨 Offer Custom
          </button>
        </div>

        {/* Chat History */}
        <div className="card" style={{ marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#6b7280' }}>
            Recent Conversation
          </h3>
          {chatHistory.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No messages yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {chatHistory.slice(-10).map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.75rem',
                    background: msg.sender === 'fan' ? '#f3f4f6' : '#dbeafe',
                    borderRadius: '0.375rem',
                    borderLeft: `3px solid ${msg.sender === 'fan' ? '#6b7280' : '#3b82f6'}`
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', color: '#6b7280' }}>
                    {msg.sender === 'fan' ? 'Fan' : 'Model'}
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Fan's New Message
          </h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter fan's message here..."
            rows={4}
            style={{
              marginBottom: '1rem',
              resize: 'vertical'
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !message.trim()}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              fontWeight: 500,
              fontSize: '1rem'
            }}
          >
            {generating ? '🤖 Generating...' : '🤖 Generate AI Response'}
          </button>
        </div>

        {/* AI Response */}
        {aiResponse && (
          <div className="card" style={{ 
            marginBottom: '1.5rem',
            border: `2px solid ${getAccionColor(aiResponse.accion)}`
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                AI Response
              </h3>
              <span style={{
                padding: '0.25rem 0.75rem',
                background: getAccionColor(aiResponse.accion),
                color: 'white',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {getAccionText(aiResponse.accion)}
              </span>
            </div>

            {/* Response text */}
            <div style={{
              padding: '1rem',
              background: '#f9fafb',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '1rem',
              lineHeight: '1.5'
            }}>
              {aiResponse.texto}
            </div>

            {/* Instructions */}
            {aiResponse.instrucciones_chatter && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📋 Instructions:</div>
                {aiResponse.instrucciones_chatter}
              </div>
            )}

            {/* Suggested content */}
            {aiResponse.contenido_sugerido && (
              <div style={{
                padding: '1rem',
                background: '#fef3c7',
                borderRadius: '0.375rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  📦 Suggested Content:
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  <div><strong>ID:</strong> {aiResponse.contenido_sugerido.offer_id}</div>
                  <div><strong>Title:</strong> {aiResponse.contenido_sugerido.title}</div>
                  <div><strong>Price:</strong> ${aiResponse.contenido_sugerido.price}</div>
                  <div><strong>Description:</strong> {aiResponse.contenido_sugerido.description}</div>
                </div>
              </div>
            )}

            {/* Context */}
            {aiResponse.contexto && (
              <div style={{
                padding: '1rem',
                background: '#f3f4f6',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>ℹ️ Context:</div>
                <div>Tier: {aiResponse.contexto.fan_tier}</div>
                <div>Total Spent: ${aiResponse.contexto.spent_total}</div>
                <div>Messages this session: {aiResponse.contexto.mensajes_sesion}</div>
                {aiResponse.contexto.recent_tip && (
                  <div style={{ color: '#059669', fontWeight: 600 }}>
                    💰 Recent tip: ${aiResponse.contexto.recent_tip.amount} ({aiResponse.contexto.recent_tip.minutes_ago} min ago)
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleCopyAndClear}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '0.375rem',
                  fontWeight: 500
                }}
              >
                📋 Copy Text & Clear
              </button>
              <button
                onClick={() => setAiResponse(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f3f4f6',
                  borderRadius: '0.375rem',
                  fontWeight: 500
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
