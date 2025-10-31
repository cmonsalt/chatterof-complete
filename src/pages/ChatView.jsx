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

  useEffect(() => {
    loadFanAndMessages();
    const interval = setInterval(loadFanAndMessages, 3000);
    return () => clearInterval(interval);
  }, [fanId, user]);

  async function loadFanAndMessages() {
    if (!user?.user_metadata?.model_id) return;
    
    const modelId = user.user_metadata.model_id;

    try {
      // ✅ CARGAR FAN (con model_id)
      const { data: fanData, error: fanError } = await supabase
        .from('fans')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)  // ← IMPORTANTE
        .single();

      if (fanError) {
        console.error('❌ Fan error:', fanError);
        setLoading(false);
        return;
      }

      console.log('✅ Fan cargado:', fanData);
      setFan(fanData);

      // ✅ CARGAR MENSAJES
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat')
        .select('*')
        .eq('fan_id', fanId)
        .eq('model_id', modelId)
        .order('ts', { ascending: true });

      if (messagesError) {
        console.error('❌ Messages error:', messagesError);
      } else {
        console.log('✅ Mensajes cargados:', messagesData);
        setMessages(messagesData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('💥 Error general:', error);
      setLoading(false);
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
    <div className="flex flex-col h-screen max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center gap-4">
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

      {/* Input */}
      <div className="bg-white border-t p-4">
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
  );
}