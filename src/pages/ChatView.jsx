import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

export default function ChatView({ embedded = false }) {
  const { fanId } = useParams();
  const { user, modelId } = useAuth();
  const navigate = useNavigate();
  
  const [fan, setFan] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  const [iaAnalisis, setIaAnalisis] = useState(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [showIaPanel, setShowIaPanel] = useState(true);
  
  const [showNotesSidebar, setShowNotesSidebar] = useState(true);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameValue, setNicknameValue] = useState('');
  const [notesValue, setNotesValue] = useState('');
  const [chatterNotesValue, setChatterNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  
  const [fanStats, setFanStats] = useState({
    totalTips: 0,
    tipsCount: 0,
    ppvUnlocked: 0,
    ppvCount: 0,
    lastInteraction: null
  });
  
  const [catalog, setCatalog] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  
  // ✅ Refs para evitar comportamiento duplicado
  const lastCheckedMessageId = useRef(null);
  const justSentMessage = useRef(false);  // 🔥 NUEVO: Flag para evitar marcar inmediatamente después de enviar

  // Helper para tier badge
  const getTierBadge = (tier) => {
    const tiers = {
      0: { emoji: '🆕', label: 'New Fan', color: 'bg-gray-100 text-gray-700' },
      1: { emoji: '💎', label: 'VIP', color: 'bg-blue-100 text-blue-700' },
      2: { emoji: '🐋', label: 'Whale', color: 'bg-purple-100 text-purple-700' }
    }
    return tiers[tier] || tiers[0]
  }

  useEffect(() => {
    loadFanAndMessages();
    loadCatalog();
    const interval = setInterval(loadFanAndMessages, 5000);
    return () => clearInterval(interval);
  }, [fanId, user]);

  // ✅ Marcar mensajes como leídos cuando fan responde
  useEffect(() => {
    if (messages.length === 0) return;
    
    // 🔥 Si acabamos de enviar un mensaje, NO marcar nada todavía
    if (justSentMessage.current) {
      console.log('⏭️ Skipping read marking - just sent a message');
      justSentMessage.current = false;  // Reset flag
      return;
    }
    
    const lastMessage = messages[0]; // Más reciente
    
    // Si el último mensaje es del fan Y no lo hemos procesado antes
    if (lastMessage?.from === 'fan' && lastMessage.id !== lastCheckedMessageId.current) {
      console.log('📖 Fan responded! Marking previous model messages as read');
      lastCheckedMessageId.current = lastMessage.id;
      markPreviousModelMessagesAsRead(lastMessage.ts);
    }
  }, [messages]);

  async function markPreviousModelMessagesAsRead(fanMessageTime) {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!fanId || !currentModelId) return;
    
    try {
      // Marcar como leídos solo los mensajes del modelo que son ANTERIORES al mensaje del fan
      const { data, error } = await supabase
        .from('chat')
        .update({ read: true })
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .eq('from', 'model')
        .eq('read', false)
        .lt('ts', fanMessageTime)  // Solo mensajes anteriores al del fan
        .select();
      
      if (error) {
        console.error('❌ Error marking messages as read:', error);
      } else {
        console.log('✅ Marked as read:', data?.length || 0, 'messages');
      }
    } catch (err) {
      console.error('❌ Error:', err);
    }
  }

  // Cargar notas cuando se carga el fan
  useEffect(() => {
    if (fan) {
      setNicknameValue(fan.display_name || '');
      setNotesValue(fan.notes || '');
      setChatterNotesValue(fan.chatter_notes || '');
    }
  }, [fan?.fan_id]);

  const handleSaveNickname = async () => {
    if (!fan) return
    
    try {
      const { error } = await supabase
        .from('fans')
        .update({ display_name: nicknameValue })
        .eq('fan_id', fan.fan_id)
      
      if (error) throw error
      
      const updatedFan = { ...fan, display_name: nicknameValue }
      setFan(updatedFan)
      setEditingNickname(false)
      alert('✅ Nickname saved!')
    } catch (error) {
      console.error('Error saving nickname:', error)
      alert('❌ Error saving nickname')
    }
  }

  const handleSaveNotes = async () => {
    if (!fan) return
    
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('fans')
        .update({ notes: notesValue })
        .eq('fan_id', fan.fan_id)
      
      if (error) throw error
      
      const updatedFan = { ...fan, notes: notesValue }
      setFan(updatedFan)
      alert('✅ Notes saved!')
    } catch (error) {
      console.error('Error saving notes:', error)
      alert('❌ Error saving notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleSaveChatterNotes = async () => {
    if (!fan) return
    
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('fans')
        .update({ chatter_notes: chatterNotesValue })
        .eq('fan_id', fan.fan_id)
      
      if (error) throw error
      
      const updatedFan = { ...fan, chatter_notes: chatterNotesValue }
      setFan(updatedFan)
      alert('✅ Chatter tips saved!')
    } catch (error) {
      console.error('Error saving chatter notes:', error)
      alert('❌ Error saving chatter tips')
    } finally {
      setSavingNotes(false)
    }
  }

  async function loadFanAndMessages() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    try {
      // Cargar fan
      const { data: fanData, error: fanError } = await supabase
        .from('fans')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .maybeSingle();

      if (fanError) {
        console.error('❌ Fan error:', fanError);
        setLoading(false);
        return;
      }
      
      if (!fanData) {
        console.log('⚠️ Fan no encontrado');
        setLoading(false);
        return;
      }

      setFan(fanData);

      // Cargar mensajes
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .order('ts', { ascending: false })
        .limit(50);

      if (messagesError) {
        console.error('❌ Messages error:', messagesError);
      } else {
        setMessages(messagesData || []);
      }

      // Calcular estadísticas
      calculateFanStats(messagesData || []);
      setLoading(false);
    } catch (error) {
      console.error('❌ Load error:', error);
      setLoading(false);
    }
  }

  function calculateFanStats(msgs) {
    const tips = msgs.filter(m => m.from === 'fan' && m.amount > 0 && !m.media_url);
    const ppvs = msgs.filter(m => m.from === 'fan' && m.amount > 0 && m.media_url);
    const lastMsg = msgs[0];
    
    const totalTips = tips.reduce((sum, t) => {
      const amount = parseFloat(t.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    
    const ppvTotal = ppvs.reduce((sum, p) => {
      const amount = parseFloat(p.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    
    setFanStats({
      totalTips: totalTips,
      tipsCount: tips.length,
      ppvUnlocked: ppvTotal,
      ppvCount: ppvs.length,
      lastInteraction: lastMsg?.ts || null
    });
  }

  async function loadCatalog() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;
    
    try {
      const { data, error } = await supabase
        .from('catalog')
        .select('*')
        .eq('model_id', currentModelId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCatalog(data || []);
    } catch (error) {
      console.error('Error loading catalog:', error);
    }
  }

  async function enviarMensaje() {
    if (!newMessage.trim() || sending) return;
    
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    setSending(true);
    justSentMessage.current = true;  // 🔥 Activar flag ANTES de enviar

    try {
      // Obtener of_account_id del modelo
      const { data: model } = await supabase
        .from('models')
        .select('of_account_id')
        .eq('model_id', currentModelId)
        .single();

      if (!model?.of_account_id) {
        alert('Model not connected to OnlyFans');
        justSentMessage.current = false;
        return;
      }

      console.log('📤 Sending message:', {
        accountId: model.of_account_id,
        modelId: currentModelId,
        fanId: fanId,
        text: newMessage
      });

      // Enviar a OnlyFans API
      const response = await fetch('/api/onlyfans/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: model.of_account_id,  // ✅ of_account_id para la API
          modelId: currentModelId,         // ✅ model_id para la BD
          chatId: fanId,
          text: newMessage,
          mediaFiles: selectedContent ? [selectedContent] : [],
          price: 0
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      console.log('✅ Message sent successfully');

      // Limpiar input y recargar mensajes
      setNewMessage('');
      setSelectedContent(null);
      
      // Esperar un poco antes de recargar para dar tiempo al servidor
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadFanAndMessages();
      
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      alert('Error al enviar mensaje: ' + error.message);
      justSentMessage.current = false;  // Reset flag en caso de error
    } finally {
      setSending(false);
    }
  }

  async function analizarConIA() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;
    
    setIaLoading(true);

    try {
      const conversacion = messages.map(m => ({
        role: m.from === 'fan' ? 'user' : 'assistant',
        content: m.message
      })).reverse();

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: `Eres un experto asesor de OnlyFans. Analiza esta conversación y dame:
1. Resumen del fan
2. Estado emocional
3. Siguiente mejor acción para maximizar revenue
4. Sugerencia de mensaje

Conversación:\n${JSON.stringify(conversacion, null, 2)}`
            }
          ]
        })
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      setIaAnalisis(data.content[0].text);
    } catch (error) {
      console.error('Error IA:', error);
      alert('Error al analizar con IA');
    } finally {
      setIaLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        {!embedded && <Navbar />}
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-gray-500 font-semibold">Loading chat...</p>
          </div>
        </div>
      </>
    );
  }

  if (!fan) {
    return (
      <>
        {!embedded && <Navbar />}
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <p className="text-gray-500 font-semibold">Fan not found</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  const tierBadge = getTierBadge(fan.tier || 0);

  return (
    <>
      {!embedded && <Navbar />}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header con info del fan */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {(fan.display_name || fan.name || 'F')[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    {fan.display_name || fan.name || 'Fan'}
                  </h1>
                  <p className="text-sm text-gray-500">@{fan.of_username || fan.fan_id}</p>
                </div>
                <span className={`ml-4 px-3 py-1 rounded-full text-sm font-semibold ${tierBadge.color}`}>
                  {tierBadge.emoji} {tierBadge.label}
                </span>
              </div>
              
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">${fan.spent_total || 0}</p>
                  <p className="text-xs text-gray-500">Total Spent</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{fanStats.tipsCount}</p>
                  <p className="text-xs text-gray-500">Tips</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{fanStats.ppvCount}</p>
                  <p className="text-xs text-gray-500">PPV</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Area */}
            <div className={showNotesSidebar ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col h-[600px]">
                {/* Botón IA */}
                <button
                  onClick={analizarConIA}
                  disabled={iaLoading}
                  className="mb-4 w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold disabled:opacity-50"
                >
                  {iaLoading ? '🤖 Analyzing...' : '🤖 Analyze with AI'}
                </button>

                {/* Panel IA */}
                {iaAnalisis && showIaPanel && (
                  <div className="mb-4 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-purple-700">💡 AI Analysis</h3>
                      <button
                        onClick={() => setShowIaPanel(false)}
                        className="text-purple-400 hover:text-purple-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{iaAnalisis}</div>
                  </div>
                )}

                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.from === 'model' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex flex-col max-w-[70%] ${msg.from === 'model' ? 'items-end' : 'items-start'}`}>
                        <span className={`text-xs font-semibold mb-1 ${
                          msg.from === 'model' ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {msg.from === 'model' ? '💙 You' : '👤 ' + (fan.display_name || fan.name || 'Fan')}
                        </span>
                        
                        <div
                          className={`px-4 py-2 rounded-lg ${
                            msg.from === 'model'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {msg.media_url && (
                            <img src={msg.media_url} alt="media" className="rounded mb-2 max-w-full" />
                          )}
                          <p className="text-sm">{msg.message}</p>
                          <div className="flex items-center justify-end gap-2 text-xs opacity-70 mt-1">
                            <span>{new Date(msg.ts).toLocaleTimeString()}</span>
                            {msg.from === 'model' && (
                              <span className={msg.read ? 'text-blue-200' : 'text-white/60'}>
                                {msg.read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selector de contenido */}
                {catalog.length > 0 && (
                  <div className="mb-3">
                    <select
                      value={selectedContent || ''}
                      onChange={(e) => setSelectedContent(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="">📎 Select content from catalog</option>
                      {catalog.map((item) => (
                        <option key={item.id} value={item.media_url}>
                          {item.title || item.media_type}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sending && enviarMensaje()}
                    placeholder="Type your message..."
                    disabled={sending}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={enviarMensaje}
                    disabled={!newMessage.trim() || sending}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {sending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar de notas */}
            {showNotesSidebar && (
              <div className="bg-white rounded-xl shadow-lg p-6 max-h-[700px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-3 border-b sticky top-0 bg-white">
                  <h3 className="font-bold text-lg">👤 Fan Profile</h3>
                  <button
                    onClick={() => setShowNotesSidebar(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* OF Username */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">OnlyFans Username</p>
                  <p className="text-sm font-mono bg-gray-50 px-3 py-2 rounded break-all">
                    {fan.of_username || fan.fan_id}
                  </p>
                </div>

                {/* Nickname */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">✏️ Nickname</p>
                  {editingNickname ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={nicknameValue}
                        onChange={(e) => setNicknameValue(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                        placeholder="e.g., John VIP"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNickname}
                          className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                          💾 Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNickname(false)
                            setNicknameValue(fan.display_name || '')
                          }}
                          className="px-3 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingNickname(true)}
                      className="px-3 py-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 text-sm border border-dashed border-gray-300"
                    >
                      {fan.display_name || <span className="text-gray-400 italic">Click to add nickname</span>}
                    </div>
                  )}
                </div>

                {/* Tier y Spent */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tier</p>
                    <div className={`px-3 py-2 rounded text-center text-sm font-semibold ${tierBadge.color}`}>
                      {tierBadge.emoji} {tierBadge.label}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                    <div className="px-3 py-2 bg-green-50 text-green-700 rounded text-center text-sm font-bold">
                      ${fan.spent_total || 0}
                    </div>
                  </div>
                </div>

                {/* Last Seen */}
                <div className="mb-4 pb-4 border-b">
                  <p className="text-xs text-gray-500 mb-1">📅 Last seen</p>
                  <p className="text-sm text-gray-700">
                    {fan.last_seen ? new Date(fan.last_seen).toLocaleString() : 'Unknown'}
                  </p>
                </div>

                {/* General Notes */}
                <div className="mb-4">
                  <p className="text-sm font-semibold mb-2">📝 General Notes</p>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows="4"
                    placeholder="Preferences, birthday, family info, etc."
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50 font-semibold"
                  >
                    {savingNotes ? 'Saving...' : '💾 Save Notes'}
                  </button>
                </div>

                {/* Chatter Tips */}
                <div>
                  <p className="text-sm font-semibold mb-2">💡 Chatter Tips</p>
                  <textarea
                    value={chatterNotesValue}
                    onChange={(e) => setChatterNotesValue(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    rows="4"
                    placeholder="Best time to message, what they like to buy, conversation style, etc."
                  />
                  <button
                    onClick={handleSaveChatterNotes}
                    disabled={savingNotes}
                    className="mt-2 w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm disabled:opacity-50 font-semibold"
                  >
                    {savingNotes ? 'Saving...' : '💾 Save Tips'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botón flotante para mostrar sidebar */}
          {!showNotesSidebar && (
            <button
              onClick={() => setShowNotesSidebar(true)}
              className="fixed right-6 bottom-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center text-2xl z-50"
            >
              📝
            </button>
          )}
        </div>
      </div>
    </>
  );
}
