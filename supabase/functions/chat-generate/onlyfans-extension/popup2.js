// popup.js

document.addEventListener('DOMContentLoaded', () => {
  // Cargar configuración guardada
  chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'modelId'], (result) => {
    if (result.supabaseUrl) {
      document.getElementById('supabaseUrl').value = result.supabaseUrl;
    }
    if (result.supabaseKey) {
      document.getElementById('supabaseKey').value = result.supabaseKey;
    }
    if (result.modelId) {
      document.getElementById('modelId').value = result.modelId;
    }
  });
  
  // Guardar configuración
  document.getElementById('saveBtn').addEventListener('click', () => {
    const supabaseUrl = document.getElementById('supabaseUrl').value.trim();
    const supabaseKey = document.getElementById('supabaseKey').value.trim();
    const modelId = document.getElementById('modelId').value.trim();
    
    if (!supabaseUrl || !supabaseKey || !modelId) {
      showStatus('❌ Please fill all fields', 'error');
      return;
    }
    
    chrome.storage.sync.set({
      supabaseUrl,
      supabaseKey,
      modelId
    }, () => {
      showStatus('✅ Configuration saved! Reload OnlyFans page.', 'success');
      
      // Recargar tabs de OnlyFans
      chrome.tabs.query({ url: 'https://onlyfans.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.reload(tab.id);
        });
      });
    });
  });

  // 🆕 Sync Vault Button
  document.getElementById('syncVaultBtn').addEventListener('click', async () => {
    const btn = document.getElementById('syncVaultBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Syncing...';
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('onlyfans.com')) {
        showStatus('❌ Please open OnlyFans first', 'error');
        btn.disabled = false;
        btn.textContent = '🔄 Sync OF Vault to Catalog';
        return;
      }
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'syncVault' }, (response) => {
        btn.disabled = false;
        btn.textContent = '🔄 Sync OF Vault to Catalog';
        
        if (chrome.runtime.lastError) {
          showStatus('❌ Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (response && response.success) {
          showStatus(`✅ ${response.message}`, 'success');
        } else {
          showStatus(`⚠️ ${response?.message || 'Sync failed'}`, 'error');
        }
      });
      
    } catch (error) {
      btn.disabled = false;
      btn.textContent = '🔄 Sync OF Vault to Catalog';
      showStatus('❌ Error: ' + error.message, 'error');
    }
  });
});

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 8000);
}
