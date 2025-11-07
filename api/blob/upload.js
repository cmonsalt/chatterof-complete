// ✅ VERCEL BLOB UPLOAD ENDPOINT
// Ubicación: api/blob/upload.js (NUEVO)

import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Necesario para streaming
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = req.query.filename || 'upload';
    
    console.log('📤 Uploading to Vercel Blob:', filename);

    // Upload directo a Blob (streaming)
    const blob = await put(filename, req, {
      access: 'public',
    });

    console.log('✅ Blob uploaded:', blob.url);

    return res.status(200).json(blob);

  } catch (error) {
    console.error('❌ Blob upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Blob upload failed' 
    });
  }
}
