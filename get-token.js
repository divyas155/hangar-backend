// get-token.js
const fs = require('fs');
const { google } = require('googleapis');

// Load your credentials.json
const creds = JSON.parse(fs.readFileSync('credentials.json')).web;
const oAuth2Client = new google.auth.OAuth2(
  creds.client_id,
  creds.client_secret,
  creds.redirect_uris[0]
);

// 1) Generate an authorization URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',            // so we get a refresh_token
  scope: ['https://www.googleapis.com/auth/drive.file']
});

console.log('1) Go to this URL, authorize the app, and copy the code parameter:');
console.log(authUrl);

// 2) After you get the code, run this script again with NODE_CODE env var:
//    CODE=the_code_here node get-token.js
if (process.env.CODE) {
  (async () => {
    const { tokens } = await oAuth2Client.getToken(process.env.CODE);
    // Save tokens, including refresh_token, to disk
    fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
    console.log('Saved token.json');
  })();
}
