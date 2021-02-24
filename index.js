const fs = require('fs');
global.atob = require("atob");
global.Blob = require('node-blob');
const save = require('save-file')

const readline = require('readline');
const {
    google
} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Gmail API.
    authorize(JSON.parse(content), listLabels);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {
        client_secret,
        client_id,
        redirect_uris
    } = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err)
            oAuth2Client.setCredentials(token)
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH)
            })
            callback(oAuth2Client)
        })
    })
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
    const gmail = google.gmail({
        version: 'v1',
        auth
    })
    gmail.users.messages.list({
        userId: 'me',
        q: "is:unread"
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const msgs = res.data.messages
        if (msgs.length) {
            msgs.forEach((msg) => {
                fetchEmail(msg.id)
            })
        }
    })

    function fetchEmail(idData) {
        gmail.users.messages.get({
            userId: 'me',
            id: idData
        }, (err, res) => {
            if (err) return console.log('The API returned an error: ' + err);
            const payload = res.data.payload
            for (let i = 0; i < payload.parts.length; i++) {
                part = payload.parts[i]
                const attachmentId = part.body.attachmentId
                if (attachmentId) {
                    downloadAttachment(attachmentId, idData, part.filename, part.mimeType)
                }
            }
        })
    }

    function downloadAttachment(idnew, msgId, filename, mimeType) {
        gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: msgId,
            id: idnew
        }, (err, res) => {
            if (err) return console.log('The API returned an error: ' + err)
            const attachment = res.data.data
            var base64 = (attachment).replace(/_/g, '/')
            base64 = base64.replace(/-/g, '+')
            var base64Fixed = fixBase64(base64)
            var blob = new Blob([base64Fixed], {
                type: mimeType
            })
            save(blob, 'images/' + filename)
        })

        function fixBase64(binaryData) {
            var base64str = binaryData
            var binary = atob(base64str.replace(/\s/g, ''))
            var len = binary.length
            var buffer = new ArrayBuffer(len)
            var view = new Uint8Array(buffer)
            for (var i = 0; i < len; i++)
                view[i] = binary.charCodeAt(i)
            return view
        }
    }
}