import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
);

export function getAuthUrl() {
  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
}

export async function getAccessTokenFromCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

export function getDriveClient(accessToken) {
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function listFilesInFolder(drive, folderId) {
  try {
    const result = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/vnd.openxmlformats-officedocument.presentationml.presentation')`,
      pageSize: 50,
      fields: 'files(id, name, mimeType, createdTime, webViewLink)',
    });

    return result.data.files || [];
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
}

export async function downloadFile(drive, fileId) {
  try {
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
      },
      {
        responseType: 'arraybuffer',
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
