import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

export default function Dashboard() {
  const { modelId } = useAuth()
  const navigate = useNavigate()
  const [fans, setFans] = useState([])
  const [filteredFans, setFilteredFans] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddFan, setShowAddFan] = useState(false)
  const [newFanId, setNewFanId] = useState('')
  const [newFanName, setNewFanName] = useState('')
  
  // 🆕 NEW: States for notes system
  const [hasPreviousHistory, setHasPreviousHistory] = useState(false)
  const [fanNotes, setFanNotes] = useState('')

  useEffect(() => {
    if (modelId) {
      loadFans()
    }
  }, [modelId])

  useEffect(() => {
    // Filtrar fans según búsqueda
    if (searchQuery.trim() === '') {
      setFilteredFans(fans)
    } else {
      const filtered = fans.filter(fan => 
        fan.fan_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fan.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fan.tier?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredFans(filtered)
    }
  }, [searchQuery, fans])

  const loadFans = async () => {
    try {
      const { data, error} = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', modelId)
        .order('last_message_date', { ascending: false, nullsFirst: false })

      if (error) throw error
      setFans(data || [])
      setFilteredFans(data || [])
    } catch (error) {
      console.error('Error loading fans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFan = async (e) => {
    e.preventDefault()
    
    try {
      // 🆕 Build insert object with optional notes
      const insertData = {
        fan_id: newFanId,
        model_id: modelId,
        name: newFanName || 'Unknown',
        tier: 'FREE',
        spent_total: 0
      }

      // 🆕 Only add notes if checkbox is checked and notes exist
      if (hasPreviousHistory && fanNotes.trim()) {
        insertData.notes = fanNotes.trim()
      }

      const { error } = await supabase
        .from('fans')
        .insert(insertData)

      if (error) throw error

      // Reset form
      setShowAddFan(false)
      setNewFanId('')
      setNewFanName('')
      setHasPreviousHistory(false)
      setFanNotes('')
      
      loadFans()
    } catch (error) {
      alert('Error adding fan: ' + error.message)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Your Fans</h2>
          <button
            onClick={() => setShowAddFan(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: '0.375rem',
              fontWeight: 500
            }}
          >
            + Add Fan
          </button>
        </div>

        {/* Search Bar */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fans by ID, name, or tier..."
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.375rem',
                fontSize: '1rem'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  padding: '0.75rem 1rem',
                  background: '#f3f4f6',
                  borderRadius: '0.375rem',
                  fontWeight: 500
                }}
              >
                Clear
              </button>
            )}
          </div>
          {searchQuery && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Found {filteredFans.length} result{filteredFans.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* 🆕 IMPROVED: Add Fan Form with Notes */}
        {showAddFan && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              Add New Fan
            </h3>
            <form onSubmit={handleAddFan} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Fan ID (from OnlyFans)</label>
                <input
                  type="text"
                  required
                  value={newFanId}
                  onChange={(e) => setNewFanId(e.target.value)}
                  placeholder="u8001"
                />
              </div>
              
              <div>
                <label>Fan Name (optional)</label>
                <input
                  type="text"
                  value={newFanName}
                  onChange={(e) => setNewFanName(e.target.value)}
                  placeholder="John"
                />
              </div>

              {/* 🆕 NEW: Previous History Checkbox */}
              <div style={{ 
                padding: '1rem',
                background: '#f9fafb',
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb'
              }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 500
                }}>
                  <input
                    type="checkbox"
                    checked={hasPreviousHistory}
                    onChange={(e) => {
                      setHasPreviousHistory(e.target.checked)
                      if (!e.target.checked) {
                        setFanNotes('') // Clear notes if unchecked
                      }
                    }}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>📜 This fan has previous history with me</span>
                </label>
              </div>

              {/* 🆕 NEW: Notes Textarea (conditional) */}
              {hasPreviousHistory && (
                <div style={{
                  padding: '1rem',
                  background: '#fef3c7',
                  borderRadius: '0.375rem',
                  border: '1px solid #fbbf24'
                }}>
                  <label style={{ 
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: '#92400e'
                  }}>
                    💡 Add context about this fan:
                  </label>
                  <textarea
                    value={fanNotes}
                    onChange={(e) => setFanNotes(e.target.value)}
                    placeholder="Example:&#10;- Miguel, 28 years old from Madrid&#10;- Subscribed for 6 months (~$150 spent)&#10;- Likes gaming and anime content&#10;- Always tips on weekends&#10;- Asked about custom videos twice"
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #fbbf24',
                      borderRadius: '0.375rem',
                      fontSize: '0.9rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ 
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#92400e'
                  }}>
                    ℹ️ The AI will use this context to personalize responses. Include:
                    name, age, interests, purchase history, preferences, etc.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#3b82f6',
                    color: 'white',
                    borderRadius: '0.375rem',
                    fontWeight: 500
                  }}
                >
                  Add Fan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFan(false)
                    setNewFanId('')
                    setNewFanName('')
                    setHasPreviousHistory(false)
                    setFanNotes('')
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    borderRadius: '0.375rem',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {filteredFans.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              {searchQuery ? 'No fans found matching your search' : 'No fans yet. Add your first fan to start chatting!'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredFans.map((fan) => (
              <div
                key={fan.fan_id}
                onClick={() => navigate(`/chat/${fan.fan_id}`)}
                className="card"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid #e5e7eb'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  e.currentTarget.style.borderColor = '#3b82f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                        {fan.name || 'Unknown'}
                      </h3>
                      {/* 🆕 NEW: Show indicator if fan has notes */}
                      {fan.notes && (
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          background: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '0.25rem',
                          fontWeight: 600
                        }}>
                          📜 HAS HISTORY
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {fan.fan_id}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#059669' }}>
                        ${fan.spent_total || 0}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        Total spent
                      </div>
                    </div>
                    <span className={`badge badge-${fan.tier.toLowerCase()}`}>
                      {fan.tier}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
