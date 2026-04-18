export async function POST(request) {
  try {
    return Response.json({
      message: 'Google OAuth will be implemented in Phase 2',
      authUrl: null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
