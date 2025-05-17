require('dotenv').config();
const path = require('path');
const { uploadFile } = require('./config/googleDrive');

(async () => {
  try {
    // 📁 Path to your ZIP file
    const filePath = path.join(__dirname, 'test-progress.zip'); // 👈 change this to your actual file
    const fileName = `progress_${new Date().toISOString().split('T')[0]}.zip`; // e.g., progress_2025-05-13.zip
    const mimeType = 'application/zip';

    const result = await uploadFile(filePath, fileName, mimeType);
    console.log('✅ File uploaded:', result.webViewLink);
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
  }
})();
