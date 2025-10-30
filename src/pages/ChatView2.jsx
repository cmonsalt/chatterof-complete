import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import TransactionModal from '../components/TransactionModal'

export default function ChatViewEnhanced() {
  const { fanId } = useParams()
  const { modelId } = useAuth()
  const navigate = useNavigate()
  
  const [fan, setFan] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [message, setMessage] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [detectedInfo, setDetectedInfo] = useState(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)

  const chatEndRef = useRef(null)

  useEffect(() => {
    loadFanData()
    loadChatHistory()
    
    // Auto-refresh chat every 10 seconds
    const interval = setInterval(() => {
      loadChatHistory()
    }, 10000)
    
    return () => clearInterval(interval)
  }, [fanId])

  useEffect(() => {
    // Auto-scroll to bottom
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

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
        .order('timestamp', { ascending: true })

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
    setAiSuggestion(null)

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
        setAiSuggestion(data.response)
        
        // 🔥 AUTO-SAVE detected info silently (no banner)
        if (data.response.detected_info) {
          const detectedData = data.response.detected_info
          
          // Check if ANY of the detected info is actually NEW
          const hasNewInfo = 
            (detectedData.name && detectedData.name !== fan?.name) ||
            (detectedData.location && detectedData.location !== fan?.location) ||
            (detectedData.occupation && detectedData.occupation !== fan?.occupation) ||
            (detectedData.interests && detectedData.interests !== fan?.interests) ||
            (detectedData.birthday && detectedData.birthday !== fan?.birthday) ||
            (detectedData.relationship_status && detectedData.relationship_status !== fan?.relationship_status)
          
          if (hasNewInfo) {
            console.log('🆕 NEW info detected, auto-saving:', detectedData)
            
            // Auto-save to database silently
            const updates = {}
            if (detectedData.name && detectedData.name !== fan?.name) updates.name = detectedData.name
            if (detectedData.location && detectedData.location !== fan?.location) updates.location = detectedData.location
            if (detectedData.occupation && detectedData.occupation !== fan?.occupation) updates.occupation = detectedData.occupation
            if (detectedData.interests && detectedData.interests !== fan?.interests) updates.interests = detectedData.interests
            if (detectedData.birthday && detectedData.birthday !== fan?.birthday) updates.birthday = detectedData.birthday
            if (detectedData.relationship_status && detectedData.relationship_status !== fan?.relationship_status) {
              updates.relationship_status = detectedData.relationship_status
            }
            
            if (Object.keys(updates).length > 0) {
              supabase
                .from('fans')
                .update(updates)
                .eq('fan_id', fanId)
                .eq('model_id', modelId)
                .then(({ error }) => {
                  if (error) {
                    console.error('Error auto-saving fan info:', error)
                  } else {
                    console.log('✅ Fan info auto-saved:', updates)
                    // Reload fan data to reflect changes
                    loadFanData()
                  }
                })
            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating:', error)
      alert('Error generating response: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSendResponse = async (responseText) => {
    if (!responseText?.trim()) return

    setSending(true)
    try {
      // Save fan message first
      await supabase.from('chat').insert({
        fan_id: fanId,
        from: 'fan',
        message: message.trim(),
        timestamp: new Date().toISOString()
      })

      // Save model response
      await supabase.from('chat').insert({
        fan_id: fanId,
        from: 'model',
        message: responseText.trim(),
        timestamp: new Date().toISOString()
      })

      // Update fan's last message date
      await supabase
        .from('fans')
        .update({ last_message_date: new Date().toISOString() })
        .eq('fan_id', fanId)
        .eq('model_id', modelId)

      // Clear form and reload
      setMessage('')
      setAiSuggestion(null)
      loadChatHistory()
    } catch (error) {
      console.error('Error sending:', error)
      alert('Error sending message')
    } finally {
      setSending(false)
    }
  }


  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin text-6xl mb-4">⚙️</div>
            <p className="text-gray-600">Loading chat...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          
          {/* Fan Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {fan.name || 'Unknown Fan'}
                </h1>
                <p className="text-gray-500 text-sm">
                  {fan.fan_id}
                </p>
                <div className="flex flex-wrap gap-3 text-sm mt-2">
                  {fan.age && (
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                      👤 {fan.age} years old
                    </span>
                  )}
                  {fan.location && (
                    <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                      📍 {fan.location}
                    </span>
                  )}
                  {fan.occupation && (
                    <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                      💼 {fan.occupation}
                    </span>
                  )}
                  {fan.interests && (
                    <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full">
                      ⭐ {fan.interests}
                    </span>
                  )}
                </div>
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

          {/* Update Banner */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Left: Chat History */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>💬</span> Conversation History
              </h3>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {chatHistory.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No messages yet</p>
                ) : (
                  chatHistory.map((msg, idx) => {
                    // Detectar si es un JSON de transacción
                    let isTransaction = false;
                    let transactionData = null;
                    
                    try {
                      if (msg.message.trim().startsWith('{') && msg.message.includes('type')) {
                        transactionData = JSON.parse(msg.message);
                        isTransaction = true;
                      }
                    } catch (e) {
                      // No es JSON válido
                    }

                    return (
                      <div key={idx}>
                        {isTransaction && transactionData ? (
                          // Render transaction card
                          <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 mr-8">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-sm text-green-700">
                                {transactionData.type === 'purchase' ? '🛍️ Purchase' : '💰 Tip'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {transactionData.type === 'purchase' ? (
                              <div className="bg-white/60 rounded-lg p-3 mt-2">
                                <div className="font-semibold text-gray-800">
                                  {transactionData.content_title}
                                </div>
                                <div className="text-2xl font-bold text-green-600 mt-1">
                                  ${transactionData.amount}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  ID: {transactionData.offer_id}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white/60 rounded-lg p-3 mt-2">
                                <div className="text-2xl font-bold text-green-600">
                                  ${transactionData.amount}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Render normal message
                          <div
                            className={`p-4 rounded-lg ${
                              msg.from === 'fan'
                                ? 'bg-gray-100 ml-8'
                                : 'bg-blue-50 mr-8'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-sm">
                                {msg.from === 'fan' ? '👤 Fan' : '💎 Model'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Right: AI Response Generator */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>🤖</span> AI Response Generator
              </h3>

              {/* Fan Message Input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2 text-gray-700">
                  👤 Fan's New Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type what the fan said..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  rows="3"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!message.trim() || generating}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl transition-all mb-4"
              >
                {generating ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙️</span>
                    Generating...
                  </>
                ) : (
                  <>🤖 Generate AI Response</>
                )}
              </button>

              {/* AI Suggestion Box */}
              {aiSuggestion && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl p-6 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-lg text-purple-700">🤖 AI Suggestion:</span>
                    <button
                      onClick={() => setAiSuggestion(null)}
                      className="text-gray-500 hover:text-gray-700 text-xl"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Response Text */}
                  <div className="bg-white rounded-lg p-4 mb-4 border-2 border-purple-200">
                    <p className="text-gray-800">{aiSuggestion.texto}</p>
                  </div>

                  {/* Content Suggestion */}
                  {aiSuggestion.content_to_offer && (
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
                      <div className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                        <span>💰</span> Suggested Content to Offer
                      </div>
                      <div className="text-sm text-yellow-900">
                        <div><strong>{aiSuggestion.content_to_offer.titulo}</strong></div>
                        <div>${aiSuggestion.content_to_offer.precio} - {aiSuggestion.content_to_offer.descripcion}</div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleSendResponse(aiSuggestion.texto)}
                      disabled={sending}
                      className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-bold disabled:opacity-50 transition-all"
                    >
                      ✅ Send
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-bold disabled:opacity-50 transition-all"
                    >
                      🔄 Regenerate
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiSuggestion.texto)
                        alert('✅ Copied to clipboard!')
                      }}
                      className="bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-bold transition-all"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Helper Text */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">💡 How to use:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Enter the fan's message above</li>
                  <li>Click "Generate AI Response"</li>
                  <li>Review the suggestion</li>
                  <li>Send as-is, regenerate, or copy to edit</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
       <TransactionModal
  isOpen={showTransactionModal}
  onClose={() => setShowTransactionModal(false)}
  fanId={fanId}
  modelId={modelId}
  fanTier={fan?.tier || 'FREE'}
  onSuccess={loadFanData}
/>
      )}
    </>
  )
}
