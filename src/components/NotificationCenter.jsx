import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function NotificationCenter() {
  const { modelId } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (modelId) {
      loadNotifications()
      
      // Poll cada 30 segundos
      const interval = setInterval(loadNotifications, 30000)
      return () => clearInterval(interval)
    }
  }, [modelId])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('model_id', modelId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
      
      setNotifications(notifications.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id)
    navigate(`/chatter?fan=${notification.fan_id}`)
    setShowDropdown(false)
  }

  const getNotificationColor = (type) => {
    switch(type) {
      case 'OFERTA_ACEPTADA': return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }
      case 'PAGO_RECIBIDO': return { bg: '#d1fae5', border: '#10b981', text: '#065f46' }
      case 'CUSTOM_REQUEST': return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
      default: return { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' }
    }
  }

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'OFERTA_ACEPTADA': return '🟡'
      case 'PAGO_RECIBIDO': return '🟢'
      case 'CUSTOM_REQUEST': return '🔵'
      default: return '⚪'
    }
  }

  const getActionText = (notification) => {
    const { type, action_data } = notification
    
    if (type === 'OFERTA_ACEPTADA') {
      return {
        title: 'Fan Accepted Offer',
        steps: [
          'Go to OnlyFans chat',
          `Upload "${action_data.title}"`,
          `Set price: $${action_data.price} (PPV)`,
          'Send to fan'
        ]
      }
    }
    
    if (type === 'PAGO_RECIBIDO') {
      return {
        title: 'Payment Received',
        steps: [
          'Go to OnlyFans chat',
          'Send unlocked content',
          'Thank the fan'
        ]
      }
    }
    
    if (type === 'CUSTOM_REQUEST') {
      return {
        title: 'Custom Content Request',
        steps: [
          'Review request details',
          'Discuss pricing',
          'Create custom content'
        ]
      }
    }
    
    return { title: 'Action Required', steps: [] }
  }

  const unreadCount = notifications.length

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          padding: '0.5rem',
          background: 'white',
          borderRadius: '0.375rem',
          border: '2px solid #e5e7eb',
          fontSize: '1.25rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          width: '400px',
          maxHeight: '600px',
          overflowY: 'auto',
          zIndex: 50
        }}>
          <div style={{ 
            padding: '1rem', 
            borderBottom: '2px solid #e5e7eb',
            fontWeight: 'bold',
            fontSize: '1.125rem',
            color: '#1f2937'
          }}>
            🔔 Notifications ({unreadCount})
          </div>

          {notifications.length === 0 ? (
            <div style={{ 
              padding: '3rem 1rem',
              textAlign: 'center',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <div>All caught up!</div>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {notifications.map((notification) => {
                const colors = getNotificationColor(notification.type)
                const actionInfo = getActionText(notification)
                
                return (
                  <div
                    key={notification.id}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e5e7eb',
                      background: colors.bg,
                      borderLeft: `4px solid ${colors.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fff'}
                    onMouseLeave={(e) => e.currentTarget.style.background = colors.bg}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: colors.text,
                          marginBottom: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          {getNotificationIcon(notification.type)}
                          {actionInfo.title}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {notification.fan_name}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification.id)
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#f3f4f6',
                          border: 'none',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ 
                      fontSize: '0.75rem',
                      color: colors.text,
                      background: 'white',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        ⚡ Action Steps:
                      </div>
                      {actionInfo.steps.map((step, idx) => (
                        <div key={idx} style={{ marginLeft: '0.5rem' }}>
                          {idx + 1}. {step}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: colors.border,
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Go to Chat
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification.id)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#f3f4f6',
                          color: '#6b7280',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Done
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
