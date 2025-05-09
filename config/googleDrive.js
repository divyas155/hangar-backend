const fs   = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');
const TOKEN_PATH       = path.join(__dirname, '../token.json');

if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
  throw new Error('Missing credentials.json or token.json');
}

const { client_id, client_secret, redirect_uris } = JSON.parse(fs.readFileSync(CREDENTIALS_PATH)).web;
const { refresh_token } = JSON.parse(fs.readFileSync(TOKEN_PATH));

const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
// Only set the refresh token:
oAuth2Client.setCredentials({ refresh_token });

const drive = google.drive({ version: 'v3', auth: oAuth2Client });

async function uploadFile(localFilePath, remoteFileName, mimeType) {
  const res = await drive.files.create({
    requestBody: { name: remoteFileName, mimeType },
    media:       { mimeType, body: fs.createReadStream(localFilePath) },
    fields:      'id,webViewLink'
  });
  return res.data;
}

/**
 * Streams a file’s contents from Drive.
 * @param {string} fileId
 * @returns {ReadableStream}
 */
async function getDriveFileStream(fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  return res.data; // Node.js Readable stream
}

module.exports = {
  uploadFile,
  getDriveFileStream
};
