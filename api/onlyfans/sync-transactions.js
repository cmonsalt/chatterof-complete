import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // Obtener historial completo de transacciones
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/payouts/list-transactions-earnings`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const transactions = data.data || [];

    // Guardar transacciones históricas
    const transactionsToInsert = transactions.map(tx => ({
      transaction_id: tx.id,
      fan_id: tx.user?.id,
      type: tx.type, // 'tip', 'subscription', 'message' (PPV), etc
      amount: tx.amount,
      created_at: new Date(tx.createdAt),
      description: tx.description,
      model_id: accountId
    }));

    if (transactionsToInsert.length > 0) {
      await supabase.from('transactions').upsert(transactionsToInsert, {
        onConflict: 'transaction_id'
      });
    }

    res.status(200).json({ 
      success: true, 
      transactionsCount: transactionsToInsert.length 
    });
  } catch (error) {
    console.error('Sync transactions error:', error);
    res.status(500).json({ error: error.message });
  }
}
