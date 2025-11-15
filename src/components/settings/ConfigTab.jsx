import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ConfigTab({ modelId }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (modelId) {
      loadConfig()
    }
  }, [modelId])

  const loadConfig = async () => {
    try {
      // Load model_configs
      const { data: configData, error: configError } = await supabase
        .from('model_configs')
        .select('*')
        .eq('model_id', modelId)
        .single()

      if (configError) throw configError

      // Load models data (name, age, niche, model_notes)
      const { data: modelData, error: modelError } = await supabase
        .from('models')
        .select('name, age, niche, model_notes')
        .eq('model_id', modelId)
        .single()

      if (modelError) throw modelError

      // Merge both
      setConfig({ ...configData, ...modelData })
    } catch (error) {
      console.error('Error loading config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      // Separate data for models vs model_configs
      const { name, age, niche, model_notes, ...configData } = config

      // Update models table
      const { error: modelError } = await supabase
        .from('models')
        .update({ name, age, niche, model_notes })
        .eq('model_id', modelId)

      if (modelError) throw modelError

      // Update model_configs table
      const { error: configError } = await supabase
        .from('model_configs')
        .update(configData)
        .eq('model_id', modelId)

      if (configError) throw configError

      setMessage({ type: 'success', text: '✅ Config saved!' })
    } catch (error) {
      console.error('Error saving config:', error)
      setMessage({ type: 'error', text: '❌ Error saving config' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center py-12 text-gray-600">
        No configuration found. Please contact support.
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">🧠 Model Configuration</h2>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSaveConfig} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model Name
            </label>
            <input
              type="text"
              value={config.name || ''}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Age
            </label>
            <input
              type="number"
              value={config.age || ''}
              onChange={(e) => setConfig({ ...config, age: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Niche
          </label>
          <input
            type="text"
            value={config.niche || ''}
            onChange={(e) => setConfig({ ...config, niche: e.target.value })}
            placeholder="e.g., Fitness, Gaming, Lifestyle"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Model Notes (for AI)
          </label>
          <textarea
            value={config.model_notes || ''}
            onChange={(e) => setConfig({ ...config, model_notes: e.target.value })}
            rows={5}
            placeholder="e.g., Personality traits, content style, what makes you unique..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical"
          />
        </div>

        {/* AI Settings */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Personality</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personality
            </label>
            <textarea
              value={config.personality || ''}
              onChange={(e) => setConfig({ ...config, personality: e.target.value })}
              rows={4}
              placeholder="e.g., Flirty but sophisticated, loves teasing..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={config.language_code || 'en-us'}
                onChange={(e) => setConfig({ ...config, language_code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="en-us">English (US)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="pt">Português</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tone
              </label>
              <select
                value={config.tone || 'casual-flirty'}
                onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="casual-flirty">Casual & Flirty</option>
                <option value="professional">Professional</option>
                <option value="sweet">Sweet & Caring</option>
                <option value="dominant">Dominant</option>
                <option value="playful">Playful</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Emojis per Message
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={config.max_emojis_per_message || 1}
                onChange={(e) => setConfig({ ...config, max_emojis_per_message: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sales Approach
              </label>
              <select
                value={config.sales_approach || 'conversational_organic'}
                onChange={(e) => setConfig({ ...config, sales_approach: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="conversational_organic">Conversational & Organic</option>
                <option value="direct">Direct</option>
                <option value="teasing">Teasing & Playful</option>
                <option value="subtle">Subtle & Sophisticated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Claude API Settings */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Claude API</h3>

          {/* Custom Content Policy */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎥 Custom Content Policy</h3>

            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.does_customs || false}
                  onChange={(e) => setConfig({ ...config, does_customs: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Offers custom content</span>
              </label>
            </div>

            {config.does_customs && (
              <div className="space-y-4 pl-6 border-l-2 border-indigo-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What customs she does
                  </label>
                  <textarea
                    value={config.custom_what_she_does || ''}
                    onChange={(e) => setConfig({ ...config, custom_what_she_does: e.target.value })}
                    rows={3}
                    placeholder="e.g., Solo, B/G, roleplay, fetish-friendly, specific requests..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What she DOESN'T do
                  </label>
                  <textarea
                    value={config.custom_what_she_doesnt || ''}
                    onChange={(e) => setConfig({ ...config, custom_what_she_doesnt: e.target.value })}
                    rows={3}
                    placeholder="e.g., No face, no extreme, no bodily fluids, no..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price Range
                    </label>
                    <input
                      type="text"
                      value={config.custom_price_range || ''}
                      onChange={(e) => setConfig({ ...config, custom_price_range: e.target.value })}
                      placeholder="$50-200"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Typical Delivery Time
                    </label>
                    <input
                      type="text"
                      value={config.custom_delivery || ''}
                      onChange={(e) => setConfig({ ...config, custom_delivery: e.target.value })}
                      placeholder="3-7 days"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Tip:</strong> When fans ask for customs, the AI will alert the chatter and gather details.
                    It will NOT quote prices automatically - you control the final quote based on the request.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Additional Services & Pricing */}
          <div className="border-t pt-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                💰 Additional Services & Pricing
              </h3>
              <p className="text-sm text-gray-600">
                List other services you offer beyond customs and catalog PPV. AI will ONLY offer services listed here.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Services You Offer
              </label>
              <textarea
                value={config.services_offered || ''}
                onChange={(e) => setConfig({ ...config, services_offered: e.target.value })}
                rows={10}
                placeholder={`Example format:
- Dick ratings (text): $30
- Dick rating video: $60
- SPH/Humiliation: $40 (NEVER give free)
- Sexting sessions: $100/30min (ONLY when fan explicitly asks for dedicated sexting time - normal flirty chat is free)
- Video calls: $200/15min
- Voice messages: $25
- JOI videos: $50
- Roleplay customs: $60

💡 Be specific about prices and conditions.
⚠️ If it's not listed here, AI won't offer it.`}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical font-mono text-sm"
              />
            </div>

            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                💡 <strong>How it works:</strong> When a fan requests something (e.g., "rate my dick"),
                the AI checks this list and offers it with the price you set. If it's not listed,
                AI will politely say you don't offer that service.
              </p>
            </div>
          </div>
          {/*
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={config.anthropic_api_key || ''}
                onChange={(e) => setConfig({ ...config, anthropic_api_key: e.target.value })}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get your key from console.anthropic.com
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Claude Model
              </label>
              <select
                value={config.claude_model || 'claude-sonnet-4-5-20250929'}
                onChange={(e) => setConfig({ ...config, claude_model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Best)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
              </select>
            </div>
          </div>*/}

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature ({config.temperature || 0.8})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature || 0.8}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Consistent (0)</span>
              <span>Balanced (0.5)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-6 border-t">
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
          >
            {saving ? '💾 Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  )
}
