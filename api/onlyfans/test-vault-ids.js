// 🔍 TEST: Verificar vault IDs reales disponibles
// Ejecutar en Vercel Functions o localmente con: node test-vault.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const API_KEY = process.env.ONLYFANS_API_KEY;
  const ACCOUNT_ID = 'acct_90ad12f0cb4b4b53bcaa31c416367656';
  const MODEL_ID = req.query.modelId || 'your_model_id';

  try {
    console.log('📦 1. Fetching vault media from OnlyFans API...');
    
    // Obtener media del vault de OnlyFans
    const vaultResponse = await fetch(
      `https://app.onlyfansapi.com/api/${ACCOUNT_ID}/media/vault?limit=50&offset=0&sort=desc`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!vaultResponse.ok) {
      const error = await vaultResponse.text();
      console.error('❌ OnlyFans API error:', error);
      return res.status(500).json({ error: 'Failed to fetch vault', details: error });
    }

    const vaultData = await vaultResponse.json();
    const medias = vaultData.data?.list || [];

    console.log(`✅ Found ${medias.length} media files in OnlyFans vault`);

    // Obtener IDs del catalog en Supabase
    const { data: catalogItems, error: catalogError } = await supabase
      .from('catalog')
      .select('of_media_id, title, file_type')
      .eq('model_id', MODEL_ID)
      .order('created_at', { ascending: false })
      .limit(50);

    if (catalogError) {
      console.error('❌ Catalog error:', catalogError);
    }

    console.log(`📚 Found ${catalogItems?.length || 0} items in catalog`);

    // Comparar IDs
    const vaultIds = medias.map(m => m.id.toString());
    const catalogIds = (catalogItems || []).map(c => c.of_media_id);

    const missingInCatalog = vaultIds.filter(id => !catalogIds.includes(id));
    const missingInVault = catalogIds.filter(id => !vaultIds.includes(id));

    // Preparar respuesta
    const response = {
      summary: {
        vault_total: medias.length,
        catalog_total: catalogItems?.length || 0,
        missing_in_catalog: missingInCatalog.length,
        missing_in_vault: missingInVault.length
      },
      vault_media: medias.slice(0, 10).map(m => ({
        id: m.id,
        type: m.type,
        isReady: m.isReady,
        canView: m.canView,
        createdAt: m.createdAt
      })),
      catalog_items: (catalogItems || []).slice(0, 10).map(c => ({
        id: c.of_media_id,
        title: c.title,
        type: c.file_type
      })),
      analysis: {
        valid_vault_ids: vaultIds.slice(0, 10),
        ids_in_catalog_but_not_vault: missingInVault.slice(0, 5),
        recommendation: missingInVault.length > 0 
          ? 'Some catalog IDs are invalid. Run sync-vault-to-catalog to update.'
          : 'All catalog IDs exist in vault'
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}
