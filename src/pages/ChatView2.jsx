// src/pages/ChatView.jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ChatView() {
  const { fanId } = useParams();
  const { user } = useAuth();
  const [fan, setFan] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  
  // 🆕 Estado IA
  const [iaAnalisis, setIaAnalisis] = useState(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [showIaPanel, setShowIaPanel] = useState(true);

  useEffect(() => {
    loadFanAndMessages();
    const interval = setInterval(loadFanAndMessages, 3000);
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
        .order('ts', { ascending: true });

      if (!messagesError) {
        setMessages(messagesData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('💥 Error general:', error);
      setLoading(false);
    }
  }

  // 🆕 GENERAR ANÁLISIS IA
  async function generarAnalisisIA() {
    if (!user?.user_metadata?.model_id) return;
    
    setIaLoading(true);
    
    try {
      const modelId = user.user_metadata.model_id;
      
      // Llamar Edge Function
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          historial: messages.slice(-20), // Últimos 20 mensajes
          fan_info: fan
        }
      });

      if (error) {
        console.error('❌ IA error:', error);
        alert('Error generando análisis IA');
      } else {
        console.log('✅ Análisis IA:', data);
        setIaAnalisis(data);
        setNewMessage(data.texto || ''); // Pre-llenar con sugerencia
      }
    } catch (error) {
      console.error('💥 Error IA:', error);
      alert('Error generando análisis IA');
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
          from: 'model',
          message: newMessage,
          ts: new Date().toISOString(),
          message_type: 'text',
          source: 'manual'
        });

      if (!error) {
        setNewMessage('');
        setIaAnalisis(null); // Limpiar análisis después de enviar
        loadFanAndMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading chat...</div>
      </div>
    );
  }

  if (!fan) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Fan not found</h2>
          <p className="text-gray-600 mb-4">
            Este fan no existe o pertenece a otro modelo.
          </p>
          <button 
            onClick={() => window.location.href = '/dashboard'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-full">
      {/* ========================================
          CONVERSACIÓN (IZQUIERDA)
      ======================================== */}
      <div className={`flex flex-col ${showIaPanel ? 'w-2/3' : 'w-full'} border-r`}>
        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/dashboard'}
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

          {/* Toggle Panel IA */}
          <button
            onClick={() => setShowIaPanel(!showIaPanel)}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            {showIaPanel ? '⬅️ Ocultar IA' : '🤖 Mostrar IA'}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              No hay mensajes todavía
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.from === 'model' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md px-4 py-2 rounded-lg ${
                      msg.from === 'model'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.from === 'model' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {new Date(msg.ts).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input con botón IA */}
        <div className="bg-white border-t p-4">
          <div className="flex gap-2 mb-2">
            <button
              onClick={generarAnalisisIA}
              disabled={iaLoading}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
            >
              {iaLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analizando...
                </>
              ) : (
                <>🤖 Generar IA</>
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* ========================================
          PANEL IA (DERECHA)
      ======================================== */}
      {showIaPanel && (
        <div className="w-1/3 bg-gray-50 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-4">
            <h3 className="font-bold text-lg">🤖 Asistente IA</h3>
            <p className="text-sm text-purple-100">Análisis contextual</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!iaAnalisis ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🤖</div>
                <p className="text-gray-600 mb-4">
                  Click en "Generar IA" para analizar el contexto y obtener sugerencias
                </p>
              </div>
            ) : (
              <>
                {/* Semáforo/Estado */}
                {iaAnalisis.semaforo && (
                  <div className={`p-4 rounded-lg border-2 ${
                    iaAnalisis.semaforo === '🟢' ? 'bg-green-50 border-green-500' :
                    iaAnalisis.semaforo === '🔴' ? 'bg-red-50 border-red-500' :
                    iaAnalisis.semaforo === '🟡' ? 'bg-yellow-50 border-yellow-500' :
                    iaAnalisis.semaforo === '🔥' ? 'bg-orange-50 border-orange-500' :
                    'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">{iaAnalisis.semaforo}</span>
                      <div>
                        <p className="font-bold">{iaAnalisis.estado}</p>
                        <p className="text-sm text-gray-600">{iaAnalisis.accion}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Análisis */}
                {iaAnalisis.analisis && (
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-bold mb-2">📊 Análisis:</h4>
                    <ul className="text-sm space-y-1">
                      {iaAnalisis.analisis.map((item, idx) => (
                        <li key={idx} className="text-gray-700">• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Respuesta Sugerida */}
                {iaAnalisis.texto && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-bold mb-2">💬 Respuesta Sugerida:</h4>
                    <p className="text-gray-800 mb-3">{iaAnalisis.texto}</p>
                    
                    {iaAnalisis.confianza && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">Confianza:</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${iaAnalisis.confianza}%` }}
                          ></div>
                        </div>
                        <span>{iaAnalisis.confianza}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Explicación */}
                {iaAnalisis.explicacion && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-bold mb-2">❓ Por qué:</h4>
                    <p className="text-sm text-gray-700">{iaAnalisis.explicacion}</p>
                  </div>
                )}

                {/* Contenido Sugerido */}
                {iaAnalisis.contenido_sugerido && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-bold mb-2">📦 Contenido a Ofrecer:</h4>
                    <div className="text-sm">
                      <p className="font-semibold">{iaAnalisis.contenido_sugerido.title}</p>
                      <p className="text-gray-600">{iaAnalisis.contenido_sugerido.description}</p>
                      <p className="text-green-600 font-bold mt-2">
                        ${iaAnalisis.contenido_sugerido.base_price}
                      </p>
                    </div>
                  </div>
                )}

                {/* Botón Copiar */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(iaAnalisis.texto);
                    alert('✅ Copiado al portapapeles');
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  📋 Copiar Respuesta
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}