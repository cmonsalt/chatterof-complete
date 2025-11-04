import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function VaultTab({ modelId }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  // Data
  const [sessions, setSessions] = useState([])
  const [singles, setSingles] = useState([])
  const [tierRules, setTierRules] = useState([])
  
  // 🎬 OnlyFans Vault Media
  const [vaultMedias, setVaultMedias] = useState([])
  const [loadingVault, setLoadingVault] = useState(false)
  const [vaultCache, setVaultCache] = useState(null)
  const [vaultCacheTime, setVaultCacheTime] = useState(null)
  const [showMediaSelector, setShowMediaSelector] = useState(false)
  const [selectingForPart, setSelectingForPart] = useState(null)
  
  // UI State
  const [expandedSessions, setExpandedSessions] = useState([])
  const [activeTab, setActiveTab] = useState('sessions')
  
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
        loadTierRules(),
        loadVaultFromOnlyFans()
      ])
    } catch (error) {
      console.error('Error loading vault data:', error)
      showMessage('error', 'Error loading vault data')
    } finally {
      setLoading(false)
    }
  }

  // 🎬 LOAD VAULT FROM ONLYFANS (with localStorage cache)
  const loadVaultFromOnlyFans = async (forceRefresh = false) => {
    // Check localStorage cache (5 minutes)
    const CACHE_KEY = `vault_${modelId}`;
    const CACHE_TIME_KEY = `vault_${modelId}_time`;
    
    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        
        if (cachedData && cachedTime) {
          const cacheAge = Date.now() - parseInt(cachedTime);
          if (cacheAge < 300000) { // 5 min
            console.log('✅ Using localStorage cache');
            const parsed = JSON.parse(cachedData);
            setVaultMedias(parsed);
            setVaultCache(parsed);
            setVaultCacheTime(parseInt(cachedTime));
            return;
          }
        }
      } catch (err) {
        console.log('Cache read error:', err);
      }
    }

    setLoadingVault(true);
    try {
      const { data: model } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', modelId)
        .single();

      if (!model?.of_account_id) {
        console.log('⚠️ No OnlyFans account connected');
        setVaultMedias([]);
        return;
      }

      const response = await fetch(`/api/onlyfans/get-vault?accountId=${model.of_account_id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load vault');
      }

      console.log('✅ Vault loaded:', data.medias?.length || 0, 'medias');
      
      const medias = data.medias || [];
      
      // Save to localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(medias));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.log('Cache write error:', err);
      }
      
      setVaultMedias(medias);
      setVaultCache(medias);
      setVaultCacheTime(Date.now());

    } catch (error) {
      console.error('Error loading OnlyFans vault:', error);
      showMessage('error', 'Error loading OnlyFans vault');
    } finally {
      setLoadingVault(false);
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

  const handleCreateSession = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const sessionId = `session_${Date.now()}`
      const parts = []
      
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

      showMessage('success', `✅ Session "${sessionForm.name}" created!`)
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

      showMessage('success', '✅ Session deleted!')
      await loadSessions()
      
    } catch (error) {
      console.error('Error deleting session:', error)
      showMessage('error', 'Error deleting session')
    } finally {
      setSaving(false)
    }
  }

  // 🎬 OPEN MEDIA SELECTOR
  const openMediaSelectorForPart = (part) => {
    setSelectingForPart(part)
    setShowMediaSelector(true)
  }

  // 🎬 ASSIGN MEDIA TO PART
  const handleAssignMediaToPart = async (media) => {
    if (!selectingForPart) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('catalog')
        .update({
          of_media_ids: [media.id],
          media_thumbnails: {
            [media.id]: media.thumb?.url || media.preview?.url
          }
        })
        .eq('id', selectingForPart.id)

      if (error) throw error

      showMessage('success', '✅ Media assigned!')
      setShowMediaSelector(false)
      setSelectingForPart(null)
      
      if (selectingForPart.parent_type === 'session') {
        await loadSessions()
      } else {
        await loadSingles()
      }
      
    } catch (error) {
      console.error('Error assigning media:', error)
      showMessage('error', 'Error assigning media')
    } finally {
      setSaving(false)
    }
  }

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
            Organize your PPV content • {vaultMedias.length} medias from OnlyFans
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => loadVaultFromOnlyFans(true)}
            disabled={loadingVault}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {loadingVault ? '🔄 Syncing...' : '🔄 Refresh Vault'}
          </button>
          <button
            onClick={() => setShowNewSessionModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Create Session
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
            onClick={() => setActiveTab('vault')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'vault'
                ? 'border-purple-600 text-purple-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🎬 OnlyFans Vault ({vaultMedias.length})
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
          openMediaSelectorForPart={openMediaSelectorForPart}
          handleDeleteSession={handleDeleteSession}
          saving={saving}
        />
      ) : (
        <VaultMediaGrid
          medias={vaultMedias}
          loading={loadingVault}
        />
      )}

      {/* Media Selector Modal */}
      {showMediaSelector && (
        <MediaSelectorModal
          medias={vaultMedias}
          onSelect={handleAssignMediaToPart}
          onClose={() => {
            setShowMediaSelector(false)
            setSelectingForPart(null)
          }}
          partTitle={selectingForPart?.title}
        />
      )}

      {/* New Session Modal */}
      {showNewSessionModal && (
        <NewSessionModal
          sessionForm={sessionForm}
          setSessionForm={setSessionForm}
          handleCreateSession={handleCreateSession}
          setShowNewSessionModal={setShowNewSessionModal}
          saving={saving}
        />
      )}
    </div>
  )
}

// SessionsView component (simplified)
function SessionsView({ 
  sessions, 
  expandedSessions, 
  toggleSession, 
  tierRules,
  calculatePriceForTier,
  getNivelLabel,
  openMediaSelectorForPart,
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
        <div key={session.session_id} className="border border-gray-200 rounded-lg">
          <div 
            className="bg-gray-50 p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100"
            onClick={() => toggleSession(session.session_id)}
          >
            <div>
              <h3 className="text-lg font-semibold">{session.name}</h3>
              <p className="text-sm text-gray-600">{session.parts.length} parts</p>
            </div>
            <span>{expandedSessions.includes(session.session_id) ? '▼' : '▶'}</span>
          </div>

          {expandedSessions.includes(session.session_id) && (
            <div className="p-4 space-y-3">
              {session.parts.map(part => (
                <div key={part.id} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{part.title || `Part ${part.step_number}`}</h4>
                      {part.of_media_ids?.length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          📎 {part.of_media_ids.length} media attached
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => openMediaSelectorForPart(part)}
                      className="px-3 py-1 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                    >
                      📎 Attach Media
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

// Vault Media Grid
function VaultMediaGrid({ medias, loading }) {
  if (loading) {
    return <div className="text-center py-12">Loading vault...</div>
  }

  if (medias.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No medias in your OnlyFans vault</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {medias.map(media => {
        // Usar Weserv proxy para las imágenes
        const proxyUrl = media.thumb 
          ? `https://images.weserv.nl/?url=${encodeURIComponent(media.thumb)}`
          : null;
        
        return (
          <div key={media.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <div className="aspect-video bg-gray-100 relative">
              {proxyUrl ? (
                <img 
                  src={proxyUrl}
                  alt={`Media ${media.id}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="flex items-center justify-center h-full text-gray-400 text-4xl"
                style={{ display: proxyUrl ? 'none' : 'flex' }}
              >
                {media.type === 'video' ? '🎥' : media.type === 'audio' ? '🎵' : '📷'}
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs text-gray-600 truncate">
                {media.type === 'video' ? '🎥' : media.type === 'audio' ? '🎵' : '📷'} 
                {' '}
                {media.type} • {media.likesCount || 0} ❤️
              </p>
            </div>
          </div>
        );
      })}
    </div>
  )
}

// Media Selector Modal
function MediaSelectorModal({ medias, onSelect, onClose, partTitle }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold">Select Media for: {partTitle}</h3>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-3 gap-4">
            {medias.map(media => (
              <button
                key={media.id}
                onClick={() => onSelect(media)}
                className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-indigo-600 transition-colors"
              >
                <div className="aspect-video bg-gray-100">
                  {media.thumb?.url ? (
                    <img 
                      src={media.thumb.url} 
                      alt="Media"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      🎬
                    </div>
                  )}
                </div>
                <div className="p-2 text-xs text-gray-600">
                  {media.type === 'video' ? '🎥' : '📷'} Select
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// New Session Modal (simplified)
function NewSessionModal({ sessionForm, setSessionForm, handleCreateSession, setShowNewSessionModal, saving }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Create PPV Session</h3>
        
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Session Name *</label>
            <input
              type="text"
              value={sessionForm.name}
              onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={sessionForm.description}
              onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Number of Parts (1-10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={sessionForm.steps_count}
              onChange={(e) => setSessionForm({ ...sessionForm, steps_count: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowNewSessionModal(false)}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
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
