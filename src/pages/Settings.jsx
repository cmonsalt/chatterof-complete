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

  useEffect(() => {
    if (modelId) {
      loadConfig()
      loadTierRules()
      loadCatalog()
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

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      // Actualizar model_configs
      const { error: configError } = await supabase
        .from('model_configs')
        .update(config)
        .eq('model_id', modelId)

      if (configError) throw configError

      // Actualizar models (name, age, niche)
      const { error: modelError } = await supabase
        .from('models')
        .update({
          name: config.name,
          age: config.age,
          niche: config.niche
        })
        .eq('model_id', modelId)

      if (modelError) throw modelError

      setMessage({ type: 'success', text: '✅ Config saved successfully!' })
      
      // Recargar para actualizar navbar
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

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure {currentModel?.name || 'your model'}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          
          {/* Tab Headers */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'config'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⚙️ Model Config
            </button>
            <button
              onClick={() => setActiveTab('tiers')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'tiers'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              💰 Tier Rules
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'catalog'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              📦 Catalog
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            
            {/* TAB 1: MODEL CONFIG */}
            {activeTab === 'config' && config && (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                
                {/* Model Info Section */}
                <div className="bg-purple-50 rounded-lg p-6 border-2 border-purple-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Model Info</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Model Name
                      </label>
                      <input
                        type="text"
                        value={config.name || currentModel?.name || ''}
                        onChange={(e) => setConfig({...config, name: e.target.value})}
                        placeholder="Sophia"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Age
                      </label>
                      <input
                        type="number"
                        min="18"
                        max="99"
                        value={config.age || ''}
                        onChange={(e) => setConfig({...config, age: parseInt(e.target.value)})}
                        placeholder="25"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Niche
                      </label>
                      <input
                        type="text"
                        value={config.niche || currentModel?.niche || ''}
                        onChange={(e) => setConfig({...config, niche: e.target.value})}
                        placeholder="Fitness, Gaming, Cosplay..."
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* OpenAI API Key */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🔑 OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={config.openai_api_key || ''}
                    onChange={(e) => setConfig({...config, openai_api_key: e.target.value})}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your key from <a href="https://platform.openai.com" target="_blank" className="text-purple-600">OpenAI Platform</a>
                  </p>
                </div>

                {/* GPT Model */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🤖 GPT Model
                  </label>
                  <select
                    value={config.gpt_model || 'gpt-4o-mini'}
                    onChange={(e) => setConfig({...config, gpt_model: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Recommended - Fast & Cheap)</option>
                    <option value="gpt-4o">GPT-4o (More Powerful)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                </div>

                {/* Personality */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🧠 Personality Description
                  </label>
                  <textarea
                    value={config.personality || ''}
                    onChange={(e) => setConfig({...config, personality: e.target.value})}
                    rows={4}
                    placeholder="e.g., Friendly and engaging fitness enthusiast..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💬 Tone
                  </label>
                  <select
                    value={config.tone || 'casual'}
                    onChange={(e) => setConfig({...config, tone: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="casual">Casual</option>
                    <option value="casual-flirty">Casual & Flirty</option>
                    <option value="friendly">Friendly</option>
                    <option value="professional">Professional</option>
                    <option value="playful">Playful</option>
                    <option value="bubbly">Bubbly</option>
                  </select>
                </div>

                {/* Sales Approach */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    💵 Sales Approach
                  </label>
                  <select
                    value={config.sales_approach || 'conversational_organic'}
                    onChange={(e) => setConfig({...config, sales_approach: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="conversational_organic">Conversational & Organic (Recommended)</option>
                    <option value="subtle_value">Subtle Value Emphasis</option>
                    <option value="direct_offers">Direct Offers</option>
                    <option value="scarcity_urgency">Scarcity & Urgency</option>
                  </select>
                </div>

                {/* Emoji Style */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ✨ Emoji Style
                  </label>
                  <select
                    value={config.emoji_style || 'moderate'}
                    onChange={(e) => setConfig({...config, emoji_style: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="minimal">Minimal</option>
                    <option value="moderate">Moderate (Recommended)</option>
                    <option value="frequent">Frequent</option>
                    <option value="very_frequent">Very Frequent</option>
                  </select>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '💾 Saving...' : '💾 Save Config'}
                </button>
              </form>
            )}

            {/* TAB 2: TIER RULES */}
            {activeTab === 'tiers' && (
              <div className="space-y-6">
                <p className="text-gray-600 mb-4">
                  Configure price multipliers for each tier. Higher multiplier = fans pay MORE.
                </p>

                {tierRules.map((rule, idx) => (
                  <div key={rule.id} className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">
                      {rule.tier_name === 'FREE' && '🆓 FREE Tier'}
                      {rule.tier_name === 'VIP' && '⭐ VIP Tier'}
                      {rule.tier_name === 'WHALE' && '🐋 WHALE Tier'}
                    </h3>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {rule.price_multiplier > 1 ? `+${((rule.price_multiplier - 1) * 100).toFixed(0)}% more` : 
                           rule.price_multiplier < 1 ? `${((1 - rule.price_multiplier) * 100).toFixed(0)}% discount` : 
                           'Base price'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Example:</strong> A fan who spent ${rule.min_spent} will pay{' '}
                        <span className="font-bold text-purple-600">
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
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-50"
                >
                  {saving ? '💾 Saving...' : '💾 Save Tier Rules'}
                </button>
              </div>
            )}

            {/* TAB 3: CATALOG */}
            {activeTab === 'catalog' && (
              <div className="space-y-6">
                
                {/* Add New Button */}
                <button
                  onClick={() => setShowAddCatalog(!showAddCatalog)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-all"
                >
                  {showAddCatalog ? '✕ Cancel' : '➕ Add New Content'}
                </button>

                {/* Add Form */}
                {showAddCatalog && (
                  <form onSubmit={handleAddCatalogItem} className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Offer ID
                        </label>
                        <input
                          type="text"
                          required
                          value={newItem.offer_id}
                          onChange={(e) => setNewItem({...newItem, offer_id: e.target.value})}
                          placeholder="offer_001"
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Base Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={newItem.base_price}
                          onChange={(e) => setNewItem({...newItem, base_price: e.target.value})}
                          placeholder="25.00"
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        required
                        value={newItem.title}
                        onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                        placeholder="Exclusive Photo Pack"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        required
                        value={newItem.description}
                        onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                        placeholder="10 exclusive behind-the-scenes photos"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Intensity Level
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newItem.nivel}
                          onChange={(e) => setNewItem({...newItem, nivel: parseInt(e.target.value)})}
                          placeholder="1"
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Higher number = more explicit content
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Tags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={newItem.tags}
                          onChange={(e) => setNewItem({...newItem, tags: e.target.value})}
                          placeholder="photos,exclusive,fitness"
                          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                      {saving ? 'Adding...' : 'Add to Catalog'}
                    </button>
                  </form>
                )}

                {/* Catalog List */}
                <div className="space-y-3">
                  {catalog.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">No content in catalog yet.</p>
                      <p className="text-sm">Click "Add New Content" to get started.</p>
                    </div>
                  ) : (
                    catalog.map((item) => (
                      <div key={item.offer_id} className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-all">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                item.nivel <= 3 ? 'bg-green-100 text-green-800' :
                                item.nivel <= 6 ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                Intensity {item.nivel}
                              </span>
                              <span className="text-xs text-gray-500">{item.offer_id}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">{item.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-2xl font-bold text-green-600">${item.base_price}</span>
                              {item.tags && (
                                <span className="text-xs text-gray-500">
                                  🏷️ {item.tags}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteCatalogItem(item.offer_id)}
                            className="ml-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all font-semibold text-sm"
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
          </div>
        </div>
      </div>
    </>
  )
}
