// content.js - AUTO-CREATE FAN + MESSAGES
console.log('🤖 ChatterOF Extension loaded (AUTO-CREATE)');

let supabaseUrl = '';
let supabaseKey = '';
let modelId = '';

let processedMessages = new Set(JSON.parse(localStorage.getItem('chatterof_processed') || '[]'));

setInterval(() => {
  const processed = Array.from(processedMessages);
  const toSave = processed.slice(-1000);
  localStorage.setItem('chatterof_processed', JSON.stringify(toSave));
}, 5000);

chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'modelId'], (result) => {
  supabaseUrl = result.supabaseUrl || '';
  supabaseKey = result.supabaseKey || '';
  modelId = result.modelId || '';
  
  if (supabaseUrl && supabaseKey && modelId) {
    console.log('✅ Config loaded, starting auto-create monitor...');
    startMonitoring();
  } else {
    console.log('⚠️ Please configure extension first');
  }
});

function startMonitoring() {
  console.log('👁️ Monitoring messages (auto-create fan on first message)...');
  
  const observer = new MutationObserver(() => {
    checkForNewMessages();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  checkForNewMessages();
  
  setInterval(() => {
    checkForNewMessages();
  }, 5000);
}

function checkForNewMessages() {
  const messageElements = document.querySelectorAll('[data-test="message"]');
  
  if (messageElements.length === 0) {
    const altMessages = document.querySelectorAll('.m-chat-message, .b-chat__message');
    if (altMessages.length > 0) {
      processMessages(altMessages);
    }
    return;
  }
  
  processMessages(messageElements);
}

function processMessages(messageElements) {
  messageElements.forEach(async (msgEl) => {
    try {
      const messageText = msgEl.textContent.trim();
      const fanId = extractFanId();
      
      if (!messageText || !fanId) return;
      
      // Ignorar headers
      if (messageText.length > 80 && /^[💚📲📧🌍🎯💎⭐🔥]/.test(messageText)) {
        return;
      }
      
      const headerPatterns = [
        /\d+,\s+[A-Z][a-z]+/,
        /@u\d{8,}/,
        /LEER NOTA/i,
      ];
      
      if (headerPatterns.some(pattern => pattern.test(messageText))) {
        return;
      }
      
      // Solo mensajes de HOY en adelante
      const timestamp = extractTimestamp(msgEl);
      const messageDate = new Date(timestamp);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (messageDate < today) {
        return;
      }
      
      const messageId = generateUniqueMessageId(fanId, messageText, msgEl);
      
      if (processedMessages.has(messageId)) {
        return;
      }
      
      const isFromFan = msgEl.classList.contains('m-from-fan') || 
                       msgEl.classList.contains('b-chat__message_income') ||
                       !msgEl.classList.contains('m-from-me');
      
      const messageType = detectMessageType(msgEl, messageText);
      const mediaUrls = extractMediaUrls(msgEl);
      
      const messageData = {
        fan_id: fanId,
        model_id: modelId,
        from: isFromFan ? 'fan' : 'model',
        message: messageText,
        message_type: messageType.type,
        amount: messageType.amount,
        media_urls: mediaUrls,
        timestamp: timestamp,
        source: 'extension'
      };
      
      console.log('💬 Message detected:', messageData);
      
      processedMessages.add(messageId);
      
      // 🔥 CRÍTICO: Solo guardar si el fan EXISTE en BD
      await saveMessageIfFanExists(messageData);
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
}

// 🔥 CRÍTICO: Auto-crear fan si no existe cuando detectamos mensaje
async function saveMessageIfFanExists(messageData) {
  try {
    // Verificar si el fan existe
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/fans?fan_id=eq.${messageData.fan_id}&model_id=eq.${messageData.model_id}&select=fan_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );
    
    const fans = await checkRes.json();
    
    if (!fans || fans.length === 0) {
      console.log(`🆕 Fan ${messageData.fan_id} no existe, creando automáticamente...`);
      
      // 🔥 CREAR FAN AUTOMÁTICAMENTE
      await createFanAutomatically(messageData.fan_id);
    }
    
    // Guardar mensaje (ya sea que el fan existiera o lo acabamos de crear)
    const saveRes = await fetch(`${supabaseUrl}/rest/v1/chat`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(messageData)
    });
    
    if (saveRes.ok) {
      console.log(`✅ Message saved for fan ${messageData.fan_id}`);
    } else {
      const error = await saveRes.text();
      console.error('❌ Error saving message:', error);
    }
    
  } catch (error) {
    console.error('💥 Error in saveMessageIfFanExists:', error);
  }
}

// 🔥 NUEVA FUNCIÓN: Crear fan automáticamente
async function createFanAutomatically(fanId) {
  const fanData = {
    fan_id: fanId,
    model_id: modelId,
    name: `Fan ${fanId}`,
    of_username: `u${fanId}`,
    of_avatar_url: null,
    tier: 0,
    spent_total: 0,
    last_message_date: new Date().toISOString()
  };
  
  try {
    const createRes = await fetch(`${supabaseUrl}/rest/v1/fans`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(fanData)
    });
    
    if (createRes.ok) {
      console.log(`✅ Fan creado automáticamente: ${fanId}`);
    } else {
      const error = await createRes.text();
      // Si es error 409 (ya existe), no es problema
      if (!error.includes('23505')) {
        console.error('❌ Error creando fan:', error);
      }
    }
  } catch (error) {
    console.error('💥 Error en createFanAutomatically:', error);
  }
}

function generateUniqueMessageId(fanId, messageText, element) {
  const timeEl = element.querySelector('.g-date, [class*="time"], [class*="date"]');
  const timeText = timeEl?.textContent || '';
  const combined = `${fanId}_${messageText}_${timeText}`;
  return simpleHash(combined);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function extractTimestamp(element) {
  const timeEl = element.querySelector('.g-date, [class*="time"], [class*="date"]');
  if (timeEl) {
    const timeText = timeEl.textContent.trim();
    const date = new Date(timeText);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function extractFanId() {
  const urlMatch = window.location.pathname.match(/\/my\/chats\/chat\/(\d+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return null;
}

function detectMessageType(msgEl, messageText) {
  if (messageText.includes('$') && (messageText.includes('Unlock') || messageText.includes('🔒'))) {
    const priceMatch = messageText.match(/\$(\d+(?:\.\d+)?)/);
    return { type: 'ppv_locked', amount: priceMatch ? parseFloat(priceMatch[1]) : null };
  }
  
  if (messageText.toLowerCase().includes('reproducir video') || messageText.toLowerCase().includes('play video')) {
    const priceMatch = messageText.match(/\$(\d+(?:\.\d+)?)/);
    return { type: 'ppv_unlocked', amount: priceMatch ? parseFloat(priceMatch[1]) : null };
  }
  
  if (messageText.match(/sent.*tip/i) || messageText.match(/tip.*\$/i)) {
    const amountMatch = messageText.match(/\$(\d+(?:\.\d+)?)/);
    return { type: 'tip', amount: amountMatch ? parseFloat(amountMatch[1]) : null };
  }
  
  return { type: 'text', amount: null };
}

function extractMediaUrls(msgEl) {
  const mediaUrls = [];
  
  const images = msgEl.querySelectorAll('img[src*="cdn"], img[src*="onlyfans"]');
  images.forEach(img => {
    const src = img.src || img.getAttribute('data-src');
    if (src && !src.includes('avatar') && !src.includes('icon')) {
      mediaUrls.push(src);
    }
  });
  
  const videos = msgEl.querySelectorAll('video source, video[src]');
  videos.forEach(video => {
    const src = video.src || video.getAttribute('data-src');
    if (src) {
      mediaUrls.push(src);
    }
  });
  
  return mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null;
}

console.log('✅ Extension ready (AUTO-CREATE - First message triggers fan creation)');
