import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import TransactionModal from '../components/TransactionModal'
import AIResponseModal from '../components/AIResponseModal'

export default function ChatView() {
  const { fanId } = useParams()
  const { modelId } = useAuth()
  const navigate = useNavigate()
  
  const [fan, setFan] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [message, setMessage] = useState('')
  const [aiResponse, setAiResponse] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)
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
        setShowAIModal(true) // Abrir modal con la respuesta
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

  const handleSaveFromModal = async (editedText) => {
    try {
      // Copiar al portapapeles
      navigator.clipboard.writeText(editedText)
      
      // Guardar mensaje del fan
      await supabase.from('chat').insert({
        fan_id: fanId,
        model_id: modelId,
        sender: 'fan',
        message: message
      })
      
      // Guardar respuesta del modelo (editada)
      await supabase.from('chat').insert({
        fan_id: fanId,
        model_id: modelId,
        sender: 'chatter',
        message: editedText
      })
      
      // Actualizar historial
      loadChatHistory()
      
      // Limpiar y cerrar
      setMessage('')
      setAiResponse(null)
      setShowAIModal(false)
      
      alert('✅ Chat saved and copied to clipboard!')
    } catch (error) {
      console.error('Error saving chat:', error)
      alert('Error saving chat: ' + error.message)
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
        setShowAIModal(true)
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
        setShowAIModal(true)
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

  return (
    <>
      <Navbar />
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        
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
              <button
                onClick={() => setShowTransactionModal(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-xl text-white py-3 px-6 rounded-lg font-semibold transition-all"
              >
                💰 Register Transaction
              </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* COLUMNA IZQUIERDA - Chat History */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>💬</span> Recent Conversation
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No messages yet</p>
                ) : (
                  chatHistory.slice(-20).map((msg, idx) => {
                    // Mensaje de transacción (tip)
                    if (msg.message_type === 'tip') {
                      try {
                        const tipData = JSON.parse(msg.message || '{}')
                        return (
                          <div
                            key={idx}
                            className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">💰</span>
                              <div>
                                <div className="font-semibold text-green-800">
                                  Tip Received: ${tipData.amount}
                                </div>
                                <div className="text-xs text-green-600">
                                  {new Date(msg.timestamp || msg.ts).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      } catch (e) {
                        return null
                      }
                    }
                    
                    // Mensaje de transacción (compra)
                    if (msg.message_type === 'purchase') {
                      try {
                        const purchaseData = JSON.parse(msg.message || '{}')
                        return (
                          <div
                            key={idx}
                            className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">📦</span>
                              <div>
                                <div className="font-semibold text-blue-800">
                                  Content Unlocked: {purchaseData.content_title}
                                </div>
                                <div className="text-sm text-blue-600">
                                  ${purchaseData.amount}
                                </div>
                                <div className="text-xs text-blue-500">
                                  {new Date(msg.timestamp || msg.ts).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      } catch (e) {
                        return null
                      }
                    }
                    
                    // Mensaje normal (texto)
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${
                          msg.sender === 'fan' || msg.from === 'fan'
                            ? 'bg-gray-50 border-gray-400' 
                            : 'bg-blue-50 border-blue-500'
                        }`}
                      >
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                          {(msg.sender === 'fan' || msg.from === 'fan') ? '👤 Fan' : '💎 Model'}
                        </div>
                        <div className="text-sm text-gray-800">
                          {msg.message}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(msg.ts || msg.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA - AI Chat Generator */}
          <div className="space-y-6">
            
            {/* Input area */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>🤖</span> AI Chat Generator
              </h3>
              
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter fan's message here..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none mb-4"
              />
              
              {/* Botones AI */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !message.trim()}
                  className="col-span-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg text-white py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? '🤖 Generating...' : '🤖 Generate Response'}
                </button>
                
                <button
                  onClick={handleReactivate}
                  disabled={generating}
                  className="bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                >
                  🔄 Reactivate
                </button>
                <button
                  onClick={handleOfferCustom}
                  disabled={generating}
                  className="col-span-2 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
                >
                  🎨 Offer Custom Content
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Response Modal */}
      <AIResponseModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        aiResponse={aiResponse}
        onSave={handleSaveFromModal}
      />

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
