import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function SingleEditor({ isOpen, single, onClose, modelId }) {
  const [title, setTitle] = useState('')
  const [basePrice, setBasePrice] = useState(10)
  const [nivel, setNivel] = useState(5)
  const [keywords, setKeywords] = useState([])
  const [keywordInput, setKeywordInput] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const NIVELES = [
    { value: 1, label: '🟢 Tease', color: 'bg-green-100 text-green-800' },
    { value: 2, label: '🟢 Soft', color: 'bg-green-100 text-green-800' },
    { value: 3, label: '🟢 Innocent', color: 'bg-green-100 text-green-800' },
    { value: 4, label: '🟡 Bikini', color: 'bg-yellow-100 text-yellow-800' },
    { value: 5, label: '🟡 Lingerie', color: 'bg-yellow-100 text-yellow-800' },
    { value: 6, label: '🟡 Topless', color: 'bg-yellow-100 text-yellow-800' },
    { value: 7, label: '🟠 Nude', color: 'bg-orange-100 text-orange-800' },
    { value: 8, label: '🟠 Solo Play', color: 'bg-orange-100 text-orange-800' },
    { value: 9, label: '🔴 Explicit', color: 'bg-red-100 text-red-800' },
    { value: 10, label: '⚫ Hardcore', color: 'bg-gray-900 text-white' }
  ]

  useEffect(() => {
    if (single) {
      setTitle(single.title || '')
      setBasePrice(single.base_price || 10)
      setNivel(single.nivel || 5)
      setKeywords(single.keywords || [])
      setDescription(single.description || '')
    }
  }, [single])

  const addKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()])
      setKeywordInput('')
    }
  }

  const removeKeyword = (index) => {
    setKeywords(keywords.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Por favor ingresa un título')
      return
    }

    if (basePrice <= 0) {
      alert('El precio debe ser mayor a 0')
      return
    }

    if (keywords.length === 0) {
      alert('Agrega al menos un keyword para que la IA pueda usar este contenido')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('catalog')
        .update({
          title,
          base_price: basePrice,
          nivel,
          keywords,
          description,
          offer_id: `single_${single.of_media_id}` // Generar offer_id
        })
        .eq('id', single.id)

      if (error) throw error

      alert('✅ Single configurado exitosamente!')
      onClose()

    } catch (error) {
      console.error('Error saving single:', error)
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-xl">
          <h2 className="text-2xl font-bold">💎 Configure Single</h2>
          <p className="text-green-100 mt-1">
            Setup pricing, level, and keywords for direct sales
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Preview:</p>
            <div className="flex gap-3">
              <div className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200">
                {single?.media_thumb ? (
                  <img
                    src={single.media_thumb}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    {single?.file_type === 'video' ? '🎥' : '📷'}
                  </div>
                )}
              </div>
              <div className="flex-1 text-sm text-gray-600">
                <p><strong>Type:</strong> {single?.file_type}</p>
                <p><strong>ID:</strong> {single?.of_media_id}</p>
                <p><strong>Created:</strong> {new Date(single?.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📝 Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ej: Hot Anal Video"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Price & Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                💰 Base Price
              </label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                min="0"
                step="5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Price will adjust by fan tier (VIP 1.2x, WHALE 1.5x)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔥 Explicitness Level
              </label>
              <select
                value={nivel}
                onChange={(e) => setNivel(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {NIVELES.map(n => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                AI will only offer high levels to engaged fans
              </p>
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              🏷️ Keywords (for AI matching)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              When fan asks about these keywords, AI will offer this content
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="ej: anal, custom, exclusive"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={addKeyword}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  {keyword}
                  <button
                    onClick={() => removeKeyword(i)}
                    className="hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              📄 Description (optional, for AI context)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ej: Exclusive anal content, very explicit..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Example */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">💡 Example Usage:</p>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Fan:</strong> "Do you have any anal videos babe?"</p>
              <p><strong>AI:</strong> Searches keywords → Finds this single → Offers it</p>
              <p><strong>AI:</strong> "Yes babe! I have an exclusive one just for you 💦 ${basePrice}"</p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50"
          >
            {loading ? '⏳ Saving...' : '💾 Save Single'}
          </button>
        </div>

      </div>
    </div>
  )
}
