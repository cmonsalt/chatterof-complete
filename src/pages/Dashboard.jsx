// src/pages/Dashboard.jsx - MEJORADO CON FILTRO INTELIGENTE
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [fans, setFans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hoy: 0, chats: 0, mensajes: 0, totalFans: 0 });
  const [mostrarTodos, setMostrarTodos] = useState(false); // Toggle entre activos y todos

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 5000);
    return () => clearInterval(interval);
  }, [user, mostrarTodos]);

  async function cargarDatos() {
    if (!user?.user_metadata?.model_id) {
      setLoading(false);
      return;
    }
    
    const modelId = user.user_metadata.model_id;

    try {
      // 🔥 NUEVO: Cargar fans CON conteo de mensajes
      const { data: fansData, error: fansError } = await supabase
        .from('fans')
        .select(`
          *,
          mensajes:chat(count)
        `)
        .eq('model_id', modelId);

      if (fansError) {
        console.error('❌ Error cargando fans:', fansError);
      }

      // 🔥 FILTRO INTELIGENTE: Solo fans con MÁS de 1 mensaje (respondieron)
      const fansActivos = fansData?.filter(fan => {
        const cantidadMensajes = fan.mensajes?.[0]?.count || 0;
        return cantidadMensajes > 1; // Más de 1 = respondió al mensaje automático
      }) || [];

      // Enriquecer con último mensaje
      const fansConUltimoMensaje = await Promise.all(
        (mostrarTodos ? fansData : fansActivos).map(async (fan) => {
          const { data: ultimoMensaje } = await supabase
            .from('chat')
            .select('message, timestamp, from')
            .eq('fan_id', fan.fan_id)
            .eq('model_id', modelId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          return {
            ...fan,
            ultimoMensaje: ultimoMensaje?.message || 'Sin mensajes',
            ultimoMensajeTimestamp: ultimoMensaje?.timestamp,
            ultimoMensajeFrom: ultimoMensaje?.from,
            cantidadMensajes: fan.mensajes?.[0]?.count || 0
          };
        })
      );

      // Ordenar por último mensaje
      fansConUltimoMensaje.sort((a, b) => {
        const dateA = new Date(a.ultimoMensajeTimestamp || 0);
        const dateB = new Date(b.ultimoMensajeTimestamp || 0);
        return dateB - dateA;
      });

      // Cargar mensajes para stats
      const { data: mensajesData } = await supabase
        .from('chat')
        .select('*')
        .eq('model_id', modelId)
        .order('timestamp', { ascending: false })
        .limit(100);

      // Cargar transacciones de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const { data: transaccionesHoy } = await supabase
        .from('transactions')
        .select('amount')
        .eq('model_id', modelId)
        .gte('created_at', hoy);

      const totalHoy = transaccionesHoy?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      setFans(fansConUltimoMensaje);
      setStats({
        hoy: totalHoy,
        chats: fansActivos.length, // Solo fans activos
        mensajes: mensajesData?.length || 0,
        totalFans: fansData?.length || 0 // Todos los fans
      });
      setLoading(false);
    } catch (error) {
      console.error('💥 Error cargando datos:', error);
      setLoading(false);
    }
  }

  function formatearTiempo(timestamp) {
    if (!timestamp) return '';
    
    const ahora = new Date();
    const fecha = new Date(timestamp);
    const diffMs = ahora - fecha;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return fecha.toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">📊 Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Today's Revenue</p>
          <p className="text-2xl font-bold text-green-600">${stats.hoy.toFixed(2)}</p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Active Chats (7d)</p>
          <p className="text-2xl font-bold text-blue-600">{stats.chats}</p>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Messages</p>
          <p className="text-2xl font-bold text-purple-600">{stats.mensajes}</p>
        </div>

        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Fans</p>
          <p className="text-2xl font-bold text-pink-600">{stats.totalFans}</p>
        </div>
      </div>

      {/* Toggle Activos/Todos */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">All Fans</h2>
        
        <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMostrarTodos(false)}
            className={`px-4 py-2 rounded-md transition ${
              !mostrarTodos 
                ? 'bg-white shadow text-blue-600 font-semibold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔥 Active ({stats.chats})
          </button>
          <button
            onClick={() => setMostrarTodos(true)}
            className={`px-4 py-2 rounded-md transition ${
              mostrarTodos 
                ? 'bg-white shadow text-blue-600 font-semibold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 All ({stats.totalFans})
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input 
          type="text" 
          placeholder="🔍 Search fans..."
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* Lista de Fans */}
      {fans.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {mostrarTodos ? 'No fans yet' : 'No active fans'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {mostrarTodos 
              ? 'Fans will be created automatically when they send their first message'
              : 'Fans appear here after they respond to your welcome message'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {fans.map(fan => (
            <div 
              key={fan.fan_id}
              className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer bg-white"
              onClick={() => window.location.href = `/chat/${fan.fan_id}`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {fan.of_avatar_url ? (
                  <img 
                    src={fan.of_avatar_url} 
                    alt={fan.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                    {fan.name?.[0]?.toUpperCase() || '👤'}
                  </div>
                )}
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">
                      {fan.name || fan.of_username}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatearTiempo(fan.ultimoMensajeTimestamp)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-1">
                    Tier {fan.tier || 0} • ${fan.spent_total || 0} • {fan.cantidadMensajes} msgs
                  </p>

                  {/* Último mensaje preview */}
                  <p className="text-sm text-gray-500 truncate">
                    {fan.ultimoMensajeFrom === 'fan' ? '💬' : '📤'} 
                    {' '}
                    {fan.ultimoMensaje.substring(0, 60)}
                    {fan.ultimoMensaje.length > 60 ? '...' : ''}
                  </p>
                </div>

                {/* Indicador de mensaje sin leer (opcional) */}
                {fan.ultimoMensajeFrom === 'fan' && (
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
