import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import PPVSelectorModal from '../components/PPVSelectorModal';
import PPVSendModal from '../components/PPVSendModal';
import PPVMessage from '../components/PPVMessage';




export default function ChatView({ embedded = false }) {
  const { fanId } = useParams();
  const { user, modelId } = useAuth();
  const navigate = useNavigate();

  const [fan, setFan] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

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

  // 🔥 PPV MODALS
  const [showPPVSelector, setShowPPVSelector] = useState(false);
  const [showPPVSend, setShowPPVSend] = useState(false);
  const [selectedPPVContent, setSelectedPPVContent] = useState([]);

  // 🔥 REPLY functionality
  const [replyingTo, setReplyingTo] = useState(null);

  const lastCheckedMessageId = useRef(null);
  const justSentMessage = useRef(false);
  const messagesEndRef = useRef(null);

  // 🌐 TRANSLATION STATES
  const [fanIsTyping, setFanIsTyping] = useState(false)
  const [floatingDate, setFloatingDate] = useState(null)
  const [expandedTranslations, setExpandedTranslations] = useState({})
  const [translating, setTranslating] = useState(null)
  const [translatedInput, setTranslatedInput] = useState('')
  const [isTranslatingInput, setIsTranslatingInput] = useState(false)
  const [outputLang, setOutputLang] = useState('en'); // 'es' o 'en'



  useEffect(() => {
    if (!fanId || !modelId) return

    // Suscribirse a cambios de typing
    const channel = supabase
      .channel(`typing:${modelId}:${fanId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `fan_id=eq.${fanId}`
        },
        (payload) => {
          const typingData = payload.new
          if (!typingData) return

          // Verificar si el timestamp es reciente (menos de 3 segundos)
          const updatedAt = new Date(typingData.updated_at)
          const now = new Date()
          const secondsAgo = (now - updatedAt) / 1000

          setFanIsTyping(typingData.is_typing && secondsAgo < 3)
        }
      )
      .subscribe()

    // Limpiar typing indicator cada segundo
    const interval = setInterval(() => {
      setFanIsTyping(false)
    }, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fanId, modelId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Solo scroll si acabas de enviar mensaje
    if (justSentMessage.current) {
      scrollToBottom();
    }
  }, [messages]);

  const getTierBadge = (tier) => {
    const tiers = {
      0: { emoji: '🆓', label: 'New Fan', color: 'bg-gray-100 text-gray-700' },
      1: { emoji: '💎', label: 'VIP', color: 'bg-blue-100 text-blue-700' },
      2: { emoji: '🐋', label: 'Whale', color: 'bg-purple-100 text-purple-700' }
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
      console.log('⭐ Skipping read marking - just sent a message');
      justSentMessage.current = false;
      return;
    }

    const lastMessage = messages[messages.length - 1];

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
      const { data, error } = await supabase
        .from('chat')
        .update({ read: true })
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .eq('from', 'model')
        .eq('read', false)
        .lt('ts', fanMessageTime);

      if (error) throw error;
      console.log('✅ Marked model messages as read');
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async function loadFanAndMessages() {
    const currentModelId = modelId || user?.user_metadata?.model_id;
    if (!currentModelId) {
      console.log('⚠️ No model ID');
      setLoading(false);
      return;
    }

    if (!fanId) {
      console.log('⚠️ No fan ID');
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
      setNotesValue(fanData.notes || '');
      setChatterNotesValue(fanData.chatter_notes || '');

      const { data: messagesData, error: messagesError } = await supabase
        .from('chat')
        .select(`
  id, ts, fan_id, message, created_at, model_id, from, read, source,
  media_url, media_thumb, media_type, amount, is_ppv, ppv_price,
  is_locked, is_purchased, ppv_unlocked, of_message_id,
  media_urls, ppv_metadata, translated_message
`)
        .eq('fan_id', fanId)
        .eq('model_id', currentModelId)
        .order('ts', { ascending: false })
        .limit(100);


      if (messagesError) {
        console.error('❌ Messages error:', messagesError);
      } else {
        const sortedMessages = (messagesData || []).reverse();
        setMessages(sortedMessages);

        // Cargar traducciones existentes
        const existingTranslations = {};
        sortedMessages.forEach(msg => {
          if (msg.translated_message) {
            existingTranslations[msg.id] = msg.translated_message;
          }
        });
        setExpandedTranslations(existingTranslations);
      }
      calculateFanStats(messagesData || []);
      setLoading(false);
    } catch (error) {
      console.error('❌ Load error:', error);
      setLoading(false);
    }
  }

  const handleScroll = (e) => {
    const container = e.target

    // Buscar el primer mensaje visible
    const messageElements = container.querySelectorAll('[data-message-date]')

    for (const el of messageElements) {
      const rect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Si el mensaje está visible cerca del top
      if (rect.top >= containerRect.top && rect.top <= containerRect.top + 150) {
        const date = el.getAttribute('data-message-date')
        setFloatingDate(date)
        break
      }
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

  // 🌐 Translate incoming message (fan → español)
  const translateMessage = async (messageId, text, direction = 'to_spanish') => {
    if (translating === messageId) return;

    setTranslating(messageId);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          direction  // ← Ahora es flexible
        })
      });

      const data = await response.json();

      if (data.translated) {
        setExpandedTranslations(prev => ({
          ...prev,
          [messageId]: data.translated
        }));

        // Guardar en DB
        await supabase
          .from('chat')
          .update({ translated_message: data.translated })
          .eq('id', messageId);
      }
    } catch (error) {
      console.error('❌ Translation error:', error);
    } finally {
      setTranslating(null);
    }
  };

  // 🌐 Auto-translate input (español → inglés)
  const handleInputChange = (e) => {
    const text = e.target.value;
    setNewMessage(text);

    // ⚠️ SOLO traducir si dropdown está en "English"
    if (outputLang !== 'en' || !text.trim()) {
      setTranslatedInput('');
      return;
    }

    // Mínimo 3 palabras
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 3) {
      setTranslatedInput('');
      return;
    }

    // Cancelar traducción anterior
    if (window.translationTimeout) {
      clearTimeout(window.translationTimeout);
    }

    // ⏱️ Esperar 1.5 segundos
    window.translationTimeout = setTimeout(async () => {
      setIsTranslatingInput(true);

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: spanishText,
            direction: 'to_english'
          })
        });

        if (!response.ok) {
          throw new Error('Translation failed');
        }

        const data = await response.json();

        if (data.translated) {
          setTranslatedInput(data.translated);
        }
      } catch (error) {
        console.error('❌ Input translation error:', error);
        // No mostrar error al usuario, solo log
      } finally {
        setIsTranslatingInput(false);
      }
    }, 800); // Espera 800ms (0.8 segundos)
  };

  // 🔥 Handle PPV content selection
  function handlePPVContentSelected(content) {
    setSelectedPPVContent(content);
    setShowPPVSelector(false);
    setShowPPVSend(true);
  }

  // 🔥 Handle PPV send
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
          previewMediaIds: ppvData.previewMediaIds,
          catalogIds: ppvData.catalogIds,
          replyToMessageId: replyingTo?.id || null,
          replyToText: replyingTo?.message || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      setSelectedPPVContent([]);
      setShowPPVSend(false);
      setReplyingTo(null);

      await new Promise(resolve => setTimeout(resolve, 500));
      await loadFanAndMessages();

    } catch (error) {
      console.error('❌ Error sending PPV:', error);
      alert('Error sending PPV: ' + error.message);
      justSentMessage.current = false;
    } finally {
      setSending(false);
    }
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
          text: outputLang === 'en' && translatedInput ? translatedInput : newMessage,
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
      setTranslatedInput(''); // 🌐 Limpiar traducción
      setReplyingTo(null);

      await new Promise(resolve => setTimeout(resolve, 500));
      await loadFanAndMessages();

    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      alert('Error al enviar mensaje: ' + error.message);
      justSentMessage.current = false;
    } finally {
      setSending(false);
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
        .update({ display_name: nicknameValue })
        .eq('fan_id', fanId)
        .eq('model_id', modelId || user?.user_metadata?.model_id);

      if (error) throw error;
      setFan(prev => ({ ...prev, display_name: nicknameValue }));
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
            <div className="text-5xl mb-4">😕</div>
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
                    ← Back
                  </button>
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-800">
                      {fan.name || fan.display_name || fan.of_username || 'Fan'}
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
                  onClick={() => setShowNotesSidebar(!showNotesSidebar)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
                >
                  📝 Notes
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mt-4">
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

          <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6">
            {/* Chat */}
            <div className="w-full md:flex-1 bg-white rounded-xl shadow-lg flex flex-col relative">
              {/* Fecha flotante */}
              {floatingDate && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium z-50 shadow-lg">
                  {floatingDate}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 max-h-[calc(100vh-200px)]"
                onScroll={handleScroll}
              >
                {messages.map((msg) => {
                  // Formatear fecha del mensaje
                  const messageDate = new Date(msg.timestamp || msg.ts).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })

                  return (
                    <div
                      key={msg.id}
                      data-message-date={messageDate}
                      className={`flex ${msg.from === 'model' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${msg.from === 'model'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                          }`}
                      >
                        {msg.reply_to_text && (
                          <div className="mb-2 pb-2 border-b border-opacity-30 border-white">
                            <div className="text-xs opacity-75">↩️ Reply to:</div>
                            <div className="text-xs italic opacity-90">
                              {msg.reply_to_text.slice(0, 50)}...
                            </div>
                          </div>
                        )}

                        <p className="text-sm">{msg.message}</p>

                        {msg.media_url && (
                          msg.is_ppv ? (
                            <PPVMessage message={msg} />
                          ) : msg.media_type === 'video' ? (
                            <video
                              src={msg.media_url}
                              controls
                              className="rounded-lg shadow-md max-w-xs max-h-60"
                              onError={(e) => {
                                console.error('Video failed to load')
                                e.target.outerHTML = '<div class="flex flex-col items-center justify-center h-48 bg-gray-100 rounded-lg"><div class="text-5xl mb-2">❌</div><div class="text-sm text-gray-600 font-semibold">Video URL expired</div></div>'
                              }}
                            />
                          ) : (
                            <img
                              src={msg.media_url}
                              alt="Media"
                              className="rounded-lg shadow-md max-w-xs max-h-60"
                              onError={(e) => {
                                console.error('Image failed to load')
                                e.target.outerHTML = '<div class="flex flex-col items-center justify-center h-48 bg-gray-100 rounded-lg"><div class="text-5xl mb-2">❌</div><div class="text-sm text-gray-600 font-semibold">Image URL expired</div></div>'
                              }}
                            />
                          )
                        )}

                        <div className="text-xs opacity-75 mt-1">
                          {new Date(msg.ts).toLocaleTimeString()}
                          {msg.from === 'model' && msg.read && ' • Read ✓'}
                        </div>

                        {/* 🌐 Botón traducir PARA TODOS LOS MENSAJES */}
                        <div className="mt-2">
                          {expandedTranslations[msg.id] ? (
                            <div className={`px-3 py-2 rounded-lg text-sm border ${msg.from === 'model'
                              ? 'bg-white/20 border-white/30 text-white'
                              : 'bg-blue-50 border-blue-200 text-gray-700'
                              }`}>
                              {msg.from === 'model' ? '🇪🇸' : '🇪🇸'} {expandedTranslations[msg.id]}
                            </div>
                          ) : (
                            <button
                              onClick={() => translateMessage(msg.id, msg.message, msg.from === 'model' ? 'to_spanish' : 'to_spanish')}
                              disabled={translating === msg.id}
                              className={`text-xs font-semibold ${msg.from === 'model'
                                ? 'text-white/90 hover:text-white'
                                : 'text-blue-600 hover:text-blue-800'
                                }`}
                            >
                              {translating === msg.id ? '⏳ Traduciendo...' : '🌐 Traducir'}
                            </button>
                          )}
                        </div>

                        {msg.from === 'fan' && (
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className="text-xs underline opacity-75 hover:opacity-100 mt-1"
                          >
                            Reply
                          </button>
                        )}

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
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* 🆕 DROPDOWN IDIOMA */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Send in:</span>
                <select
                  value={outputLang}
                  onChange={(e) => {
                    setOutputLang(e.target.value);
                    setTranslatedInput(''); // Limpiar preview
                  }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇺🇸 English</option>
                </select>
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                {replyingTo && (
                  <div className="mb-3 bg-blue-50 border-l-4 border-blue-500 p-3 rounded flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-blue-700 mb-1">
                        ↩️ Replying to:
                      </div>
                      <div className="text-sm text-gray-700">
                        {replyingTo.message.slice(0, 80)}{replyingTo.message.length > 80 ? '...' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {/* 🌐 Preview de traducción */}
                  {translatedInput && (
                    <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                      <span className="text-xs text-green-700 font-semibold">🇬🇧 English Preview:</span>
                      <p className="text-sm text-gray-700 mt-1">{translatedInput}</p>
                    </div>
                  )}

                  {/* Input arriba - full width */}
                  <textarea
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && !sending && (e.preventDefault(), enviarMensaje())}
                    placeholder={
                      replyingTo
                        ? "Write your reply..."
                        : outputLang === 'en'
                          ? "Escribe en español..."
                          : "Escribe tu mensaje..."
                    }
                    disabled={sending}
                    rows="3"
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                  />

                  {/* Botones abajo - grid (sin botón AI) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowPPVSelector(true)}
                      className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 font-semibold transition-all text-sm"
                    >
                      💰 PPV
                    </button>

                    <button
                      onClick={enviarMensaje}
                      disabled={sending || !newMessage.trim()}
                      className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold transition-all disabled:opacity-50 text-sm"
                    >
                      {sending ? '⏳' : '📤 Send'}
                    </button>
                  </div>

                  {/* Typing indicator */}
                  {fanIsTyping && (
                    <div className="px-4 py-1 text-sm text-gray-500 italic flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      Fan escribiendo...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes Sidebar */}
            {showNotesSidebar && (
              <>
                {/* Overlay oscuro - solo mobile */}
                <div
                  className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                  onClick={() => setShowNotesSidebar(false)}
                />

                {/* Sidebar/Modal */}
                <div className="fixed md:relative bottom-0 left-0 right-0 md:top-auto bg-white rounded-t-2xl md:rounded-xl shadow-lg p-6 max-h-[80vh] md:max-h-[700px] overflow-y-auto md:w-[320px] z-50">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">📝 Notes</h2>
                    <button
                      onClick={() => setShowNotesSidebar(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
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
                              setNicknameValue(fan.display_name || '');
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
                          setNicknameValue(fan.display_name || '');
                        }}
                        className="px-3 py-2 bg-gray-50 border rounded text-sm cursor-pointer hover:bg-gray-100"
                      >
                        {fan.display_name || 'Click to add nickname...'}
                      </div>
                    )}
                  </div>

                  {/* Personal Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      💭 Personal Notes
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
                      {savingNotes ? 'Saving...' : '💾 Save Notes'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

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

      {/* 🔥 PPV MODALS */}
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