import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

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
  const [lastSync, setLastSync] = useState(null)

  // Fan Notes
  const [fans, setFans] = useState([])
  const [filteredFansNotes, setFilteredFansNotes] = useState([])
  const [fanSearchQuery, setFanSearchQuery] = useState('')
  const [selectedFan, setSelectedFan] = useState(null)
  const [fanNotes, setFanNotes] = useState('')

  useEffect(() => {
    if (modelId) {
      loadConfig()
      loadTierRules()
      loadCatalog()
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

  const loadCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .order('nivel', { ascending: true })

      if (error) throw error
      setCatalog(data || [])
    } catch (error) {
      console.error('Error loading catalog:', error)
    }
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
        .from('of_sessions')
        .select('last_sync, is_active')
        .eq('model_id', modelId)
        .eq('is_active', true)
        .single()
      
      if (data) {
        setIsConnected(true)
        setLastSync(new Date(data.last_sync).toLocaleString())
      }
    } catch (error) {
      console.log('No OF connection')
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect OnlyFans? You will need to reconnect.')) return
    
    try {
      await supabase
        .from('of_sessions')
        .update({ is_active: false })
        .eq('model_id', modelId)
      
      setIsConnected(false)
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
            { id: 'catalog', label: '📦 Catalog', emoji: '📦' },
            { id: 'notes', label: '🗒️ Fan Notes', emoji: '🗒️' }
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
                        Last sync: {lastSync || 'Never'}
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
                  <div style={{ 
                    background: '#fef3c7', 
                    border: '2px solid #fbbf24', 
                    borderRadius: '0.75rem', 
                    padding: '1.5rem' 
                  }}>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#92400e', marginBottom: '0.75rem' }}>
                      ⚠️ Not connected to OnlyFans
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '1.5rem' }}>
                      Install the ChatterOF extension and connect your account to start syncing data automatically.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <a 
                        href="/extension/chatterof-extension.zip"
                        download
                        style={{
                          display: 'inline-block',
                          padding: '0.75rem 1.5rem',
                          background: '#7c3aed',
                          color: 'white',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        📥 Download Extension
                      </a>
                      <a
                        href="https://docs.google.com/document/d/YOUR_DOCS_LINK"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '0.75rem 1.5rem',
                          border: '2px solid #7c3aed',
                          color: '#7c3aed',
                          background: 'white',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        📖 Instructions
                      </a>
                    </div>
                  </div>
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
            {activeTab === 'catalog' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937' }}>
                    📦 Content Catalog
                  </h2>
                  <button
                    onClick={() => setShowAddCatalog(!showAddCatalog)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {showAddCatalog ? '✕ Cancel' : '+ Add Item'}
                  </button>
                </div>

                {/* Add Item Form */}
                {showAddCatalog && (
                  <form onSubmit={handleAddCatalogItem} style={{
                    marginBottom: '2rem',
                    padding: '1.5rem',
                    background: '#f9fafb',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Offer ID
                        </label>
                        <input
                          type="text"
                          value={newItem.offer_id}
                          onChange={(e) => setNewItem({ ...newItem, offer_id: e.target.value })}
                          required
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={newItem.title}
                          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                          required
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Base Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={newItem.base_price}
                          onChange={(e) => setNewItem({ ...newItem, base_price: e.target.value })}
                          required
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                          Level
                        </label>
                        <select
                          value={newItem.nivel}
                          onChange={(e) => setNewItem({ ...newItem, nivel: parseInt(e.target.value) })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.375rem'
                          }}
                        >
                          <option value={1}>1 - Basic</option>
                          <option value={2}>2 - Standard</option>
                          <option value={3}>3 - Premium</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={newItem.tags}
                        onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                        placeholder="e.g., feet, lingerie, custom"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.375rem'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#374151' }}>
                        Description
                      </label>
                      <textarea
                        value={newItem.description}
                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        width: '100%',
                        padding: '1rem',
                        background: saving ? '#9ca3af' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {saving ? '➕ Adding...' : '➕ Add to Catalog'}
                    </button>
                  </form>
                )}

                {/* Catalog List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {catalog.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                      <p>No catalog items yet.</p>
                      <p style={{ fontSize: '0.875rem' }}>Add your first content item above.</p>
                    </div>
                  ) : (
                    catalog.map((item) => (
                      <div key={item.id} style={{
                        padding: '1.5rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        background: 'white'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>
                                {item.title}
                              </h3>
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                background: '#ede9fe',
                                color: '#7c3aed',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                Level {item.nivel}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                              ID: {item.offer_id}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981', marginBottom: '0.75rem' }}>
                              ${item.base_price}
                            </div>
                            {item.tags && (
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                {item.tags.split(',').map((tag, i) => (
                                  <span key={i} style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem'
                                  }}>
                                    {tag.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.description && (
                              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                                {item.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteCatalogItem(item.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'transparent',
                              border: '2px solid #ef4444',
                              color: '#ef4444',
                              borderRadius: '0.375rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: FAN NOTES */}
            {activeTab === 'notes' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', minHeight: '500px' }}>
                
                {/* Left: Fan List */}
                <div style={{
                  borderRight: '2px solid #e5e7eb',
                  paddingRight: '1.5rem',
                  overflowY: 'auto',
                  maxHeight: '600px'
                }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>
                    📋 Select a Fan
                  </h3>
                  
                  {/* Search Bar */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>🔍</span>
                      <input
                        type="text"
                        value={fanSearchQuery}
                        onChange={(e) => setFanSearchQuery(e.target.value)}
                        placeholder="Search by name, ID, or tier..."
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem'
                        }}
                      />
                      {fanSearchQuery && (
                        <button
                          onClick={() => setFanSearchQuery('')}
                          style={{
                            padding: '0.5rem',
                            background: '#f3f4f6',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: '#6b7280'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {fanSearchQuery && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        Found {filteredFansNotes.length} fan{filteredFansNotes.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  
                  {fans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      <p>No fans yet.</p>
                      <p style={{ fontSize: '0.875rem' }}>Add fans from Dashboard first.</p>
                    </div>
                  ) : filteredFansNotes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      <p>No fans found</p>
                      <p style={{ fontSize: '0.875rem' }}>Try a different search</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {filteredFansNotes.map((fan) => (
                        <button
                          key={fan.fan_id}
                          onClick={() => handleSelectFan(fan)}
                          style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            background: selectedFan?.fan_id === fan.fan_id ? '#ede9fe' : 'white',
                            border: `2px solid ${selectedFan?.fan_id === fan.fan_id ? '#7c3aed' : '#e5e7eb'}`,
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {fan.name || 'Unknown'}
                                {fan.notes && (
                                  <span style={{
                                    fontSize: '0.7rem',
                                    padding: '0.15rem 0.4rem',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: '0.25rem',
                                    fontWeight: 600
                                  }}>
                                    📝
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fan.fan_id}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}>
                                ${fan.spent_total || 0}
                              </div>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.2rem 0.4rem',
                                background: fan.tier === 'FREE' ? '#f3f4f6' : fan.tier === 'VIP' ? '#ede9fe' : '#fef3c7',
                                color: fan.tier === 'FREE' ? '#6b7280' : fan.tier === 'VIP' ? '#5b21b6' : '#92400e',
                                borderRadius: '0.25rem',
                                fontWeight: 600
                              }}>
                                {fan.tier}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Notes Editor */}
                <div>
                  {selectedFan ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937', marginBottom: '0.25rem' }}>
                          {selectedFan.name || 'Unknown'}
                        </h3>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {selectedFan.fan_id} • {selectedFan.tier} • ${selectedFan.spent_total} spent
                        </div>
                      </div>

                      <div style={{
                        padding: '1rem',
                        background: '#fef3c7',
                        borderRadius: '0.5rem',
                        border: '1px solid #fbbf24'
                      }}>
                        <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                          💡 <strong>Add context about this fan</strong> that the AI will use to personalize responses.
                          Include: name, age, interests, purchase history, preferences, etc.
                        </p>
                      </div>

                      <textarea
                        value={fanNotes}
                        onChange={(e) => setFanNotes(e.target.value)}
                        placeholder={`Example:

- Miguel, 28 years old from Madrid
- Subscribed for 6 months (~$150 spent)
- Loves gaming and anime content
- Always tips on weekends
- Asked about custom videos twice
- Prefers feet content over other types
- Very respectful, easy to talk to`}
                        rows={15}
                        style={{
                          width: '100%',
                          padding: '1rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                          flex: 1
                        }}
                      />

                      <button
                        onClick={handleSaveFanNotes}
                        disabled={saving}
                        style={{
                          width: '100%',
                          padding: '1rem',
                          background: saving ? '#9ca3af' : '#7c3aed',
                          color: 'white',
                          borderRadius: '0.5rem',
                          fontWeight: 600,
                          fontSize: '1.125rem',
                          cursor: saving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {saving ? '💾 Saving...' : '💾 Save Notes'}
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#6b7280'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>👈 Select a fan to edit their notes</p>
                        <p style={{ fontSize: '0.875rem' }}>Notes help the AI personalize responses based on past history</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
