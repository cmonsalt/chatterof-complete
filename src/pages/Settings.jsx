/* ═══════════════════════════════════════════════════════════════
   REEMPLAZAR EN Settings.jsx
   Busca la sección "Language & GPT Model" (línea ~431)
   Y reemplaza hasta "Temperature & Emoji Level" (línea ~503)
   ═══════════════════════════════════════════════════════════════ */

                {/* Language & AI Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      Language
                    </label>
                    <select
                      value={config.language_code || 'en'}
                      onChange={(e) => setConfig({...config, language_code: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem'
                      }}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                      AI Model
                    </label>
                    <div style={{ 
                      padding: '0.75rem',
                      border: '2px solid #10b981',
                      borderRadius: '0.5rem',
                      background: '#d1fae5',
                      color: '#065f46',
                      fontWeight: 600
                    }}>
                      🤖 Claude 3.5 Sonnet (Best for NSFW)
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Better for adult content, no censorship
                    </p>
                  </div>
                </div>

                {/* Claude API Key */}
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                    🔑 Claude API Key
                  </label>
                  <input
                    type="password"
                    value={config.anthropic_api_key || ''}
                    onChange={(e) => setConfig({...config, anthropic_api_key: e.target.value})}
                    placeholder="sk-ant-api03-..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <div style={{ 
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: '#eff6ff',
                    borderRadius: '0.5rem',
                    border: '1px solid #bfdbfe'
                  }}>
                    <p style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem', fontWeight: 600 }}>
                      📌 How to get your API key:
                    </p>
                    <ol style={{ fontSize: '0.875rem', color: '#374151', marginLeft: '1.25rem', lineHeight: '1.5' }}>
                      <li>Go to: <a 
                        href="https://console.anthropic.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        console.anthropic.com
                      </a></li>
                      <li>Click "Get API Key" → Create Key</li>
                      <li>Add $10-20 credits (Billing → Add Credits)</li>
                      <li>Copy key (starts with sk-ant-api03-...)</li>
                      <li>Paste here and Save</li>
                    </ol>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      💰 Cost: ~$0.018 per response (~$20-30/month for 50 fans/day)
                    </p>
                  </div>
                </div>
