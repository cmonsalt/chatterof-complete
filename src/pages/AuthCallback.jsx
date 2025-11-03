// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'  // ← FALTABA ESTO
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { modelId } = useAuth()
  const [status, setStatus] = useState('Conectando...')

  useEffect(() => {
    const connectAccount = async () => {
      const accountId = searchParams.get('account_id')
      
      if (!accountId) {
        setStatus('❌ No se recibió account_id')
        return
      }

      if (!modelId) {
        setStatus('❌ No hay modelo seleccionado')
        return
      }

      try {
        setStatus('💾 Guardando conexión...')
        
        const { error } = await supabase
          .from('models')
          .update({ of_account_id: accountId })
          .eq('model_id', modelId)

        if (error) throw error

        setStatus('✅ ¡Conectado!')

        setTimeout(() => {
          navigate('/settings')
        }, 1500)

      } catch (error) {
        setStatus('❌ Error: ' + error.message)
      }
    }

    connectAccount()
  }, [searchParams, modelId, navigate])

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ fontSize: '3rem' }}>🔗</div>
      <h2>{status}</h2>
    </div>
  )
}