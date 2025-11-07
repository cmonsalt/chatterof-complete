import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, modelId } = req.body;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  console.log('🔄 Starting vault sync for:', modelId);

  if (!accountId || !modelId) {
    return res.status(400).json({ error: 'accountId and modelId required' });
  }

  try {
    // 1. Obtener vault de OnlyFans
    const response = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/vault`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const medias = data.data?.list || [];

    console.log(`📦 Found ${medias.length} medias in vault`);

    // 2. Borrar contenido viejo del catalog
    const { error: deleteError } = await supabase
      .from('catalog')
      .delete()
      .eq('model_id', modelId)
      .is('session_id', null)  // Solo singles, no sessions
      .eq('is_single', true);

    if (deleteError) {
      console.error('❌ Error deleting old catalog:', deleteError);
    } else {
      console.log('✅ Old catalog cleared');
    }

    // 3. Insertar nuevos medias
    let inserted = 0;
    const batchSize = 50;

    for (let i = 0; i < medias.length; i += batchSize) {
      const batch = medias.slice(i, i + batchSize);
      
      const catalogItems = batch.map(media => ({
        model_id: modelId,
        of_media_id: String(media.id),
        of_media_ids: [String(media.id)],
        title: `Media ${media.id}`,
        file_type: media.type === 'video' ? 'video' : 'photo',
        media_url: media.full,
        media_thumb: media.thumb || media.preview,
        base_price: 10,  // Precio default
        nivel: 1,
        is_single: true,
        keywords: [media.type]
      }));

      const { data: insertData, error: insertError } = await supabase
        .from('catalog')
        .insert(catalogItems)
        .select();

      if (insertError) {
        console.error(`❌ Error inserting batch ${i}:`, insertError);
      } else {
        inserted += insertData.length;
        console.log(`✅ Inserted batch ${i}: ${insertData.length} items`);
      }
    }

    console.log(`✅ Sync complete: ${inserted}/${medias.length} medias saved`);

    res.status(200).json({
      success: true,
      total: medias.length,
      inserted: inserted,
      message: `Synced ${inserted} medias to catalog`
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ error: error.message });
  }
}
