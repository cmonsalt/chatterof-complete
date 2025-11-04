export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // PASO 1: Obtener todas las listas (categorías) del vault
    console.log('📂 Fetching vault lists...');
    
    const listsResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/vault/lists`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!listsResponse.ok) {
      throw new Error(`API error getting lists: ${listsResponse.status}`);
    }

    const listsData = await listsResponse.json();
    
    // La respuesta puede ser: { data: [...] } o directamente [...]
    let lists = [];
    if (Array.isArray(listsData)) {
      lists = listsData;
    } else if (Array.isArray(listsData.data)) {
      lists = listsData.data;
    } else {
      console.log('⚠️ Unexpected lists structure:', Object.keys(listsData));
    }

    console.log('✅ Found vault lists:', lists.length);

    // Si no hay listas, intentar obtener medias directamente
    if (lists.length === 0) {
      console.log('📁 No lists found, trying direct vault fetch...');
      
      const directResponse = await fetch(
        `https://app.onlyfansapi.com/api/${accountId}/media/vault`,
        {
          headers: { 
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (directResponse.ok) {
        const directData = await directResponse.json();
        const medias = directData.data || [];
        
        console.log('✅ Found medias directly:', medias.length);
        
        return res.status(200).json({ 
          success: true,
          medias: medias,
          total: medias.length,
          lists: 0,
          source: 'direct'
        });
      }
    }

    // PASO 2: Obtener medias de cada lista
    let allMedias = [];

    for (const list of lists) {
      console.log(`📂 Fetching list: ${list.name || list.id}`);

      try {
        const listMediaResponse = await fetch(
          `https://app.onlyfansapi.com/api/${accountId}/media/vault/lists/${list.id}`,
          {
            headers: { 
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (listMediaResponse.ok) {
          const listMediaData = await listMediaResponse.json();
          
          // Buscar medias en diferentes estructuras posibles
          let medias = [];
          if (Array.isArray(listMediaData)) {
            medias = listMediaData;
          } else if (Array.isArray(listMediaData.data)) {
            medias = listMediaData.data;
          } else if (listMediaData.data?.media) {
            medias = listMediaData.data.media;
          } else if (listMediaData.data?.medias) {
            medias = listMediaData.data.medias;
          }
          
          console.log(`  ├─ Found ${medias.length} medias`);
          
          // Agregar info de la lista a cada media
          const mediasWithList = medias.map(media => ({
            ...media,
            list_name: list.name,
            list_id: list.id
          }));
          
          allMedias = allMedias.concat(mediasWithList);
        }
      } catch (err) {
        console.error(`  ├─ Error fetching list ${list.id}:`, err.message);
      }
    }

    console.log('✅ Total vault medias loaded:', allMedias.length);

    res.status(200).json({ 
      success: true,
      medias: allMedias,
      total: allMedias.length,
      lists: lists.length,
      source: 'lists'
    });
    
  } catch (error) {
    console.error('❌ Get vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
