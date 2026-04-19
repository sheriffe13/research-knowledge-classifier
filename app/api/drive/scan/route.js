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

async function extractPDFText(drive, fileId) {
  try {
    console.log('Downloading PDF...');
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    console.log('Extracting text from PDF...');
    // Node.js 環境でのみ実行（require を使用）
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(response.data);
    
    return (pdfData.text || '').substring(0, 3000);
  } catch (error) {
    console.error('PDF extraction error:', error.message);
    return '';
  }
}

async function extractMetadataWithClaude(pdfText, filename) {
  try {
    if (!pdfText || pdfText.length === 0) {
      return {
        year: 'Unknown',
        authors: [],
        abstract: `論文: ${filename.replace('.pdf', '')}`,
        keywords: []
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        year: 'Unknown',
        authors: [],
        abstract: `論文: ${filename.replace('.pdf', '')}`,
        keywords: []
      };
    }

    const prompt = `以下は論文PDFから抽出されたテキストです。JSON形式でメタデータを抽出：

【テキスト】
${pdfText}

【返答】JSON のみ
{"year":"発行年","authors":["著者1"],"abstract":"概要","keywords":["k1","k2"]}`;

    console.log('Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      return {
        year: 'Unknown',
        authors: [],
        abstract: `論文: ${filename.replace('.pdf', '')}`,
        keywords: []
      };
    }

    const data = await response.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return {
        year: 'Unknown',
        authors: [],
        abstract: `論文: ${filename.replace('.pdf', '')}`,
        keywords: []
      };
    }

    const metadata = JSON.parse(jsonMatch[0]);
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
      abstract: `論文: ${filename.replace('.pdf', '')}`,
      keywords: []
    };
  }
}

async function createSpreadsheetWithSheet(sheets, spreadsheetName, sheetName) {
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: spreadsheetName },
        sheets: [{ properties: { sheetId: 0, title: sheetName } }]
      }
    });
    return response.data.spreadsheetId;
  } catch (error) {
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { folderUrl, spreadsheetId, spreadsheetName, sheetName, accessToken } = body;

    console.log('\n=== Scan Start ===');
    const folderId = folderUrl?.match(/\/folders\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!folderId) {
      return Response.json({ error: 'Invalid folder URL', success: false }, { status: 400 });
    }

    if (!accessToken) {
      return Response.json({
        success: true,
        papers: [{ filename: 'Sample.pdf', title: 'Sample', year: 2024, authors: ['Author'], abstract: 'Sample', keywords: ['k1'], primaryCategory: 'データサイエンス' }],
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
        const pdfText = await extractPDFText(drive, file.id);
        const metadata = await extractMetadataWithClaude(pdfText, file.name);
        
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

    console.log('✅ Completed\n');

    return Response.json({
      success: true,
      papers: papers,
      spreadsheetId: resultSpreadsheetId,
      message: `✅ ${papers.length} 件のファイルを検出・メタデータを抽出・Google Sheets に保存しました。`,
      sheetsUrl: `https://docs.google.com/spreadsheets/d/${resultSpreadsheetId}/edit`
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
}
