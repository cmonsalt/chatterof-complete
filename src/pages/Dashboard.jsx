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
      // PAGINACIÓN: Cargar todos los fans en batches de 1000
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

        console.log(`📦 Loaded batch: ${batch.length} fans (total so far: ${allFansData.length})`)

        if (batch.length < pageSize) break
        from += pageSize
      }

      console.log(`✅ Total fans loaded: ${allFansData.length}`)

      const fanIds = allFansData?.map(f => f.fan_id) || []

      let lastMessagesMap = {}

      if (fanIds.length > 0) {
        // Cargar mensajes también en batches
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

      console.log('📊 FANS CARGADOS:', fansWithLastMessage.length)

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
      // Si hay un tier seleccionado, ignorar el filtro de "Active"
      if (selectedTier !== null) {
        return fan.tier === selectedTier
      }
      // Si no hay tier seleccionado, aplicar filtro Active/All
      return showActiveOnly ? fan.isActive : true
    })
    .filter(fan =>
      fan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fan.of_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fan.fan_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fan.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

  // Contar fans por tier (todos, no filtrados)
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
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            📊 Dashboard
          </h1>
          <p style={{ color: '#6b7280' }}>Overview of all fans and activity</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6">
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            borderLeft: '4px solid #10b981',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Today's Revenue</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>${stats.hoy.toFixed(2)}</p>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Active Fans</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{stats.chats}</p>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            borderLeft: '4px solid #a855f7',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Messages</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a855f7' }}>{stats.mensajes}</p>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            borderLeft: '4px solid #ec4899',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Total Fans</p>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ec4899' }}>{stats.totalFans}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 md:p-6 shadow-sm">
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>All Fans</h2>

              <div className="flex flex-col md:flex-row gap-2 md:gap-4 w-full md:w-auto">

                <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setShowActiveOnly(true)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${showActiveOnly
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    🔥 Active ({stats.chats})
                  </button>
                  <button
                    onClick={() => setShowActiveOnly(false)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${!showActiveOnly
                      ? 'bg-white shadow text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    👥 All ({stats.totalFans})
                  </button>
                </div>

                <div className="flex gap-2 bg-gray-50 rounded-lg p-1 border">
                  <button
                    onClick={() => setSelectedTier(null)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${selectedTier === null
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${selectedTier === 0
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${selectedTier === 1
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${selectedTier === 2
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
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          {filteredFans.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
              <p style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                No fans found
              </p>
              <p style={{ fontSize: '0.875rem' }}>
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
                  className="border rounded-lg p-4 hover:shadow-lg hover:border-blue-300 transition cursor-pointer bg-gray-50"
                  onClick={() => navigate(`/chat/${fan.fan_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {fan.of_avatar_url ? (
                        <img
                          src={fan.of_avatar_url}
                          alt={fan.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xl font-bold">
                          {fan.name?.[0]?.toUpperCase() || '👤'}
                        </div>
                      )}

                      <div>
                        <h3 className="font-bold text-gray-800">
                          {fan.display_name || fan.name || fan.of_username || 'Unknown'}
                          {fan.display_name && (
                            <span className="text-xs font-normal text-gray-500 ml-2">
                              ({fan.of_username || fan.fan_id})
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
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
                          <span>{getTimeText(fan)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">
                        {fan.lastMessageFrom === 'fan' && '👤 Fan'}
                        {fan.lastMessageFrom === 'model' && '💙 You'}
                      </div>
                      <div className="text-sm text-gray-700 max-w-xs truncate">
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
