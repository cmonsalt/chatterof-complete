import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function NotificationBell() {
  const { currentModel } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cargar notificaciones
  const loadNotifications = async () => {
    if (!currentModel?.model_id) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('model_id', currentModel.model_id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }

  // Suscribirse a nuevas notificaciones en tiempo real
  useEffect(() => {
    if (!currentModel?.model_id) return

    loadNotifications()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `model_id=eq.${currentModel.model_id}`
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 20))
          setUnreadCount(prev => prev + 1)
          
          // Reproducir sonido (opcional)
          // new Audio('/notification.mp3').play()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentModel?.model_id])

  // Marcar como leída
  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    if (!currentModel?.model_id) return
    setLoading(true)

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('model_id', currentModel.model_id)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    setLoading(false)
  }

  // Manejar click en notificación
  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.id)
    setShowDropdown(false)

    // Navegar según el tipo - TODOS llevan al chat del fan
    if (notification.fan_id) {
      navigate(`/chat/${notification.fan_id}`)
    } else if (notification.type === 'new_subscriber') {
      // Si es suscriptor nuevo pero sin fan_id, ir a dashboard
      navigate('/dashboard')
    }
  }

  // Formato de tiempo relativo
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return 'ahora'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  // Icono según tipo
  const getIcon = (type) => {
    const icons = {
      new_message: '💬',
      new_purchase: '💰',
      new_tip: '💸',
      new_subscriber: '⭐',
      new_like: '❤️'
    }
    return icons[type] || '🔔'
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          padding: '0.5rem',
          background: showDropdown ? '#f3f4f6' : 'transparent',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.5rem',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => !showDropdown && (e.target.style.background = '#f9fafb')}
        onMouseLeave={(e) => !showDropdown && (e.target.style.background = 'transparent')}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0.25rem',
            right: '0.25rem',
            background: '#ef4444',
            color: 'white',
            borderRadius: '9999px',
            padding: '0.125rem 0.375rem',
            fontSize: '0.625rem',
            fontWeight: 700,
            minWidth: '1.25rem',
            textAlign: 'center'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          width: '380px',
          maxHeight: '500px',
          overflow: 'hidden',
          zIndex: 50
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
              Notificaciones
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                style={{
                  fontSize: '0.75rem',
                  color: '#3b82f6',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Marcando...' : 'Marcar todas'}
              </button>
            )}
          </div>

          {/* List */}
          <div style={{
            maxHeight: '420px',
            overflowY: 'auto'
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                color: '#9ca3af'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔔</div>
                <div style={{ fontSize: '0.875rem' }}>No hay notificaciones</div>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: notif.is_read ? 'white' : '#eff6ff',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = notif.is_read ? '#f9fafb' : '#dbeafe'}
                  onMouseLeave={(e) => e.target.style.background = notif.is_read ? 'white' : '#eff6ff'}
                >
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                      {getIcon(notif.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'start',
                        marginBottom: '0.25rem'
                      }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: notif.is_read ? 400 : 700,
                          color: '#111827'
                        }}>
                          {notif.title}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          flexShrink: 0,
                          marginLeft: '0.5rem'
                        }}>
                          {timeAgo(notif.created_at)}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.8125rem',
                        color: '#6b7280',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {notif.message}
                      </div>
                      {notif.amount > 0 && (
                        <div style={{
                          marginTop: '0.25rem',
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: '#10b981'
                        }}>
                          ${notif.amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
