import { Anthropic } from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function extractMetadata(text, filename) {
  const prompt = `以下のテキストはPDF論文またはドキュメントからの抽出です。メタデータを JSON 形式で抽出してください。

テキスト：
${text.substring(0, 5000)}

次のフィールドをJSON形式で出力してください：
{
  "title": "論文タイトル",
  "year": 2024 または "Unknown",
  "authors": ["著者1", "著者2"],
  "abstract": "概要（最初の200文字）",
  "keywords": ["キーワード1", "キーワード2"],
  "sections": ["Introduction", "Methods", "Results"],
  "confidence": 0.95
}

必ず有効な JSON のみを返してください。`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-20250805',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const jsonStr = message.content[0].text;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Metadata extraction error:', error);
    return {
      title: filename,
      year: 'Unknown',
      authors: [],
      abstract: '',
      keywords: [],
      sections: [],
      confidence: 0.3
    };
  }
}

export const CATEGORIES = [
  '微細気泡', '混相流体', '熱流体', '振動音響', '遮音防音', '木材',
  '熱硬化樹脂', '熱可塑樹脂', '無機材料', '有機材料', '空間シミュレーション',
  '1DCAE', 'MBD', '感性工学', 'データサイエンス', 'AI', '機械学習',
  '物理化学', 'バイオ', 'ヒートポンプ', '電気化学', '無機化学', '塗料'
];

export async function classifyPaper(metadata) {
  const prompt = `以下の論文メタデータを、23のカテゴリーのいずれかに分類してください：

${JSON.stringify(metadata, null, 2)}

カテゴリー：
${CATEGORIES.join('、')}

JSON形式で以下を返してください：
{
  "primaryCategory": "最も関連のあるカテゴリー",
  "secondaryCategories": ["関連カテゴリー1", "関連カテゴリー2"],
  "confidence": 0.85
}

必ず有効な JSON のみを返してください。`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-20250805',
      max_tokens: 500,
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const jsonStr = message.content[0].text;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Classification error:', error);
    return {
      primaryCategory: 'データサイエンス',
      secondaryCategories: [],
      confidence: 0.5
    };
  }
}
