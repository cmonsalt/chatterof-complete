// ✅ CLIENT UPLOAD HANDLER - Para @vercel/blob client-side
// Ubicación: api/blob/client-upload.js

import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  const jsonResponse = await handleUpload({
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      // Aquí podrías validar permisos si quisieras
      return {
        allowedContentTypes: ['image/*', 'video/*'],
        maximumSizeInBytes: 500 * 1024 * 1024, // 500MB
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      console.log('✅ Blob uploaded:', blob.url);
    },
  });

  return res.status(jsonResponse.status).json(jsonResponse.body);
}
