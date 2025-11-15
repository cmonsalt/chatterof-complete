import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Navbar from '../components/Navbar'

export default function Dashboard() {
  const { user, modelId, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const actualModelId = modelId || user?.user_metadata?.model_id

  const [fans, setFans] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ hoy: 0, chats: 0, mensajes: 0, totalFans: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [selectedTier, setSelectedTier] = useState(null)

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
      cargarDatos()
      const interval = setInterval(cargarDatos, 30000)
      return () => clearInterval(interval)
    }
  }, [actualModelId])

  async function cargarDatos() {
    if (!actualModelId) {
      setLoading(false)
      return
    }

    try {
      let allFansData = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data: batch, error: batchError } = await supabase
          .from('fans')
          .select('*')
          .eq('model_id', actualModelId)
          .range(from, from + pageSize - 1)
          .order('last_message_date', { ascending: false, nullsFirst: false })

        if (batchError) {
          console.error('Error loading fans batch:', batchError)
          break
        }

        if (!batch || batch.length === 0) break

        allFansData = [...allFansData, ...batch]

        console.log(`Loaded batch: ${batch.length} fans (total so far: ${allFansData.length})`)

        if (batch.length < pageSize) break
        from += pageSize
      }

      console.log(`Total fans loaded: ${allFansData.length}`)

      const fanIds = allFansData?.map(f => f.fan_id) || []

      let lastMessagesMap = {}

      if (fanIds.length > 0) {
        const batchSize = 1000
        for (let i = 0; i < fanIds.length; i += batchSize) {
          const fanIdBatch = fanIds.slice(i, i + batchSize)

          const { data: allMessages } = await supabase
            .from('chat')
            .select('fan_id, message, ts, from')
            .eq('model_id', actualModelId)
            .in('fan_id', fanIdBatch)
            .order('ts', { ascending: false })

          if (allMessages) {
            for (const msg of allMessages) {
              if (!lastMessagesMap[msg.fan_id]) {
                lastMessagesMap[msg.fan_id] = {
                  message: msg.message,
                  time: msg.ts,
                  from: msg.from
                }
              }
            }
          }
        }
      }

      const fansWithLastMessage = (allFansData || []).map(fan => {
        const lastMsg = lastMessagesMap[fan.fan_id]
        const lastMsgTime = lastMsg?.time ? new Date(lastMsg.time) : null
        const now = new Date()
        const hoursSinceLastMsg = lastMsgTime ? (now - lastMsgTime) / (1000 * 60 * 60) : null

        return {
          ...fan,
          lastMessage: lastMsg?.message || 'No messages',
          lastMessageTime: lastMsg?.time || null,
          lastMessageFrom: lastMsg?.from || null,
          isActive: hoursSinceLastMsg !== null && hoursSinceLastMsg < 48
        }
      })

      setFans(fansWithLastMessage)

      const activeFans = fansWithLastMessage.filter(f => f.isActive)

      console.log('FANS CARGADOS:', fansWithLastMessage.length)

      setStats({
        hoy: 0,
        chats: activeFans.length,
        mensajes: 0,
        totalFans: fansWithLastMessage.length
      })

      setLoading(false)
    } catch (error) {
      console.error('Error cargando datos:', error)
      setLoading(false)
    }
  }

  const filteredFans = fans
    .filter(fan => {
      if (selectedTier !== null) {
        return fan.tier === selectedTier
      }
      return showActiveOnly ? fan.isActive : true
    })
    .filter(fan =>
      fan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fan.of_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fan.fan_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fan.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const tierCounts = {
    new: fans.filter(f => f.tier === 0).length,
    vip: fans.filter(f => f.tier === 1).length,
    whale: fans.filter(f => f.tier === 2).length
  }

  const getTimeText = (fan) => {
    if (!fan.lastMessageTime) return 'No messages'
    const date = new Date(fan.lastMessageTime)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays}d ago`
  }

  if (authLoading || loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-xl">Loading...</div>
        </div>
      </>
    )
  }

  if (!actualModelId) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No Model Selected</h2>
            <p className="text-gray-600 mb-4">Please select a model from the dropdown</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">📊 Dashboard</h1>
          <p className="text-gray-600">Overview of all fans and activity</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
          <div className="bg-white p-3 md:p-6 rounded-xl border-l-4 border-green-500 shadow-sm">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Today's Revenue</p>
            <p className="text-xl md:text-2xl font-bold text-green-600">${stats.hoy.toFixed(2)}</p>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Active Fans</p>
            <p className="text-xl md:text-2xl font-bold text-blue-600">{stats.chats}</p>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-xl border-l-4 border-purple-500 shadow-sm">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Total Messages</p>
            <p className="text-xl md:text-2xl font-bold text-purple-600">{stats.mensajes}</p>
          </div>

          <div className="bg-white p-3 md:p-6 rounded-xl border-l-4 border-pink-500 shadow-sm">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Total Fans</p>
            <p className="text-xl md:text-2xl font-bold text-pink-600">{stats.totalFans}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 md:p-6 shadow-sm">
          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
              <h2 className="text-lg md:text-xl font-bold">All Fans</h2>

              <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto">
                <div className="flex gap-2 bg-gray-100 rounded-lg p-1 w-full md:w-auto">
                  <button
                    onClick={() => setShowActiveOnly(true)}
                    className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition ${showActiveOnly
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    🔥 Active ({stats.chats})
                  </button>
                  <button
                    onClick={() => setShowActiveOnly(false)}
                    className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition ${!showActiveOnly
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    👥 All ({stats.totalFans})
                  </button>
                </div>

                <div className="flex gap-1 md:gap-2 bg-gray-50 rounded-lg p-1 border overflow-x-auto">
                  <button
                    onClick={() => setSelectedTier(null)}
                    className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${selectedTier === null
                      ? 'bg-white shadow text-blue-600 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    All Tiers
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTier(0)
                      setShowActiveOnly(false)
                    }}
                    className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${selectedTier === 0
                      ? 'bg-white shadow text-gray-600 border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    🆕 New ({tierCounts.new})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTier(1)
                      setShowActiveOnly(false)
                    }}
                    className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${selectedTier === 1
                      ? 'bg-white shadow text-blue-600 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    💎 VIP ({tierCounts.vip})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTier(2)
                      setShowActiveOnly(false)
                    }}
                    className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${selectedTier === 2
                      ? 'bg-white shadow text-purple-600 border border-purple-200'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    🐋 Whale ({tierCounts.whale})
                  </button>
                </div>
              </div>
            </div>

            <input
              type="text"
              placeholder="🔍 Search fans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {filteredFans.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-5xl mb-4">👥</div>
              <p className="text-lg font-semibold mb-2">No fans found</p>
              <p className="text-sm">
                {showActiveOnly
                  ? 'No active fans in the last 48 hours'
                  : 'Fans will appear automatically when they send messages'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredFans.map(fan => (
                <div
                  key={fan.fan_id}
                  className="border rounded-lg p-3 md:p-4 hover:shadow-lg hover:border-blue-300 transition cursor-pointer bg-gray-50"
                  onClick={() => navigate(`/chat/${fan.fan_id}`)}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {fan.of_avatar_url ? (
                        <img
                          src={fan.of_avatar_url}
                          alt={fan.name}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg md:text-xl font-bold flex-shrink-0">
                          {fan.name?.[0]?.toUpperCase() || '👤'}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm md:text-base text-gray-800 truncate">
                          {fan.display_name || fan.name || fan.of_username || 'Unknown'}
                          {fan.display_name && (
                            <span className="text-xs font-normal text-gray-500 ml-2">
                              ({fan.of_username || fan.fan_id})
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 flex-wrap">
                          {(() => {
                            const tierBadge = getTierBadge(fan.tier || 0)
                            return (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierBadge.color}`}>
                                {tierBadge.emoji} {tierBadge.label}
                              </span>
                            )
                          })()}
                          <span className="font-semibold text-green-600">
                            ${(fan.spent_total || 0).toFixed(2)}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs">{getTimeText(fan)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-left md:text-right w-full md:w-auto">
                      <div className="text-xs text-gray-500 mb-1">
                        {fan.lastMessageFrom === 'fan' && '👤 Fan'}
                        {fan.lastMessageFrom === 'model' && '💙 You'}
                      </div>
                      <div className="text-xs md:text-sm text-gray-700 max-w-full md:max-w-xs truncate">
                        {fan.lastMessage}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}