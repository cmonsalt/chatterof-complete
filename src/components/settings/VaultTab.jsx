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
  const [vaultLists, setVaultLists] = useState([])  // Carpetas/categorías de OF
  const [loadingVault, setLoadingVault] = useState(false)
  const [vaultCache, setVaultCache] = useState(null)
  const [vaultCacheTime, setVaultCacheTime] = useState(null)
  const [showMediaSelector, setShowMediaSelector] = useState(false)
  const [selectingForPart, setSelectingForPart] = useState(null)
  
  // 🖼️ Media Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewingMedia, setPreviewingMedia] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  
  // UI State
  const [expandedSessions, setExpandedSessions] = useState([])
  const [activeTab, setActiveTab] = useState('sessions')
  const [vaultFilter, setVaultFilter] = useState({ type: '', sortBy: 'newest', listId: '' })
  
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

      // 📁 Load Vault Lists (carpetas)
      try {
        const listsResponse = await fetch(`/api/onlyfans/get-vault-lists?accountId=${model.of_account_id}`);
        const listsData = await listsResponse.json();
        
        if (listsData.success && listsData.lists) {
          console.log('✅ Vault lists loaded:', listsData.lists.length);
          setVaultLists(listsData.lists);
        } else {
          setVaultLists([]);
        }
      } catch (err) {
        console.log('⚠️ Error loading vault lists:', err);
        setVaultLists([]);
      }

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

  const handleCreateSingle = async (e) => {
    e.preventDefault()
    
    if (!singleForm.title || singleForm.base_price <= 0) {
      showMessage('error', 'Please fill title and price')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('catalog')
        .insert({
          model_id: modelId,
          offer_id: `single_${Date.now()}`,
          parent_type: 'single',
          title: singleForm.title,
          description: singleForm.description,
          base_price: parseFloat(singleForm.base_price),
          nivel: parseInt(singleForm.nivel),
          tags: singleForm.tags,
          of_media_ids: [],
          media_thumbnails: {}
        })

      if (error) throw error

      showMessage('success', `✅ Single "${singleForm.title}" created!`)
      setSingleForm({ title: '', description: '', base_price: 0, nivel: 5, tags: '', of_media_ids: [] })
      setShowNewSingleModal(false)
      await loadSingles()
      
    } catch (error) {
      console.error('Error creating single:', error)
      showMessage('error', 'Error creating single')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSingle = async (singleId) => {
    if (!confirm('Delete this single?')) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('id', singleId)

      if (error) throw error

      showMessage('success', '✅ Single deleted!')
      await loadSingles()
      
    } catch (error) {
      console.error('Error deleting single:', error)
      showMessage('error', 'Error deleting single')
    } finally {
      setSaving(false)
    }
  }

  // 🖼️ OPEN PREVIEW MODAL
  const openPreviewModal = async (media) => {
    setPreviewingMedia(media)
    setShowPreviewModal(true)
    setLoadingPreview(true)
    setPreviewUrl(null)

    try {
      // Get OF account_id
      const { data: model } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', modelId)
        .single()

      if (!model?.of_account_id) {
        throw new Error('No OnlyFans account connected')
      }

      // Para VIDEOS: usar preview o thumb (no full porque es muy pesado)
      // Para FOTOS: usar full (mejor calidad)
      const urlToScrape = media.type === 'video'
        ? (media.preview || media.thumb)
        : (media.full || media.preview || media.thumb)

      // Scrape media to get temporary URL
      const response = await fetch(
        `/api/onlyfans/scrape-media?accountId=${model.of_account_id}&mediaId=${encodeURIComponent(urlToScrape)}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to scrape media')
      }

      setPreviewUrl(data.temporary_url)
      
    } catch (error) {
      console.error('Error loading preview:', error)
      showMessage('error', 'Error loading preview')
    } finally {
      setLoadingPreview(false)
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
            onClick={() => {
              if (activeTab === 'sessions') {
                setShowNewSessionModal(true)
              } else if (activeTab === 'singles') {
                setShowNewSingleModal(true)
              }
            }}
            disabled={activeTab === 'vault'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + {activeTab === 'sessions' ? 'Create Session' : activeTab === 'singles' ? 'Create Single' : 'Create'}
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
                ? 'border-green-600 text-green-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            🎯 Singles ({singles.length})
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
        
        {/* Filters for Vault tab */}
        {activeTab === 'vault' && (
          <div className="py-2 px-4 bg-gray-50 flex gap-4 items-center">
            <select
              className="px-3 py-1 border rounded text-sm"
              onChange={(e) => setVaultFilter({ ...vaultFilter, type: e.target.value })}
              value={vaultFilter.type}
            >
              <option value="">All Types</option>
              <option value="photo">📷 Photos</option>
              <option value="video">🎥 Videos</option>
              <option value="audio">🎵 Audio</option>
            </select>
            
            <select
              className="px-3 py-1 border rounded text-sm"
              onChange={(e) => setVaultFilter({ ...vaultFilter, listId: e.target.value })}
              value={vaultFilter.listId}
            >
              <option value="">All Folders</option>
              {vaultLists.map(list => (
                <option key={list.id} value={list.id}>
                  📁 {list.name} ({list.count || 0})
                </option>
              ))}
            </select>
            
            <select
              className="px-3 py-1 border rounded text-sm"
              onChange={(e) => setVaultFilter({ ...vaultFilter, sortBy: e.target.value })}
              value={vaultFilter.sortBy}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="likes">Most Liked</option>
            </select>
          </div>
        )}
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
      ) : activeTab === 'singles' ? (
        <SinglesView
          singles={singles}
          tierRules={tierRules}
          calculatePriceForTier={calculatePriceForTier}
          getNivelLabel={getNivelLabel}
          openMediaSelectorForPart={openMediaSelectorForPart}
          handleDeleteSingle={handleDeleteSingle}
          saving={saving}
        />
      ) : (
        <VaultMediaGrid
          medias={vaultMedias
            .filter(m => !vaultFilter.type || m.type === vaultFilter.type)
            .filter(m => !vaultFilter.listId || (m.lists && m.lists.includes(parseInt(vaultFilter.listId))))
            .sort((a, b) => {
              if (vaultFilter.sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
              if (vaultFilter.sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
              if (vaultFilter.sortBy === 'likes') return (b.likesCount || 0) - (a.likesCount || 0)
              return 0
            })
          }
          loading={loadingVault}
          onMediaClick={openPreviewModal}
        />
      )}

      {/* Media Selector Modal */}
      {showMediaSelector && (
        <MediaSelectorModal
          medias={vaultMedias}
          onSelect={handleAssignMediaToPart}
          onMediaClick={openPreviewModal}
          onClose={() => {
            setShowMediaSelector(false)
            setSelectingForPart(null)
          }}
          partTitle={selectingForPart?.title}
        />
      )}

      {/* Media Preview Modal */}
      {showPreviewModal && (
        <MediaPreviewModal
          show={showPreviewModal}
          media={previewingMedia}
          previewUrl={previewUrl}
          loading={loadingPreview}
          onClose={() => {
            setShowPreviewModal(false)
            setPreviewingMedia(null)
            setPreviewUrl(null)
          }}
          onAssign={selectingForPart ? () => {
            // Si hay un part seleccionado, asignar directamente
            handleAssignMediaToPart(previewingMedia)
            setShowPreviewModal(false)
            setPreviewingMedia(null)
            setPreviewUrl(null)
          } : null}
          partTitle={selectingForPart?.title}
        />
      )}

      {/* Media Preview Modal */}
      {showPreviewModal && (
        <MediaPreviewModal
          show={showPreviewModal}
          media={previewingMedia}
          previewUrl={previewUrl}
          loading={loadingPreview}
          onClose={() => {
            setShowPreviewModal(false)
            setPreviewingMedia(null)
            setPreviewUrl(null)
          }}
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

      {/* New Single Modal */}
      {showNewSingleModal && (
        <NewSingleModal
          singleForm={singleForm}
          setSingleForm={setSingleForm}
          handleCreateSingle={handleCreateSingle}
          setShowNewSingleModal={setShowNewSingleModal}
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

// Singles View component
function SinglesView({
  singles,
  tierRules,
  calculatePriceForTier,
  getNivelLabel,
  openMediaSelectorForPart,
  handleDeleteSingle,
  saving
}) {
  if (singles.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No singles yet. Singles are standalone PPV content.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {singles.map(single => {
        const nivelLabel = getNivelLabel(single.nivel)
        
        return (
          <div key={single.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-lg">{single.title}</h3>
              <button
                onClick={() => handleDeleteSingle(single.id)}
                className="text-red-500 hover:text-red-700"
                disabled={saving}
              >
                🗑️
              </button>
            </div>

            {single.description && (
              <p className="text-sm text-gray-600 mb-3">{single.description}</p>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs px-2 py-1 rounded ${nivelLabel.color}`}>
                {nivelLabel.text}
              </span>
              <span className="text-xs text-gray-500">Nivel {single.nivel}</span>
            </div>

            {/* Pricing Tiers */}
            <div className="space-y-1 text-sm mb-3">
              {tierRules.map(tier => (
                <div key={tier.id} className="flex justify-between">
                  <span className="text-gray-600">{tier.emoji} {tier.tier_name}:</span>
                  <span className="font-medium">${calculatePriceForTier(single.base_price, tier.price_multiplier)}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => openMediaSelectorForPart(single)}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              {single.of_media_id ? '✓ Media Assigned' : '+ Assign Media'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Vault Media Grid  
function VaultMediaGrid({ medias, loading, onMediaClick }) {
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
    <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {medias.map(media => {
        const thumbUrl = media.thumb
        
        return (
          <div 
            key={media.id} 
            onClick={() => onMediaClick && onMediaClick(media)}
            className="border rounded-lg overflow-hidden hover:shadow-lg hover:border-purple-500 transition-all cursor-pointer group"
          >
            <div className="aspect-square bg-gray-100 relative flex items-center justify-center overflow-hidden">
              {thumbUrl ? (
                <img 
                  src={thumbUrl}
                  alt={`Media ${media.id}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div 
                className="flex items-center justify-center w-full h-full text-4xl"
                style={{ display: thumbUrl ? 'none' : 'flex' }}
              >
                {media.type === 'video' ? '🎥' : media.type === 'audio' ? '🎵' : '📷'}
              </div>
            </div>
            
            <div className="p-1.5 bg-white">
              <p className="text-[10px] text-gray-600 truncate text-center flex items-center justify-center gap-1">
                <span>{media.type === 'video' ? '🎥' : '📷'}</span>
                <span>{media.likesCount || 0}❤️</span>
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Media Selector Modal
function MediaSelectorModal({ medias, onSelect, onClose, partTitle, onMediaClick }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <h3 className="text-xl font-bold">Select Media for: {partTitle}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {medias.map(media => (
              <div
                key={media.id}
                onClick={() => onMediaClick(media)}
                className="border rounded-lg overflow-hidden hover:shadow-lg hover:border-purple-500 transition-all cursor-pointer group"
              >
                <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
                  <div className="text-4xl">
                    {media.type === 'video' ? '🎥' : media.type === 'audio' ? '🎵' : '📷'}
                  </div>
                  
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">
                      Preview
                    </span>
                  </div>
                </div>
                
                <div className="p-1 bg-white">
                  <p className="text-[9px] text-gray-600 truncate text-center">
                    {media.type === 'video' ? '🎥' : '📷'} {media.likesCount || 0}❤️
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end">
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

// Media Preview Modal
function MediaPreviewModal({ 
  show, 
  media, 
  previewUrl, 
  loading, 
  onClose, 
  onAssign,
  partTitle
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Media Preview</h3>
            {partTitle && <p className="text-sm text-gray-600">For: {partTitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-2">⏳</div>
                <p className="text-gray-600">Loading preview...</p>
              </div>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt="Media preview"
              className="w-full rounded-lg"
            />
          ) : (
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {media?.type === 'video' ? '🎥' : media?.type === 'audio' ? '🎵' : '📷'}
                </div>
                <p className="text-gray-600">Preview not available</p>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Type:</span>
                <span className="ml-2 font-medium">
                  {media?.type === 'video' ? '🎥 Video' : media?.type === 'audio' ? '🎵 Audio' : '📷 Photo'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Likes:</span>
                <span className="ml-2 font-medium">❤️ {media?.likesCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
          {onAssign && (
            <button
              onClick={onAssign}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Assign to Part
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// New Single Modal
function NewSingleModal({ singleForm, setSingleForm, handleCreateSingle, setShowNewSingleModal, saving }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Create Single PPV</h3>
        
        <form onSubmit={handleCreateSingle} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={singleForm.title}
              onChange={(e) => setSingleForm({ ...singleForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={singleForm.description}
              onChange={(e) => setSingleForm({ ...singleForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Base Price ($) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={singleForm.base_price}
              onChange={(e) => setSingleForm({ ...singleForm, base_price: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nivel (1-10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={singleForm.nivel}
              onChange={(e) => setSingleForm({ ...singleForm, nivel: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <input
              type="text"
              value={singleForm.tags}
              onChange={(e) => setSingleForm({ ...singleForm, tags: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="lingerie, solo, etc"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => setShowNewSingleModal(false)}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Creating...' : 'Create Single'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
