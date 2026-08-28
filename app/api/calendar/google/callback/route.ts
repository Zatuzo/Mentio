import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { decodeState, exchangeCode } from '@/app/lib/google-calendar';

export const dynamic = 'force-dynamic';

// GET /api/calendar/google/callback — Google redirects here after user approves
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.APP_URL ?? 'https://mentio.space';

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/settings/integrations?gcal=error`);
  }

  try {
    const userId = decodeState(state);

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new Error('User not found');

    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) throw new Error('No refresh_token — user may need to re-authorize');

    await prisma.googleCalendarToken.upsert({
      where:  { userId },
      update: {
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt:    new Date(Date.now() + tokens.expires_in * 1000),
        syncEnabled:  true,
      },
      create: {
        userId,
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt:    new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(`${appUrl}/settings/integrations?gcal=connected`);
  } catch (err) {
    console.error('[gcal] callback error:', err);
    return NextResponse.redirect(`${appUrl}/settings/integrations?gcal=error`);
  }
}
