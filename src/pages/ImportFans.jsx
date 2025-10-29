import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function ImportFans() {
  const { modelId } = useAuth()
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  // Parser de formato: "Fan: mensaje\nModel: respuesta"
  const parseChatHistory = (text) => {
    const lines = text.trim().split('\n')
    const messages = []
    let currentSender = null
    let currentMessage = ''

    for (let line of lines) {
      if (line.startsWith('Fan:')) {
        if (currentMessage && currentSender) {
          messages.push({ from: currentSender, message: currentMessage.trim() })
        }
        currentSender = 'fan'
        currentMessage = line.replace('Fan:', '').trim()
      } else if (line.startsWith('Model:')) {
        if (currentMessage && currentSender) {
          messages.push({ from: currentSender, message: currentMessage.trim() })
        }
        currentSender = 'chatter'
        currentMessage = line.replace('Model:', '').trim()
      } else {
        // Línea de continuación
        currentMessage += ' ' + line.trim()
      }
    }

    // Agregar último mensaje
    if (currentMessage && currentSender) {
      messages.push({ from: currentSender, message: currentMessage.trim() })
    }

    return messages
  }

  const handleImport = async () => {
    if (!importText.trim()) {
      alert('Please paste chat history to import')
      return
    }

    setImporting(true)
    setResult(null)

    try {
      // Parse el texto
      const lines = importText.trim().split('\n')
      
      // Buscar fan_id en el formato esperado
      const fanIdLine = lines.find(l => l.startsWith('FAN_ID:'))
      if (!fanIdLine) {
        throw new Error('Format error: Missing FAN_ID line. Expected format:\nFAN_ID: username\nFan: message\nModel: response')
      }

      const fanId = fanIdLine.replace('FAN_ID:', '').trim()
      
      // Buscar nombre del fan (opcional)
      const nameLine = lines.find(l => l.startsWith('NAME:'))
      const fanName = nameLine ? nameLine.replace('NAME:', '').trim() : 'Unknown'

      // Filtrar solo las líneas de chat
      const chatLines = lines
        .filter(l => !l.startsWith('FAN_ID:') && !l.startsWith('NAME:'))
        .join('\n')

      // Parse mensajes
      const messages = parseChatHistory(chatLines)

      if (messages.length === 0) {
        throw new Error('No messages found. Make sure format is correct:\nFan: message\nModel: response')
      }

      // 1. Verificar si el fan ya existe
      const { data: existingFan } = await supabase
        .from('fans')
        .select('fan_id')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .single()

      // 2. Si no existe, crear el fan
      if (!existingFan) {
        const { error: fanError } = await supabase
          .from('fans')
          .insert({
            fan_id: fanId,
            model_id: modelId,
            name: fanName,
            tier: 'FREE',
            spent_total: 0,
            last_message_date: new Date().toISOString()
          })

        if (fanError) throw fanError
      }

      // 3. Insertar mensajes en la tabla chat
      const chatInserts = messages.map((msg, idx) => ({
        fan_id: fanId,
        model_id: modelId,
        from: msg.from,
        message: msg.message,
        message_type: 'text',
        timestamp: new Date(Date.now() - (messages.length - idx) * 60000).toISOString() // Timestamps escalonados
      }))

      const { error: chatError } = await supabase
        .from('chat')
        .insert(chatInserts)

      if (chatError) throw chatError

      // Success
      setResult({
        success: true,
        fanId,
        fanName,
        messagesImported: messages.length
      })

      setImportText('')
      alert(`✅ Successfully imported ${messages.length} messages for fan: ${fanName} (${fanId})`)

    } catch (error) {
      console.error('Import error:', error)
      setResult({
        success: false,
        error: error.message
      })
      alert('❌ Import failed: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            📥 Import Existing Fans
          </h2>
          <p className="text-gray-600">
            Migrate your existing fan conversations into ChatterOF
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6 rounded-r-lg">
          <h3 className="font-semibold text-blue-800 mb-3">📋 Required Format:</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <code className="block bg-blue-100 p-4 rounded-lg whitespace-pre font-mono text-xs">
{`FAN_ID: username123
NAME: John Doe
Fan: Hey, how are you?
Model: Hi! I'm doing great, thanks for asking!
Fan: What content do you have?
Model: I have lots of exclusive photos and videos`}
            </code>
            <div className="mt-4 space-y-2">
              <p><strong>Required:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code>FAN_ID:</code> - The fan's OnlyFans username or ID</li>
                <li><code>Fan:</code> - Lines starting with "Fan:" are fan messages</li>
                <li><code>Model:</code> - Lines starting with "Model:" are your responses</li>
              </ul>
              <p className="mt-3"><strong>Optional:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code>NAME:</code> - The fan's real name (optional, defaults to "Unknown")</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Import Textarea */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Paste Chat History:
          </label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="FAN_ID: username&#10;NAME: John Doe&#10;Fan: First message...&#10;Model: Your response..."
            rows={15}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
          />
          <div className="text-xs text-gray-500 mt-2">
            {importText.trim().split('\n').length} lines
          </div>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${
            result.success 
              ? 'bg-green-50 border-green-500' 
              : 'bg-red-50 border-red-500'
          }`}>
            {result.success ? (
              <div className="text-green-800">
                <div className="font-semibold mb-2">✅ Import Successful!</div>
                <div className="text-sm space-y-1">
                  <div>Fan ID: {result.fanId}</div>
                  <div>Name: {result.fanName}</div>
                  <div>Messages imported: {result.messagesImported}</div>
                </div>
              </div>
            ) : (
              <div className="text-red-800">
                <div className="font-semibold mb-2">❌ Import Failed</div>
                <div className="text-sm">{result.error}</div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleImport}
            disabled={importing || !importText.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-xl text-white py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? '⏳ Importing...' : '📥 Import Fan & Chat History'}
          </button>
          
          <button
            onClick={() => setImportText('')}
            className="px-8 bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-lg font-semibold transition-all"
          >
            🗑️ Clear
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">💡 Tips:</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>You can import multiple fans one at a time</li>
            <li>Each message will be timestamped chronologically</li>
            <li>After import, you can add transactions and update fan details manually</li>
            <li>The AI will use this conversation history for context in future chats</li>
            <li>Make sure the FAN_ID matches the fan's OnlyFans username</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
