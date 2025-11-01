import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function ChatterDashboard() {
  const { user, modelId, loading } = useAuth()
  const navigate = useNavigate()
  
  const actualModelId = modelId || user?.user_metadata?.model_id
  
  const [activeChats, setActiveChats] = useState([])
  const [selectedFan, setSelectedFan] = useState(null)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Metrics
  const [todayStats, setTodayStats] = useState({
    messagesSent: 0,
    sales: 0,
    revenue: 0,
    activeFans: 0,
    avgResponseTime: 0
  })

  const chatContainerRef = useRef(null)

  // 🎨 Helper: Get Tier Badge with emoji + color
  const getTierBadge = (tier) => {
    const tiers = {
      0: { emoji: '⚪', label: 'New Fan', color: 'bg-gray-100 text-gray-700' },
      1: { emoji: '🟡', label: 'Regular', color: 'bg-yellow-100 text-yellow-700' },
      2: { emoji: '🟢', label: 'VIP', color: 'bg-green-100 text-green-700' },
      3: { emoji: '🟣', label: 'Whale', color: 'bg-purple-100 text-purple-700' }
    }
    return tiers[tier] || tiers[0]
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // No model ID
  if (!actualModelId) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">⚠️ No Model ID Found</h2>
            <p className="text-gray-600 mb-4">Please configure your account first</p>
            <button 
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Go to Settings
            </button>
          </div>
        </div>
      </>
    )
  }

  useEffect(() => {
    if (actualModelId) {
      console.log('🔥 ChatterDashboard loaded with modelId:', actualModelId)
      loadActiveChats()
      loadTodayStats()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(() => {
        loadActiveChats()
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [actualModelId])

  useEffect(() => {
    // Auto-scroll to bottom when chat updates
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [selectedFan?.history])

  const loadActiveChats = async () => {
    try {
      // Get all fans with recent activity (last 7 days) AND that have messages
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: fans } = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', actualModelId)
        .not('last_message_date', 'is', null)
        .gte('last_message_date', sevenDaysAgo.toISOString())
        .order('last_message_date', { ascending: false })

      if (!fans || fans.length === 0) {
        setActiveChats([])
        return
      }

      // Get last message for each fan
      const chatsWithMessages = await Promise.all(
        fans.map(async (fan) => {
          const { data: lastMessage } = await supabase
            .from('chat')
            .select('*')
            .eq('fan_id', fan.fan_id)
            .order('ts', { ascending: false })
            .limit(1)
            .single()

          const { data: history } = await supabase
            .from('chat')
            .select('*')
            .eq('fan_id', fan.fan_id)
            .order('ts', { ascending: true })
            .limit(50)

          // Calculate time since last message
          const lastMsgTime = lastMessage?.ts ? new Date(lastMessage.ts) : null
          const minutesAgo = lastMsgTime ? Math.floor((Date.now() - lastMsgTime.getTime()) / 60000) : null

          return {
            ...fan,
            lastMessage: lastMessage?.message || 'No messages yet',
            lastMessageFrom: lastMessage?.from || null,
            lastMessageTime: lastMsgTime,
            minutesAgo,
            history: history || [],
            needsResponse: lastMessage?.from === 'fan'
          }
        })
      )

      // Filter out fans with no actual messages
      const fansWithMessages = chatsWithMessages.filter(chat => chat.history.length > 0)

      // Sort by priority: needs response first, then by time
      const sorted = fansWithMessages.sort((a, b) => {
        if (a.needsResponse && !b.needsResponse) return -1
        if (!a.needsResponse && b.needsResponse) return 1
        return (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0)
      })

      setActiveChats(sorted)

      // Update selected fan if exists
      if (selectedFan) {
        const updated = sorted.find(f => f.fan_id === selectedFan.fan_id)
        if (updated) setSelectedFan(updated)
      }
    } catch (error) {
      console.error('Error loading chats:', error)
    }
  }

  const loadTodayStats = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Messages sent today
      const { data: messages } = await supabase
        .from('chat')
        .select('*')
        .eq('from', 'model')
        .gte('ts', today.toISOString())

      // Sales today
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('model_id', actualModelId)
        .gte('ts', today.toISOString())

      const sales = transactions?.filter(t => t.type === 'compra') || []
      const revenue = sales.reduce((sum, t) => sum + (t.amount || 0), 0)

      setTodayStats({
        messagesSent: messages?.length || 0,
        sales: sales.length,
        revenue,
        activeFans: activeChats.filter(c => c.needsResponse).length,
        avgResponseTime: 0 // TODO: Calculate
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleGenerateAI = async () => {
    if (!selectedFan) return

    setGenerating(true)
    try {
      // Get the last fan message for context
      const lastFanMessage = selectedFan.history
        ?.filter(m => m.from === 'fan')
        ?.slice(-1)[0]?.message || ''

      console.log('🤖 Generating AI for fan:', selectedFan.fan_id)
      console.log('📩 Last fan message:', lastFanMessage)

      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: actualModelId,
          fan_id: selectedFan.fan_id,
          message: lastFanMessage
        }
      })

      console.log('✅ AI Response:', data)
      console.log('📝 AI Response KEYS:', data ? Object.keys(data) : 'no data')
      console.log('📝 AI Response.response.texto:', data?.response?.texto)
      console.log('📝 Full JSON:', JSON.stringify(data, null, 2))
      console.log('❌ AI Error:', error)

      if (error) throw error

      // ✅ Guardar data.response, no data directamente
      setAiSuggestion(data.response)
    } catch (error) {
      console.error('❌ Error generating AI:', error)
      alert('Error generating AI response: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSendMessage = async (messageText) => {
    if (!messageText.trim() || !selectedFan) return

    setSending(true)
    try {
      const { error } = await supabase
        .from('chat')
        .insert({
          fan_id: selectedFan.fan_id,
          model_id: actualModelId,
          from: 'model',
          message: messageText,
          message_type: 'text',
          ts: new Date().toISOString(),
          source: 'manual'
        })

      if (error) throw error

      // Clear AI suggestion
      setAiSuggestion(null)

      // Reload chats
      await loadActiveChats()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Error sending message')
    } finally {
      setSending(false)
    }
  }

  const getStatusColor = (chat) => {
    if (chat.needsResponse) return 'bg-red-500'
    if (chat.minutesAgo < 60) return 'bg-green-500'
    return 'bg-gray-400'
  }

  const getTimeText = (chat) => {
    if (!chat.minutesAgo) return 'Unknown'
    if (chat.minutesAgo < 60) return `${chat.minutesAgo}m ago`
    const hours = Math.floor(chat.minutesAgo / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const filteredChats = activeChats.filter(chat =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.of_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.fan_id?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <p className="text-sm text-gray-600 font-semibold">Messages Today</p>
              <p className="text-3xl font-bold text-blue-600">{todayStats.messagesSent}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <p className="text-sm text-gray-600 font-semibold">Sales Today</p>
              <p className="text-3xl font-bold text-green-600">{todayStats.sales}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <p className="text-sm text-gray-600 font-semibold">Revenue Today</p>
              <p className="text-3xl font-bold text-green-600">${todayStats.revenue}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <p className="text-sm text-gray-600 font-semibold">Active Chats</p>
              <p className="text-3xl font-bold text-orange-600">{todayStats.activeFans}</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4">
              <p className="text-sm text-gray-600 font-semibold">Avg Response</p>
              <p className="text-3xl font-bold text-purple-600">{todayStats.avgResponseTime}m</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: Fan List */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search fans..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {filteredChats.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-gray-500 font-semibold">No active chats</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {searchQuery 
                        ? 'No fans match your search' 
                        : 'Start a conversation with a fan from the Dashboard'}
                    </p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const tierBadge = getTierBadge(chat.tier || 0)
                    return (
                      <div
                        key={chat.fan_id}
                        onClick={() => setSelectedFan(chat)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedFan?.fan_id === chat.fan_id
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(chat)}`}></div>
                            <span className="font-semibold text-sm">{chat.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">{getTimeText(chat)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${tierBadge.color}`}>
                            {tierBadge.emoji} {tierBadge.label}
                          </span>
                          <span className="font-semibold text-green-600">${chat.spent_total || 0}</span>
                        </div>

                        <div className="text-xs text-gray-600 truncate">
                          {chat.lastMessageFrom === 'fan' && '👤 '}
                          {chat.lastMessageFrom === 'model' && '💎 '}
                          {chat.lastMessage}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Middle: Chat View */}
            <div className="bg-white rounded-xl shadow-lg p-6 col-span-2">
              {selectedFan ? (
                <>
                  {/* Header */}
                  <div className="border-b pb-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold">{selectedFan.name}</h2>
                        <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                          <span>{selectedFan.fan_id}</span>
                          {(() => {
                            const tierBadge = getTierBadge(selectedFan.tier || 0)
                            return (
                              <span className={`px-2 py-0.5 rounded-full font-semibold ${tierBadge.color}`}>
                                {tierBadge.emoji} {tierBadge.label}
                              </span>
                            )
                          })()}
                          <span className="font-semibold text-green-600">${selectedFan.spent_total || 0}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/chat/${selectedFan.fan_id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                      >
                        Open Full View →
                      </button>
                    </div>
                  </div>

                  {/* Chat History */}
                  <div
                    ref={chatContainerRef}
                    className="space-y-3 max-h-[300px] overflow-y-auto mb-4"
                  >
                    {selectedFan.history?.slice(-10).map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          msg.from === 'fan'
                            ? 'bg-gray-100 ml-8'
                            : 'bg-blue-50 mr-8'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">
                            {msg.from === 'fan' ? '👤 Fan' : '💎 You'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.ts).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm">{msg.message}</div>
                      </div>
                    ))}
                  </div>

                  {/* Generate AI Button - NO INPUT */}
                  {!aiSuggestion && (
                    <button
                      onClick={handleGenerateAI}
                      disabled={generating}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold disabled:opacity-50 mb-4 hover:shadow-lg transition"
                    >
                      {generating ? '🤖 Generating...' : '🤖 Generate AI Response'}
                    </button>
                  )}

                  {/* AI Suggestion */}
                  {aiSuggestion && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-purple-700">🤖 AI Suggestion:</span>
                        <button
                          onClick={() => setAiSuggestion(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="bg-white rounded p-3 mb-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {aiSuggestion.texto || 'No response generated'}
                        </p>
                      </div>

                      {aiSuggestion.content_to_offer && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-3">
                          <div className="text-xs font-semibold text-yellow-800">
                            💰 Suggested Content: {aiSuggestion.content_to_offer.titulo} - ${aiSuggestion.content_to_offer.precio}
                          </div>
                        </div>
                      )}

                      {aiSuggestion.detected_info && (
                        <div className="bg-blue-50 border border-blue-300 rounded p-2 mb-3 text-xs">
                          <strong>ℹ️ Detected Info:</strong> {JSON.stringify(aiSuggestion.detected_info)}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendMessage(aiSuggestion.texto)}
                          disabled={sending || !aiSuggestion.texto}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
                        >
                          ✅ Send As-Is
                        </button>
                        <button
                          onClick={handleGenerateAI}
                          disabled={generating}
                          className="px-4 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold disabled:opacity-50"
                        >
                          🔄 Regenerate
                        </button>
                        <button
                          onClick={() => {
                            if (aiSuggestion.texto) {
                              navigator.clipboard.writeText(aiSuggestion.texto)
                              alert('✅ Copied to clipboard!')
                            }
                          }}
                          className="px-4 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-semibold"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p>Select a chat to start</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
