// src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ordenarFansPorPrioridad } from '../utils/fanPriority';
import FanCard from '../components/FanCard';

export default function Dashboard() {
  const { user } = useAuth();
  const [fans, setFans] = useState([]);
  const [mensajes, setMensajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hoy: 0, chats: 0, mensajes: 0 });

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 5000);
    return () => clearInterval(interval);
  }, [user]);

  async function cargarDatos() {
    console.log('🔍 Cargando datos...');
    console.log('👤 User:', user);
    
    if (!user?.user_metadata?.model_id) {
      console.log('❌ No model_id encontrado');
      setLoading(false);
      return;
    }
    
    const modelId = user.user_metadata.model_id;
    console.log('✅ Model ID:', modelId);

    try {
      // Cargar fans
      console.log('📊 Cargando fans...');
      const { data: fansData, error: fansError } = await supabase
        .from('fans')
        .select('*')
        .eq('model_id', modelId);

      console.log('👥 Fans:', fansData);
      if (fansError) console.log('❌ Fans error:', fansError);

      // Cargar mensajes
      console.log('💬 Cargando mensajes...');
      const { data: mensajesData, error: mensajesError } = await supabase
        .from('chat')
        .select('*')
        .eq('model_id', modelId)
        .order('ts', { ascending: false })
        .limit(100);

      console.log('📨 Mensajes:', mensajesData);
      if (mensajesError) console.log('❌ Mensajes error:', mensajesError);

      // Cargar transacciones de hoy
      const hoy = new Date().toISOString().split('T')[0];
      console.log('💰 Cargando transacciones desde:', hoy);
      
      const { data: transaccionesHoy, error: transaccionesError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('model_id', modelId)
        .gte('created_at', hoy);

      console.log('💵 Transacciones hoy:', transaccionesHoy);
      if (transaccionesError) console.log('❌ Transacciones error:', transaccionesError);

      const totalHoy = transaccionesHoy?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      console.log('📊 Stats calculadas:', {
        totalHoy,
        fansCount: fansData?.length || 0,
        mensajesCount: mensajesData?.length || 0
      });

      setFans(fansData || []);
      setMensajes(mensajesData || []);
      setStats({
        hoy: totalHoy,
        chats: fansData?.length || 0,
        mensajes: mensajesData?.length || 0
      });
      setLoading(false);
      console.log('✅ Datos cargados exitosamente');
    } catch (error) {
      console.error('💥 Error general cargando datos:', error);
      setLoading(false);
    }
  }

  const fansConPrioridad = ordenarFansPorPrioridad(fans, mensajes);
  console.log('🎯 Fans con prioridad:', fansConPrioridad);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        
        <div className="grid grid-cols-3 gap-4">
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
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Fans Activos</h2>
        
        {fansConPrioridad.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No hay fans todavía</p>
            <p className="text-sm text-gray-500 mt-2">
              Los fans se crearán automáticamente cuando la extensión detecte mensajes
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {fansConPrioridad.map(fan => (
              <FanCard key={fan.fan_id} fan={fan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}