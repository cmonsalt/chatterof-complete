import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import SessionManager from './SessionManager'
import SingleEditor from './SingleEditor'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function CatalogView({ modelId }) {
  const [activeTab, setActiveTab] = useState('sessions')
  const [sessions, setSessions] = useState([])
  const [singles, setSingles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [expandedSessions, setExpandedSessions] = useState(new Set())
  const [previewMedia, setPreviewMedia] = useState(null)
  const [editingSingle, setEditingSingle] = useState(null)

  useEffect(() => {
    loadCatalog()
  }, [modelId])

  const loadCatalog = async () => {
    setLoading(true)
    try {
      // Cargar todo el contenido
      const { data, error} = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const sessionsMap = new Map()
      const singlesArray = []

      data.forEach(item => {
        // Sessions: items que tienen session_id Y step_number (son parts principales)
        // Los medias secundarios tienen session_id pero NO tienen step_number
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
        
        // Singles: items marcados como single
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

  const toggleSession = (sessionId) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  const handleDeleteSession = async (session) => {
    if (!confirm(`¿Eliminar session "${session.session_name}"? Los medias volverán a estar sin organizar pero seguirán en Inbox.`)) {
      return
    }

    try {
      // Solo quitar la referencia de session, NO eliminar los items
      const { error } = await supabase
        .from('catalog')
        .update({ 
          session_id: null,
          session_name: null,
          session_description: null,
          step_number: null
        })
        .eq('session_id', session.session_id)

      if (error) throw error

      alert('✅ Session eliminada. Los medias siguen en Inbox.')
      loadCatalog()

    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Error: ' + error.message)
    }
  }

  const handleEditSession = (session) => {
    setEditingSession(session)
    setShowSessionManager(true)
  }

  const handleDeleteSingle = async (single) => {
    if (!confirm(`¿Desmarcar "${single.title}" como Single? El media seguirá en Inbox.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('catalog')
        .update({ is_single: false })
        .eq('id', single.id)

      if (error) throw error

      alert('✅ Single desmarcado. El media sigue en Inbox.')
      loadCatalog()

    } catch (error) {
      console.error('Error unmarking single:', error)
      alert('Error: ' + error.message)
    }
  }

  const handleEditSingle = (single) => {
    setEditingSingle(single)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading catalog...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex gap-4 border-b border-gray-200">
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

        <button
          onClick={() => {
            setEditingSession(null)
            setShowSessionManager(true)
          }}
          className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          ✨ Create Session
        </button>
      </div>

      {activeTab === 'sessions' ? (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">📁 No sessions yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Create sessions from Inbox content
              </p>
              <button
                onClick={() => setShowSessionManager(true)}
                className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
              >
                Create First Session
              </button>
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.session_id}
                className="border-2 border-purple-200 rounded-lg overflow-hidden bg-white hover:shadow-lg transition-all"
              >
                <div
                  className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 cursor-pointer"
                  onClick={() => toggleSession(session.session_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {expandedSessions.has(session.session_id) ? '📂' : '📁'}
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {session.session_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {session.parts.length} parts • {session.session_description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditSession(session)
                        }}
                        className="px-3 py-1 bg-white border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 text-sm font-semibold"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session)
                        }}
                        className="px-3 py-1 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-semibold"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>

                {expandedSessions.has(session.session_id) && (
                  <div className="p-4 space-y-3 bg-white">
                    {session.parts.map(part => {
                      const nivelBadge = getNivelBadge(part.nivel)
                      return (
                        <div
                          key={part.id}
                          className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 transition-all"
                        >
                          <div className="flex gap-3">
                            <div
                              className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 ring-purple-500"
                              onClick={() => setPreviewMedia(part)}
                            >
                              {part.media_thumb ? (
                                <img
                                  src={part.media_thumb}
                                  alt={part.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                  {part.file_type === 'video' ? '🎥' : '📷'}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 mb-1">
                                    Part {part.step_number}: {part.title}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                      💰 ${part.base_price}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${nivelBadge.color}`}>
                                      {nivelBadge.label}
                                    </span>
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                      {part.of_media_ids?.length || 1} media(s)
                                    </span>
                                  </div>
                                  {part.keywords && part.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {part.keywords.slice(0, 5).map((keyword, ki) => (
                                        <span
                                          key={ki}
                                          className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs"
                                        >
                                          #{keyword}
                                        </span>
                                      ))}
                                      {part.keywords.length > 5 && (
                                        <span className="text-xs text-gray-400">
                                          +{part.keywords.length - 5} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Add Single Button */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                // Buscar un item sin organizar para agregarlo como single
                alert('Para agregar Singles: ve a Inbox, busca el contenido que quieres, y configúralo desde Catalog. Próximamente: selector directo aquí.')
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              ➕ Add Single
            </button>
          </div>

          {singles.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-lg">💎 No singles yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Mark content as Singles from Inbox for quick direct sales
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {singles.map(single => {
                const nivelBadge = getNivelBadge(single.nivel || 1)
                const isConfigured = single.base_price > 0 && single.keywords?.length > 0
                
                return (
                  <div
                    key={single.id}
                    className={`border-2 rounded-lg overflow-hidden hover:shadow-lg transition-all bg-white group ${
                      isConfigured ? 'border-green-200' : 'border-yellow-300'
                    }`}
                  >
                    <div
                      className="relative aspect-square cursor-pointer"
                      onClick={() => setPreviewMedia(single)}
                    >
                      {single.media_thumb ? (
                        <img
                          src={single.media_thumb}
                          alt={single.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-4xl">
                          {single.file_type === 'video' ? '🎥' : '📷'}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                        <span className="text-white text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all">
                          👁️ Preview
                        </span>
                      </div>

                      {!isConfigured && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
                          ⚠️ Configure
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <h4 className="font-semibold text-gray-900 text-sm mb-2 truncate">
                        {single.title || 'Untitled'}
                      </h4>
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        {single.base_price > 0 ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                            ${single.base_price}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                            No price
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${nivelBadge.color}`}>
                          Lv.{single.nivel || 1}
                        </span>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditSingle(single)}
                          className="flex-1 px-3 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 text-xs font-semibold"
                        >
                          ✏️ {isConfigured ? 'Edit' : 'Configure'}
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(single)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs font-semibold"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showSessionManager && (
        <SessionManager
          isOpen={showSessionManager}
          onClose={() => {
            setShowSessionManager(false)
            setEditingSession(null)
            loadCatalog()
          }}
          modelId={modelId}
          editingSession={editingSession}
        />
      )}

      {editingSingle && (
        <SingleEditor
          isOpen={!!editingSingle}
          single={editingSingle}
          onClose={() => {
            setEditingSingle(null)
            loadCatalog()
          }}
          modelId={modelId}
        />
      )}

      {previewMedia && (
        <MediaPreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
        />
      )}

    </div>
  )
}

function MediaPreviewModal({ media, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{media.title || 'Preview'}</h3>
            <p className="text-sm text-purple-100">
              {media.file_type === 'video' ? '🎥 Video' : '📷 Photo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2"
          >
            ✕
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-auto">
          {media.file_type === 'video' ? (
            <video
              src={media.media_url}
              controls
              className="w-full rounded-lg"
            >
              Your browser doesn't support video
            </video>
          ) : (
            <img
              src={media.media_url || media.media_thumb}
              alt={media.title}
              className="w-full rounded-lg"
            />
          )}
        </div>

        <div className="border-t p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
