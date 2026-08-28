import { prisma } from './db';
import { defaultTaskDates } from './task-defaults';

interface ICalEvent {
  uid: string;
  summary: string;
  description: string | null;
  dtStart: Date | null;
  dtEnd: Date | null;
  categories: string | null;
}

function parseICalDate(value: string): Date | null {
  // TZID format: DTEND;TZID=Asia/Jakarta:20260623T225900
  // UTC format:  DTEND:20260623T155900Z
  // Date-only:   DTEND;VALUE=DATE:20260623
  const clean = value.split(':').pop()?.trim() ?? '';
  if (!clean) return null;

  if (/^\d{8}$/.test(clean)) {
    // DATE only: YYYYMMDD
    return new Date(`${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00`);
  }
  if (/^\d{8}T\d{6}Z$/.test(clean)) {
    // UTC datetime
    return new Date(
      `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`
    );
  }
  if (/^\d{8}T\d{6}$/.test(clean)) {
    // Local datetime (assume WIB UTC+7)
    const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}+07:00`;
    return new Date(iso);
  }
  return null;
}

function unescapeIcal(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function parseIcal(icsText: string): ICalEvent[] {
  // Unfold continuation lines (lines starting with space/tab)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: ICalEvent[] = [];
  let current: Partial<ICalEvent> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.uid && current.summary) {
        events.push({
          uid: current.uid,
          summary: current.summary,
          description: current.description ?? null,
          dtStart: current.dtStart ?? null,
          dtEnd: current.dtEnd ?? null,
          categories: current.categories ?? null,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).toUpperCase();
    const val = line.slice(colonIdx + 1);

    if (key === 'UID') current.uid = val.trim();
    else if (key === 'SUMMARY') current.summary = unescapeIcal(val.trim());
    else if (key === 'DESCRIPTION') current.description = unescapeIcal(val.trim()) || null;
    else if (key.startsWith('DTSTART')) current.dtStart = parseICalDate(line);
    else if (key.startsWith('DTEND')) current.dtEnd = parseICalDate(line);
    else if (key === 'CATEGORIES') current.categories = val.trim() || null;
  }

  return events;
}

function cleanSummary(summary: string): string {
  return summary
    .replace(/\s*-\s*Assignment is due\s*$/i, '')
    .replace(/\s+(is due|closes|should be completed|akan berakhir|jatuh tempo)\s*$/i, '')
    .trim();
}

export async function syncLmsForUser(userId: string): Promise<{ created: number; skipped: number; error?: string }> {
  const conn = await prisma.lmsConnection.findUnique({ where: { userId } });
  if (!conn) return { created: 0, skipped: 0, error: 'No LMS connection' };

  // Fetch iCal
  let icsText: string;
  try {
    const res = await fetch(conn.icalUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    icsText = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Fetch failed';
    return { created: 0, skipped: 0, error: msg };
  }

  const events = parseIcal(icsText);
  // Only keep events that are assignment deadlines (have a due date in future or recent past)
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 86400_000); // ignore tasks >7 days overdue
  const relevant = events.filter((e) => {
    // "opens" = assignment becomes available, NOT a deadline — skip
    if (/\s+opens\s*$/i.test(e.summary)) return false;
    const dueDate = e.dtEnd ?? e.dtStart;
    if (!dueDate) return false;
    return dueDate >= cutoff;
  });

  // One-time fixup: detach any existing LMS tasks that were wrongly assigned to a project
  await prisma.task.updateMany({
    where: { userId, lmsSourceId: { not: null }, projectId: { not: null } },
    data: { projectId: null, assignedToId: userId },
  });

  let created = 0;
  let skipped = 0;

  for (const event of relevant) {
    const dueDate = event.dtEnd ?? event.dtStart;
    const title = cleanSummary(event.summary);
    const description = event.categories ? `📚 ${event.categories}` : null;

    // Dedup by lmsSourceId
    const existing = await prisma.task.findFirst({
      where: { userId, lmsSourceId: event.uid },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    // LMS tasks are personal (no projectId), like WA dump tasks
    await prisma.task.create({
      data: {
        userId,
        assignedToId: userId,
        title,
        description,
        status: 'todo',
        priority: 'medium',
        source: 'lms',
        lmsSourceId: event.uid,
        ...defaultTaskDates(undefined, dueDate),
      },
    });
    created++;
  }

  await prisma.lmsConnection.update({
    where: { userId },
    data: { lastSyncAt: new Date(), lastSyncCount: created },
  });

  return { created, skipped };
}

export async function syncAllLmsUsers(): Promise<number> {
  const connections = await prisma.lmsConnection.findMany({ select: { userId: true } });
  let total = 0;
  for (const { userId } of connections) {
    const { created } = await syncLmsForUser(userId);
    total += created;
  }
  return total;
}
