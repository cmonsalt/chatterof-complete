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
  const [message, setMessage] = useState('')
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
        .not('last_message_date', 'is', null)  // ✅ Solo fans con mensajes
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
            .order('ts', { ascending: false })  // 🔥 CAMBIADO A ts
            .limit(1)
            .single()

          const { data: history } = await supabase
            .from('chat')
            .select('*')
            .eq('fan_id', fan.fan_id)
            .order('ts', { ascending: true })  // 🔥 CAMBIADO A ts
            .limit(50)

          // Calculate time since last message
          const lastMsgTime = lastMessage?.ts ? new Date(lastMessage.ts) : null  // 🔥 CAMBIADO A ts
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
        .gte('ts', today.toISOString())  // 🔥 CAMBIADO A ts

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
    if (!message.trim() || !selectedFan) return

    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: actualModelId,
          fan_id: selectedFan.fan_id,
          message: message.trim()
        }
      })

      if (error) throw error

      if (data.success) {
        setAiSuggestion(data.response)
      }
    } catch (error) {
      console.error('Error generating:', error)
      alert('Error generating response')
    } finally {
      setGenerating(false)
    }
  }

  const handleSendMessage = async (text) => {
    if (!text?.trim() || !selectedFan) return

    setSending(true)
    try {
      // Save fan message
      await supabase.from('chat').insert({
        fan_id: selectedFan.fan_id,
        model_id: actualModelId,
        from: 'fan',
        message: message.trim(),
        ts: new Date().toISOString()  // 🔥 CAMBIADO A ts
      })

      // Save AI response
      await supabase.from('chat').insert({
        fan_id: selectedFan.fan_id,
        model_id: actualModelId,
        from: 'model',
        message: text.trim(),
        ts: new Date().toISOString()  // 🔥 CAMBIADO A ts
      })

      // Update fan's last message date
      await supabase
        .from('fans')
        .update({ last_message_date: new Date().toISOString() })
        .eq('fan_id', selectedFan.fan_id)

      // Clear form
      setMessage('')
      setAiSuggestion(null)
      
      // Reload
      loadActiveChats()
      loadTodayStats()
    } catch (error) {
      console.error('Error sending:', error)
      alert('Error sending message')
    } finally {
      setSending(false)
    }
  }

  const getStatusColor = (chat) => {
    if (chat.needsResponse) return 'bg-red-500'
    if (chat.minutesAgo < 5) return 'bg-green-500'
    if (chat.minutesAgo < 30) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const getTimeText = (chat) => {
    if (!chat.minutesAgo) return 'Never'
    if (chat.minutesAgo < 1) return 'Just now'
    if (chat.minutesAgo < 60) return `${chat.minutesAgo}m ago`
    const hours = Math.floor(chat.minutesAgo / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const filteredChats = searchQuery
    ? activeChats.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.fan_id?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeChats

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Messages Today</div>
              <div className="text-2xl font-bold text-blue-600">{todayStats.messagesSent}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Sales Today</div>
              <div className="text-2xl font-bold text-green-600">{todayStats.sales}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Revenue Today</div>
              <div className="text-2xl font-bold text-green-600">${todayStats.revenue}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Active Chats</div>
              <div className="text-2xl font-bold text-orange-600">{filteredChats.filter(c => c.needsResponse).length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Avg Response</div>
              <div className="text-2xl font-bold text-purple-600">{todayStats.avgResponseTime}m</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            
            {/* Left: Chat List */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Search fans..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  filteredChats.map((chat) => (
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
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        chat.tier === 'WHALE' ? 'bg-purple-100 text-purple-800' :
                        chat.tier === 'VIP' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {chat.tier}
                      </span>
                      <span className="font-semibold text-green-600">${chat.spent_total}</span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600 truncate">
                      {chat.lastMessageFrom === 'fan' && '👤 '}
                      {chat.lastMessageFrom === 'model' && '💎 '}
                      {chat.lastMessage}
                    </div>
                  </div>
                  ))
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
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{selectedFan.fan_id}</span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            selectedFan.tier === 'WHALE' ? 'bg-purple-100 text-purple-800' :
                            selectedFan.tier === 'VIP' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {selectedFan.tier}
                          </span>
                          <span className="font-semibold text-green-600">${selectedFan.spent_total}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/chat/${selectedFan.fan_id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
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

                  {/* Fan Message Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2">
                      👤 Fan's New Message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type what the fan said..."
                      className="w-full px-4 py-2 border rounded-lg resize-none"
                      rows="2"
                    />
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateAI}
                    disabled={!message.trim() || generating}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold disabled:opacity-50 mb-4"
                  >
                    {generating ? '🤖 Generating...' : '🤖 Generate AI Response'}
                  </button>

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
                        <p className="text-sm">{aiSuggestion.texto}</p>
                      </div>

                      {aiSuggestion.content_to_offer && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-3">
                          <div className="text-xs font-semibold text-yellow-800">
                            💰 Suggested Content: {aiSuggestion.content_to_offer.titulo} - ${aiSuggestion.content_to_offer.precio}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendMessage(aiSuggestion.texto)}
                          disabled={sending}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold"
                        >
                          ✅ Send As-Is
                        </button>
                        <button
                          onClick={handleGenerateAI}
                          disabled={generating}
                          className="px-4 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold"
                        >
                          🔄 Regenerate
                        </button>
                        <button
                          onClick={() => {
                            // Copy to clipboard for manual edit
                            navigator.clipboard.writeText(aiSuggestion.texto)
                            alert('Copied to clipboard! You can edit and send manually.')
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
