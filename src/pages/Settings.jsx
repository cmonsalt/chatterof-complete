import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import ConnectOnlyFans from '../components/ConnectOnlyFans'

export default function Settings() {
  const { modelId, currentModel } = useAuth()
  const [activeTab, setActiveTab] = useState('vault') // ✨ Changed default to vault
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  
  // Model Config
  const [config, setConfig] = useState(null)
  
  // Tier Rules
  const [tierRules, setTierRules] = useState([])
  
  // 🔗 OnlyFans Connection  
  const [isConnected, setIsConnected] = useState(false)
  const [accountId, setAccountId] = useState(null)

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
      checkConnection()
    }
  }, [modelId])

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

  // Vault functions
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
          parent_type: 'session',
          session_id: sessionId,
          session_name: sessionForm.name,
          session_description: sessionForm.description,
          step_number: i,
          title: '',
          description: '',
          price: 0,
          level: 5,
          tags: [],
          of_media_ids: []
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
      const level = levelMap[contentForm.intensity]

      const { error } = await supabase
        .from('catalog')
        .update({
          title: contentForm.title,
          description: contentForm.description,
          price: parseFloat(contentForm.price),
          level: level,
          tags: contentForm.tags.split(',').map(t => t.trim()),
          of_media_ids: contentForm.of_media_ids
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
      const level = levelMap[contentForm.intensity]

      const { error } = await supabase
        .from('catalog')
        .insert({
          model_id: modelId,
          parent_type: 'single',
          title: contentForm.title,
          description: contentForm.description,
          price: parseFloat(contentForm.price),
          level: level,
          tags: contentForm.tags.split(',').map(t => t.trim()),
          of_media_ids: contentForm.of_media_ids
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
      price: step.price || '',
      intensity: intensityMap[step.level] || 'medium',
      tags: step.tags?.join(', ') || '',
      of_media_ids: step.of_media_ids || []
    })
    setShowAddContent(true)
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
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: '❌ Error saving config' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTierRules = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Eliminar reglas existentes
      await supabase
        .from('tier_rules')
        .delete()
        .eq('model_id', modelId)

      // Insertar nuevas reglas
      const newRules = tierRules.map(rule => ({
        ...rule,
        model_id: modelId
      }))

      const { error } = await supabase
        .from('tier_rules')
        .insert(newRules)

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Tier rules saved!' })
    } catch (error) {
      console.error('Error saving tier rules:', error)
      setMessage({ type: 'error', text: '❌ Error saving tier rules' })
    } finally {
      setSaving(false)
    }
  }

  const addTierRule = () => {
    setTierRules([...tierRules, {
      tier_name: '',
      min_spent: 0,
      max_spent: null,
      price_multiplier: 1.0,
      emoji: '🆓'
    }])
  }

  const updateTierRule = (index, field, value) => {
    const updated = [...tierRules]
    updated[index] = { ...updated[index], [field]: value }
    setTierRules(updated)
  }

  const deleteTierRule = (index) => {
    setTierRules(tierRules.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ fontSize: '1.5rem', color: '#6b7280' }}>Loading...</div>
        </div>
      </>
    )
  }

  const tabs = [
    { id: 'connect', label: '🔗 Connect', emoji: '🔗' },
    { id: 'aiconfig', label: '🤖 AI Config', emoji: '🤖' },
    { id: 'tiers', label: '💎 Tiers', emoji: '💎' },
    { id: 'vault', label: '🗂️ Vault', emoji: '🗂️' }
  ]

  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #faf5ff, #fce7f3)', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
              ⚙️ Settings
            </h1>
            <p style={{ color: '#6b7280' }}>
              Configure your model and AI behavior
            </p>
          </div>

          {/* Message */}
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
            background: 'white',
            borderRadius: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {/* Tab Headers */}
            <div style={{
              display: 'flex',
              borderBottom: '2px solid #e5e7eb',
              background: '#f9fafb'
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: '1rem',
                    border: 'none',
                    background: activeTab === tab.id ? 'white' : 'transparent',
                    borderBottom: activeTab === tab.id ? '3px solid #7c3aed' : '3px solid transparent',
                    color: activeTab === tab.id ? '#7c3aed' : '#6b7280',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ marginRight: '0.5rem' }}>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ padding: '2rem' }}>
              
              {/* TAB 1: CONNECT */}
              {activeTab === 'connect' && (
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                    🔗 Connect OnlyFans
                  </h2>
                  
                  {isConnected ? (
                    <div>
                      <div style={{
                        padding: '1.5rem',
                        background: '#d1fae5',
                        border: '2px solid #10b981',
                        borderRadius: '0.75rem',
                        marginBottom: '1.5rem'
                      }}>
                        <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#065f46', marginBottom: '0.5rem' }}>
                          ✅ Connected to OnlyFans
                        </p>
                        <p style={{ color: '#047857', fontSize: '0.875rem' }}>
                          Account ID: {accountId}
                        </p>
                      </div>
                      
                      <button
                        onClick={handleDisconnect}
                        style={{
                          padding: '0.75rem 1.5rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <ConnectOnlyFans />
                  )}
                </div>
              )}

              {/* TAB 2: AI CONFIG */}
              {activeTab === 'aiconfig' && config && (
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                    🤖 AI Configuration
                  </h2>
                  
                  <form onSubmit={handleSaveConfig}>
                    {/* Model Info */}
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>
                        📋 Model Information
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Name:
                          </label>
                          <input
                            type="text"
                            value={config.name || ''}
                            onChange={(e) => setConfig({ ...config, name: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '0.5rem'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            Age:
                          </label>
                          <input
                            type="number"
                            value={config.age || ''}
                            onChange={(e) => setConfig({ ...config, age: parseInt(e.target.value) })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '0.5rem'
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          Niche:
                        </label>
                        <input
                          type="text"
                          value={config.niche || ''}
                          onChange={(e) => setConfig({ ...config, niche: e.target.value })}
                          placeholder="e.g., Fitness, Cosplay, MILF"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          Model Notes (for AI):
                        </label>
                        <textarea
                          value={config.model_notes || ''}
                          onChange={(e) => setConfig({ ...config, model_notes: e.target.value })}
                          rows={4}
                          placeholder="Important context about the model that AI should know..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                    </div>

                    {/* AI Personality */}
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>
                        🎭 Personality & Tone
                      </h3>
                      
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          Tone:
                        </label>
                        <select
                          value={config.tone || 'casual-flirty'}
                          onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        >
                          <option value="casual-flirty">Casual Flirty</option>
                          <option value="romantic">Romantic</option>
                          <option value="explicit">Explicit</option>
                          <option value="girlfriend">Girlfriend Experience</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          Temperature (Creativity): {config.temperature || 0.8}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={config.temperature || 0.8}
                          onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                          style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          Lower = More predictable | Higher = More creative
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        padding: '1rem 2rem',
                        background: saving ? '#9ca3af' : '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        fontSize: '1.125rem',
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {saving ? '💾 Saving...' : '💾 Save Configuration'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: TIERS */}
              {activeTab === 'tiers' && (
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    💎 Tier Rules
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                    Define pricing tiers based on how much fans have spent
                  </p>

                  <div style={{ marginBottom: '1.5rem' }}>
                    {tierRules.map((rule, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '0.5fr 1fr 1fr 1fr 1fr 0.5fr',
                          gap: '0.75rem',
                          marginBottom: '1rem',
                          padding: '1rem',
                          background: '#f9fafb',
                          borderRadius: '0.5rem'
                        }}
                      >
                        <input
                          type="text"
                          placeholder="🆓"
                          value={rule.emoji}
                          onChange={(e) => updateTierRule(index, 'emoji', e.target.value)}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem',
                            textAlign: 'center'
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Tier Name"
                          value={rule.tier_name}
                          onChange={(e) => updateTierRule(index, 'tier_name', e.target.value)}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Min $"
                          value={rule.min_spent}
                          onChange={(e) => updateTierRule(index, 'min_spent', parseFloat(e.target.value))}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Max $ (optional)"
                          value={rule.max_spent || ''}
                          onChange={(e) => updateTierRule(index, 'max_spent', e.target.value ? parseFloat(e.target.value) : null)}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                        <input
                          type="number"
                          step="0.1"
                          placeholder="1.0x"
                          value={rule.price_multiplier}
                          onChange={(e) => updateTierRule(index, 'price_multiplier', parseFloat(e.target.value))}
                          style={{
                            padding: '0.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                        <button
                          onClick={() => deleteTierRule(index)}
                          style={{
                            padding: '0.5rem',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={addTierRule}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Add Tier
                    </button>
                    
                    <button
                      onClick={handleSaveTierRules}
                      disabled={saving}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: saving ? '#9ca3af' : '#7c3aed',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {saving ? '💾 Saving...' : '💾 Save Tiers'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: VAULT */}
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
                                        Step {step.step_number}: {step.title || 'Not configured'}
                                      </h5>
                                      {step.title && (
                                        <>
                                          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                            {step.type === 'bundle' ? '📦 Bundle' : '📄 Single'} - ${step.price} | Level: {step.level}/10
                                          </p>
                                          <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
                                            {step.description}
                                          </p>
                                          {step.tags && step.tags.length > 0 && (
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              {step.tags.map((tag, idx) => (
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
                                                  {tag}
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
                                        background: step.title ? '#3B82F6' : '#10B981',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {step.title ? 'Edit' : '+ Add Content'}
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
                              Price: ${single.price}
                            </p>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                              Level: {single.level}/10
                            </p>
                            <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
                              {single.description?.substring(0, 100)}{single.description?.length > 100 ? '...' : ''}
                            </p>
                            {single.tags && single.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                {single.tags.map((tag, idx) => (
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
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  background: '#3B82F6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
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
      </div>
    </>
  )
}
