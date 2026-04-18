export async function POST(request) {
  try {
    const { folderUrl, sheetName } = await request.json();

    const mockPapers = [
      {
        filename: 'Dog ownership paper.pdf',
        title: 'Dog ownership: is it beneficial for physical activity, cardiovascular disease, and diabetes?',
        year: 2020,
        authors: ['Hidetaka Hamasaki'],
        keywords: ['dog ownership', 'physical activity', 'diabetes'],
        primaryCategory: 'データサイエンス',
      }
    ];

    return Response.json({
      success: true,
      papers: mockPapers,
      message: 'Sample data returned. Full integration in Phase 2.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
