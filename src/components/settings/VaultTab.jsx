import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ═══════════════════════════════════════════════════════════════
// 🗂️ VAULT TAB - COMPLETE COMPONENT
// ═══════════════════════════════════════════════════════════════
// Gestión completa de contenido PPV (Sessions + Singles)
// ═══════════════════════════════════════════════════════════════

export default function VaultTab({ modelId }) {
  // ═══════════════════════════════════════════════════════════════
  // 📊 STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  // Data
  const [sessions, setSessions] = useState([])
  const [singles, setSingles] = useState([])
  const [tierRules, setTierRules] = useState([])
  
  // UI State
  const [expandedSessions, setExpandedSessions] = useState([])
  const [activeTab, setActiveTab] = useState('sessions') // 'sessions' | 'singles'
  
  // Modals
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [showNewSingleModal, setShowNewSingleModal] = useState(false)
  const [showEditPartModal, setShowEditPartModal] = useState(false)
  const [editingPart, setEditingPart] = useState(null)
  
  // Forms
  const [sessionForm, setSessionForm] = useState({
    name: '',
    description: '',
    steps_count: 3
  })
  
  const [singleForm, setSingleForm] = useState({
    title: '',
    description: '',
    base_price: 0,
    nivel: 5,
    tags: '',
    of_media_ids: []
  })
  
  const [partForm, setPartForm] = useState({
    title: '',
    description: '',
    base_price: 0,
    nivel: 5,
    tags: '',
    of_media_ids: []
  })

  // ═══════════════════════════════════════════════════════════════
  // 🔄 DATA LOADING
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (modelId) {
      loadData()
    }
  }, [modelId])

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        loadSessions(),
        loadSingles(),
        loadTierRules()
      ])
    } catch (error) {
      console.error('Error loading vault data:', error)
      showMessage('error', 'Error loading vault data')
    } finally {
      setLoading(false)
    }
  }

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .eq('parent_type', 'session')
        .order('session_id', { ascending: false })
        .order('step_number', { ascending: true })

      if (error) throw error

      // Group by session_id
      const sessionsMap = {}
      data?.forEach(item => {
        if (!sessionsMap[item.session_id]) {
          sessionsMap[item.session_id] = {
            session_id: item.session_id,
            name: item.session_name || 'Unnamed Session',
            description: item.session_description || '',
            created_at: item.created_at,
            model_id: item.model_id,
            parts: []
          }
        }
        sessionsMap[item.session_id].parts.push(item)
      })

      setSessions(Object.values(sessionsMap))
    } catch (error) {
      console.error('Error loading sessions:', error)
      throw error
    }
  }

  const loadSingles = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .eq('parent_type', 'single')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSingles(data || [])
    } catch (error) {
      console.error('Error loading singles:', error)
      throw error
    }
  }

  const loadTierRules = async () => {
    try {
      const { data, error } = await supabase
        .from('tier_rules')
        .select('*')
        .eq('model_id', modelId)
        .order('min_spent', { ascending: true })

      if (error) throw error
      setTierRules(data || [])
    } catch (error) {
      console.error('Error loading tier rules:', error)
      throw error
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 📦 SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  
  const handleCreateSession = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const sessionId = `session_${Date.now()}`
      const parts = []
      
      // Create all parts for the session
      for (let i = 1; i <= sessionForm.steps_count; i++) {
        parts.push({
          model_id: modelId,
          offer_id: `${sessionId}_step${i}`,
          parent_type: 'session',
          session_id: sessionId,
          session_name: sessionForm.name,
          session_description: sessionForm.description,
          step_number: i,
          title: `Part ${i}`,
          description: '',
          base_price: 0,
          nivel: 5,
          tags: '',
          of_media_ids: [],
          media_thumbnails: {}
        })
      }

      const { error } = await supabase
        .from('catalog')
        .insert(parts)

      if (error) throw error

      showMessage('success', `✅ Session "${sessionForm.name}" created with ${sessionForm.steps_count} parts!`)
      
      // Reset form and reload
      setSessionForm({ name: '', description: '', steps_count: 3 })
      setShowNewSessionModal(false)
      await loadSessions()
      
    } catch (error) {
      console.error('Error creating session:', error)
      showMessage('error', 'Error creating session')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSession = async (sessionId, sessionName) => {
    if (!confirm(`Delete session "${sessionName}" and all its parts?`)) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('session_id', sessionId)

      if (error) throw error

      showMessage('success', '✅ Session deleted')
      await loadSessions()
      
    } catch (error) {
      console.error('Error deleting session:', error)
      showMessage('error', 'Error deleting session')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎬 SINGLE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  
  const handleCreateSingle = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const offerId = `single_${Date.now()}`
      
      const { error } = await supabase
        .from('catalog')
        .insert({
          model_id: modelId,
          offer_id: offerId,
          parent_type: 'single',
          title: singleForm.title,
          description: singleForm.description,
          base_price: singleForm.base_price,
          nivel: singleForm.nivel,
          tags: singleForm.tags,
          of_media_ids: singleForm.of_media_ids,
          media_thumbnails: {}
        })

      if (error) throw error

      showMessage('success', '✅ Individual PPV created!')
      
      // Reset form and reload
      setSingleForm({
        title: '',
        description: '',
        base_price: 0,
        nivel: 5,
        tags: '',
        of_media_ids: []
      })
      setShowNewSingleModal(false)
      await loadSingles()
      
    } catch (error) {
      console.error('Error creating single:', error)
      showMessage('error', 'Error creating single')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSingle = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('id', id)

      if (error) throw error

      showMessage('success', '✅ Single deleted')
      await loadSingles()
      
    } catch (error) {
      console.error('Error deleting single:', error)
      showMessage('error', 'Error deleting single')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ✏️ PART EDITING
  // ═══════════════════════════════════════════════════════════════
  
  const openEditPartModal = (part) => {
    setEditingPart(part)
    setPartForm({
      title: part.title || '',
      description: part.description || '',
      base_price: part.base_price || 0,
      nivel: part.nivel || 5,
      tags: part.tags || '',
      of_media_ids: part.of_media_ids || []
    })
    setShowEditPartModal(true)
  }

  const handleUpdatePart = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('catalog')
        .update({
          title: partForm.title,
          description: partForm.description,
          base_price: partForm.base_price,
          nivel: partForm.nivel,
          tags: partForm.tags,
          of_media_ids: partForm.of_media_ids
        })
        .eq('id', editingPart.id)

      if (error) throw error

      showMessage('success', '✅ Part updated!')
      setShowEditPartModal(false)
      setEditingPart(null)
      
      // Reload appropriate data
      if (editingPart.parent_type === 'session') {
        await loadSessions()
      } else {
        await loadSingles()
      }
      
    } catch (error) {
      console.error('Error updating part:', error)
      showMessage('error', 'Error updating part')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎨 HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => 
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    )
  }

  const calculatePriceForTier = (basePrice, multiplier) => {
    return (basePrice * multiplier).toFixed(2)
  }

  const getNivelLabel = (nivel) => {
    if (nivel <= 3) return { text: 'Soft', color: 'bg-green-100 text-green-800' }
    if (nivel <= 6) return { text: 'Medium', color: 'bg-yellow-100 text-yellow-800' }
    return { text: 'Hardcore', color: 'bg-red-100 text-red-800' }
  }

  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════════
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">🗂️ Content Vault</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage your PPV content library (Sessions & Singles)
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Create Session
          </button>
          <button
            onClick={() => setShowNewSingleModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            + Add Single
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-indigo-600 text-indigo-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📦 Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('singles')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'singles'
                ? 'border-purple-600 text-purple-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🎬 Singles ({singles.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'sessions' ? (
        <SessionsView
          sessions={sessions}
          expandedSessions={expandedSessions}
          toggleSession={toggleSession}
          tierRules={tierRules}
          calculatePriceForTier={calculatePriceForTier}
          getNivelLabel={getNivelLabel}
          openEditPartModal={openEditPartModal}
          handleDeleteSession={handleDeleteSession}
          saving={saving}
        />
      ) : (
        <SinglesView
          singles={singles}
          tierRules={tierRules}
          calculatePriceForTier={calculatePriceForTier}
          getNivelLabel={getNivelLabel}
          openEditPartModal={openEditPartModal}
          handleDeleteSingle={handleDeleteSingle}
          saving={saving}
        />
      )}

      {/* Modals */}
      {showNewSessionModal && (
        <NewSessionModal
          sessionForm={sessionForm}
          setSessionForm={setSessionForm}
          handleCreateSession={handleCreateSession}
          setShowNewSessionModal={setShowNewSessionModal}
          saving={saving}
        />
      )}

      {showNewSingleModal && (
        <NewSingleModal
          singleForm={singleForm}
          setSingleForm={setSingleForm}
          handleCreateSingle={handleCreateSingle}
          setShowNewSingleModal={setShowNewSingleModal}
          saving={saving}
        />
      )}

      {showEditPartModal && editingPart && (
        <EditPartModal
          partForm={partForm}
          setPartForm={setPartForm}
          handleUpdatePart={handleUpdatePart}
          setShowEditPartModal={setShowEditPartModal}
          editingPart={editingPart}
          saving={saving}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 📦 SESSIONS VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════

function SessionsView({ 
  sessions, 
  expandedSessions, 
  toggleSession, 
  tierRules,
  calculatePriceForTier,
  getNivelLabel,
  openEditPartModal,
  handleDeleteSession,
  saving
}) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No sessions yet. Create your first PPV set!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sessions.map(session => (
        <div key={session.session_id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Session Header */}
          <div 
            className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => toggleSession(session.session_id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                  {session.parts.length} parts
                </span>
              </div>
              {session.description && (
                <p className="text-sm text-gray-600 mt-1">{session.description}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteSession(session.session_id, session.name)
                }}
                disabled={saving}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                🗑️ Delete
              </button>
              <span className="text-gray-400">
                {expandedSessions.includes(session.session_id) ? '▼' : '▶'}
              </span>
            </div>
          </div>

          {/* Session Parts */}
          {expandedSessions.includes(session.session_id) && (
            <div className="p-4 space-y-3 bg-white">
              {session.parts.map((part, index) => (
                <div key={part.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          Part {part.step_number}
                        </span>
                        {part.of_media_ids?.length > 0 && (
                          <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                            {part.of_media_ids.length} media
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded ${getNivelLabel(part.nivel).color}`}>
                          {getNivelLabel(part.nivel).text} (Lv {part.nivel})
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-gray-900">{part.title || `Part ${part.step_number}`}</h4>
                      {part.description && (
                        <p className="text-sm text-gray-600 mt-1">{part.description}</p>
                      )}
                      {part.tags && (
                        <p className="text-xs text-gray-500 mt-2">Tags: {part.tags}</p>
                      )}

                      {/* Tier Pricing */}
                      <div className="mt-3 flex gap-3">
                        {tierRules.map(tier => (
                          <div key={tier.id} className="text-sm">
                            <span className="font-medium">{tier.emoji} {tier.tier_name}:</span>
                            <span className="ml-1 text-gray-700">
                              ${calculatePriceForTier(part.base_price, tier.price_multiplier)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => openEditPartModal(part)}
                      className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🎬 SINGLES VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════

function SinglesView({ 
  singles,
  tierRules,
  calculatePriceForTier,
  getNivelLabel,
  openEditPartModal,
  handleDeleteSingle,
  saving
}) {
  if (singles.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No individual PPVs yet. Add your first one!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {singles.map(single => (
        <div key={single.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {single.of_media_ids?.length > 0 && (
                  <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                    {single.of_media_ids.length} media
                  </span>
                )}
                <span className={`px-2 py-1 text-xs rounded ${getNivelLabel(single.nivel).color}`}>
                  {getNivelLabel(single.nivel).text} (Lv {single.nivel})
                </span>
              </div>
              
              <h3 className="font-semibold text-gray-900">{single.title}</h3>
              {single.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{single.description}</p>
              )}
              {single.tags && (
                <p className="text-xs text-gray-500 mt-2">Tags: {single.tags}</p>
              )}
            </div>
          </div>

          {/* Tier Pricing */}
          <div className="mt-3 space-y-1">
            {tierRules.map(tier => (
              <div key={tier.id} className="flex justify-between text-sm">
                <span>{tier.emoji} {tier.tier_name}</span>
                <span className="font-medium">
                  ${calculatePriceForTier(single.base_price, tier.price_multiplier)}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => openEditPartModal(single)}
              className="flex-1 px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => handleDeleteSingle(single.id, single.title)}
              disabled={saving}
              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🆕 NEW SESSION MODAL
// ═══════════════════════════════════════════════════════════════

function NewSessionModal({ sessionForm, setSessionForm, handleCreateSession, setShowNewSessionModal, saving }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Create PPV Session</h3>
        
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Name *
            </label>
            <input
              type="text"
              value={sessionForm.name}
              onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Beach Yoga Experience"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={sessionForm.description}
              onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional description for AI storytelling"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Parts (1-10)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={sessionForm.steps_count}
              onChange={(e) => setSessionForm({ ...sessionForm, steps_count: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowNewSessionModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 🆕 NEW SINGLE MODAL
// ═══════════════════════════════════════════════════════════════

function NewSingleModal({ singleForm, setSingleForm, handleCreateSingle, setShowNewSingleModal, saving }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Create Individual PPV</h3>
        
        <form onSubmit={handleCreateSingle} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={singleForm.title}
              onChange={(e) => setSingleForm({ ...singleForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., BJ POV Video"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={singleForm.description}
              onChange={(e) => setSingleForm({ ...singleForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Description for AI matching"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={singleForm.base_price}
              onChange={(e) => setSingleForm({ ...singleForm, base_price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Explicitness Level (1-10)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={singleForm.nivel}
              onChange={(e) => setSingleForm({ ...singleForm, nivel: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              1-3: Soft, 4-6: Medium, 7-10: Hardcore
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={singleForm.tags}
              onChange={(e) => setSingleForm({ ...singleForm, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., bj, pov, bedroom"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowNewSingleModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create PPV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ✏️ EDIT PART MODAL
// ═══════════════════════════════════════════════════════════════

function EditPartModal({ partForm, setPartForm, handleUpdatePart, setShowEditPartModal, editingPart, saving }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">
          Edit {editingPart.parent_type === 'session' ? `Part ${editingPart.step_number}` : 'PPV'}
        </h3>
        
        <form onSubmit={handleUpdatePart} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={partForm.title}
              onChange={(e) => setPartForm({ ...partForm, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={partForm.description}
              onChange={(e) => setPartForm({ ...partForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={partForm.base_price}
              onChange={(e) => setPartForm({ ...partForm, base_price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Explicitness Level (1-10)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={partForm.nivel}
              onChange={(e) => setPartForm({ ...partForm, nivel: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              1-3: Soft, 4-6: Medium, 7-10: Hardcore
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={partForm.tags}
              onChange={(e) => setPartForm({ ...partForm, tags: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., beach, yoga, outdoor"
            />
          </div>

          {/* TODO: Add media management UI here */}
          {partForm.of_media_ids?.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                📁 {partForm.of_media_ids.length} media files attached
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowEditPartModal(false)
                setEditingPart(null)
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
