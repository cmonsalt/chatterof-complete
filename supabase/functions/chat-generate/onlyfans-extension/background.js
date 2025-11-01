// background.js - Service worker

console.log('🤖 ChatterOF Background service started');

// Escuchar mensajes del content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_MESSAGE') {
    console.log('📨 New message received:', message.data);
    
    // Aquí puedes agregar lógica adicional:
    // - Mostrar notificación
    // - Actualizar badge
    // - Trigger análisis de IA
    
    // Mostrar notificación
    if (message.data.from === 'fan') {
      showNotification(message.data);
    }
    
    sendResponse({ success: true });
  }
  
  return true; // Mantener canal abierto para respuesta async
});

function showNotification(messageData) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: `New message from Fan ${messageData.fan_id}`,
    message: messageData.message.substring(0, 100),
    priority: 2
  });
}

// Sincronización periódica (opcional)
chrome.alarms.create('syncCheck', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncCheck') {
    console.log('🔄 Periodic sync check');
    // Aquí podrías verificar si hay mensajes pendientes
  }
});