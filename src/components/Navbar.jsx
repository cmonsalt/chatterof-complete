import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
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
