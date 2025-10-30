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
  const [showMarkSaleModal, setShowMarkSaleModal] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [selectedContent, setSelectedContent] = useState(null)

  const chatEndRef = useRef(null)

  useEffect(() => {
    loadFanData()
    loadChatHistory()
    loadCatalog()
    
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

  const loadCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('nivel', { ascending: true })

      if (error) throw error
      setCatalog(data || [])
    } catch (error) {
      console.error('Error loading catalog:', error)
    }
  }

  const handleMarkSale = (msg) => {
    setSelectedMessage(msg)
    setShowMarkSaleModal(true)
  }

  const handleCreateNotification = async () => {
    if (!selectedContent) {
      alert('Please select content')
      return
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          model_id: modelId,
          fan_id: fanId,
          fan_name: fan.name || 'Unknown',
          type: 'OFERTA_ACEPTADA',
          message: `${fan.name} accepted offer: ${selectedContent.title}`,
          action_data: {
            offer_id: selectedContent.offer_id,
            title: selectedContent.title,
            price: selectedContent.base_price,
            description: selectedContent.description
          }
        })

      if (error) throw error

      alert('✅ Notification created!')
      setShowMarkSaleModal(false)
      setSelectedContent(null)
    } catch (error) {
      alert('Error: ' + error.message)
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
        
        // Check for detected info
        if (data.response.fan_info_detected) {
          const hasNewInfo = Object.values(data.response.fan_info_detected).some(v => v !== null && v !== undefined && v !== '')
          
          if (hasNewInfo) {
            setDetectedInfo(data.response.fan_info_detected)
            setShowUpdateBanner(true)
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

  const handleUpdateFanProfile = async () => {
    if (!detectedInfo) return

    try {
      const updates = {}
      if (detectedInfo.name) updates.name = detectedInfo.name
      if (detectedInfo.age) updates.age = detectedInfo.age
      if (detectedInfo.location) updates.location = detectedInfo.location
      if (detectedInfo.occupation) updates.occupation = detectedInfo.occupation
      if (detectedInfo.interests) updates.interests = detectedInfo.interests

      await supabase
        .from('fans')
        .update(updates)
        .eq('fan_id', fanId)
        .eq('model_id', modelId)

      setShowUpdateBanner(false)
      setDetectedInfo(null)
      loadFanData()
      alert('✅ Fan profile updated!')
    } catch (error) {
      console.error('Error updating fan:', error)
      alert('Error updating profile')
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
          {showUpdateBanner && detectedInfo && (
            <div className="bg-gradient-to-r from-green-400 to-emerald-500 border-4 border-green-600 p-6 mb-6 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-bold text-xl flex items-center gap-3 mb-3">
                    <span className="text-3xl">🎉</span> 
                    <span>New Fan Information Detected!</span>
                  </h3>
                  
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 space-y-2">
                    {detectedInfo.name && (
                      <div className="text-white font-bold flex items-center gap-2">
                        <span>👤 Name:</span>
                        <span className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full">{detectedInfo.name}</span>
                      </div>
                    )}
                    {detectedInfo.age && (
                      <div className="text-white font-semibold flex items-center gap-2">
                        <span>🎂 Age:</span>
                        <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.age}</span>
                      </div>
                    )}
                    {detectedInfo.location && (
                      <div className="text-white font-semibold flex items-center gap-2">
                        <span>📍 Location:</span>
                        <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.location}</span>
                      </div>
                    )}
                    {detectedInfo.occupation && (
                      <div className="text-white font-semibold flex items-center gap-2">
                        <span>💼 Occupation:</span>
                        <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.occupation}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 ml-6">
                  <button
                    onClick={handleUpdateFanProfile}
                    className="bg-white hover:bg-green-50 text-green-700 py-4 px-8 rounded-xl font-bold text-lg shadow-lg"
                  >
                    ✅ Update Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUpdateBanner(false)
                      setDetectedInfo(null)
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white py-2 px-8 rounded-xl font-semibold"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

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
                  chatHistory.map((msg, idx) => (
                    <div key={idx}>
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
                      
                      {/* Quick Action Buttons for Fan Messages */}
                      {msg.from === 'fan' && (
                        <div className="ml-8 mt-2 flex gap-2">
                          <button
                            onClick={() => handleMarkSale(msg)}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg font-semibold transition-all"
                          >
                            ✅ Mark Sale
                          </button>
                          <button
                            onClick={() => setShowTransactionModal(true)}
                            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg font-semibold transition-all"
                          >
                            💰 Payment
                          </button>
                        </div>
                      )}
                    </div>
                  ))
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

      {/* Mark Sale Modal */}
      {showMarkSaleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-800">✅ Mark as Sale</h2>
              <button 
                onClick={() => setShowMarkSaleModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="font-semibold text-blue-800 mb-2">Fan's Message:</div>
                <div className="text-blue-700">{selectedMessage?.message}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Content that Fan Accepted:
                </label>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {catalog.map((item) => (
                    <button
                      key={item.offer_id}
                      onClick={() => setSelectedContent(item)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedContent?.offer_id === item.offer_id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-800">{item.title}</div>
                          <div className="text-sm text-gray-600 mt-1">{item.description}</div>
                          <div className="text-xs text-gray-500 mt-2">
                            Level {item.nivel}/3 • ID: {item.offer_id}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          ${item.base_price}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowMarkSaleModal(false)}
                className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all text-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNotification}
                disabled={!selectedContent}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-xl transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ Create Notification
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
