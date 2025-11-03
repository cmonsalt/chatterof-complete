// ✅ Settings.jsx CORREGIDO - Solo se cambiaron las funciones de conexión

// REEMPLAZAR líneas 149-177 de tu Settings.jsx con esto:

// ✅ Check OnlyFans Connection
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

// ✅ NUEVO: OAuth Connect
const handleConnect = () => {
  const redirectUrl = encodeURIComponent(`${window.location.origin}/auth/callback`)
  window.location = `https://app.onlyfansapi.com/connect?redirect_url=${redirectUrl}`
}

// ✅ Disconnect corregido
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

// ==============================================================
// TAMBIÉN CAMBIAR EN LA LÍNEA 33:
// Agregar este nuevo state:
const [accountId, setAccountId] = useState(null)

// ==============================================================
// REEMPLAZAR líneas 452-500 (el contenido cuando NO está conectado):

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
      Connect your OnlyFans account to start syncing chats, fans, and transactions automatically.
    </p>
    <button 
      onClick={handleConnect}
      style={{
        padding: '0.75rem 1.5rem',
        background: '#7c3aed',
        color: 'white',
        borderRadius: '0.5rem',
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer'
      }}
    >
      🔗 Connect OnlyFans
    </button>
  </div>
)}

// ==============================================================
// RESUMEN DE CAMBIOS:
// 1. checkConnection() - Usa models.of_account_id en vez de API externa
// 2. handleConnect() - NUEVO: Redirect a OAuth
// 3. handleDisconnect() - Actualiza models.of_account_id en vez de of_sessions
// 4. UI - Botón "Connect OnlyFans" en vez de "Download Extension"
// 5. State - Agregado accountId para mostrar ID conectado
