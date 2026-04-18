import pdf from 'pdf-parse';

export async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer);
    
    // テキストを抽出（最初の 20 ページまで）
    let text = data.text || '';
    
    if (!text) {
      return '';
    }

    // 最初の 10000 文字を返す
    return text.substring(0, 10000);
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

export async function extractMetadataFromText(text, filename) {
  // テキストから簡易的にメタデータを抽出
  return {
    title: filename.replace('.pdf', ''),
    text: text.substring(0, 5000)
  };
}
