import { google } from 'googleapis';
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

export async function POST(request) {
  try {
    const { folderUrl, sheetName, accessToken } = await request.json();

    const folderId = folderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!folderId) {
      return Response.json({ error: 'Invalid folder URL' }, { status: 400 });
    }

    // アクセストークンがない場合はモックデータを返す（デモ用）
    if (!accessToken) {
      const mockPapers = [
        {
          filename: 'Dog ownership paper.pdf',
          title: 'Dog ownership: is it beneficial for physical activity, cardiovascular disease, and diabetes?',
          year: 2020,
          authors: ['Hidetaka Hamasaki'],
          abstract: 'Dog ownership has been shown to have significant health benefits...',
          keywords: ['dog ownership', 'physical activity', 'diabetes', 'cardiovascular disease'],
          primaryCategory: 'データサイエンス',
          secondaryCategories: ['AI'],
          confidence: 0.95,
          relatedPapers: []
        },
        {
          filename: 'Kalman Filter Paper.pdf',
          title: '一次元輝度分布センサを用いたカルマンフィルタによる水平位置及び奥行距離同時推定',
          year: 2019,
          authors: ['堀川裕気', '穆盛林'],
          abstract: '本稿では、一台の一次元輝度分布センサを用いて対象者の水平位置...',
          keywords: ['センサ', 'カルマンフィルタ', '位置推定'],
          primaryCategory: '振動音響',
          secondaryCategories: ['AI'],
          confidence: 0.92,
          relatedPapers: []
        }
      ];

      return Response.json({
        success: true,
        papers: mockPapers,
        message: `✅ ${mockPapers.length} 件の論文を処理しました。（デモモード）`
      });
    }

    // 実装：Google Drive API を使用してファイルをスキャン
    // TODO: 実装予定
    return Response.json({
      success: true,
      papers: [],
      message: 'Google Drive API integration coming soon'
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
