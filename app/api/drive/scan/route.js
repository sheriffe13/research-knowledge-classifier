import { google } from 'googleapis';

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

async function extractMetadataWithClaude(filename) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return extractMetadataBasic(filename);
    }

    const prompt = `以下は論文のファイル名です。JSON形式で返してください。

ファイル名: ${filename}

{
  "year": "発行年（4桁の数字、分からなければnull）",
  "authors": ["著者1", "著者2"],
  "keywords": ["キーワード1", "キーワード2", "キーワード3"]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250805',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Claude API error:', error);
      return extractMetadataBasic(filename);
    }

    const data = await response.json();
    const text = data.content[0].text;

    // JSON を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return extractMetadataBasic(filename);
    }

    const metadata = JSON.parse(jsonMatch[0]);

    return {
      year: metadata.year || 'Unknown',
      authors: metadata.authors || [],
      abstract: `論文: ${filename.replace('.pdf', '')}`,
      keywords: metadata.keywords || []
    };
  } catch (error) {
    console.error('Claude API error:', error.message);
    return extractMetadataBasic(filename);
  }
}

function extractMetadataBasic(filename) {
  const title = filename.replace('.pdf', '');
  const yearMatch = filename.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : 'Unknown';
  
  const keywords = title
    .split(/[_-\s]+/)
    .filter(word => word.length > 2 && !/^\d+$/.test(word))
    .slice(0, 5);
  
  return {
    year: year,
    authors: ['(抽出予定)'],
    abstract: `論文: ${title}`,
    keywords: keywords
  };
}

async function createSpreadsheetWithSheet(sheets, spreadsheetName, sheetName) {
  try {
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

    if (!accessToken) {
      return Response.json({
        success: true,
        papers: [{
          filename: 'Sample.pdf',
          title: 'Sample Paper',
          year: 2024,
          authors: ['Author'],
          abstract: 'Sample',
          keywords: ['k1'],
          primaryCategory: 'データサイエンス'
        }],
        message: '✅ デモモード'
      });
    }

    console.log('Starting Drive scan...');
    const drive = await getDriveClient(accessToken);
    const files = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
      pageSize: 20,
      fields: 'files(id, name)',
    });

    console.log(`Files found: ${files.data.files?.length || 0}`);

    const papers = [];

    for (const file of files.data.files || []) {
      try {
        console.log(`Processing: ${file.name}`);
        const metadata = await extractMetadataWithClaude(file.name);
        
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
          abstract: 'Processing failed',
          keywords: [],
          primaryCategory: 'データサイエンス'
        });
      }
    }

    console.log(`Papers prepared: ${papers.length}`);

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
      message: `✅ ${papers.length} 件のファイルを検出・Google Sheets に保存しました。`,
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
