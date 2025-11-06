import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId } = req.query;
  const API_KEY = process.env.ONLYFANS_API_KEY;

  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  try {
    // Parse el form con formidable
    const form = formidable({ multiples: false });
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Leer el archivo
    const fileStream = fs.createReadStream(file.filepath);
    const formData = new FormData();
    formData.append('file', fileStream, {
      filename: file.originalFilename,
      contentType: file.mimetype,
    });

    // Subir a OnlyFans API
    const uploadResponse = await fetch(
      `https://app.onlyfansapi.com/api/${accountId}/media/upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('OnlyFans API error:', errorText);
      throw new Error(`OnlyFans API error: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();

    // Limpiar archivo temporal
    fs.unlinkSync(file.filepath);

    res.status(200).json(uploadData);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
}
