import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

export default function ChatView() {
  const { fanId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [fan, setFan] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  
  const [iaAnalisis, setIaAnalisis] = useState(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [showIaPanel, setShowIaPanel] = useState(true);
  
  // 🔥 NUEVO: Stats del fan
  const [fanStats, setFanStats] = useState({
    totalTips: 0,
    tipsCount: 0,
    ppvUnlocked: 0,
    ppvCount: 0,
    lastInteraction: null
  });
  
  // 🔥 NUEVO: Catálogo de contenido
  const [catalog, setCatalog] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);

  useEffect(() => {
    loadFanAndMessages();
    loadCatalog();
    const interval = setInterval(loadFanAndMessages, 5000);
    return () => clearInterval(interval);
  }, [fanId, user]);

  async function loadFanAndMessages() {
    if (!user?.user_metadata?.model_id) return;
    
    const modelId = user.user_metadata.model_id;

    try {
      const { data: fanData, error: fanError } = await supabase
        .from('fans')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .single();

      if (fanError) {
        console.error('❌ Fan error:', fanError);
        setLoading(false);
        return;
      }

      setFan(fanData);

      const { data: messagesData, error: messagesError } = await supabase
        .from('chat')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .order('ts', { ascending: true })
        .limit(200);

      if (!messagesError) {
        setMessages(messagesData || []);
        
        // 🔥 CALCULAR STATS DEL FAN
        calculateFanStats(messagesData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('💥 Error general:', error);
      setLoading(false);
    }
  }
  
  // 🔥 NUEVO: Calcular estadísticas del fan
  function calculateFanStats(msgs) {
    const tips = msgs.filter(m => m.message_type === 'tip');
    const ppvs = msgs.filter(m => m.message_type === 'ppv_unlocked');
    const lastMsg = msgs.filter(m => m.from === 'fan').slice(-1)[0];
    
    setFanStats({
      totalTips: tips.reduce((sum, t) => sum + (t.amount || 0), 0),
      tipsCount: tips.length,
      ppvUnlocked: ppvs.reduce((sum, p) => sum + (p.amount || 0), 0),
      ppvCount: ppvs.length,
      lastInteraction: lastMsg?.ts || null
    });
  }
  
  // 🔥 NUEVO: Cargar catálogo
  async function loadCatalog() {
    if (!user?.user_metadata?.model_id) return;
    
    const modelId = user.user_metadata.model_id;
    
    const { data, error } = await supabase
      .from('catalog')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      setCatalog(data);
    }
  }

  // 🔥 USANDO EDGE FUNCTION MEJORADA
  async function generarAnalisisIA() {
    if (!user?.user_metadata?.model_id || !fan) return;
    
    setIaLoading(true);
    
    try {
      const modelId = user.user_metadata.model_id;
      
      // Obtener último mensaje del fan
      const lastFanMessage = messages.filter(m => m.from === 'fan').slice(-1)[0];
      
      if (!lastFanMessage) {
        alert('No hay mensajes del fan para analizar');
        setIaLoading(false);
        return;
      }

      // 🔥 LLAMAR EDGE FUNCTION con contexto completo
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          message: lastFanMessage.message,
          // 🔥 ENVIAR CONTEXTO ADICIONAL
          fan_context: {
            name: fan.name,
            tier: fan.tier,
            spent_total: fan.spent_total,
            tips_total: fanStats.totalTips,
            tips_count: fanStats.tipsCount,
            ppv_total: fanStats.ppvUnlocked,
            ppv_count: fanStats.ppvCount,
            last_interaction: fanStats.lastInteraction
          },
          // 🔥 ENVIAR HISTORIAL RECIENTE (últimos 10 mensajes)
          recent_messages: messages.slice(-10).map(m => ({
            from: m.from,
            message: m.message,
            type: m.message_type,
            amount: m.amount
          }))
        }
      });

      if (error) {
        console.error('❌ IA error:', error);
        alert('Error generando análisis IA');
      } else {
        console.log('✅ Análisis IA:', data);
        setIaAnalisis(data.response);
        setNewMessage(data.response.texto || '');
        
        // 🔥 AUTO-SELECCIONAR CONTENIDO RECOMENDADO
        if (data.response.content_to_offer?.of_media_id) {
          const recommended = catalog.find(c => c.of_media_id === data.response.content_to_offer.of_media_id);
          if (recommended) {
            setSelectedContent(recommended);
          }
        }
      }
      
    } catch (error) {
      console.error('💥 Error IA:', error);
      alert('Error generando respuesta IA');
    } finally {
      setIaLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    
    const modelId = user.user_metadata.model_id;

    try {
      const { error } = await supabase
        .from('chat')
        .insert({
          fan_id: fanId,
          model_id: modelId,
          message: newMessage,
          from: 'model',
          ts: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Error enviando mensaje:', error);
        alert('Error enviando mensaje');
      } else {
        setNewMessage('');
        setIaAnalisis(null);
        setSelectedContent(null);
        loadFanAndMessages();
      }
    } catch (error) {
      console.error('💥 Error general:', error);
      alert('Error enviando mensaje');
    }
  }
  
  // 🔥 NUEVO: Función para enviar a OnlyFans via extensión
  async function enviarAOnlyFans() {
    if (!newMessage.trim()) {
      alert('No hay mensaje para enviar');
      return;
    }
    
    const payload = {
      action: 'sendMessage',
      fanId: fanId,
      message: newMessage,
      content: selectedContent ? {
        of_media_id: selectedContent.of_media_id,
        precio: selectedContent.base_price,
        titulo: selectedContent.title
      } : null
    };
    
    console.log('📤 Enviando a extensión:', payload);
    
    // Enviar comando a extensión Chrome
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          alert('❌ Error: La extensión no está instalada o no responde');
        } else {
          alert('✅ Mensaje enviado a OnlyFans!');
          handleSendMessage(); // Guardar también en BD
        }
      });
    } catch (error) {
      alert('❌ La extensión Chrome no está disponible. El mensaje solo se guardará en la BD.');
      handleSendMessage();
    }
  }
  
  // 🔥 NUEVO: Formatear tiempo relativo
  function timeAgo(dateString) {
    if (!dateString) return 'Nunca';
    
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " años";
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " días";
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas";
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutos";
    
    return "Hace un momento";
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-xl">Cargando...</div>
        </div>
      </>
    );
  }

  if (!fan) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Fan not found</h2>
            <p className="text-gray-600 mb-4">
              Este fan no existe o pertenece a otro modelo.
            </p>
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="flex h-screen max-w-full">
        {/* CHAT AREA */}
        <div className={`flex flex-col ${showIaPanel ? 'w-2/3' : 'w-full'} border-r`}>
          <div className="bg-white border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="text-blue-500 hover:text-blue-700"
              >
                ← Volver
              </button>
              
              {fan.of_avatar_url ? (
                <img 
                  src={fan.of_avatar_url} 
                  alt={fan.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  👤
                </div>
              )}
              
              <div>
                <h2 className="font-bold">{fan.name || fan.of_username}</h2>
                <p className="text-sm text-gray-600">
                  Tier {fan.tier || 0} • ${fan.spent_total || 0}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIaPanel(!showIaPanel)}
              className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
            >
              {showIaPanel ? '⬅️ Ocultar IA' : '🤖 Mostrar IA'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                No hay mensajes todavía
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-4 flex ${msg.from === 'model' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.from === 'model'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    
                    {/* 🔥 MOSTRAR TIP/PPV */}
                    {msg.amount && (
                      <div className="mt-1 text-xs font-bold">
                        {msg.message_type === 'tip' && '💰 Tip: $'}
                        {msg.message_type === 'ppv_unlocked' && '🔓 PPV: $'}
                        {msg.amount}
                      </div>
                    )}
                    
                    {/* 🔥 MOSTRAR IMÁGENES */}
                    {msg.media_urls && (
                      <div className="mt-2">
                        <span className="text-xs">📷 {JSON.parse(msg.media_urls).length} imagen(es)</span>
                      </div>
                    )}
                    
                    <p className="text-xs mt-1 opacity-75">
                      {new Date(msg.ts).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white border-t p-4">
            <div className="flex gap-2">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-4 py-2 border rounded-lg resize-none"
                rows="2"
              />
              <button
                onClick={handleSendMessage}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                💾 Guardar
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 PANEL IA MEJORADO */}
        {showIaPanel && (
          <div className="w-1/3 bg-gray-50 p-6 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">🤖 Asistente IA</h3>
            
            <button
              onClick={generarAnalisisIA}
              disabled={iaLoading}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold disabled:opacity-50 mb-4"
            >
              {iaLoading ? '🤖 Analizando...' : '🤖 Generar Análisis IA'}
            </button>

            {/* 🔥 TARJETA DE ANÁLISIS DEL FAN */}
            <div className="bg-white rounded-lg p-4 mb-4 border shadow-sm">
              <h4 className="font-bold text-sm text-gray-700 mb-3">📊 Datos del Fan</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">💰 Total gastado:</span>
                  <span className="font-bold">${fan.spent_total || 0}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">💸 Tips recibidos:</span>
                  <span className="font-bold">${fanStats.totalTips} ({fanStats.tipsCount})</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">🔓 PPV comprados:</span>
                  <span className="font-bold">${fanStats.ppvUnlocked} ({fanStats.ppvCount})</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">📊 Tier:</span>
                  <span className="font-bold">{fan.tier || 0}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">📅 Última interacción:</span>
                  <span className="font-bold text-xs">{timeAgo(fanStats.lastInteraction)}</span>
                </div>
              </div>
            </div>

            {/* 🔥 ANÁLISIS IA */}
            {iaAnalisis && (
              <>
                {/* Análisis del comportamiento */}
                {iaAnalisis.analisis && (
                  <div className="bg-purple-50 rounded-lg p-4 mb-4 border border-purple-200">
                    <p className="text-xs font-semibold text-purple-700 mb-2">🧠 Análisis del Fan:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{iaAnalisis.analisis}</p>
                  </div>
                )}

                {/* Mensaje sugerido */}
                <div className="bg-white rounded-lg p-4 mb-4 border-2 border-purple-300">
                  <p className="text-sm font-semibold text-purple-700 mb-2">💬 Mensaje Sugerido:</p>
                  <p className="text-sm whitespace-pre-wrap">{iaAnalisis.texto}</p>
                </div>

                {/* Contenido recomendado */}
                {iaAnalisis.content_to_offer && (
                  <div className="bg-yellow-50 rounded-lg p-4 mb-4 border border-yellow-300">
                    <p className="text-xs font-semibold text-yellow-800 mb-2">📦 Contenido Sugerido:</p>
                    <p className="text-sm font-bold">{iaAnalisis.content_to_offer.titulo}</p>
                    <p className="text-lg font-bold text-yellow-600">${iaAnalisis.content_to_offer.precio}</p>
                  </div>
                )}

                {/* Selector manual de contenido */}
                {catalog.length > 0 && (
                  <div className="bg-white rounded-lg p-4 mb-4 border">
                    <p className="text-xs font-semibold text-gray-700 mb-2">📦 O selecciona otro contenido:</p>
                    <select
                      value={selectedContent?.of_media_id || ''}
                      onChange={(e) => {
                        const content = catalog.find(c => c.of_media_id === e.target.value);
                        setSelectedContent(content);
                      }}
                      className="w-full p-2 border rounded text-sm"
                    >
                      <option value="">-- Seleccionar --</option>
                      {catalog.map(item => (
                        <option key={item.of_media_id} value={item.of_media_id}>
                          {item.title} - ${item.base_price}
                        </option>
                      ))}
                    </select>
                    
                    {selectedContent && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <p className="font-bold">{selectedContent.title}</p>
                        <p className="text-gray-600">{selectedContent.file_type}</p>
                        <p className="font-bold text-green-600">${selectedContent.base_price}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Botones de acción */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(iaAnalisis.texto);
                      alert('✅ Copiado al portapapeles');
                    }}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm"
                  >
                    📋 Copiar Mensaje
                  </button>
                  
                  {/* 🔥 BOTÓN ENVIAR A OF */}
                  <button
                    onClick={enviarAOnlyFans}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg font-bold hover:from-green-600 hover:to-blue-600"
                  >
                    📤 Enviar a OnlyFans
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
