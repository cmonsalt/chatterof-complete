import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import ChatView from './ChatView'  // ✅ Importar ChatView

export default function ChatterMode() {
  const { fanId } = useParams()
  const { user, modelId } = useAuth()
  const navigate = useNavigate()
  
  const actualModelId = modelId || user?.user_metadata?.model_id
  
  const [activeChats, setActiveChats] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Metrics
  const [todayStats, setTodayStats] = useState({
    messagesSent: 0,
    sales: 0,
    revenue: 0,
    activeFans: 0,
    avgResponseTime: 5
  })

  // Get Tier Badge
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
      
      const interval = setInterval(loadActiveChats, 30000)
      return () => clearInterval(interval)
    }
  }, [actualModelId])

  const loadActiveChats = async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Get all fans with recent messages
      const { data: recentMessages } = await supabase
        .from('chat')
        .select('fan_id, ts')
        .eq('model_id', actualModelId)
        .gte('ts', thirtyDaysAgo.toISOString())
        .order('ts', { ascending: false })

      if (!recentMessages || recentMessages.length === 0) {
        setActiveChats([])
        return
      }

      // Get unique fan IDs
      const fanIds = [...new Set(recentMessages.map(m => m.fan_id))]

      // Get fan details
      const { data: fans } = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', actualModelId)
        .in('fan_id', fanIds)

      if (!fans || fans.length === 0) {
        setActiveChats([])
        return
      }

      // Get last message for each fan
      const { data: allMessages } = await supabase
        .from('chat')
        .select('*')
        .eq('model_id', actualModelId)
        .in('fan_id', fanIds)
        .order('ts', { ascending: false })

      const chatsMap = {}

      for (const fan of fans) {
        const messages = allMessages?.filter(m => m.fan_id === fan.fan_id) || []
        
        if (messages.length === 0) continue

        const lastMessage = messages[0] // Already sorted desc
        const lastFanMessage = messages.find(m => m.from === 'fan')
        const lastModelMessage = messages.find(m => m.from === 'model')

        const needsResponse = lastFanMessage && 
          (!lastModelMessage || new Date(lastFanMessage.ts) > new Date(lastModelMessage.ts))

        const minutesAgo = Math.floor((new Date() - new Date(lastMessage.ts)) / 60000)

        chatsMap[fan.fan_id] = {
          ...fan,
          lastMessage: lastMessage.message,
          lastMessageFrom: lastMessage.from,
          lastMessageTime: lastMessage.ts,
          minutesAgo,
          needsResponse
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

  const getStatusColor = (chat) => {
    if (chat.needsResponse) return 'bg-red-500'
    if (chat.minutesAgo < 60) return 'bg-green-500'
    return 'bg-gray-400'
  }

  const getTimeText = (chat) => {
    if (chat.minutesAgo < 1) return 'Now'
    if (chat.minutesAgo < 60) return `${chat.minutesAgo}m ago`
    const hours = Math.floor(chat.minutesAgo / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const filteredChats = activeChats.filter(chat =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.of_username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold">💬 Chatter Mode</h1>
            <p className="text-gray-600 mt-1">Manage multiple conversations efficiently</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-600">Messages Today</p>
              <p className="text-2xl font-bold text-blue-600">{todayStats.messagesSent}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-600">Sales Today</p>
              <p className="text-2xl font-bold text-green-600">{todayStats.sales}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-600">Revenue Today</p>
              <p className="text-2xl font-bold text-green-600">${todayStats.revenue}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-600">Active Chats</p>
              <p className="text-2xl font-bold text-orange-600">{todayStats.activeFans}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-sm text-gray-600">Avg Response</p>
              <p className="text-2xl font-bold text-purple-600">{todayStats.avgResponseTime}m</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left: Fan List (3 columns) */}
            <div className="col-span-3 bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                <h3 className="font-bold text-lg">Active Chats ({filteredChats.length})</h3>
              </div>

              <div className="flex gap-3 text-xs text-gray-600 mb-4">
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

              <div className="mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search fans..."
                  className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2 max-h-[calc(100vh-450px)] overflow-y-auto pr-2">
                {filteredChats.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">💬</div>
                    <p className="text-gray-500 font-semibold text-sm">No active chats</p>
                    <p className="text-gray-400 text-xs mt-2">
                      {searchQuery 
                        ? 'No fans match your search' 
                        : 'Fans with recent messages will appear here'}
                    </p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const tierBadge = getTierBadge(chat.tier || 0)
                    const isSelected = fanId === chat.fan_id
                    
                    return (
                      <div
                        key={chat.fan_id}
                        onClick={() => navigate(`/chatter/${chat.fan_id}`)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-2 border-blue-500 shadow-sm'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusColor(chat)}`}></div>
                            <span className="font-semibold text-sm truncate">{chat.display_name || chat.name}</span>
                          </div>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{getTimeText(chat)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${tierBadge.color}`}>
                            {tierBadge.emoji} {tierBadge.label}
                          </span>
                          <span className="font-bold text-green-600">${chat.spent_total || 0}</span>
                        </div>

                        <div className="text-xs text-gray-600 truncate">
                          {chat.lastMessageFrom === 'fan' && <span className="font-semibold">👤 Fan: </span>}
                          {chat.lastMessageFrom === 'model' && <span className="font-semibold">💙 You: </span>}
                          {chat.lastMessage}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right: ChatView Component (9 columns - más espacio) */}
            <div className="col-span-9">
              {fanId ? (
                <ChatView embedded={true} />
              ) : (
                <div className="bg-white rounded-xl shadow-lg h-[calc(100vh-250px)] flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-7xl mb-4">💬</div>
                    <p className="text-gray-500 font-bold text-xl">Select a chat to start</p>
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
