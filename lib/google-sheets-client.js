import { google } from 'googleapis';

export async function getSheetsClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export async function createSpreadsheet(sheets, title) {
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title,
        },
      },
    });

    return response.data.spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

export async function getOrCreateSheet(sheets, spreadsheetId, sheetName) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    let sheet = spreadsheet.data.sheets.find(
      (s) => s.properties.title === sheetName
    );

    if (!sheet) {
      // シートが存在しない場合は作成
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // 作成したシートを取得
      const updatedSpreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });
      sheet = updatedSpreadsheet.data.sheets.find(
        (s) => s.properties.title === sheetName
      );
    }

    return sheet.properties.sheetId;
  } catch (error) {
    console.error('Error getting or creating sheet:', error);
    throw error;
  }
}

export async function addHeaderRow(sheets, spreadsheetId, sheetName) {
  try {
    const headers = [
      '日付',
      'タイトル',
      '年',
      '著者',
      '概要',
      'キーワード',
      'カテゴリー',
      '関連論文',
      'ソース'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
  } catch (error) {
    console.error('Error adding header row:', error);
    throw error;
  }
}

export async function appendPaperData(sheets, spreadsheetId, sheetName, papers) {
  try {
    const values = papers.map((paper) => [
      new Date().toISOString().split('T')[0], // 日付
      paper.title || '',
      paper.year || '',
      Array.isArray(paper.authors) ? paper.authors.join('; ') : paper.authors || '',
      paper.abstract || '',
      Array.isArray(paper.keywords) ? paper.keywords.join('; ') : paper.keywords || '',
      paper.primaryCategory || '',
      paper.relatedPapers && paper.relatedPapers.length > 0
        ? paper.relatedPapers.map((r) => `${r.title} (${(r.similarity_score * 100).toFixed(0)}%)`).join('; ')
        : '',
      paper.filename || ''
    ]);

    // 既存のデータ行数を取得
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:A`,
    });

    const nextRow = (result.data.values?.length || 0) + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A${nextRow}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: values,
      },
    });

    return nextRow;
  } catch (error) {
    console.error('Error appending paper data:', error);
    throw error;
  }
}
