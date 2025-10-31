// src/components/FanCard.jsx
import { useNavigate } from 'react-router-dom';

export default function FanCard({ fan }) {
  const navigate = useNavigate();
  
  const { semaforo, ultimoMensaje } = fan;
  
  // Colores según semáforo
  const colorClasses = {
    '🔥': 'bg-red-50 border-red-500',
    '🟢': 'bg-green-50 border-green-500',
    '🔴': 'bg-red-100 border-red-600',
    '🟠': 'bg-orange-50 border-orange-500',
    '🟡': 'bg-yellow-50 border-yellow-500',
    '⚪': 'bg-gray-50 border-gray-300',
    '⏰': 'bg-blue-50 border-blue-500'
  };
  
  const badgeClasses = {
    '🔥': 'bg-red-500 text-white',
    '🟢': 'bg-green-500 text-white',
    '🔴': 'bg-red-600 text-white',
    '🟠': 'bg-orange-500 text-white',
    '🟡': 'bg-yellow-500 text-white',
    '⚪': 'bg-gray-400 text-white',
    '⏰': 'bg-blue-500 text-white'
  };
  
  const tiempoAtras = calcularTiempo(fan.last_message_date);
  
  return (
    <div 
      className={`border-2 rounded-lg p-4 cursor-pointer hover:shadow-lg transition ${colorClasses[semaforo.color]}`}
      onClick={() => navigate(`/chat/${fan.fan_id}`)}
    >
      {/* Header con avatar y badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {fan.of_avatar_url ? (
            <img 
              src={fan.of_avatar_url} 
              alt={fan.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xl">👤</span>
            </div>
          )}
          
          <div>
            <h3 className="font-bold text-lg">{fan.name || fan.of_username}</h3>
            <p className="text-sm text-gray-600">
              {getTierLabel(fan.tier)} • ${fan.spent_total || 0}
            </p>
          </div>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClasses[semaforo.color]}`}>
          {semaforo.color} {semaforo.label}
        </span>
      </div>
      
      {/* Último mensaje */}
      {ultimoMensaje && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 line-clamp-2">
            💬 "{ultimoMensaje.message}"
          </p>
          <p className="text-xs text-gray-500 mt-1">{tiempoAtras}</p>
        </div>
      )}
      
      {/* Acción sugerida */}
      <div className="border-t pt-3 mt-3">
        <p className="text-sm font-semibold text-gray-700">
          🎯 {semaforo.accion}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {semaforo.descripcion}
        </p>
      </div>
    </div>
  );
}

function getTierLabel(tier) {
  const labels = {
    0: 'Free',
    1: 'Bronze',
    2: 'Silver',
    3: 'Gold',
    4: 'VIP'
  };
  return labels[tier] || 'Unknown';
}

function calcularTiempo(fecha) {
  const ahora = new Date();
  const entonces = new Date(fecha);
  const diff = ahora - entonces;
  
  const minutos = Math.floor(diff / (1000 * 60));
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `${minutos}min ago`;
  
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h ago`;
  
  const dias = Math.floor(horas / 24);
  return `${dias}d ago`;
}