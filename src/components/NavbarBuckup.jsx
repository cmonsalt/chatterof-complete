import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import NotificationCenter from './NotificationCenter'

export default function Navbar() {
  const { user, models, currentModel, switchModel, signOut } = useAuth()
  const navigate = useNavigate()
  const [showModelSelector, setShowModelSelector] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelSelector(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleModelSwitch = (modelId) => {
    switchModel(modelId)
    setShowModelSelector(false)
    // Recargar la página para actualizar los fans
    window.location.reload()
  }

  return (
    <nav style={{
      background: 'white',
      borderBottom: '1px solid #e5e7eb',
      padding: '1rem 2rem',
      marginBottom: '2rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 
          onClick={() => navigate('/dashboard')}
          style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold',
            cursor: 'pointer',
            color: '#3b82f6'
          }}
        >
          ChatterOF
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Notification Center */}
          <NotificationCenter />

          {/* Chatter Mode Button - NUEVO */}
          <button
            onClick={() => navigate('/chatter')}
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(to right, #8b5cf6, #ec4899)',
              color: 'white',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-1px)'
              e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <span>💬</span>
            <span>Chatter Mode</span>
          </button>

          {/* Model Selector */}
          {models.length > 0 && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#8b5cf6',
                  color: 'white',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  border: '2px solid #7c3aed'
                }}
              >
                <span>💎</span>
                <span>{currentModel?.name || 'Select Model'}</span>
                <span style={{ fontSize: '0.75rem' }}>▼</span>
              </button>

              {/* Dropdown */}
              {showModelSelector && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  minWidth: '200px',
                  zIndex: 50
                }}>
                  <div style={{ padding: '0.5rem' }}>
                    <div style={{ 
                      padding: '0.5rem', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      color: '#6b7280',
                      borderBottom: '1px solid #e5e7eb'
                    }}>
                      SELECT MODEL
                    </div>
                    {models.map((model) => (
                      <button
                        key={model.model_id}
                        onClick={() => handleModelSwitch(model.model_id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.75rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          background: currentModel?.model_id === model.model_id ? '#f3f4f6' : 'transparent',
                          fontWeight: currentModel?.model_id === model.model_id ? 600 : 400,
                          color: currentModel?.model_id === model.model_id ? '#3b82f6' : '#374151',
                          marginTop: '0.25rem'
                        }}
                        onMouseEnter={(e) => {
                          if (currentModel?.model_id !== model.model_id) {
                            e.target.style.background = '#f9fafb'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentModel?.model_id !== model.model_id) {
                            e.target.style.background = 'transparent'
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {currentModel?.model_id === model.model_id && <span>✓</span>}
                          <div>
                            <div>{model.name}</div>
                            {model.niche && (
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                {model.niche}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {user?.email}
          </span>
          <button
            onClick={() => navigate('/settings')}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Settings
          </button>
          <button
            onClick={handleSignOut}
            style={{
              padding: '0.5rem 1rem',
              background: '#ef4444',
              color: 'white',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  )
}
