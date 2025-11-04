import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import ConnectOnlyFans from '../components/ConnectOnlyFans'

export default function Settings() {
  const { modelId, currentModel } = useAuth()
  const [activeTab, setActiveTab] = useState('connect') // ✨ Changed default to connect
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  // Model Config
  const [config, setConfig] = useState(null)
  
  // Tier Rules
  const [tierRules, setTierRules] = useState([])
  
  // Catalog
  const [catalog, setCatalog] = useState([])
  const [showAddCatalog, setShowAddCatalog] = useState(false)
  const [newItem, setNewItem] = useState({
    offer_id: '',
    title: '',
    base_price: '',
    nivel: 1,
    tags: '',
    description: ''
  })

  // 🔗 OnlyFans Connection  
  const [isConnected, setIsConnected] = useState(false)
  const [accountId, setAccountId] = useState(null)

  // Fan Notes
  const [fans, setFans] = useState([])
  const [filteredFansNotes, setFilteredFansNotes] = useState([])
  const [fanSearchQuery, setFanSearchQuery] = useState('')
  const [selectedFan, setSelectedFan] = useState(null)
  const [fanNotes, setFanNotes] = useState('')

  // 🗂️ VAULT
  const [sessions, setSessions] = useState([])
  const [singles, setSingles] = useState([])
  const [expandedSessions, setExpandedSessions] = useState([])
  const [showNewSession, setShowNewSession] = useState(false)
  const [showAddContent, setShowAddContent] = useState(false)
  const [showAddSingle, setShowAddSingle] = useState(false)
  const [sessionForm, setSessionForm] = useState({
    name: '',
    description: '',
    steps_count: 3
  })
  const [contentForm, setContentForm] = useState({
    session_id: null,
    step_number: null,
    type: 'single',
    title: '',
    description: '',
    price: '',
    intensity: 'medium',
    tags: '',
    of_media_ids: []
  })

  useEffect(() => {
    if (modelId) {
      loadConfig()
      loadTierRules()
      loadVault()
      loadFans()
      checkConnection() // ✨ NEW
    }
  }, [modelId])

  // Filter fans based on search query
  useEffect(() => {
    if (fanSearchQuery.trim() === '') {
      setFilteredFansNotes(fans)
    } else {
      const filtered = fans.filter(fan => 
        fan.fan_id.toLowerCase().includes(fanSearchQuery.toLowerCase()) ||
        fan.name?.toLowerCase().includes(fanSearchQuery.toLowerCase()) ||
        fan.tier?.toLowerCase().includes(fanSearchQuery.toLowerCase())
      )
      setFilteredFansNotes(filtered)
    }
  }, [fanSearchQuery, fans])

  const loadConfig = async () => {
    try {
      // Cargar model_configs
      const { data: configData, error: configError } = await supabase
        .from('model_configs')
        .select('*')
        .eq('model_id', modelId)
        .single()

      if (configError) throw configError

      // Cargar models (para name, age, niche, model_notes)
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('name, age, niche, model_notes')
        .eq('model_id', modelId)
        .single()

      if (modelError) throw modelError

      // Combinar datos
      setConfig({
        ...configData,
        name: modelData.name,
        age: modelData.age,
        niche: modelData.niche,
        model_notes: modelData.model_notes || ''
      })
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
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
    }
  }

  // 🗂️ Load Vault (Sessions + Singles)
  const loadVault = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const sessionsMap = {}
      const singlesArray = []

      data?.forEach(item => {
        if (item.parent_type === 'session') {
          if (!sessionsMap[item.session_id]) {
            sessionsMap[item.session_id] = {
              session_id: item.session_id,
              name: item.session_name || 'Unnamed Session',
              description: item.session_description || '',
              created_at: item.created_at,
              steps: []
            }
          }
          sessionsMap[item.session_id].steps.push(item)
        } else if (item.parent_type === 'single') {
          singlesArray.push(item)
        }
      })

      Object.values(sessionsMap).forEach(session => {
        session.steps.sort((a, b) => a.step_number - b.step_number)
      })

      setSessions(Object.values(sessionsMap))
      setSingles(singlesArray)
    } catch (error) {
      console.error('Error loading vault:', error)
    }
  }

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => 
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    )
  }

  const handleCreateSession = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const sessionId = `session_${Date.now()}`
      const steps = []
      
      for (let i = 1; i <= sessionForm.steps_count; i++) {
        steps.push({
          model_id: modelId,
          offer_id: `${sessionId}_step${i}`,
          parent_type: 'session',
          session_id: sessionId,
          session_name: sessionForm.name,
          session_description: sessionForm.description,
          step_number: i,
          title: `Step ${i}`,
          description: '',
          base_price: 0,
          nivel: 5,
          tags: ''
        })
      }

      const { error } = await supabase.from('catalog').insert(steps)
      if (error) throw error

      setMessage({ type: 'success', text: '✅ Session created!' })
      setShowNewSession(false)
      setSessionForm({ name: '', description: '', steps_count: 3 })
      loadVault()
    } catch (error) {
      console.error('Error creating session:', error)
      setMessage({ type: 'error', text: '❌ Error creating session' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddContent = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const levelMap = { soft: 2, medium: 5, hardcore: 9 }
      const nivel = levelMap[contentForm.intensity]

      const { error } = await supabase
        .from('catalog')
        .update({
          title: contentForm.title,
          description: contentForm.description,
          base_price: parseFloat(contentForm.price),
          nivel: nivel,
          tags: contentForm.tags
        })
        .eq('model_id', modelId)
        .eq('session_id', contentForm.session_id)
        .eq('step_number', contentForm.step_number)

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Content added!' })
      setShowAddContent(false)
      setContentForm({
        session_id: null,
        step_number: null,
        type: 'single',
        title: '',
        description: '',
        price: '',
        intensity: 'medium',
        tags: '',
        of_media_ids: []
      })
      loadVault()
    } catch (error) {
      console.error('Error adding content:', error)
      setMessage({ type: 'error', text: '❌ Error adding content' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddSingle = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const levelMap = { soft: 2, medium: 5, hardcore: 9 }
      const nivel = levelMap[contentForm.intensity]

      const { error } = await supabase
        .from('catalog')
        .insert({
          model_id: modelId,
          offer_id: `single_${Date.now()}`,
          parent_type: 'single',
          title: contentForm.title,
          description: contentForm.description,
          base_price: parseFloat(contentForm.price),
          nivel: nivel,
          tags: contentForm.tags
        })

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Single added!' })
      setShowAddSingle(false)
      setContentForm({
        type: 'single',
        title: '',
        description: '',
        price: '',
        intensity: 'medium',
        tags: '',
        of_media_ids: []
      })
      loadVault()
    } catch (error) {
      console.error('Error adding single:', error)
      setMessage({ type: 'error', text: '❌ Error adding single' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Delete entire session? This cannot be undone.')) return

    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('session_id', sessionId)

      if (error) throw error
      setMessage({ type: 'success', text: '✅ Session deleted' })
      loadVault()
    } catch (error) {
      console.error('Error deleting session:', error)
      setMessage({ type: 'error', text: '❌ Error deleting session' })
    }
  }

  const handleDeleteSingle = async (id) => {
    if (!confirm('Delete this content?')) return

    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('id', id)

      if (error) throw error
      setMessage({ type: 'success', text: '✅ Content deleted' })
      loadVault()
    } catch (error) {
      console.error('Error deleting content:', error)
      setMessage({ type: 'error', text: '❌ Error deleting content' })
    }
  }

  const openEditStep = (session, step) => {
    const intensityMap = { 2: 'soft', 5: 'medium', 9: 'hardcore' }
    
    setContentForm({
      session_id: session.session_id,
      step_number: step.step_number,
      type: 'single',
      title: step.title || '',
      description: step.description || '',
      price: step.base_price || '',
      intensity: intensityMap[step.nivel] || 'medium',
      tags: step.tags || '',
      of_media_ids: []
    })
    setShowAddContent(true)
  }

  // Load fans for notes management
  const loadFans = async () => {
    try {
      const { data, error } = await supabase
        .from('fans')
        .select('fan_id, name, notes, tier, spent_total')
        .eq('model_id', modelId)
        .order('name', { ascending: true })

      if (error) throw error
      setFans(data || [])
      setFilteredFansNotes(data || [])
    } catch (error) {
      console.error('Error loading fans:', error)
    }
  }

  // ✨ Check OnlyFans Connection
  const checkConnection = async () => {
    try {
      const { data } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', modelId)
        .single()
      
      if (data?.of_account_id) {
        setIsConnected(true)
        setAccountId(data.of_account_id)
      }
    } catch (error) {
      console.log('No OF connection')
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect OnlyFans? You will need to reconnect.')) return
    
    try {
      await supabase
        .from('models')
        .update({ of_account_id: null })
        .eq('model_id', modelId)
      
      setIsConnected(false)
      setAccountId(null)
      setMessage({ type: 'success', text: '✅ Disconnected from OnlyFans' })
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    }
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      // Separar datos para models vs model_configs
      const { name, age, niche, model_notes, ...configData } = config

      // Actualizar models (name, age, niche, model_notes)
      const { error: modelError } = await supabase
        .from('models')
        .update({
          name: name,
          age: age,
          niche: niche,
          model_notes: model_notes
        })
        .eq('model_id', modelId)

      if (modelError) throw modelError

      // Actualizar model_configs (todo lo demás)
      const { error: configError } = await supabase
        .from('model_configs')
        .update(configData)
        .eq('model_id', modelId)

      if (configError) throw configError

      setMessage({ type: 'success', text: '✅ Config saved successfully!' })
      
      // Recargar para actualizar navbar con nuevo nombre
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTierRules = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Actualizar cada tier rule
      for (const rule of tierRules) {
        await supabase
          .from('tier_rules')
          .update({
            min_spent: rule.min_spent,
            max_spent: rule.max_spent,
            price_multiplier: rule.price_multiplier
          })
          .eq('id', rule.id)
      }

      setMessage({ type: 'success', text: '✅ Tier rules saved!' })
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleAddCatalogItem = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('catalog')
        .insert([{
          model_id: modelId,
          offer_id: newItem.offer_id,
          title: newItem.title,
          base_price: parseFloat(newItem.base_price),
          nivel: parseInt(newItem.nivel),
          tags: newItem.tags,
          description: newItem.description
        }])

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Catalog item added!' })
      setShowAddCatalog(false)
      setNewItem({
        offer_id: '',
        title: '',
        base_price: '',
        nivel: 1,
        tags: '',
        description: ''
      })
      loadCatalog()
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCatalogItem = async (itemId) => {
    if (!confirm('Delete this catalog item?')) return

    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Item deleted!' })
      loadCatalog()
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    }
  }

  const handleSelectFan = (fan) => {
    setSelectedFan(fan)
    setFanNotes(fan.notes || '')
  }

  const handleSaveFanNotes = async () => {
    if (!selectedFan) return

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('fans')
        .update({ notes: fanNotes })
        .eq('fan_id', selectedFan.fan_id)
        .eq('model_id', modelId)

      if (error) throw error

      setMessage({ type: 'success', text: `✅ Notes saved for ${selectedFan.name}` })
      
      // Update local state
      setFans(fans.map(f => 
        f.fan_id === selectedFan.fan_id 
          ? { ...f, notes: fanNotes }
          : f
      ))
      setSelectedFan({ ...selectedFan, notes: fanNotes })
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem', color: '#1f2937' }}>
          ⚙️ Settings
        </h1>

        {/* Message Banner */}
        {message && (
          <div style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            borderRadius: '0.5rem',
            background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            border: `2px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginBottom: '2rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          {[
            { id: 'connect', label: '🔗 OnlyFans', emoji: '🔗' },
            { id: 'config', label: '🧠 Model Config', emoji: '🧠' },
            { id: 'tiers', label: '💎 Tier Rules', emoji: '💎' },
            { id: 'vault', label: '🗂️ Vault', emoji: '🗂️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 1.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #7c3aed' : '3px solid transparent',
                background: activeTab === tab.id ? '#f5f3ff' : 'transparent',
                color: activeTab === tab.id ? '#7c3aed' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ 
          background: 'white', 
          borderRadius: '0.75rem', 
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div>

            {/* ✨ TAB 0: ONLYFANS CONNECTION */}
            {activeTab === 'connect' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#1f2937' }}>
                  🔗 OnlyFans Connection
                </h2>
                
                {isConnected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      flex: 1, 
                      background: '#d1fae5', 
                      border: '2px solid #10b981', 
                      borderRadius: '0.75rem', 
                      padding: '1.5rem' 
                    }}>
                      <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#065f46', marginBottom: '0.5rem' }}>
                        ✅ Connected to OnlyFans
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#047857' }}>
                        Account ID: {accountId}
                      </p>
                    </div>
                    <button 
                      onClick={handleDisconnect}
                      style={{
                        padding: '0.75rem 1.5rem',
                        border: '2px solid #ef4444',
                        color: '#ef4444',
                        background: 'white',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <ConnectOnlyFans 
                    modelId={modelId} 
                    onSuccess={(accId) => { 
                      setIsConnected(true)
                      setAccountId(accId)
                      setMessage({ type: 'success', text: '✅ Connected successfully!' })
                    }} 
                  />
                )}
              </div>
            )}

            {/* TAB 1: MODEL CONFIG */}
            {activeTab === 'config' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#1f2937' }}>
                  🧠 Model Configuration
                </h2>
                
                {config && (
                  <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Model Name
                        </label>
                        <input
                          type="text"
                          value={config.name || ''}
                          onChange={(e) => setConfig({ ...config, name: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            fontSize: '1rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Age
                        </label>
                        <input
                          type="number"
                          value={config.age || ''}
                          onChange={(e) => setConfig({ ...config, age: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            fontSize: '1rem'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                        Niche
                      </label>
                      <input
                        type="text"
                        value={config.niche || ''}
                        onChange={(e) => setConfig({ ...config, niche: e.target.value })}
                        placeholder="e.g., Fitness, Gaming, Lifestyle"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          fontSize: '1rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                        Model Notes (for AI)
                      </label>
                      <textarea
                        value={config.model_notes || ''}
                        onChange={(e) => setConfig({ ...config, model_notes: e.target.value })}
                        rows={5}
                        placeholder="e.g., Personality traits, content style, what makes you unique..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          fontSize: '1rem',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Max Messages per Day
                        </label>
                        <input
                          type="number"
                          value={config.max_messages_per_day || 500}
                          onChange={(e) => setConfig({ ...config, max_messages_per_day: parseInt(e.target.value) })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            fontSize: '1rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Message Delay (seconds)
                        </label>
                        <input
                          type="number"
                          value={config.message_delay || 5}
                          onChange={(e) => setConfig({ ...config, message_delay: parseInt(e.target.value) })}
                          min="3"
                          max="30"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            fontSize: '1rem'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        padding: '1rem',
                        background: saving ? '#9ca3af' : '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {saving ? '💾 Saving...' : '💾 Save Config'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: TIER RULES */}
            {activeTab === 'tiers' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#1f2937' }}>
                  💎 Tier Rules
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {tierRules.map((rule) => (
                    <div key={rule.id} style={{
                      padding: '1.5rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      background: '#f9fafb'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr 1fr', gap: '1rem', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#7c3aed' }}>
                            {rule.tier_name}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Tier {rule.tier_level}
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#6b7280' }}>
                            Min Spent ($)
                          </label>
                          <input
                            type="number"
                            value={rule.min_spent}
                            onChange={(e) => {
                              const updated = tierRules.map(r => 
                                r.id === rule.id ? { ...r, min_spent: parseFloat(e.target.value) } : r
                              )
                              setTierRules(updated)
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#6b7280' }}>
                            Max Spent ($)
                          </label>
                          <input
                            type="number"
                            value={rule.max_spent || 999999}
                            onChange={(e) => {
                              const updated = tierRules.map(r => 
                                r.id === rule.id ? { ...r, max_spent: parseFloat(e.target.value) } : r
                              )
                              setTierRules(updated)
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: '#6b7280' }}>
                            Price Multiplier
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={rule.price_multiplier}
                            onChange={(e) => {
                              const updated = tierRules.map(r => 
                                r.id === rule.id ? { ...r, price_multiplier: parseFloat(e.target.value) } : r
                              )
                              setTierRules(updated)
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.375rem'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveTierRules}
                  disabled={saving}
                  style={{
                    marginTop: '1.5rem',
                    width: '100%',
                    padding: '1rem',
                    background: saving ? '#9ca3af' : '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? '💾 Saving...' : '💾 Save Tier Rules'}
                </button>
              </div>
            )}

            {/* TAB 3: CATALOG */}
            {activeTab === 'vault' && (
              <div>
                {/* Header */}
                <div style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                    🗂️ MY VAULT
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                    Organize your content for AI-powered selling
                  </p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => setShowNewSession(true)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + New Session
                    </button>
                    <button
                      onClick={() => setShowAddSingle(true)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#8B5CF6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Add Single
                    </button>
                  </div>
                </div>

                {/* SESSIONS */}
                <div style={{ marginBottom: '3rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1f2937' }}>
                    📁 SESSIONS ({sessions.length})
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                    Organized content that sells step-by-step
                  </p>

                  {sessions.length === 0 ? (
                    <div style={{
                      padding: '3rem',
                      background: '#EFF6FF',
                      border: '2px dashed #BFDBFE',
                      borderRadius: '0.75rem',
                      textAlign: 'center'
                    }}>
                      <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                        📁 No sessions yet
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                        Sessions are perfect for:<br />
                        • Sexual experiences (foreplay → climax)<br />
                        • Cosplay transformations<br />
                        • Workout routines<br />
                        • Date experiences
                      </p>
                      <button
                        onClick={() => setShowNewSession(true)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#3B82F6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Create Your First Session
                      </button>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.session_id}
                        style={{
                          marginBottom: '1rem',
                          background: 'white',
                          border: '2px solid #BFDBFE',
                          borderRadius: '0.75rem',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Session Header */}
                        <div style={{
                          padding: '1rem 1.5rem',
                          background: '#EFF6FF',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleSession(session.session_id)}
                        >
                          <div>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                              📁 {session.name}
                            </h4>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              Created: {new Date(session.created_at).toLocaleDateString()} | {session.steps.length} steps
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSession(session.session_id)
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#EF4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                            <span style={{ fontSize: '1.5rem' }}>
                              {expandedSessions.includes(session.session_id) ? '▼' : '▶'}
                            </span>
                          </div>
                        </div>

                        {/* Session Steps (Expandible) */}
                        {expandedSessions.includes(session.session_id) && (
                          <div style={{ padding: '1.5rem' }}>
                            {session.steps.map((step) => (
                              <div
                                key={`${session.session_id}-${step.step_number}`}
                                style={{
                                  marginBottom: '1rem',
                                  padding: '1rem',
                                  background: '#F9FAFB',
                                  border: '1px solid #E5E7EB',
                                  borderRadius: '0.5rem'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                  <div style={{ flex: 1 }}>
                                    <h5 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                                      {step.title}
                                    </h5>
                                    {step.base_price > 0 && (
                                      <>
                                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                          ${step.base_price} | Level: {step.nivel}/10
                                        </p>
                                        <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
                                          {step.description}
                                        </p>
                                        {step.tags && (
                                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {step.tags.split(',').map((tag, idx) => (
                                              <span
                                                key={idx}
                                                style={{
                                                  fontSize: '0.75rem',
                                                  padding: '0.25rem 0.5rem',
                                                  background: '#DBEAFE',
                                                  color: '#1E40AF',
                                                  borderRadius: '0.25rem'
                                                }}
                                              >
                                                {tag.trim()}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => openEditStep(session, step)}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      background: step.base_price > 0 ? '#3B82F6' : '#10B981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {step.base_price > 0 ? 'Edit' : '+ Add Content'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* SINGLES */}
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1f2937' }}>
                    📦 SINGLES ({singles.length})
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                    Individual content for direct sales
                  </p>

                  {singles.length === 0 ? (
                    <div style={{
                      padding: '3rem',
                      background: '#F5F3FF',
                      border: '2px dashed #DDD6FE',
                      borderRadius: '0.75rem',
                      textAlign: 'center'
                    }}>
                      <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                        📦 No singles yet
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                        Singles are perfect for:<br />
                        • Specific requests (anal, BJ, feet, etc)<br />
                        • Quick sales<br />
                        • Custom content<br />
                        • Popular standalone videos
                      </p>
                      <button
                        onClick={() => setShowAddSingle(true)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#8B5CF6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        + Add Your First Single
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '1rem'
                    }}>
                      {singles.map((single) => (
                        <div
                          key={single.id}
                          style={{
                            padding: '1.5rem',
                            background: 'white',
                            border: '2px solid #DDD6FE',
                            borderRadius: '0.75rem'
                          }}
                        >
                          <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                            📄 {single.title}
                          </h4>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Price: ${single.base_price}
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            Level: {single.nivel}/10
                          </p>
                          <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
                            {single.description?.substring(0, 100)}{single.description?.length > 100 ? '...' : ''}
                          </p>
                          {single.tags && (
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                              {single.tags.split(',').map((tag, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.2rem 0.4rem',
                                    background: '#F3E8FF',
                                    color: '#6B21A8',
                                    borderRadius: '0.25rem'
                                  }}
                                >
                                  {tag.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleDeleteSingle(single.id)}
                              style={{
                                padding: '0.5rem 0.75rem',
                                background: '#EF4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                cursor: 'pointer'
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MODALS */}
                
                {/* Modal: New Session */}
                {showNewSession && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                  }}>
                    <div style={{
                      background: 'white',
                      padding: '2rem',
                      borderRadius: '0.75rem',
                      maxWidth: '500px',
                      width: '90%'
                    }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                        Create New Session
                      </h3>
                      <form onSubmit={handleCreateSession}>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Session Name:
                          </label>
                          <input
                            type="text"
                            value={sessionForm.name}
                            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                            required
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="Beach Masturbation"
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Description (for AI):
                          </label>
                          <textarea
                            value={sessionForm.description}
                            onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Complete sexual experience from foreplay to orgasm..."
                          />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            How many steps?
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={sessionForm.steps_count}
                            onChange={(e) => setSessionForm({ ...sessionForm, steps_count: parseInt(e.target.value) })}
                            style={{
                              width: '100px',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                          />
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            ℹ️ You'll add content to each step after creating
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNewSession(false)
                              setSessionForm({ name: '', description: '', steps_count: 3 })
                            }}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: '#6B7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: saving ? '#9CA3AF' : '#3B82F6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {saving ? 'Creating...' : 'Create Session'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Modal: Add Content to Step */}
                {showAddContent && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    overflowY: 'auto'
                  }}>
                    <div style={{
                      background: 'white',
                      padding: '2rem',
                      borderRadius: '0.75rem',
                      maxWidth: '600px',
                      width: '90%',
                      maxHeight: '90vh',
                      overflowY: 'auto'
                    }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                        Add Content to Step {contentForm.step_number}
                      </h3>
                      <form onSubmit={handleAddContent}>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Title:
                          </label>
                          <input
                            type="text"
                            value={contentForm.title}
                            onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                            required
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="Beach Tease"
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Price:
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={contentForm.price}
                            onChange={(e) => setContentForm({ ...contentForm, price: e.target.value })}
                            required
                            style={{
                              width: '150px',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="10.00"
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Intensity:
                          </label>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            {['soft', 'medium', 'hardcore'].map((intensity) => (
                              <label key={intensity} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name="intensity"
                                  value={intensity}
                                  checked={contentForm.intensity === intensity}
                                  onChange={(e) => setContentForm({ ...contentForm, intensity: e.target.value })}
                                  style={{ marginRight: '0.5rem' }}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{intensity}</span>
                              </label>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            ℹ️ Helps AI know when to offer (soft = new fans, hardcore = whales)
                          </p>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Description (for AI):
                          </label>
                          <textarea
                            value={contentForm.description}
                            onChange={(e) => setContentForm({ ...contentForm, description: e.target.value })}
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem',
                              fontFamily: 'inherit'
                            }}
                            placeholder="Walking on beach in bikini, getting wet..."
                          />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Tags:
                          </label>
                          <input
                            type="text"
                            value={contentForm.tags}
                            onChange={(e) => setContentForm({ ...contentForm, tags: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="beach, bikini, wet, tease"
                          />
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            Separate with commas
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddContent(false)
                              setContentForm({
                                session_id: null,
                                step_number: null,
                                type: 'single',
                                title: '',
                                description: '',
                                price: '',
                                intensity: 'medium',
                                tags: '',
                                of_media_ids: []
                              })
                            }}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: '#6B7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: saving ? '#9CA3AF' : '#10B981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {saving ? 'Saving...' : 'Add Content'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Modal: Add Single */}
                {showAddSingle && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    overflowY: 'auto'
                  }}>
                    <div style={{
                      background: 'white',
                      padding: '2rem',
                      borderRadius: '0.75rem',
                      maxWidth: '600px',
                      width: '90%',
                      maxHeight: '90vh',
                      overflowY: 'auto'
                    }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                        Add Single Content
                      </h3>
                      <form onSubmit={handleAddSingle}>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Title:
                          </label>
                          <input
                            type="text"
                            value={contentForm.title}
                            onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                            required
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="Anal Video"
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Price:
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={contentForm.price}
                            onChange={(e) => setContentForm({ ...contentForm, price: e.target.value })}
                            required
                            style={{
                              width: '150px',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="100.00"
                          />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Intensity:
                          </label>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            {['soft', 'medium', 'hardcore'].map((intensity) => (
                              <label key={intensity} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name="intensity-single"
                                  value={intensity}
                                  checked={contentForm.intensity === intensity}
                                  onChange={(e) => setContentForm({ ...contentForm, intensity: e.target.value })}
                                  style={{ marginRight: '0.5rem' }}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{intensity}</span>
                              </label>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                            ℹ️ Controls who can buy (soft = anyone, hardcore = whales only)
                          </p>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Description:
                          </label>
                          <textarea
                            value={contentForm.description}
                            onChange={(e) => setContentForm({ ...contentForm, description: e.target.value })}
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem',
                              fontFamily: 'inherit'
                            }}
                            placeholder="10 minute anal video, very explicit..."
                          />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Tags:
                          </label>
                          <input
                            type="text"
                            value={contentForm.tags}
                            onChange={(e) => setContentForm({ ...contentForm, tags: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #E5E7EB',
                              borderRadius: '0.5rem'
                            }}
                            placeholder="anal, hardcore, explicit"
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddSingle(false)
                              setContentForm({
                                type: 'single',
                                title: '',
                                description: '',
                                price: '',
                                intensity: 'medium',
                                tags: '',
                                of_media_ids: []
                              })
                            }}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: '#6B7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving}
                            style={{
                              flex: 1,
                              padding: '0.75rem',
                              background: saving ? '#9CA3AF' : '#8B5CF6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {saving ? 'Adding...' : 'Add Single'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}


          </div>
        </div>
      </div>
    </>
  )
}
