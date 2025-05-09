const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

let CREDENTIALS, TOKEN;

try {
  CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  TOKEN = JSON.parse(process.env.GOOGLE_TOKEN);
} catch (err) {
  throw new Error('❌ Missing or invalid GOOGLE_CREDENTIALS or GOOGLE_TOKEN environment variables.');
}

// Get auth fields
const { client_id, client_secret, redirect_uris } =
  CREDENTIALS.installed || CREDENTIALS.web; // support both formats

const { refresh_token } = TOKEN;

// Initialize OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// Set token
oAuth2Client.setCredentials({ refresh_token });

// Set up Google Drive API
const drive = google.drive({ version: 'v3', auth: oAuth2Client });

// Upload file to Drive
async function uploadFile(localFilePath, remoteFileName, mimeType) {
  const res = await drive.files.create({
    requestBody: { name: remoteFileName, mimeType },
    media: { mimeType, body: fs.createReadStream(localFilePath) },
    fields: 'id,webViewLink',
  });
  return res.data;
}

// Stream file from Drive
async function getDriveFileStream(fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res.data; // Node.js Readable stream
}

module.exports = {
  uploadFile,
  getDriveFileStream,
};
