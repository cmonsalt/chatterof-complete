// ✅ SCRAPE AND SAVE - OnlyFans scrape desde R2 y guarda en catalog
// Ubicación: api/onlyfans/scrape-and-save.js (NUEVO)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    accountId,
    modelId,
    r2Url,
    title,
    basePrice = 10,
    nivel = 5,
    tags = '',
    fileType
  } = req.body;

  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId || !modelId || !r2Url) {
    return res.status(400).json({ 
      error: 'accountId, modelId, and r2Url required' 
    });
  }

  console.log('🌐 Starting OnlyFans scrape from R2...');

  try {
    // OnlyFans scrape desde R2 (solo 1 crédito)
    console.log('📥 Scraping:', r2Url);
    
    const scrapeResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/scrape`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: r2Url })
      }
    );

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('❌ Scrape failed:', errorText);
      throw new Error(`Scrape failed: ${errorText}`);
    }

    const scrapeData = await scrapeResponse.json();
    console.log('✅ Scrape response:', scrapeData);

    // Extraer vault_media_id
    const vaultMediaId = scrapeData.id || scrapeData.media_id || scrapeData.data?.id;
    const thumbUrl = scrapeData.files?.thumb?.url || scrapeData.thumb?.url || scrapeData.data?.files?.thumb?.url;

    if (!vaultMediaId) {
      console.error('❌ No vault ID in response:', scrapeData);
      throw new Error('No vault media ID returned from scrape');
    }

    console.log('✅ Got vault ID:', vaultMediaId);

    // Guardar en catalog
    console.log('💾 Saving to catalog...');

    const catalogData = {
      of_media_id: vaultMediaId.toString(),
      of_media_ids: [vaultMediaId.toString()],
      r2_url: r2Url,  // ✅ URL permanente
      media_url: r2Url,  // Usar R2 como principal
      media_thumb: thumbUrl,
      media_thumbnails: thumbUrl ? { [vaultMediaId]: thumbUrl } : {},
      file_type: fileType,
      model_id: modelId,
      parent_type: 'single',
      title: title || `${fileType} ${vaultMediaId}`,
      base_price: basePrice,
      nivel: nivel,
      tags: tags || fileType,
      description: `Uploaded via R2 on ${new Date().toISOString().split('T')[0]}`,
      created_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabase
      .from('catalog')
      .upsert(catalogData, { 
        onConflict: 'of_media_id',
        ignoreDuplicates: false 
      });

    if (dbError) {
      console.error('⚠️ DB error:', dbError);
      throw dbError;
    }

    console.log('✅ Saved to catalog');

    return res.status(200).json({
      success: true,
      vaultMediaId: vaultMediaId,
      r2Url: r2Url,
      fileType: fileType,
      creditsUsed: 1,
      message: '✅ File uploaded to vault successfully!',
      catalogSaved: true
    });

  } catch (error) {
    console.error('❌ Scrape error:', error);
    return res.status(500).json({ 
      error: error.message || 'Scrape failed'
    });
  }
}
