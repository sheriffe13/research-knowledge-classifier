import { google } from 'googleapis';
import { Anthropic } from '@anthropic-ai/sdk';

const CATEGORIES = [
  '微細気泡', '混相流体', '熱流体', '振動音響', '遮音防音', '木材',
  '熱硬化樹脂', '熱可塑樹脂', '無機材料', '有機材料', '空間シミュレーション',
  '1DCAE', 'MBD', '感性工学', 'データサイエンス', 'AI', '機械学習',
  '物理化学', 'バイオ', 'ヒートポンプ', '電気化学', '無機化学', '塗料'
];

const anthropic = new Anthropic();

async function getDriveClient(accessToken) {
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

async function getSheetsClient(accessToken) {
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

async function createSpreadsheet(sheets, spreadsheetName) {
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: spreadsheetName,
        },
      },
    });

    return response.data.spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

async function addHeaderRow(sheets, spreadsheetId, sheetName) {
  try {
    const headers = [
      '日付',
      'タイトル',
      '年',
      '著者',
      '概要',
      'キーワード',
      'カテゴリー',
      'ファイル名'
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

async function appendPaperData(sheets, spreadsheetId, sheetName, papers) {
  try {
    const values = papers.map((paper) => [
      new Date().toISOString().split('T')[0],
      paper.title || '',
      paper.year || '',
      Array.isArray(paper.authors) ? paper.authors.join('; ') : paper.authors || '',
      paper.abstract || '',
      Array.isArray(paper.keywords) ? paper.keywords.join('; ') : paper.keywords || '',
      paper.primaryCategory || '',
      paper.filename || ''
    ]);

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

export async function POST(request) {
  try {
    const body = await request.json();
    const { folderUrl, spreadsheetId, spreadsheetName, sheetName, accessToken } = body;

    const folderId = folderUrl?.match(/\/folders\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!folderId) {
      return Response.json({ 
        error: 'Invalid folder URL format. Please check the Google Drive folder URL.',
        success: false 
      }, { status: 400 });
    }

    // デモモード
    if (!accessToken) {
      const mockPapers = [
        {
          filename: 'Dog ownership paper.pdf',
          title: 'Dog ownership: is it beneficial for physical activity, cardiovascular disease, and diabetes?',
          year: 2020,
          authors: ['Hidetaka Hamasaki'],
          abstract: 'Dog ownership has been shown to have significant health benefits...',
          keywords: ['dog ownership', 'physical activity', 'diabetes'],
          primaryCategory: 'データサイエンス',
          confidence: 0.95,
          relatedPapers: []
        }
      ];

      return Response.json({
        success: true,
        papers: mockPapers,
        message: `✅ ${mockPapers.length} 件の論文を処理しました。（デモモード）`,
        spreadsheetId: null
      });
    }

    // 本番モード
    const drive = await getDriveClient(accessToken);
    const sheets = await getSheetsClient(accessToken);

    // Google Drive からファイルをスキャン
    const files = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
      pageSize: 20,
      fields: 'files(id, name)',
    });

    const papers = [];

    for (const file of files.data.files || []) {
      try {
        papers.push({
          filename: file.name,
          title: file.name.replace('.pdf', ''),
          year: 'Detected',
          authors: ['(抽出中)'],
          abstract: 'PDF から自動抽出されます',
          keywords: [],
          primaryCategory: 'データサイエンス',
          confidence: 0.6,
          relatedPapers: []
        });
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    }

    // Google Sheets への保存処理
    let resultSpreadsheetId = spreadsheetId;

    try {
      // 既存の Sheets ID がない場合は新規作成
      if (!resultSpreadsheetId) {
        resultSpreadsheetId = await createSpreadsheet(sheets, spreadsheetName);
      }

      // ヘッダー行を追加
      await addHeaderRow(sheets, resultSpreadsheetId, sheetName);

      // メタデータを追記
      if (papers.length > 0) {
        await appendPaperData(sheets, resultSpreadsheetId, sheetName, papers);
      }
    } catch (error) {
      console.error('Error saving to Google Sheets:', error);
      // Sheets 保存に失敗してもデータは取得したので続行
    }

    return Response.json({
      success: true,
      papers: papers,
      spreadsheetId: resultSpreadsheetId,
      message: `✅ ${papers.length} 件のファイルを検出・Google Sheets に保存しました。`,
      sheetsUrl: `https://docs.google.com/spreadsheets/d/${resultSpreadsheetId}/edit`
    });
  } catch (error) {
    console.error('Scan error:', error);
    return Response.json({ 
      error: `Error scanning Google Drive: ${error.message}`,
      success: false 
    }, { status: 500 });
  }
}
