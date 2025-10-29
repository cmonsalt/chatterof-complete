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
  const [detectedInfo, setDetectedInfo] = useState(null)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)

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
    setAiResponse(null)
    setDetectedInfo(null)
    setShowUpdateBanner(false)

    try {
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          message: message.trim()
        }
      })

      if (error) throw error

      console.log('🔍 AI Response:', data)

      if (data.success) {
        setAiResponse(data.response)
        
        // 🔥 Check if fan info was detected AND if it's NEW info
        if (data.response.fan_info_detected) {
          console.log('✅ Fan info detected:', data.response.fan_info_detected)
          
          // Check if ANY of the detected info is actually NEW (different from current fan data)
          const detectedData = data.response.fan_info_detected
          const hasNewInfo = 
            (detectedData.name && detectedData.name !== fan.name) ||
            (detectedData.age && detectedData.age !== fan.age) ||
            (detectedData.location && detectedData.location !== fan.location) ||
            (detectedData.occupation && detectedData.occupation !== fan.occupation) ||
            (detectedData.interests && detectedData.interests !== fan.interests)
          
          if (hasNewInfo) {
            console.log('🆕 NEW info detected - showing banner')
            setDetectedInfo(data.response.fan_info_detected)
            setShowUpdateBanner(true)
          } else {
            console.log('ℹ️ Info detected but not new - skipping banner')
          }
        }
        
        setShowAIModal(true)
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

  // Handle updating fan profile with detected info (INCLUDING NAME)
  const handleUpdateFanProfile = async () => {
    if (!detectedInfo) return

    try {
      const updates = {}
      
      // 🆕 NAME is now included!
      if (detectedInfo.name) updates.name = detectedInfo.name
      if (detectedInfo.age) updates.age = detectedInfo.age
      if (detectedInfo.location) updates.location = detectedInfo.location
      if (detectedInfo.occupation) updates.occupation = detectedInfo.occupation
      if (detectedInfo.interests) updates.interests = detectedInfo.interests

      if (Object.keys(updates).length === 0) {
        alert('No new information to update')
        return
      }

      const { error } = await supabase
        .from('fans')
        .update(updates)
        .eq('fan_id', fanId)
        .eq('model_id', modelId)

      if (error) throw error

      alert('✅ Fan profile updated successfully!')
      
      // 🔥 CRITICAL: Clear everything after updating
      setDetectedInfo(null)
      setShowUpdateBanner(false)
      
      // Reload fan data to show updated info
      await loadFanData()
    } catch (error) {
      console.error('Error updating fan profile:', error)
      alert('Error: ' + error.message)
    }
  }

  const handleSaveFromModal = async (editedText) => {
    try {
      navigator.clipboard.writeText(editedText)
      
      await supabase.from('chat').insert({
        fan_id: fanId,
        model_id: modelId,
        from: 'fan',
        message: message,
        message_type: 'text',
        timestamp: new Date().toISOString()
      })
      
      await supabase.from('chat').insert({
        fan_id: fanId,
        model_id: modelId,
        from: 'chatter',
        message: editedText,
        message_type: 'text',
        timestamp: new Date().toISOString()
      })
      
      loadChatHistory()
      
      // 🔥 CRITICAL: Clear EVERYTHING when saving
      setMessage('')
      setAiResponse(null)
      setShowAIModal(false)
      setDetectedInfo(null) // Clear detected info
      setShowUpdateBanner(false) // Hide banner
      
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
              <p className="text-sm text-gray-500 mb-2">
                {fan.fan_id}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
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

        {/* 🆕 PROMINENT Alert banner - SHOWS NAME PROMINENTLY */}
        {showUpdateBanner && detectedInfo && (
          <div className="bg-gradient-to-r from-green-400 to-emerald-500 border-4 border-green-600 p-6 mb-6 rounded-xl shadow-2xl animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {/* 🆕 NAME gets SPECIAL TREATMENT if detected */}
                {detectedInfo.name ? (
                  <h3 className="text-white font-bold text-2xl flex items-center gap-3 mb-3">
                    <span className="text-4xl">🎉</span> 
                    <span>Fan Name Detected: "{detectedInfo.name}"</span>
                  </h3>
                ) : (
                  <h3 className="text-white font-bold text-xl flex items-center gap-3 mb-3">
                    <span className="text-3xl">🎉</span> 
                    <span>New Fan Information Detected!</span>
                  </h3>
                )}
                
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 space-y-2">
                  {detectedInfo.name && (
                    <div className="text-white font-bold text-lg flex items-center gap-2 bg-white/30 p-3 rounded-lg">
                      <span className="text-2xl">👤</span> 
                      Name: <span className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-xl">{detectedInfo.name}</span>
                    </div>
                  )}
                  {detectedInfo.age && (
                    <div className="text-white font-semibold flex items-center gap-2">
                      <span>🎂</span> Age: <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.age} years old</span>
                    </div>
                  )}
                  {detectedInfo.location && (
                    <div className="text-white font-semibold flex items-center gap-2">
                      <span>📍</span> Location: <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.location}</span>
                    </div>
                  )}
                  {detectedInfo.occupation && (
                    <div className="text-white font-semibold flex items-center gap-2">
                      <span>💼</span> Occupation: <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.occupation}</span>
                    </div>
                  )}
                  {detectedInfo.interests && (
                    <div className="text-white font-semibold flex items-center gap-2">
                      <span>⭐</span> Interests: <span className="bg-white/30 px-3 py-1 rounded-full">{detectedInfo.interests}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 ml-6">
                <button
                  onClick={handleUpdateFanProfile}
                  className="bg-white hover:bg-green-50 text-green-700 py-4 px-8 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                >
                  <span className="text-2xl">✅</span>
                  {detectedInfo.name ? 'Update Name & Profile' : 'Update Profile'}
                </button>
                <button
                  onClick={() => {
                    setShowUpdateBanner(false)
                    setDetectedInfo(null)
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white py-2 px-8 rounded-xl font-semibold transition-all"
                >
                  ✕ Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

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
                    if (msg.message_type === 'tip') {
                      try {
                        const tipData = JSON.parse(msg.message || '{}')
                        return (
                          <div key={idx} className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
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
                    
                    if (msg.message_type === 'purchase') {
                      try {
                        const purchaseData = JSON.parse(msg.message || '{}')
                        return (
                          <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
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

      <AIResponseModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        aiResponse={aiResponse}
        onSave={handleSaveFromModal}
      />

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
