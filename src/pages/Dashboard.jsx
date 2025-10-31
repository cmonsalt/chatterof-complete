// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [fans, setFans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hoy: 0, chats: 0, mensajes: 0 });

  useEffect(() => {
    cargarDatos();
    // Refresh cada 5 segundos
    const interval = setInterval(cargarDatos, 5000);
    return () => clearInterval(interval);
  }, [user]);

  async function cargarDatos() {
    if (!user?.user_metadata?.model_id) return;
    
    const modelId = user.user_metadata.model_id;

    try {
      // Cargar fans
      const { data: fansData } = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', modelId);

      // Cargar mensajes
      const { data: mensajesData } = await supabase
        .from('chat')
        .select('*')
        .eq('model_id', modelId)
        .order('ts', { ascending: false })
        .limit(100);

      // Cargar transacciones de hoy
      const hoy = new Date().toISOString().split('T')[0];
      const { data: transaccionesHoy } = await supabase
        .from('transactions')
        .select('amount')
        .eq('model_id', modelId)
        .gte('created_at', hoy);

      const totalHoy = transaccionesHoy?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      setFans(fansData || []);
      setStats({
        hoy: totalHoy,
        chats: fansData?.length || 0,
        mensajes: mensajesData?.length || 0
      });
      setLoading(false);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Stats */}
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Hoy</p>
          <p className="text-2xl font-bold text-green-600">${stats.hoy}</p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Chats Activos</p>
          <p className="text-2xl font-bold text-blue-600">{stats.chats}</p>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Mensajes</p>
          <p className="text-2xl font-bold text-purple-600">{stats.mensajes}</p>
        </div>
      </div>

      {/* Lista de fans */}
      <h2 className="text-xl font-bold mb-4">Fans Activos</h2>
      
      {fans.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay fans todavía</p>
          <p className="text-sm text-gray-500 mt-2">
            Los fans se crearán automáticamente cuando la extensión detecte mensajes
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {fans.map(fan => (
            <div 
              key={fan.fan_id}
              className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
              onClick={() => window.location.href = `/chat/${fan.fan_id}`}
            >
              <div className="flex items-center gap-3">
                {fan.of_avatar_url ? (
                  <img 
                    src={fan.of_avatar_url} 
                    alt={fan.name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                    👤
                  </div>
                )}
                
                <div>
                  <h3 className="font-bold">{fan.name || fan.of_username}</h3>
                  <p className="text-sm text-gray-600">
                    Tier {fan.tier || 0} • ${fan.spent_total || 0}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}