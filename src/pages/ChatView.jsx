import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import TransactionModal from '../components/TransactionModal'

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
  const [showTransactionModal, setShowTransactionModal] = useState(false)

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
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </>
    )
  }

  const getAccionColor = (accion) => {
    switch(accion) {
      case 'SOLO_TEXTO': return 'bg-green-500'
      case 'CONTENIDO_SUGERIDO': return 'bg-amber-500'
      case 'ENVIAR_DESBLOQUEADO': return 'bg-purple-500'
      case 'CUSTOM_REQUEST': return 'bg-red-500'
      default: return 'bg-gray-500'
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
      <div className="max-w-5xl mx-auto p-4 lg:p-6">
        {/* Header con info del fan */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {fan.name || 'Unknown'}
              </h2>
              <p className="text-sm text-gray-500">
                {fan.fan_id}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  ${fan.spent_total || 0}
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  fan.tier === 'WHALE' ? 'bg-purple-100 text-purple-800' :
                  fan.tier === 'VIP' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {fan.tier}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción rápida */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button
            onClick={handleReactivate}
            disabled={generating}
            className="bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Reactivate
          </button>
          <button
            onClick={handleOfferCustom}
            disabled={generating}
            className="bg-amber-600 hover:bg-amber-700 text-white py-3 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎨 Offer Custom
          </button>
          <button
            onClick={() => setShowTransactionModal(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg text-white py-3 px-4 rounded-lg font-semibold transition-all col-span-2"
          >
            💰 Register Transaction
          </button>
        </div>

        {/* Chat History */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 max-h-80 overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Recent Conversation
          </h3>
          {chatHistory.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No messages yet</p>
          ) : (
            <div className="space-y-3">
              {chatHistory.slice(-10).map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    msg.sender === 'fan' 
                      ? 'bg-gray-50 border-gray-400' 
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-500 mb-1">
                    {msg.sender === 'fan' ? 'Fan' : 'Model'}
                  </div>
                  <div className="text-sm text-gray-800">
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Fan's New Message
          </h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter fan's message here..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none mb-4"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !message.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg text-white py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? '🤖 Generating...' : '🤖 Generate AI Response'}
          </button>
        </div>

        {/* AI Response */}
        {aiResponse && (
          <div className={`bg-white rounded-xl shadow-lg p-6 border-2 ${getAccionColor(aiResponse.accion)} border-opacity-50`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                AI Response
              </h3>
              <span className={`${getAccionColor(aiResponse.accion)} text-white px-4 py-2 rounded-lg text-sm font-semibold`}>
                {getAccionText(aiResponse.accion)}
              </span>
            </div>

            {/* Response text */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-lg leading-relaxed">
              {aiResponse.texto}
            </div>

            {/* Instructions */}
            {aiResponse.instrucciones_chatter && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                <div className="font-semibold text-blue-800 mb-2">📋 Instructions:</div>
                <div className="text-blue-700">{aiResponse.instrucciones_chatter}</div>
              </div>
            )}

            {/* Suggested content */}
            {aiResponse.contenido_sugerido && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
                <div className="font-semibold text-amber-800 mb-2">
                  📦 Suggested Content:
                </div>
                <div className="text-sm text-amber-700 space-y-1">
                  <div><strong>ID:</strong> {aiResponse.contenido_sugerido.offer_id}</div>
                  <div><strong>Title:</strong> {aiResponse.contenido_sugerido.title}</div>
                  <div><strong>Price:</strong> ${aiResponse.contenido_sugerido.price}</div>
                  <div><strong>Description:</strong> {aiResponse.contenido_sugerido.description}</div>
                </div>
              </div>
            )}

            {/* Context */}
            {aiResponse.contexto && (
              <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-700 mb-4 space-y-1">
                <div className="font-semibold text-gray-800 mb-2">ℹ️ Context:</div>
                <div>Tier: {aiResponse.contexto.fan_tier}</div>
                <div>Total Spent: ${aiResponse.contexto.spent_total}</div>
                <div>Messages this session: {aiResponse.contexto.mensajes_sesion}</div>
                {aiResponse.contexto.recent_tip && (
                  <div className="text-green-600 font-semibold">
                    💰 Recent tip: ${aiResponse.contexto.recent_tip.amount} ({aiResponse.contexto.recent_tip.minutes_ago} min ago)
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCopyAndClear}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-all"
              >
                📋 Copy Text & Clear
              </button>
              <button
                onClick={() => setAiResponse(null)}
                className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold transition-all"
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        fanId={fanId}
        modelId={modelId}
        fanTier={fan?.tier || 'FREE'}
        onSuccess={loadFanData}
      />
    </>
  )
}
