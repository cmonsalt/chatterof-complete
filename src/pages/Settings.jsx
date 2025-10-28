import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function Settings() {
  const { modelId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadConfig()
  }, [modelId])

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('model_configs')
        .select('*')
        .eq('model_id', modelId)
        .single()

      if (error) throw error
      setConfig(data)
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('model_configs')
        .update(config)
        .eq('model_id', modelId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving settings: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }))
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
      <div className="container" style={{ maxWidth: '800px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          Model Settings
        </h2>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* OpenAI API Key */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              🔑 OpenAI API Key
            </h3>
            <div>
              <label>API Key</label>
              <input
                type="password"
                value={config?.openai_api_key || ''}
                onChange={(e) => updateConfig('openai_api_key', e.target.value)}
                placeholder="sk-..."
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>OpenAI Platform</a>
              </p>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label>GPT Model</label>
              <select
                value={config?.gpt_model || 'gpt-4o-mini'}
                onChange={(e) => updateConfig('gpt_model', e.target.value)}
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Recommended - Fast & Cheap)</option>
                <option value="gpt-4o">GPT-4o (More Advanced)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>

          {/* Personality */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              🎭 Personality
            </h3>
            <div>
              <label>Personality Description</label>
              <textarea
                value={config?.personality || ''}
                onChange={(e) => updateConfig('personality', e.target.value)}
                rows={3}
                placeholder="Friendly, playful, flirty..."
              />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label>Tone</label>
              <select
                value={config?.tone || 'casual'}
                onChange={(e) => updateConfig('tone', e.target.value)}
              >
                <option value="casual">Casual</option>
                <option value="flirty">Flirty</option>
                <option value="professional">Professional</option>
                <option value="playful">Playful</option>
              </select>
            </div>
          </div>

          {/* Language */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              🌐 Language
            </h3>
            <div>
              <label>Response Language</label>
              <select
                value={config?.language_code || 'en'}
                onChange={(e) => updateConfig('language_code', e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>

          {/* Sales Approach */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              💰 Sales Approach
            </h3>
            <div>
              <label>Strategy</label>
              <select
                value={config?.sales_approach || 'conversational_organic'}
                onChange={(e) => updateConfig('sales_approach', e.target.value)}
              >
                <option value="conversational_organic">Conversational & Organic (Recommended)</option>
                <option value="aggressive">Aggressive</option>
                <option value="passive">Passive</option>
              </select>
            </div>
          </div>

          {/* Style Preferences */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              ✨ Style Preferences
            </h3>
            <div>
              <label>Max Emojis Per Message</label>
              <input
                type="number"
                min="0"
                max="10"
                value={config?.max_emojis_per_message || 2}
                onChange={(e) => updateConfig('max_emojis_per_message', parseInt(e.target.value))}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.75rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              fontWeight: 500,
              fontSize: '1rem'
            }}
          >
            {saving ? 'Saving...' : '💾 Save Settings'}
          </button>
        </form>
      </div>
    </>
  )
}
