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

  // 🎨 Helper: Get Tier Badge
  const getTierBadge = (tier) => {
    const tiers = {
      0: { emoji: '🆕', label: 'New Fan', color: 'bg-gray-100 text-gray-700' },
      1: { emoji: '💎', label: 'VIP', color: 'bg-blue-100 text-blue-700' },
      2: { emoji: '🐋', label: 'Whale', color: 'bg-purple-100 text-purple-700' }
    }
    return tiers[tier] || tiers[0]
  }

  useEffect(() => {
    if (actualModelId) {
      loadActiveChats()
      loadTodayStats()
      
      const interval = setInterval(() => {
        loadActiveChats()
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [actualModelId])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [selectedFan?.history])

  const loadActiveChats = async () => {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: fans } = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', actualModelId)
        .gte('last_message_date', sevenDaysAgo.toISOString())

      if (!fans || fans.length === 0) {
        setActiveChats([])
        return
      }

      const fanIds = fans.map(f => f.fan_id)

      const { data: allMessages } = await supabase
        .from('chat')
        .select('*')
        .eq('model_id', actualModelId)
        .in('fan_id', fanIds)
        .order('ts', { ascending: true })

      const chatsMap = {}

      for (const fan of fans) {
        const messages = allMessages?.filter(m => m.fan_id === fan.fan_id) || []
        
        if (messages.length === 0) continue

        const lastMessage = messages[messages.length - 1]
        const lastFanMessage = messages.filter(m => m.from === 'fan').slice(-1)[0]
        const lastModelMessage = messages.filter(m => m.from === 'model').slice(-1)[0]

        const needsResponse = lastFanMessage && 
          (!lastModelMessage || new Date(lastFanMessage.ts) > new Date(lastModelMessage.ts))

        const minutesAgo = Math.floor((new Date() - new Date(lastMessage.ts)) / 60000)

        chatsMap[fan.fan_id] = {
          ...fan,
          lastMessage: lastMessage.message,
          lastMessageFrom: lastMessage.from,
          lastMessageTime: lastMessage.ts,
          minutesAgo,
          needsResponse,
          history: messages
        }
      }

      const chatsList = Object.values(chatsMap).sort((a, b) => {
        if (a.needsResponse && !b.needsResponse) return -1
        if (!a.needsResponse && b.needsResponse) return 1
        return a.minutesAgo - b.minutesAgo
      })

      setActiveChats(chatsList)
    } catch (error) {
      console.error('Error loading chats:', error)
    }
  }

  const loadTodayStats = async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: messages } = await supabase
        .from('chat')
        .select('*')
        .eq('model_id', actualModelId)
        .eq('from', 'model')
        .gte('ts', today.toISOString())

      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('model_id', actualModelId)
        .gte('created_at', today.toISOString())

      const revenue = transactions?.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0) || 0

      setTodayStats({
        messagesSent: messages?.length || 0,
        sales: transactions?.length || 0,
        revenue: revenue.toFixed(2),
        activeFans: activeChats.length,
        avgResponseTime: 5
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleGenerateAI = async () => {
    if (!selectedFan) return

    setGenerating(true)
    try {
      const lastFanMessage = selectedFan.history
        ?.filter(m => m.from === 'fan')
        ?.slice(-1)[0]?.message || ''

      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: actualModelId,
          fan_id: selectedFan.fan_id,
          message: lastFanMessage
        }
      })

      if (error) throw error
      setAiSuggestion(data)
    } catch (error) {
      console.error('Error generating AI:', error)
      alert('Error generating AI response')
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
          source: 'manual',
          chatter_id: user?.id // 🔥 NUEVO: Track quien envió
        })

      if (error) throw error

      setAiSuggestion(null)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

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
              
              {/* 🔥 NUEVO: Header con leyenda */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                <h3 className="font-semibold text-sm">Active Chats ({filteredChats.length})</h3>
                <div className="flex gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    Urgent
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Active
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                    Idle
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search fans..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
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
                            <span className="font-semibold text-sm">{chat.display_name || chat.name}</span>
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
                          {chat.lastMessageFrom === 'model' && '💙 '}
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
                  {/* Fan Header */}
                  <div className="flex items-center justify-between pb-4 border-b mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedFan.display_name || selectedFan.name}</h2>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {(() => {
                          const tierBadge = getTierBadge(selectedFan.tier || 0)
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierBadge.color}`}>
                              {tierBadge.emoji} {tierBadge.label}
                            </span>
                          )
                        })()}
                        <span className="font-semibold text-green-600">${selectedFan.spent_total || 0}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/chat/${selectedFan.fan_id}`)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      Open Full Chat
                    </button>
                  </div>

                  {/* Chat Messages */}
                  <div 
                    ref={chatContainerRef}
                    className="h-[400px] overflow-y-auto mb-4 space-y-3"
                  >
                    {selectedFan.history?.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.from === 'model' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-lg ${
                            msg.from === 'model'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.ts).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Suggestion */}
                  {aiSuggestion && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-purple-800 mb-2">🤖 AI Suggestion:</p>
                      <p className="text-sm text-gray-700 mb-3">{aiSuggestion.message}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendMessage(aiSuggestion.message)}
                          disabled={sending}
                          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm disabled:opacity-50"
                        >
                          {sending ? 'Sending...' : 'Send This'}
                        </button>
                        <button
                          onClick={() => setAiSuggestion(null)}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateAI}
                      disabled={generating}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                    >
                      {generating ? '...' : '🤖 AI'}
                    </button>
                    <input
                      type="text"
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border rounded-lg"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage(e.target.value)
                          e.target.value = ''
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousElementSibling
                        handleSendMessage(input.value)
                        input.value = ''
                      }}
                      disabled={sending}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      {sending ? '...' : 'Send'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-6xl mb-4">💬</div>
                    <p className="text-gray-500 font-semibold">Select a chat to start</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Choose a fan from the list to view conversation
                    </p>
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
