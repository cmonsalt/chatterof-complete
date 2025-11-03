const API_BASE = '/api/onlyfans';

export const ofAPI = {
  // SYNC INICIAL (1 vez)
  syncChats: (accountId) =>
    fetch(`${API_BASE}/sync-chats?accountId=${accountId}`).then(r => r.json()),

  syncFans: (accountId) =>
    fetch(`${API_BASE}/sync-fans?accountId=${accountId}`).then(r => r.json()),

  syncTransactions: (accountId) =>
    fetch(`${API_BASE}/sync-transactions?accountId=${accountId}`).then(r => r.json()),

  // CHAT
  getMessages: (accountId, chatId, limit = 20) =>
    fetch(`${API_BASE}/get-messages?accountId=${accountId}&chatId=${chatId}&limit=${limit}`)
      .then(r => r.json()),

  sendMessage: (accountId, chatId, text, mediaFiles = [], price = 0) =>
    fetch(`${API_BASE}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, chatId, text, mediaFiles, price })
    }).then(r => r.json()),

  sendTyping: (accountId, chatId) =>
    fetch(`${API_BASE}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, chatId })
    }).then(r => r.json()),

  // VAULT
  getVault: (accountId) =>
    fetch(`${API_BASE}/get-vault?accountId=${accountId}`).then(r => r.json()),

  uploadMedia: (accountId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/upload-media?accountId=${accountId}`, {
      method: 'POST',
      body: formData
    }).then(r => r.json());
  },

  // SYNC COMPLETO (ejecutar al conectar cuenta)
  fullSync: async (accountId) => {
    try {
      const results = await Promise.all([
        ofAPI.syncChats(accountId),
        ofAPI.syncFans(accountId),
        ofAPI.syncTransactions(accountId)
      ]);
      return {
        success: true,
        chats: results[0].chatsCount,
        fans: results[1].fansCount,
        transactions: results[2].transactionsCount
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
