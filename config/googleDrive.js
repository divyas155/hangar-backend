require('dotenv').config(); // ✅ Load environment variables first
const fs = require('fs');
const { google } = require('googleapis');

// 🔐 Initialize Drive client using service account credentials
let drive = null;

try {
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    throw new Error('❌ Missing or invalid GOOGLE_SERVICE_ACCOUNT_KEY_PATH.');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive client initialized using service account.');
} catch (error) {
  console.error('⚠️ Google Drive setup failed:', error.message);
  drive = null;
}

// ✅ Default shared folder for ZIP uploads
const FIXED_FOLDER_ID = '1QFXvk45MCVe1ozlFjBOMRr_Y7y4HIqU_';

// 📤 Upload ZIP file to shared ZIP folder (original logic unchanged)
async function uploadFile(localFilePath, remoteFileName, mimeType) {
  if (!drive) throw new Error('❌ Google Drive client not initialized.');

  const res = await drive.files.create({
    requestBody: {
      name: remoteFileName,
      mimeType,
      parents: [FIXED_FOLDER_ID],
    },
    media: {
      mimeType,
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, webViewLink',
  });

  return res.data;
}

// 📤 Upload admin files (PDF, DOCX, TXT, etc.) to a separate Drive folder
async function uploadAdminFile(localFilePath, remoteFileName, mimeType, folderId) {
  if (!drive) throw new Error('❌ Google Drive client not initialized.');

  const res = await drive.files.create({
    requestBody: {
      name: remoteFileName,
      mimeType,
      parents: [folderId], // 📁 uploads to Admin folder
    },
    media: {
      mimeType,
      body: fs.createReadStream(localFilePath),
    },
    fields: 'id, name, webViewLink',
  });

  const fileId = res.data.id;

  // 🔓 Make the uploaded file publicly downloadable
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    driveId: fileId,
    name: res.data.name,
    webViewLink: res.data.webViewLink,
    downloadUrl: `https://drive.google.com/uc?id=${fileId}&export=download`,
  };
}

// 📥 Stream/download file from Drive
async function getDriveFileStream(fileId) {
  if (!drive) throw new Error('❌ Google Drive client not initialized.');

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return res.data;
}
// 🗑️ Delete file from Google Drive by file ID
async function deleteDriveFile(fileId) {
  if (!drive) throw new Error('❌ Google Drive client not initialized.');
  try {
    await drive.files.delete({ fileId });
    return true;
  } catch (error) {
    throw new Error(`Drive deletion failed: ${error.message}`);
  }
}


module.exports = {
  uploadFile,
  uploadAdminFile,
  getDriveFileStream,
  deleteDriveFile, // ✅ include it here
};
