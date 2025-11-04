export default async function handler(req, res) {
  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId required' });
  }

  try {
    // PASO 1: Obtener todas las listas (categorías) del vault
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
    const lists = listsData.data || [];

    console.log('✅ Found vault lists:', lists.length);

    // PASO 2: Obtener medias de cada lista
    let allMedias = [];

    for (const list of lists) {
      console.log(`📂 Fetching list: ${list.name} (${list.id})`);

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
        
        // Las medias pueden estar en data.media o data.medias
        const medias = listMediaData.data?.media || listMediaData.data?.medias || listMediaData.data || [];
        
        console.log(`  ├─ Found ${medias.length} medias`);
        
        // Agregar info de la lista a cada media
        const mediasWithList = medias.map(media => ({
          ...media,
          list_name: list.name,
          list_id: list.id
        }));
        
        allMedias = allMedias.concat(mediasWithList);
      }
    }

    // PASO 3: También intentar obtener medias sin lista (por si acaso)
    console.log('📁 Fetching unlisted medias...');
    const unlistedResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/vault`,
      {
        headers: { 
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (unlistedResponse.ok) {
      const unlistedData = await unlistedResponse.json();
      const unlistedMedias = unlistedData.data || [];
      console.log(`  ├─ Found ${unlistedMedias.length} unlisted medias`);
      allMedias = allMedias.concat(unlistedMedias);
    }

    console.log('✅ Total vault medias loaded:', allMedias.length);

    res.status(200).json({ 
      success: true,
      medias: allMedias,
      total: allMedias.length,
      lists: lists.length
    });
    
  } catch (error) {
    console.error('Get vault error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}
