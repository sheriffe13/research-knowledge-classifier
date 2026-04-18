import { google } from 'googleapis';

export async function getDriveClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function listFilesInFolder(drive, folderId) {
  try {
    const result = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: 100,
      fields: 'files(id, name, mimeType, webContentLink, createdTime)',
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
