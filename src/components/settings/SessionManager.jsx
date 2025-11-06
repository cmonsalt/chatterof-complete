import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function SessionManager({ isOpen, onClose, modelId, editingSession = null, preselectedMediaIds = [] }) {
  const [sessionName, setSessionName] = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [numParts, setNumParts] = useState(3)
  const [parts, setParts] = useState([])
  const [availableMedias, setAvailableMedias] = useState([])
  const [loading, setLoading] = useState(false)
  const [showMediaSelector, setShowMediaSelector] = useState(null) // {partIndex}

  // Niveles predefinidos
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
    if (isOpen) {
      loadAvailableMedias()
      
      if (editingSession) {
        // Cargar session existente
        setSessionName(editingSession.session_name || '')
        setSessionDescription(editingSession.session_description || '')
        loadSessionParts(editingSession.session_id)
      } else {
        // Nueva session - inicializar parts vacíos
        initializeParts(numParts)
      }
    }
  }, [isOpen, editingSession])

  const initializeParts = (count) => {
    const newParts = []
    for (let i = 0; i < count; i++) {
      newParts.push({
        step_number: i + 1,
        title: '',
        base_price: 10,
        nivel: 2,
        keywords: [],
        selectedMedias: [], // Array de media objects
        keywordInput: ''
      })
    }
    setParts(newParts)
  }

  const loadAvailableMedias = async () => {
    try {
      // Obtener medias que están en inbox o que no tienen session_id (disponibles)
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', modelId)
        .in('status', ['inbox', 'single']) // Inbox o singles (pueden reasignarse)
        .is('session_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAvailableMedias(data || [])
    } catch (error) {
      console.error('Error loading available medias:', error)
    }
  }

  const loadSessionParts = async (sessionId) => {
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('session_id', sessionId)
        .order('step_number', { ascending: true })

      if (error) throw error
      
      const loadedParts = data.map(part => ({
        id: part.id,
        step_number: part.step_number,
        title: part.title,
        base_price: part.base_price,
        nivel: part.nivel,
        keywords: part.keywords || [],
        selectedMedias: part.of_media_ids ? 
          part.of_media_ids.map(id => ({ of_media_id: id })) : [],
        keywordInput: ''
      }))

      setParts(loadedParts)
      setNumParts(loadedParts.length)
    } catch (error) {
      console.error('Error loading session parts:', error)
    }
  }

  const handleNumPartsChange = (count) => {
    setNumParts(count)
    if (!editingSession) {
      initializeParts(count)
    }
  }

  const updatePart = (index, field, value) => {
    const newParts = [...parts]
    newParts[index][field] = value
    setParts(newParts)
  }

  const addKeyword = (index) => {
    const part = parts[index]
    if (part.keywordInput.trim()) {
      const newKeywords = [...part.keywords, part.keywordInput.trim()]
      updatePart(index, 'keywords', newKeywords)
      updatePart(index, 'keywordInput', '')
    }
  }

  const removeKeyword = (partIndex, keywordIndex) => {
    const newKeywords = parts[partIndex].keywords.filter((_, i) => i !== keywordIndex)
    updatePart(partIndex, 'keywords', newKeywords)
  }

  const openMediaSelector = (partIndex) => {
    setShowMediaSelector(partIndex)
  }

  const handleMediaSelect = (partIndex, selectedMediaIds) => {
    // Convertir IDs a objetos con info del media
    const selectedMediaObjects = availableMedias.filter(m => 
      selectedMediaIds.includes(m.of_media_id)
    )
    updatePart(partIndex, 'selectedMedias', selectedMediaObjects)
    setShowMediaSelector(null)
  }

  const getUsedMediaIds = () => {
    // Obtener todos los media IDs ya seleccionados en otras parts
    const usedIds = new Set()
    parts.forEach(part => {
      part.selectedMedias.forEach(media => {
        usedIds.add(media.of_media_id)
      })
    })
    return usedIds
  }

  const handleSave = async () => {
    // Validaciones
    if (!sessionName.trim()) {
      alert('Por favor ingresa un nombre para la session')
      return
    }

    const emptyParts = parts.filter(p => p.selectedMedias.length === 0)
    if (emptyParts.length > 0) {
      alert(`Hay ${emptyParts.length} part(s) sin medias asignados. Por favor asigna medias a todos los parts.`)
      return
    }

    setLoading(true)

    try {
      const sessionId = editingSession?.session_id || `session_${Date.now()}`

      // Actualizar cada part en la base de datos
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const mediaIds = part.selectedMedias.map(m => m.of_media_id)
        
        // Si es el primer media, usar su info
        const firstMedia = part.selectedMedias[0]
        
        const partData = {
          title: part.title || `${sessionName} - Part ${part.step_number}`,
          base_price: part.base_price,
          nivel: part.nivel,
          keywords: part.keywords,
          parent_type: 'session',
          session_id: sessionId,
          session_name: sessionName,
          session_description: sessionDescription,
          step_number: part.step_number,
          of_media_id: firstMedia.of_media_id,
          of_media_ids: mediaIds, // Array de todos los IDs
          media_url: firstMedia.media_url,
          media_thumb: firstMedia.media_thumb,
          file_type: firstMedia.file_type,
          model_id: modelId,
          status: 'session', // Estado correcto
          offer_id: `${sessionId}_part_${part.step_number}` // Generar offer_id único
        }

        if (part.id) {
          // Actualizar part existente
          const { error } = await supabase
            .from('catalog')
            .update(partData)
            .eq('id', part.id)
          
          if (error) throw error
        } else {
          // Crear nuevo part
          const { error } = await supabase
            .from('catalog')
            .insert(partData)
          
          if (error) throw error
        }

        // Marcar los medias como usados (asignarles session_id y status)
        for (const media of part.selectedMedias) {
          const { error } = await supabase
            .from('catalog')
            .update({ 
              session_id: sessionId,
              parent_type: 'session',
              status: 'session' // Actualizar status también
            })
            .eq('of_media_id', media.of_media_id)
          
          if (error) throw error
        }
      }

      alert(`✅ Session "${sessionName}" guardada exitosamente!`)
      onClose()
      
    } catch (error) {
      console.error('Error saving session:', error)
      alert('Error guardando session: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-xl">
          <h2 className="text-2xl font-bold">
            {editingSession ? '✏️ Edit Session' : '✨ Create New Session'}
          </h2>
          <p className="text-purple-100 mt-1">
            Organiza tu contenido en múltiples parts secuenciales
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Session Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📝 Session Name
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="ej: Beach Masturbation Session"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📄 Description (para la IA)
              </label>
              <textarea
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder="ej: Hot beach session starting innocent and getting naughty..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {!editingSession && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🔢 Number of Parts (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numParts}
                  onChange={(e) => handleNumPartsChange(parseInt(e.target.value))}
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Parts */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              📦 Configure Parts
            </h3>

            {parts.map((part, index) => (
              <div key={index} className="border-2 border-purple-200 rounded-lg p-4 space-y-4 bg-white">
                
                {/* Part Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <h4 className="text-lg font-bold text-purple-600">
                    Part {part.step_number}
                  </h4>
                  <span className="text-sm text-gray-500">
                    {part.selectedMedias.length} media(s) selected
                  </span>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={part.title}
                    onChange={(e) => updatePart(index, 'title', e.target.value)}
                    placeholder={`${sessionName} - Part ${part.step_number}`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Price & Level */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      💰 Base Price
                    </label>
                    <input
                      type="number"
                      value={part.base_price}
                      onChange={(e) => updatePart(index, 'base_price', parseFloat(e.target.value))}
                      min="0"
                      step="5"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      🔥 Explicitness Level
                    </label>
                    <select
                      value={part.nivel}
                      onChange={(e) => updatePart(index, 'nivel', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {NIVELES.map(nivel => (
                        <option key={nivel.value} value={nivel.value}>
                          {nivel.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Keywords */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    🏷️ Keywords (para storyline de IA)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={part.keywordInput}
                      onChange={(e) => updatePart(index, 'keywordInput', e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword(index)}
                      placeholder="Escribe y presiona Enter"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => addKeyword(index)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {part.keywords.map((keyword, ki) => (
                      <span
                        key={ki}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => removeKeyword(index, ki)}
                          className="hover:text-purple-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Selected Medias */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎬 Selected Media(s)
                  </label>
                  
                  {part.selectedMedias.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {part.selectedMedias.map((media, mi) => (
                        <div key={mi} className="relative group">
                          <img
                            src={media.media_thumb || '/placeholder.png'}
                            alt={media.title}
                            className="w-full h-24 object-cover rounded-lg border-2 border-purple-300"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs">
                              {media.file_type === 'video' ? '🎥' : '📷'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <p className="text-gray-500 text-sm">No medias selected</p>
                    </div>
                  )}

                  <button
                    onClick={() => openMediaSelector(index)}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                  >
                    {part.selectedMedias.length > 0 ? '✏️ Change Medias' : '➕ Select Medias'}
                  </button>
                </div>

              </div>
            ))}
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
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50"
          >
            {loading ? '⏳ Saving...' : '💾 Save Session'}
          </button>
        </div>

      </div>

      {/* Media Selector Modal */}
      {showMediaSelector !== null && (
        <MediaSelectorModal
          availableMedias={availableMedias}
          usedMediaIds={getUsedMediaIds()}
          selectedMediaIds={parts[showMediaSelector].selectedMedias.map(m => m.of_media_id)}
          onSelect={(ids) => handleMediaSelect(showMediaSelector, ids)}
          onClose={() => setShowMediaSelector(null)}
        />
      )}

    </div>
  )
}

// Sub-componente para seleccionar medias
function MediaSelectorModal({ availableMedias, usedMediaIds, selectedMediaIds, onSelect, onClose }) {
  const [selected, setSelected] = useState(new Set(selectedMediaIds))

  const toggleMedia = (mediaId) => {
    const newSelected = new Set(selected)
    if (newSelected.has(mediaId)) {
      newSelected.delete(mediaId)
    } else {
      newSelected.add(mediaId)
    }
    setSelected(newSelected)
  }

  const handleConfirm = () => {
    onSelect(Array.from(selected))
  }

  // Filtrar medias disponibles (no usados en otras parts)
  const availableToSelect = availableMedias.filter(m => 
    !usedMediaIds.has(m.of_media_id) || selectedMediaIds.includes(m.of_media_id)
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
          <h3 className="text-xl font-bold">Select Media(s)</h3>
          <p className="text-blue-100 text-sm">
            {selected.size} selected • {availableToSelect.length} available
          </p>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableToSelect.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">😔 No available medias</p>
              <p className="text-gray-400 text-sm mt-2">
                All medias are already assigned to other parts
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {availableToSelect.map(media => (
                <div
                  key={media.of_media_id}
                  onClick={() => toggleMedia(media.of_media_id)}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-4 transition-all ${
                    selected.has(media.of_media_id)
                      ? 'border-purple-600 shadow-lg'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img
                    src={media.media_thumb || '/placeholder.png'}
                    alt={media.title}
                    className="w-full h-32 object-cover"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-2">
                    <span className="text-white text-xs font-semibold truncate">
                      {media.file_type === 'video' ? '🎥' : '📷'} {media.title || 'Untitled'}
                    </span>
                  </div>

                  {/* Checkmark */}
                  {selected.has(media.of_media_id) && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            Confirm ({selected.size})
          </button>
        </div>

      </div>
    </div>
  )
}
