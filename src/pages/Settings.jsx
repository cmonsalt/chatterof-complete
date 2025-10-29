import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function Settings() {
  const { modelId, currentModel } = useAuth()
  const [activeTab, setActiveTab] = useState('config')
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

  // 🆕 NEW: Fan Notes
  const [fans, setFans] = useState([])
  const [selectedFan, setSelectedFan] = useState(null)
  const [fanNotes, setFanNotes] = useState('')

  useEffect(() => {
    if (modelId) {
      loadConfig()
      loadTierRules()
      loadCatalog()
      loadFans() // 🆕 NEW
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

      // Cargar models (para name, age, niche)
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('name, age, niche')
        .eq('model_id', modelId)
        .single()

      if (modelError) throw modelError

      // Combinar datos
      setConfig({
        ...configData,
        name: modelData.name,
        age: modelData.age,
        niche: modelData.niche
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

  // 🆕 NEW: Load fans for notes management
  const loadFans = async () => {
    try {
      const { data, error } = await supabase
        .from('fans')
        .select('fan_id, name, notes, tier, spent_total')
        .eq('model_id', modelId)
        .order('name', { ascending: true })

      if (error) throw error
      setFans(data || [])
    } catch (error) {
      console.error('Error loading fans:', error)
    }
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      // Separar datos para models vs model_configs
      const { name, age, niche, ...configData } = config

      // Actualizar models (name, age, niche)
      const { error: modelError } = await supabase
        .from('models')
        .update({
          name: name,
          age: age,
          niche: niche
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
        .insert({
          ...newItem,
          model_id: modelId,
          base_price: parseFloat(newItem.base_price)
        })

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Item added to catalog!' })
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

  const handleDeleteCatalogItem = async (offerId) => {
    if (!confirm('Delete this item from catalog?')) return

    try {
      const { error } = await supabase
        .from('catalog')
        .delete()
        .eq('offer_id', offerId)
        .eq('model_id', modelId)

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Item deleted!' })
      loadCatalog()
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    }
  }

  // 🆕 NEW: Handle fan notes save
  const handleSaveFanNotes = async () => {
    if (!selectedFan) return

    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('fans')
        .update({ notes: fanNotes.trim() || null })
        .eq('fan_id', selectedFan.fan_id)
        .eq('model_id', modelId)

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Fan notes saved!' })
      
      // Update local state
      setFans(fans.map(f => 
        f.fan_id === selectedFan.fan_id 
          ? { ...f, notes: fanNotes.trim() || null }
          : f
      ))
      
      setSelectedFan({ ...selectedFan, notes: fanNotes.trim() || null })
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  // 🆕 NEW: Handle fan selection
  const handleSelectFan = (fan) => {
    setSelectedFan(fan)
    setFanNotes(fan.notes || '')
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
            { id: 'config', label: '🤖 Model Config', emoji: '🤖' },
            { id: 'tiers', label: '💎 Tier Rules', emoji: '💎' },
            { id: 'catalog', label: '📦 Catalog', emoji: '📦' },
            { id: 'notes', label: '📜 Fan Notes', emoji: '📜' } // 🆕 NEW TAB
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 1.5rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? '#7c3aed' : '#6b7280',
                background: activeTab === tab.id ? '#f3f4f6' : 'transparent',
                borderBottom: activeTab === tab.id ? '3px solid #7c3aed' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="card">
          <div style={{ padding: '1.5rem' }}>
            
            {/* TAB 1: MODEL CONFIG */}
            {activeTab === 'config' && config && (
              <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Model Name */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={config.name || ''}
                    onChange={(e) => setConfig({...config, name: e.target.value})}
                    placeholder="Sofia"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                {/* Age & Niche */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Age
                    </label>
                    <input
                      type="number"
                      value={config.age || ''}
                      onChange={(e) => setConfig({...config, age: parseInt(e.target.value)})}
                      placeholder="25"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Niche
                    </label>
                    <input
                      type="text"
                      value={config.niche || ''}
                      onChange={(e) => setConfig({...config, niche: e.target.value})}
                      placeholder="fitness, lifestyle"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    />
                  </div>
                </div>

                {/* Personality & Tone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Personality
                    </label>
                    <input
                      type="text"
                      value={config.personality || ''}
                      onChange={(e) => setConfig({...config, personality: e.target.value})}
                      placeholder="Friendly, flirty"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Tone
                    </label>
                    <select
                      value={config.tone || 'casual'}
                      onChange={(e) => setConfig({...config, tone: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <option value="casual">Casual</option>
                      <option value="professional">Professional</option>
                      <option value="flirty">Flirty</option>
                    </select>
                  </div>
                </div>

                {/* Language & GPT Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Language
                    </label>
                    <select
                      value={config.language_code || 'en'}
                      onChange={(e) => setConfig({...config, language_code: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      GPT Model
                    </label>
                    <select
                      value={config.gpt_model || 'gpt-4o-mini'}
                      onChange={(e) => setConfig({...config, gpt_model: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <option value="gpt-4o-mini">GPT-4o-mini (cheaper)</option>
                      <option value="gpt-4o">GPT-4o (smarter)</option>
                    </select>
                  </div>
                </div>

                {/* OpenAI API Key */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={config.openai_api_key || ''}
                    onChange={(e) => setConfig({...config, openai_api_key: e.target.value})}
                    placeholder="sk-..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>

                {/* Sales Approach & Max Emojis */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Sales Approach
                    </label>
                    <select
                      value={config.sales_approach || 'conversational_organic'}
                      onChange={(e) => setConfig({...config, sales_approach: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <option value="conversational_organic">Conversational Organic</option>
                      <option value="direct">Direct</option>
                      <option value="subtle">Subtle</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Max Emojis per Message
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={config.max_emojis_per_message || 2}
                      onChange={(e) => setConfig({...config, max_emojis_per_message: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
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
                  {saving ? '💾 Saving...' : '💾 Save Config'}
                </button>
              </form>
            )}

            {/* TAB 2: TIER RULES */}
            {activeTab === 'tiers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {tierRules.map((rule, idx) => (
                  <div key={rule.id} style={{
                    padding: '1.5rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '2px solid #e5e7eb'
                  }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: 'bold',
                      marginBottom: '1rem',
                      color: rule.tier_name === 'FREE' ? '#6b7280' : 
                             rule.tier_name === 'VIP' ? '#7c3aed' : '#eab308'
                    }}>
                      {rule.tier_name === 'FREE' ? '🆓' : rule.tier_name === 'VIP' ? '💎' : '🐋'} {rule.tier_name}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Min Spent ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={rule.min_spent}
                          onChange={(e) => {
                            const newRules = [...tierRules]
                            newRules[idx].min_spent = parseFloat(e.target.value)
                            setTierRules(newRules)
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Max Spent ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={rule.max_spent}
                          onChange={(e) => {
                            const newRules = [...tierRules]
                            newRules[idx].max_spent = parseFloat(e.target.value)
                            setTierRules(newRules)
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Price Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={rule.price_multiplier}
                          onChange={(e) => {
                            const newRules = [...tierRules]
                            newRules[idx].price_multiplier = parseFloat(e.target.value)
                            setTierRules(newRules)
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {rule.price_multiplier > 1 ? `+${((rule.price_multiplier - 1) * 100).toFixed(0)}% more` : 
                           rule.price_multiplier < 1 ? `${((1 - rule.price_multiplier) * 100).toFixed(0)}% discount` : 
                           'Base price'}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#ede9fe', borderRadius: '0.5rem' }}>
                      <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                        <strong>Example:</strong> A fan who spent ${rule.min_spent} will pay{' '}
                        <span style={{ fontWeight: 'bold', color: '#7c3aed' }}>
                          ${(50 * rule.price_multiplier).toFixed(2)}
                        </span>{' '}
                        for a $50 item.
                      </p>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleSaveTierRules}
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
                  {saving ? '💾 Saving...' : '💾 Save Tier Rules'}
                </button>
              </div>
            )}

            {/* TAB 3: CATALOG */}
            {activeTab === 'catalog' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Add New Button */}
                <button
                  onClick={() => setShowAddCatalog(!showAddCatalog)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: showAddCatalog ? '#f3f4f6' : '#10b981',
                    color: showAddCatalog ? '#374151' : 'white',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {showAddCatalog ? '✕ Cancel' : '➕ Add New Content'}
                </button>

                {/* Add Form */}
                {showAddCatalog && (
                  <form onSubmit={handleAddCatalogItem} style={{
                    padding: '1.5rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '2px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Offer ID
                        </label>
                        <input
                          type="text"
                          required
                          value={newItem.offer_id}
                          onChange={(e) => setNewItem({...newItem, offer_id: e.target.value})}
                          placeholder="offer_001"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Base Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={newItem.base_price}
                          onChange={(e) => setNewItem({...newItem, base_price: e.target.value})}
                          placeholder="25.00"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                        Title
                      </label>
                      <input
                        type="text"
                        required
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        placeholder="Exclusive Photo Pack"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.5rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                        Description
                      </label>
                      <textarea
                        required
                        value={newItem.description}
                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                        placeholder="10 exclusive behind-the-scenes photos"
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          resize: 'none',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Intensity Level
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newItem.nivel}
                          onChange={(e) => setNewItem({...newItem, nivel: parseInt(e.target.value)})}
                          placeholder="1"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          Higher number = more explicit content
                        </p>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                          Tags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={newItem.tags}
                          onChange={(e) => setNewItem({...newItem, tags: e.target.value})}
                          placeholder="photos,exclusive,fitness"
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '0.5rem'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: saving ? '#9ca3af' : '#7c3aed',
                        color: 'white',
                        borderRadius: '0.5rem',
                        fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {saving ? 'Adding...' : 'Add to Catalog'}
                    </button>
                  </form>
                )}

                {/* Catalog List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {catalog.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                      <p style={{ fontSize: '1.125rem' }}>No content in catalog yet.</p>
                      <p style={{ fontSize: '0.875rem' }}>Click "Add New Content" to get started.</p>
                    </div>
                  ) : (
                    catalog.map((item) => (
                      <div key={item.offer_id} style={{
                        background: 'white',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        transition: 'border-color 0.2s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: item.nivel <= 3 ? '#d1fae5' : item.nivel <= 6 ? '#dbeafe' : '#ede9fe',
                                color: item.nivel <= 3 ? '#065f46' : item.nivel <= 6 ? '#1e3a8a' : '#5b21b6'
                              }}>
                                Intensity {item.nivel}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{item.offer_id}</span>
                            </div>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937' }}>{item.title}</h3>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>{item.description}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>${item.base_price}</span>
                              {item.tags && (
                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                  🏷️ {item.tags}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCatalogItem(item.offer_id)}
                            style={{
                              marginLeft: '1rem',
                              padding: '0.5rem 1rem',
                              background: '#fee2e2',
                              color: '#991b1b',
                              borderRadius: '0.5rem',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 🆕 TAB 4: FAN NOTES */}
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
                  
                  {fans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      <p>No fans yet.</p>
                      <p style={{ fontSize: '0.875rem' }}>Add fans from Dashboard first.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {fans.map((fan) => (
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
                                    📜
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
