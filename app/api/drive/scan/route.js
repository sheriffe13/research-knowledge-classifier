import { google } from 'googleapis';
import pdf from 'pdf-parse';
import { Anthropic } from '@anthropic-ai/sdk';

const CATEGORIES = [
  '微細気泡', '混相流体', '熱流体', '振動音響', '遮音防音', '木材',
  '熱硬化樹脂', '熱可塑樹脂', '無機材料', '有機材料', '空間シミュレーション',
  '1DCAE', 'MBD', '感性工学', 'データサイエンス', 'AI', '機械学習',
  '物理化学', 'バイオ', 'ヒートポンプ', '電気化学', '無機化学', '塗料'
];

const anthropic = new Anthropic();

async function extractMetadata(text, filename) {
  const prompt = `以下のテキストはPDF論文からの抽出です。メタデータをJSON形式で抽出してください。

テキスト：
${text.substring(0, 3000)}

次のフィールドをJSON形式で出力してください：
{
  "title": "論文タイトル",
  "year": 2024 または "Unknown",
  "authors": ["著者1", "著者2"],
  "abstract": "概要",
  "keywords": ["キーワード1", "キーワード2"],
  "confidence": 0.85
}

必ず有効なJSONのみを返してください。`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-20250805',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonStr = message.content[0].text;
    return JSON.parse(jsonStr);
  } catch (error) {
    return {
      title: filename,
      year: 'Unknown',
      authors: [],
      abstract: '',
      keywords: [],
      confidence: 0.3
    };
  }
}

async function classifyPaper(metadata) {
  const prompt = `以下の論文メタデータを23のカテゴリーのいずれかに分類してください：

${JSON.stringify(metadata, null, 2)}

カテゴリー：${CATEGORIES.join('、')}

JSON形式で以下を返してください：
{
  "primaryCategory": "最も関連のあるカテゴリー",
  "secondaryCategories": ["関連カテゴリー1"],
  "confidence": 0.85
}

必ず有効なJSONのみを返してください。`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-20250805',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const jsonStr = message.content[0].text;
    return JSON.parse(jsonStr);
  } catch (error) {
    return {
      primaryCategory: 'データサイエンス',
      secondaryCategories: [],
      confidence: 0.5
    };
  }
}

async function extractPDFText(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer);
    return data.text.substring(0, 10000);
  } catch (error) {
    return '';
  }
}

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

export async function POST(request) {
  try {
    const { folderUrl, sheetName, accessToken } = await request.json();

    const folderId = folderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!folderId) {
      return Response.json({ error: 'Invalid folder URL' }, { status: 400 });
    }

    // アクセストークンがない場合はモックデータを返す
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
          secondaryCategories: ['AI'],
          confidence: 0.95,
          relatedPapers: [
            { title: '関連論文1', similarity_score: 0.85 }
          ]
        }
      ];

      return Response.json({
        success: true,
        papers: mockPapers,
        message: `✅ ${mockPapers.length} 件の論文を処理しました。（モックデータ）`
      });
    }

    // Google Drive API を使用してファイルをスキャン
    const drive = await getDriveClient(accessToken);
    const files = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`,
      pageSize: 10,
      fields: 'files(id, name, mimeType)',
    });

    const papers = [];

    for (const file of files.data.files || []) {
      try {
        // PDF をダウンロード
        const response = await drive.files.get(
          {
            fileId: file.id,
            alt: 'media',
          },
          {
            responseType: 'arraybuffer',
          }
        );

        // テキストを抽出
        const text = await extractPDFText(response.data);

        // メタデータを抽出
        const metadata = await extractMetadata(text, file.name);

        // 分類
        const classification = await classifyPaper(metadata);

        papers.push({
          filename: file.name,
          ...metadata,
          ...classification,
          relatedPapers: []
        });
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    return Response.json({
      success: true,
      papers: papers,
      message: `✅ ${papers.length} 件の論文を処理しました。`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
