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

  useEffect(() => {
    loadFanAndMessages();
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
      }

      setLoading(false);
    } catch (error) {
      console.error('💥 Error general:', error);
      setLoading(false);
    }
  }

  // 🔥 USANDO EDGE FUNCTION IGUAL QUE ChatterDashboard
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

      // 🔥 LLAMAR EDGE FUNCTION (igual que ChatterDashboard)
      const { data, error } = await supabase.functions.invoke('chat-generate', {
        body: {
          model_id: modelId,
          fan_id: fanId,
          message: lastFanMessage.message
        }
      });

      if (error) {
        console.error('❌ IA error:', error);
        alert('Error generando análisis IA');
      } else {
        console.log('✅ Análisis IA:', data);
        setIaAnalisis(data.response);
        setNewMessage(data.response.texto || '');
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
        loadFanAndMessages();
      }
    } catch (error) {
      console.error('💥 Error general:', error);
      alert('Error enviando mensaje');
    }
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
                Enviar
              </button>
            </div>
          </div>
        </div>

        {showIaPanel && (
          <div className="w-1/3 bg-gray-50 p-6 overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">🤖 Asistente IA</h3>
            
            <button
              onClick={generarAnalisisIA}
              disabled={iaLoading}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold disabled:opacity-50 mb-4"
            >
              {iaLoading ? '🤖 Analizando...' : '🤖 Generar Respuesta IA'}
            </button>

            {iaAnalisis && (
              <>
                <div className="bg-white rounded-lg p-4 mb-4 border-2 border-purple-300">
                  <p className="text-sm font-semibold text-purple-700 mb-2">Respuesta Sugerida:</p>
                  <p className="text-sm whitespace-pre-wrap">{iaAnalisis.texto}</p>
                </div>

                {iaAnalisis.content_to_offer && (
                  <div className="bg-yellow-50 rounded-lg p-3 mb-4 border border-yellow-300">
                    <p className="text-xs font-semibold text-yellow-800 mb-1">💰 Contenido Sugerido:</p>
                    <p className="text-sm">{iaAnalisis.content_to_offer.titulo}</p>
                    <p className="text-sm font-bold">${iaAnalisis.content_to_offer.precio}</p>
                  </div>
                )}

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
        )}
      </div>
    </>
  );
}
