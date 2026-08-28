import { prisma } from './db';

const TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars';
// Narrowest scope that still allows create/update/delete of events.
// We never read other calendars or change calendar settings, so the broad
// .../auth/calendar scope is unnecessary and harder to get verified.
const SCOPE        = 'https://www.googleapis.com/auth/calendar.events';

function appUrl() {
  return process.env.APP_URL ?? 'https://mentio.space';
}

function redirectUri() {
  return `${appUrl()}/api/calendar/google/callback`;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function getOAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  redirectUri(),
    response_type: 'code',
    scope:         SCOPE,
    access_type:   'offline',
    prompt:        'consent',
    state:         Buffer.from(userId).toString('base64url'),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function decodeState(state: string): string {
  return Buffer.from(state, 'base64url').toString('utf-8');
}

export async function exchangeCode(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri(),
      grant_type:    'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
}

async function refreshToken(userId: string) {
  const record = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!record) throw new Error('Google Calendar not connected');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: record.refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };

  const updated = await prisma.googleCalendarToken.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      expiresAt:   new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return updated;
}

async function getValidToken(userId: string): Promise<string> {
  let record = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!record) throw new Error('Google Calendar not connected');

  // Refresh if expired (with 60s buffer)
  if (record.expiresAt.getTime() < Date.now() + 60_000) {
    record = await refreshToken(userId);
  }
  return record.accessToken;
}

// ── Calendar event CRUD ───────────────────────────────────────────────────────

function taskToGCalEvent(task: {
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}) {
  const hasTime = false; // all-day events

  const startStr = task.startDate
    ? task.startDate.slice(0, 10)
    : task.dueDate
      ? task.dueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const endStr = task.dueDate
    ? (() => {
        // GCal all-day end is exclusive — add 1 day
        const d = new Date(task.dueDate);
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      })()
    : (() => {
        const d = new Date(startStr);
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
      })();

  return {
    summary:     task.title,
    description: task.description ?? '',
    start:       { date: startStr },
    end:         { date: endStr },
    source: {
      title: 'Mentio',
      url:   appUrl(),
    },
  };
}

export async function createCalendarEvent(userId: string, task: {
  id: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}): Promise<string | null> {
  try {
    const token      = await getValidToken(userId);
    const record     = await prisma.googleCalendarToken.findUnique({ where: { userId } });
    const calendarId = record?.calendarId ?? 'primary';

    const res = await fetch(`${CALENDAR_URL}/${encodeURIComponent(calendarId)}/events`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body:    JSON.stringify(taskToGCalEvent(task)),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { id: string };
    return data.id;
  } catch (err) {
    console.error('[gcal] createEvent error:', err);
    return null;
  }
}

export async function updateCalendarEvent(userId: string, googleEventId: string, task: {
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}): Promise<void> {
  try {
    const token      = await getValidToken(userId);
    const record     = await prisma.googleCalendarToken.findUnique({ where: { userId } });
    const calendarId = record?.calendarId ?? 'primary';

    const res = await fetch(
      `${CALENDAR_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body:    JSON.stringify(taskToGCalEvent(task)),
      }
    );
    if (!res.ok) throw new Error(await res.text());
  } catch (err) {
    console.error('[gcal] updateEvent error:', err);
  }
}

export async function deleteCalendarEvent(userId: string, googleEventId: string): Promise<void> {
  try {
    const token      = await getValidToken(userId);
    const record     = await prisma.googleCalendarToken.findUnique({ where: { userId } });
    const calendarId = record?.calendarId ?? 'primary';

    await fetch(
      `${CALENDAR_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error('[gcal] deleteEvent error:', err);
  }
}

export async function isConnected(userId: string): Promise<boolean> {
  const record = await prisma.googleCalendarToken.findUnique({
    where: { userId },
    select: { syncEnabled: true },
  });
  return !!record?.syncEnabled;
}
