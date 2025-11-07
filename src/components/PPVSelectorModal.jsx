import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function PPVSelectorModal({ isOpen, onClose, onSelect, modelId, fanTier = 0 }) {
  const [activeTab, setActiveTab] = useState('sessions')
  const [sessions, setSessions] = useState([])
  const [singles, setSingles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadCatalog()
    }
  }, [isOpen, modelId])

  const loadCatalog = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Agrupar sessions
      const sessionsMap = new Map()
      const singlesArray = []

      data.forEach(item => {
        if (item.session_id && item.step_number != null) {
          if (!sessionsMap.has(item.session_id)) {
            sessionsMap.set(item.session_id, {
              session_id: item.session_id,
              session_name: item.session_name,
              session_description: item.session_description,
              parts: []
            })
          }
          sessionsMap.get(item.session_id).parts.push(item)
        }
        
        if (item.is_single) {
          singlesArray.push(item)
        }
      })

      sessionsMap.forEach(session => {
        session.parts.sort((a, b) => (a.step_number || 0) - (b.step_number || 0))
      })

      setSessions(Array.from(sessionsMap.values()))
      setSingles(singlesArray)

    } catch (error) {
      console.error('Error loading catalog:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePrice = (basePrice) => {
    const multipliers = {
      0: 1.0,   // Free
      1: 1.2,   // VIP
      2: 1.5    // Whale
    }
    return Math.round(basePrice * (multipliers[fanTier] || 1.0))
  }

  const getNivelBadge = (nivel) => {
    const badges = {
      1: { label: '🟢 Tease', color: 'bg-green-100 text-green-800' },
      2: { label: '🟢 Soft', color: 'bg-green-100 text-green-800' },
      3: { label: '🟢 Innocent', color: 'bg-green-100 text-green-800' },
      4: { label: '🟡 Bikini', color: 'bg-yellow-100 text-yellow-800' },
      5: { label: '🟡 Lingerie', color: 'bg-yellow-100 text-yellow-800' },
      6: { label: '🟡 Topless', color: 'bg-yellow-100 text-yellow-800' },
      7: { label: '🟠 Nude', color: 'bg-orange-100 text-orange-800' },
      8: { label: '🟠 Solo Play', color: 'bg-orange-100 text-orange-800' },
      9: { label: '🔴 Explicit', color: 'bg-red-100 text-red-800' },
      10: { label: '⚫ Hardcore', color: 'bg-gray-900 text-white' }
    }
    return badges[nivel] || badges[1]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">💰 Select PPV Content</h2>
              <p className="text-sm text-purple-100 mt-1">
                Choose content to send to fan
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📁 Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('singles')}
              className={`pb-3 px-4 font-semibold border-b-2 transition-colors ${
                activeTab === 'singles'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              💎 Singles ({singles.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading content...</p>
              </div>
            </div>
          ) : activeTab === 'sessions' ? (
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">📁 No sessions yet</p>
                  <p className="text-sm mt-2">Create sessions in Vault tab</p>
                </div>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.session_id}
                    className="border-2 border-purple-200 rounded-lg overflow-hidden bg-white"
                  >
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        📁 {session.session_name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {session.parts.length} parts • {session.session_description}
                      </p>
                    </div>

                    <div className="p-4 space-y-3">
                      {session.parts.map(part => {
                        const nivelBadge = getNivelBadge(part.nivel || 1)
                        const finalPrice = calculatePrice(part.base_price)
                        
                        return (
                          <div
                            key={part.id}
                            onClick={() => onSelect({
                              type: 'session',
                              session_id: session.session_id,
                              session_name: session.session_name,
                              part_number: part.step_number,
                              catalog_id: part.id,
                              title: part.title,
                              base_price: part.base_price,
                              final_price: finalPrice,
                              nivel: part.nivel,
                              media_thumb: part.media_thumb,
                              media_url: part.media_url,
                              of_media_ids: part.of_media_ids || [part.of_media_id],
                              description: part.description || session.session_description
                            })}
                            className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg hover:border-purple-500 hover:shadow-md transition-all cursor-pointer group"
                          >
                            {/* Thumbnail */}
                            <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              {part.media_thumb ? (
                                <img
                                  src={part.media_thumb}
                                  alt={part.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                                  {part.file_type === 'video' ? '🎥' : '📷'}
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-semibold text-gray-900 mb-1">
                                    Part {part.step_number}: {part.title}
                                  </p>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${nivelBadge.color}`}>
                                      {nivelBadge.label}
                                    </span>
                                    <span className="text-gray-500">
                                      {part.of_media_ids?.length || 1} media(s)
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-500">Base: ${part.base_price}</p>
                                  <p className="text-lg font-bold text-purple-600">
                                    ${finalPrice}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Select indicator */}
                            <div className="text-purple-600 opacity-0 group-hover:opacity-100 transition-all">
                              →
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {singles.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <p className="text-lg">💎 No singles yet</p>
                  <p className="text-sm mt-2">Add singles in Vault tab</p>
                </div>
              ) : (
                singles.map(single => {
                  const nivelBadge = getNivelBadge(single.nivel || 1)
                  const finalPrice = calculatePrice(single.base_price)
                  
                  return (
                    <div
                      key={single.id}
                      onClick={() => onSelect({
                        type: 'single',
                        catalog_id: single.id,
                        title: single.title,
                        base_price: single.base_price,
                        final_price: finalPrice,
                        nivel: single.nivel,
                        media_thumb: single.media_thumb,
                        media_url: single.media_url,
                        of_media_ids: [single.of_media_id],
                        description: single.description,
                        keywords: single.keywords
                      })}
                      className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-green-500 hover:shadow-lg transition-all cursor-pointer group"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-gray-100 relative">
                        {single.media_thumb ? (
                          <img
                            src={single.media_thumb}
                            alt={single.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                            {single.file_type === 'video' ? '🎥' : '📷'}
                          </div>
                        )}
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                          <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-all">
                            ✓ Select
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold text-gray-900 text-sm mb-2 truncate">
                          {single.title}
                        </p>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${nivelBadge.color}`}>
                            {nivelBadge.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Base: ${single.base_price}</span>
                          <span className="text-lg font-bold text-green-600">
                            ${finalPrice}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}
