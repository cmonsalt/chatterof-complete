import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import PPVSelectorModal from '../components/PPVSelectorModal';
import PPVSendModal from '../components/PPVSendModal';
import PPVMessage from '../components/PPVMessage';
import AISuggestionModal from '../components/AISuggestionModal';
import { generateAISuggestion } from '../services/aiService';

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
  
  // ðŸ”¥ PPV MODALS - NEW
  const [showPPVSelector, setShowPPVSelector] = useState(false);
  const [showPPVSend, setShowPPVSend] = useState(false);
  const [selectedPPVContent, setSelectedPPVContent] = useState([]);
  
  // 🤖 AI SUGGESTION MODAL
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [catalogSessions, setCatalogSessions] = useState([]);
  
  // ðŸ”¥ REPLY functionality
  const [replyingTo, setReplyingTo] = useState(null);
  
  const lastCheckedMessageId = useRef(null);
  const justSentMessage = useRef(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getTierBadge = (tier) => {
    const tiers = {
      0: { emoji: 'ðŸ†“', label: 'New Fan', color: 'bg-gray-100 text-gray-700' },
      1: { emoji: 'ðŸ’Ž', label: 'VIP', color: 'bg-blue-100 text-blue-700' },
      2: { emoji: 'ðŸ‹', label: 'Whale', color: 'bg-purple-100 text-purple-700' }
    }
    return tiers[tier] || tiers[0]
  }

  useEffect(() => {
    loadFanAndMessages();
    const interval = setInterval(loadFanAndMessages, 5000);
    return () => clearInterval(interval);
  }, [fanId, user]);

  useEffect(() => {
    if (messages.length === 0) return;
    
    if (justSentMessage.current) {
      console.log('â­ï¸ Skipping read marking - just sent a message');
      justSentMessage.current = false;
      return;
    }
    
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage?.from === 'fan' && lastMessage.id !== lastCheckedMessageId.current) {
      console.log('ðŸ“– Fan responded! Marking previous model messages as read');
      lastCheckedMessageId.current = lastMessage.id;
      markPreviousModelMessagesAsRead(lastMessage.ts);
    }
  }, [messages]);

  async function markPreviousModelMessagesAsRead(fanMessageTime) {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!fanId || !currentModelId) return;
    
    try {
      const { data, error } = await supabase
        .from('chat')
        .update({ read: true })
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .eq('from', 'model')
        .eq('read', false)
        .lt('ts', fanMessageTime);

      if (error) throw error;
      console.log('âœ… Marked model messages as read');
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async function loadFanAndMessages() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) {
      console.log('âš ï¸ No model ID');
      setLoading(false);
      return;
    }

    if (!fanId) {
      console.log('âš ï¸ No fan ID');
      setLoading(false);
      return;
    }

    try {
      const { data: fanData, error: fanError } = await supabase
        .from('fans')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .maybeSingle();

      if (fanError) {
        console.error('âŒ Fan error:', fanError);
        setLoading(false);
        return;
      }
      
      if (!fanData) {
        console.log('âš ï¸ Fan no encontrado');
        setLoading(false);
        return;
      }

      setFan(fanData);

      const { data: messagesData, error: messagesError} = await supabase
        .from('chat')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .order('ts', { ascending: true })
        .limit(50);

      if (messagesError) {
        console.error('âŒ Messages error:', messagesError);
      } else {
        setMessages(messagesData || []);
      }

      calculateFanStats(messagesData || []);
      setLoading(false);
    } catch (error) {
      console.error('âŒ Load error:', error);
      setLoading(false);
    }
  }

  function calculateFanStats(msgs) {
    const tips = msgs.filter(m => m.from === 'fan' && m.amount > 0 && !m.media_url);
    const ppvs = msgs.filter(m => m.from === 'fan' && m.amount > 0 && m.media_url);
    const lastMsg = msgs[msgs.length - 1];
    
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

  // ðŸ”¥ NEW: Handle PPV content selection
  function handlePPVContentSelected(content) {
    setSelectedPPVContent(content);
    setShowPPVSelector(false);
    setShowPPVSend(true);
  }

  // ðŸ”¥ NEW: Handle PPV send
  async function handleSendPPV(ppvData) {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    setSending(true);
    justSentMessage.current = true;

    try {
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

      const response = await fetch('/api/onlyfans/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: model.of_account_id,
          modelId: currentModelId,
          chatId: fanId,
          text: ppvData.text,
          mediaFiles: ppvData.mediaFiles,
          price: ppvData.price,
          replyToMessageId: replyingTo?.id || null,
          replyToText: replyingTo?.message || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      // Reset states
      setSelectedPPVContent([]);
      setShowPPVSend(false);
      setReplyingTo(null);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadFanAndMessages();
      
    } catch (error) {
      console.error('âŒ Error sending PPV:', error);
      alert('Error sending PPV: ' + error.message);
      justSentMessage.current = false;
    } finally {
      setSending(false);
    }
  }

  // 🤖 NEW: Consultar IA
  async function handleConsultarIA() {
    setAiGenerating(true);
    
    try {
      // Load catalog if not loaded
      if (catalogSessions.length === 0) {
        const { data } = await supabase
          .from('catalog')
          .select('*')
          .eq('model_id', modelId)
          .order('created_at', { ascending: false });
        
        // Group into sessions
        const sessionsMap = new Map();
        const allMediasMap = new Map();
        
        data?.forEach(item => {
          if (item.of_media_id) {
            allMediasMap.set(item.of_media_id, item);
          }
        });
        
        data?.filter(item => item.session_id && item.step_number !== null)
          .forEach(item => {
            if (!sessionsMap.has(item.session_id)) {
              sessionsMap.set(item.session_id, {
                session_id: item.session_id,
                session_name: item.session_name,
                parts: []
              });
            }
            
            const mediasInfo = [];
            if (item.of_media_ids && item.of_media_ids.length > 0) {
              item.of_media_ids.forEach(mediaId => {
                const mediaInfo = allMediasMap.get(mediaId);
                if (mediaInfo) {
                  mediasInfo.push({
                    of_media_id: mediaInfo.of_media_id,
                    media_thumb: mediaInfo.media_thumb,
                    media_url: mediaInfo.media_url,
                    r2_url: mediaInfo.r2_url,
                    file_type: mediaInfo.file_type
                  });
                }
              });
            }
            
            sessionsMap.get(item.session_id).parts.push({
              ...item,
              medias_info: mediasInfo
            });
          });
        
        sessionsMap.forEach(session => {
          session.parts.sort((a, b) => a.step_number - b.step_number);
        });
        
        setCatalogSessions(Array.from(sessionsMap.values()));
      }
      
      // Generate AI suggestion
      const suggestion = await generateAISuggestion(
        fan,
        { lastMessage: messages[messages.length - 1]?.message || '' },
        catalogSessions
      );
      
      setAiSuggestion(suggestion);
      setShowAISuggestion(true);
      
    } catch (error) {
      console.error('Error generating AI suggestion:', error);
      alert('Error generating AI suggestion');
    } finally {
      setAiGenerating(false);
    }
  }

  // 🤖 Handle AI suggestion accept
  function handleAIAccept(data) {
    if (data.ppv) {
      // User wants to send PPV
      setNewMessage(data.message);
      setSelectedPPVContent([data.ppv]);
      setShowPPVSend(true);
    } else {
      // Just send message
      setNewMessage(data.message);
    }
    setShowAISuggestion(false);
  }

  // 🤖 Handle AI edit content
  function handleAIEdit(data) {
    setNewMessage(data.message);
    setShowAISuggestion(false);
    setShowPPVSelector(true);
  }

  async function enviarMensaje() {
    if (!newMessage.trim() || sending) return;
    
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) return;

    setSending(true);
    justSentMessage.current = true;

    try {
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

      const response = await fetch('/api/onlyfans/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: model.of_account_id,
          modelId: currentModelId,
          chatId: fanId,
          text: newMessage,
          mediaFiles: [],
          price: 0,
          replyToMessageId: replyingTo?.id || null,
          replyToText: replyingTo?.message || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      setNewMessage('');
      setReplyingTo(null);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadFanAndMessages();
      
    } catch (error) {
      console.error('âŒ Error enviando mensaje:', error);
      alert('Error al enviar mensaje: ' + error.message);
      justSentMessage.current = false;
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
      }));

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
              content: `Eres un experto asesor de OnlyFans. Analiza esta conversaciÃ³n y dame:
1. Resumen del fan
2. Estado emocional
3. Siguiente mejor acciÃ³n para maximizar revenue
4. Sugerencia de mensaje

ConversaciÃ³n:\n${JSON.stringify(conversacion, null, 2)}`
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

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('fans')
        .update({ notes: notesValue })
        .eq('fan_id', fanId)
        .eq('model_id', modelId || user?.user_metadata?.model_id);

      if (error) throw error;
      setFan(prev => ({ ...prev, notes: notesValue }));
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Error saving notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSaveChatterNotes() {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('fans')
        .update({ chatter_notes: chatterNotesValue })
        .eq('fan_id', fanId)
        .eq('model_id', modelId || user?.user_metadata?.model_id);

      if (error) throw error;
      setFan(prev => ({ ...prev, chatter_notes: chatterNotesValue }));
    } catch (error) {
      console.error('Error saving chatter notes:', error);
      alert('Error saving chatter notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSaveNickname() {
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('fans')
        .update({ nickname: nicknameValue })
        .eq('fan_id', fanId)
        .eq('model_id', modelId || user?.user_metadata?.model_id);

      if (error) throw error;
      setFan(prev => ({ ...prev, nickname: nicknameValue }));
      setEditingNickname(false);
    } catch (error) {
      console.error('Error saving nickname:', error);
      alert('Error saving nickname');
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return (
      <>
        {!embedded && <Navbar />}
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-5xl mb-4">ðŸ’¬</div>
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
            <div className="text-5xl mb-4">ðŸ˜•</div>
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

  const tierInfo = getTierBadge(fan.tier || 0);

  return (
    <>
      {!embedded && <Navbar />}
      <div className={`flex ${embedded ? 'h-full' : 'min-h-screen pt-16'}`}>
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {!embedded && (
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    â† Back
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-800">
                      {fan.nickname || fan.of_username || 'Fan'}
                    </h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${tierInfo.color}`}>
                      {tierInfo.emoji} {tierInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">@{fan.of_username}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowIaPanel(!showIaPanel)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-semibold"
                >
                  ðŸ¤– AI Analysis
                </button>
                <button
                  onClick={() => setShowNotesSidebar(!showNotesSidebar)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
                >
                  ðŸ“ Notes
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  ${fanStats.totalTips.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Tips ({fanStats.tipsCount})</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">
                  ${fanStats.ppvUnlocked.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">PPV ({fanStats.ppvCount})</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">
                  ${(fanStats.totalTips + fanStats.ppvUnlocked).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Revenue</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-sm font-semibold text-gray-700">Last Activity</div>
                <div className="text-xs text-gray-500">
                  {fanStats.lastInteraction 
                    ? new Date(fanStats.lastInteraction).toLocaleDateString()
                    : 'Never'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex gap-4 p-6">
            {/* AI Panel */}
            {showIaPanel && (
              <div className="w-80 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg p-6 border border-purple-200">
                <h2 className="text-xl font-bold text-gray-800 mb-4">ðŸ¤– AI Assistant</h2>
                
                <button
                  onClick={analizarConIA}
                  disabled={iaLoading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 font-semibold disabled:opacity-50 mb-4"
                >
                  {iaLoading ? 'â³ Analyzing...' : 'ðŸ” Analyze Conversation'}
                </button>

                {iaAnalisis && (
                  <div className="bg-white rounded-lg p-4 border border-purple-200 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">{iaAnalisis}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Chat */}
            <div className="flex-1 bg-white rounded-xl shadow-lg flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from === 'model' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.from === 'model'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.reply_to_text && (
                        <div className="mb-2 pb-2 border-b border-opacity-30 border-white">
                          <div className="text-xs opacity-75">â†©ï¸ Reply to:</div>
                          <div className="text-xs italic opacity-90">
                            {msg.reply_to_text.slice(0, 50)}...
                          </div>
                        </div>
                      )}

                      <p className="text-sm">{msg.message}</p>

                      {msg.media_url && (
  // ðŸ”¥ RENDERIZADO CONDICIONAL: PPV vs Normal
  msg.is_ppv ? (
    <PPVMessage message={msg} />
  ) : msg.media_type === 'video' ? (
    <video
      src={msg.media_url}
      controls
      className="rounded-lg shadow-md max-w-xs max-h-60"
      onError={(e) => {
        console.error('Video failed to load')
        e.target.outerHTML = '<div class="flex flex-col items-center justify-center h-48 bg-gray-100 rounded-lg"><div class="text-5xl mb-2">âŒ</div><p class="text-sm text-gray-600 font-semibold">Video URL expired</p></div>'
      }}
    />
  ) : (
    <img
      src={msg.media_url}
      alt="Media"
      className="rounded-lg shadow-md max-w-xs max-h-60"
      onError={(e) => {
        console.error('Image failed to load')
        e.target.outerHTML = '<div class="flex flex-col items-center justify-center h-48 bg-gray-100 rounded-lg"><div class="text-5xl mb-2">âŒ</div><p class="text-sm text-gray-600 font-semibold">Image URL expired</p></div>'
      }}
    />
  )
)}

                      <div className="text-xs opacity-75 mt-1">
                        {new Date(msg.ts).toLocaleTimeString()}
                        {msg.from === 'model' && msg.read && ' â€¢ Read âœ“'}
                      </div>

                      {msg.from === 'fan' && (
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="text-xs underline opacity-75 hover:opacity-100 mt-1"
                        >
                          Reply
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                {replyingTo && (
                  <div className="mb-3 bg-blue-50 border-l-4 border-blue-500 p-3 rounded flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-blue-700 mb-1">
                        â†©ï¸ Replying to:
                      </div>
                      <div className="text-sm text-gray-700">
                        {replyingTo.message.slice(0, 80)}{replyingTo.message.length > 80 ? '...' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      âœ•
                    </button>
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sending && enviarMensaje()}
                    placeholder={replyingTo ? "Write your reply..." : "Type your message..."}
                    disabled={sending}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  
                  {/* ðŸ”¥ NEW PPV BUTTON */}
                  <button
                    onClick={() => setShowPPVSelector(true)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 font-semibold transition-all"
                  >
                    ðŸ’° PPV
                  </button>

                  <button
                    onClick={enviarMensaje}
                    disabled={!newMessage.trim() || sending}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {sending ? 'â³' : 'Send'}
                  </button>
                </div>
              </div>
            </div>

            {/* Notes Sidebar */}
            {showNotesSidebar && (
              <div className="bg-white rounded-xl shadow-lg p-6 max-h-[700px] overflow-y-auto" style={{ width: '320px' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">ðŸ“ Notes</h2>
                  <button
                    onClick={() => setShowNotesSidebar(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    âœ•
                  </button>
                </div>

                {/* Nickname */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nickname
                  </label>
                  {editingNickname ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={nicknameValue}
                        onChange={(e) => setNicknameValue(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Give this fan a nickname..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveNickname}
                          disabled={savingNotes}
                          className="flex-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNickname(false);
                            setNicknameValue(fan.nickname || '');
                          }}
                          className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        setEditingNickname(true);
                        setNicknameValue(fan.nickname || '');
                      }}
                      className="px-3 py-2 bg-gray-50 border rounded text-sm cursor-pointer hover:bg-gray-100"
                    >
                      {fan.nickname || 'Click to add nickname...'}
                    </div>
                  )}
                </div>

                {/* Personal Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ’­ Personal Notes
                  </label>
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows="4"
                    placeholder="What they like, preferences, personal info, etc."
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-2 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm disabled:opacity-50 font-semibold"
                  >
                    {savingNotes ? 'Saving...' : 'ðŸ’¾ Save Notes'}
                  </button>
                </div>

                {/* Chatter Tips */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ðŸ’¡ Chatter Tips
                  </label>
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
                    {savingNotes ? 'Saving...' : 'ðŸ’¾ Save Tips'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {!showNotesSidebar && (
            <button
              onClick={() => setShowNotesSidebar(true)}
              className="fixed right-6 bottom-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center text-2xl z-50"
            >
              ðŸ“
            </button>
          )}
        </div>
      </div>

      {/* ðŸ”¥ PPV MODALS */}
      <PPVSelectorModal
        isOpen={showPPVSelector}
        onClose={() => setShowPPVSelector(false)}
        modelId={modelId || user?.user_metadata?.model_id}
        onSelectContent={handlePPVContentSelected}
      />

      <PPVSendModal
        isOpen={showPPVSend}
        onClose={() => {
          setShowPPVSend(false);
          setSelectedPPVContent([]);
        }}
        selectedContent={selectedPPVContent}
        fanTier={fan?.tier || 0}
        fanId={fanId}
        modelId={modelId || user?.user_metadata?.model_id}
        onSendPPV={handleSendPPV}
      />
    </>
  );
}
