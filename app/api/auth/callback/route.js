import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback`
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}?error=${error}`
      );
    }

    if (!code) {
      return Response.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}?error=no_code`
      );
    }

    const { tokens } = await oauth2Client.getToken(code);
    const accessToken = tokens.access_token;

    const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}?access_token=${accessToken}`;

    return Response.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}?error=auth_failed`
    );
  }
}
