// src/utils/fanPriority.js

// Keywords para detección
const KEYWORDS = {
  vender: ['quiero', 'ver', 'show', 'video', 'foto', 'caliente', 'sexy', 'hot', 'tengo ganas', 'me gustaría', 'muéstrame', 'tienes', 'comprar', 'custom'],
  sensible: ['triste', 'mal', 'deprimido', 'murió', 'muerte', 'hospital', 'enfermo', 'problema', 'sad', 'broke', 'no tengo dinero', 'perdí trabajo', 'depressed'],
  gratis: ['gratis', 'free', 'sample', 'muestra', 'preview', 'sin pagar', 'no puedo pagar']
};

export function calcularSemaforo(fan, ultimoMensaje) {
  const ahora = new Date();
  const ultimaFecha = new Date(fan.last_message_date);
  const minutosDesdeUltimo = (ahora - ultimaFecha) / (1000 * 60);
  const diasInactivo = minutosDesdeUltimo / (60 * 24);
  
  const mensaje = ultimoMensaje?.message?.toLowerCase() || '';
  
  // 🔴 ROJO - Sensible (prioridad máxima)
  if (tieneKeywords(mensaje, KEYWORDS.sensible)) {
    return {
      color: '🔴',
      label: 'NO VENDER',
      descripcion: 'Tema sensible - solo apoyo',
      prioridad: 5,
      accion: 'DAR APOYO'
    };
  }
  
  // 🔥 URGENTE - Verde + muy reciente
  if (minutosDesdeUltimo < 2 && fan.tier >= 2 && tieneKeywords(mensaje, KEYWORDS.vender)) {
    return {
      color: '🔥',
      label: 'URGENTE',
      descripcion: 'Responder AHORA - oportunidad caliente',
      prioridad: 6,
      accion: 'VENDER YA'
    };
  }
  
  // 🟢 VERDE - Vender ahora
  if (
    fan.tier >= 2 &&
    fan.spent_total >= 50 &&
    tieneKeywords(mensaje, KEYWORDS.vender) &&
    diasInactivo < 7
  ) {
    return {
      color: '🟢',
      label: 'VENDER AHORA',
      descripcion: 'Fan caliente y tier alto',
      prioridad: 4,
      accion: 'OFRECER CONTENIDO'
    };
  }
  
  // ⏰ ESPERANDO - Más de 30 min sin respuesta
  if (minutosDesdeUltimo > 30 && ultimoMensaje?.from === 'fan') {
    return {
      color: '⏰',
      label: 'ESPERANDO',
      descripcion: `Esperando ${Math.floor(minutosDesdeUltimo)} minutos`,
      prioridad: 3,
      accion: 'RESPONDER'
    };
  }
  
  // 🟠 NARANJA - Reactivar
  if (diasInactivo > 30 && fan.spent_total >= 20) {
    return {
      color: '🟠',
      label: 'REACTIVAR',
      descripcion: 'Inactivo pero era buen cliente',
      prioridad: 2,
      accion: 'RE-ENGAGEMENT'
    };
  }
  
  // 🟡 AMARILLO - Precaución
  if (
    fan.spent_total < 20 ||
    tieneKeywords(mensaje, KEYWORDS.gratis) ||
    (fan.message_count > 20 && fan.spent_total === 0)
  ) {
    return {
      color: '🟡',
      label: 'PRECAUCIÓN',
      descripcion: 'Posible time waster',
      prioridad: 1,
      accion: 'CONVERSAR SUAVE'
    };
  }
  
  // ⚪ BLANCO - Normal
  return {
    color: '⚪',
    label: 'NORMAL',
    descripcion: 'Conversación casual',
    prioridad: 0,
    accion: 'CONVERSAR'
  };
}

function tieneKeywords(texto, keywords) {
  return keywords.some(keyword => texto.includes(keyword));
}

export function ordenarFansPorPrioridad(fans, mensajes) {
  return fans
    .map(fan => {
      const ultimoMensaje = mensajes
        .filter(m => m.fan_id === fan.fan_id)
        .sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
      
      const semaforo = calcularSemaforo(fan, ultimoMensaje);
      
      return {
        ...fan,
        ultimoMensaje,
        semaforo
      };
    })
    .sort((a, b) => b.semaforo.prioridad - a.semaforo.prioridad);
}