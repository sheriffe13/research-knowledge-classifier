import { google } from 'googleapis';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function getDriveClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getSheetsClient(accessToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function extractMetadataFromFilename(filename) {
  try {
    console.log('Extracting metadata from filename:', filename);

    const prompt = `以下はPDF論文のファイル名です。ファイル名から論文のメタデータを推測してください：

ファイル名：${filename}

以下のJSON形式で返答してください。他の説明は不要です。
{
  "year": 論文の推定発行年または "Unknown",
  "authors": ["著者1"],
  "abstract": "ファイル名から推測される論文の概要",
  "keywords": ["キーワード1", "キーワード2", "キーワード3"]
}

注意：
- yearは4桁の数字またはUnknown
- authorsは配列
- 有効なJSONのみを返してください`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-20250805',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonStr = message.content[0].text.trim();
    const metadata = JSON.parse(jsonStr);
    
    return {
      year: metadata.year || 'Unknown',
      authors: metadata.authors || [],
      abstract: metadata.abstract || '',
      keywords: metadata.keywords || []
    };
  } catch (error) {
    console.error('Metadata extraction error:', error.message);
    return {
      year: 'Unknown',
      authors: [],
      abstract: 'メタデータ抽出エラー',
      keywords: []
    };
  }
}

async function createSpreadsheetWithSheet(sheets, spreadsheetName, sheetName) {
  try {
    console.log('Creating spreadsheet:', spreadsheetName);
    
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: spreadsheetName },
        sheets: [
          {
            properties: {
              sheetId: 0,
              title: sheetName
            }
          }
        ]
      }
    });
    
    return response.data.spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error.message);
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { folderUrl, spreadsheetId, spreadsheetName, sheetName, accessToken } = body;

    console.log('=== Scan Start ===');
    const folderId = folderUrl?.match(/\/folders\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!folderId) {
      return Response.json({ error: 'Invalid folder URL', success: false }, { status: 400 });
    }

    // デモモード
    if (!accessToken) {
      return Response.json({
        success: true,
        papers: [{
          filename: 'Sample.pdf',
          title: 'Sample Paper',
          year: 2024,
          authors: ['Author'],
          abstract: 'Sample abstract',
          keywords: ['keyword1', 'keyword2'],
          primaryCategory: 'データサイエンス'
        }],
        message: '✅ デモモード'
      });
    }

    // 本番モード
    console.log('Starting Drive scan...');
    const drive = await getDriveClient(accessToken);
    const files = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
      pageSize: 20,
      fields: 'files(id, name)',
    });

    console.log('Files found:', files.data.files?.length || 0);

    const papers = [];

    for (const file of files.data.files || []) {
      try {
        console.log(`Processing: ${file.name}`);
        const metadata = await extractMetadataFromFilename(file.name);
        
        papers.push({
          filename: file.name,
          title: file.name.replace('.pdf', ''),
          year: metadata.year,
          authors: metadata.authors,
          abstract: metadata.abstract,
          keywords: metadata.keywords,
          primaryCategory: 'データサイエンス'
        });

        console.log(`✅ ${file.name}`);
      } catch (error) {
        console.error(`Error: ${file.name}`, error.message);
        papers.push({
          filename: file.name,
          title: file.name.replace('.pdf', ''),
          year: 'Error',
          authors: [],
          abstract: 'エラーが発生しました',
          keywords: [],
          primaryCategory: 'データサイエンス'
        });
      }
    }

    console.log('Papers prepared:', papers.length);

    // Sheets に保存
    let resultSpreadsheetId = spreadsheetId;
    const sheets = await getSheetsClient(accessToken);

    if (!resultSpreadsheetId) {
      resultSpreadsheetId = await createSpreadsheetWithSheet(sheets, spreadsheetName, sheetName);
    }

    const headers = ['日付', 'タイトル', '年', '著者', '概要', 'キーワード', 'カテゴリー', 'ファイル名'];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: resultSpreadsheetId,
      range: `'${sheetName}'!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    });

    const values = papers.map(p => [
      new Date().toISOString().split('T')[0],
      p.title || '',
      p.year || '',
      Array.isArray(p.authors) ? p.authors.join('; ') : '',
      p.abstract || '',
      Array.isArray(p.keywords) ? p.keywords.join('; ') : '',
      p.primaryCategory || '',
      p.filename || ''
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: resultSpreadsheetId,
      range: `'${sheetName}'!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: values }
    });

    console.log('✅ Completed');

    return Response.json({
      success: true,
      papers: papers,
      spreadsheetId: resultSpreadsheetId,
      message: `✅ ${papers.length} 件のファイルを検出・メタデータを抽出・Google Sheets に保存しました。`,
      sheetsUrl: `https://docs.google.com/spreadsheets/d/${resultSpreadsheetId}/edit`
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}
