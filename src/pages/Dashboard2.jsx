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
      // 🔥 OPTIMIZACIÓN: Un solo query para fans
      const { data: fansData, error: fansError } = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', actualModelId)
        .order('last_message_date', { ascending: false, nullsFirst: false })

      if (fansError) throw fansError

      // 🔥 OPTIMIZACIÓN: Un solo query para TODOS los últimos mensajes
      const fanIds = fansData?.map(f => f.fan_id) || []
      
      let lastMessagesMap = {}
      if (fanIds.length > 0) {
        // Obtener último mensaje de cada fan en una sola query
        const { data: allMessages } = await supabase
          .from('chat')
          .select('fan_id, message, ts, from')
          .in('fan_id', fanIds)
          .order('ts', { ascending: false })

        // Crear mapa con último mensaje de cada fan
        allMessages?.forEach(msg => {
          if (!lastMessagesMap[msg.fan_id]) {
            lastMessagesMap[msg.fan_id] = msg
          }
        })
      }

      // Combinar fans con sus últimos mensajes
      const fansWithLastMessage = fansData.map(fan => {
        const lastMsg = lastMessagesMap[fan.fan_id]
        return {
          ...fan,
          lastMessage: lastMsg?.message || 'No messages yet',
          lastMessageTime: lastMsg?.ts || null,
          lastMessageFrom: lastMsg?.from || null
        }
      })

      // Calcular chats activos (últimos 7 días)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const chatsActivos = fansWithLastMessage.filter(
        f => f.last_message_date && new Date(f.last_message_date) > sevenDaysAgo
      ).length

      // Contar mensajes totales
      const { count: totalMensajes } = await supabase
        .from('chat')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', actualModelId)

      // Transacciones de hoy
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      
      const { data: transaccionesHoy } = await supabase
        .from('transactions')
        .select('amount')
        .eq('model_id', actualModelId)
        .gte('ts', hoy.toISOString())

      const totalHoy = transaccionesHoy?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

      setFans(fansWithLastMessage)
      setStats({
        hoy: totalHoy,
        chats: chatsActivos,
        mensajes: totalMensajes || 0,
        totalFans: fansWithLastMessage.length
      })
      setLoading(false)
    } catch (error) {
      console.error('Error cargando datos:', error)
      setLoading(false)
    }
  }

  const filteredFans = fans.filter(fan => 
    fan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fan.of_username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fan.fan_id?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getTimeText = (fan) => {
    if (!fan.lastMessageTime) return 'No messages'
    const date = new Date(fan.lastMessageTime)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
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
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">📊 Dashboard</h1>
            <p className="text-gray-600">Overview of all fans and activity</p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-600 font-semibold">Today's Revenue</p>
              <p className="text-3xl font-bold text-green-600">${stats.hoy.toFixed(2)}</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <p className="text-sm text-gray-600 font-semibold">Active Chats (7d)</p>
              <p className="text-3xl font-bold text-blue-600">{stats.chats}</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
              <p className="text-sm text-gray-600 font-semibold">Total Messages</p>
              <p className="text-3xl font-bold text-purple-600">{stats.mensajes}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-pink-500">
              <p className="text-sm text-gray-600 font-semibold">Total Fans</p>
              <p className="text-3xl font-bold text-pink-600">{stats.totalFans}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">All Fans</h2>
              <input
                type="text"
                placeholder="🔍 Search fans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border rounded-lg w-64"
              />
            </div>
            
            {filteredFans.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-gray-600 font-semibold">
                  {searchQuery ? 'No fans match your search' : 'No fans yet'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Fans will appear automatically when the extension detects messages
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
                            {fan.name || fan.of_username || 'Unknown'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              fan.tier === 3 ? 'bg-purple-100 text-purple-800' :
                              fan.tier === 2 ? 'bg-blue-100 text-blue-800' :
                              fan.tier === 1 ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              Tier {fan.tier || 0}
                            </span>
                            <span className="font-semibold text-green-600">
                              ${fan.spent_total || 0}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span>{getTimeText(fan)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">
                          {fan.lastMessageFrom === 'fan' && '👤 Fan'}
                          {fan.lastMessageFrom === 'model' && '💎 You'}
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
      </div>
    </>
  )
}
