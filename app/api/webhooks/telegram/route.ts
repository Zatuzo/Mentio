import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/db';
import { sendTelegramMessage, sendTelegramMessageWithButtons, answerCallbackQuery, editMessageText } from '@/app/lib/telegram';
import {
  createTaskFromTelegram,
  createNoteFromTelegram,
  getActiveTasks,
  getAllProjectTasks,
  markTaskDoneByShortId,
  getBriefingData,
  formatBriefing,
} from '@/app/lib/telegram-brain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HELP_TEXT = `*Mentio Bot — Commands*

/task \\<judul\\> — Buat task baru
/note \\<isi\\> — Simpan catatan ke Brain Inbox
/tasks — Semua task open di project
/todo — Task yang di\\-assign ke kamu
/briefing — Briefing pagi on\\-demand

/status — Cek status koneksi
/help — Tampilkan pesan ini

💡 _Tap tombol ✅ di notifikasi untuk tandai task selesai tanpa mengetik_`;

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get('x-telegram-bot-api-secret-token');
    if (header !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: Record<string, unknown>;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // ── callback_query (inline button tap) ───────────────────────────────────
  const callbackQuery = update.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery) {
    const cbId = String(callbackQuery.id ?? '');
    const cbData = String(callbackQuery.data ?? '');
    const cbFrom = callbackQuery.from as Record<string, unknown>;
    const cbMessage = callbackQuery.message as Record<string, unknown> | undefined;
    const cbChatId = String((cbMessage?.chat as Record<string, unknown>)?.id ?? '');
    const cbMessageId = cbMessage?.message_id as number | undefined;

    // Find user by chatId
    const cbUser = await prisma.user.findFirst({
      where: { telegramChatId: cbChatId },
      select: { id: true },
    });

    const rejectMatch = cbData.match(/^agent_reject:(.+)$/);
    if (rejectMatch && cbUser) {
      const taskId = rejectMatch[1];
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task || task.userId !== cbUser.id) {
        await answerCallbackQuery(cbId, 'Task tidak ditemukan');
      } else {
        await prisma.task.update({
          where: { id: taskId },
          data: { agentStatus: 'failed', agentError: 'Ditolak oleh user', agentPrUrl: null },
        });
        await answerCallbackQuery(cbId, 'PR ditolak');
        if (cbChatId && cbMessageId) {
          await editMessageText(cbChatId, cbMessageId, `*Ditolak*\n\n${task.title}\n\n_Branch agent telah diabaikan._`);
        }
      }
      return NextResponse.json({ ok: true });
    }

    const doneMatch = cbData.match(/^done:(.+)$/);
    if (doneMatch && cbUser) {
      const taskId = doneMatch[1];
      const task = await prisma.task.findUnique({ where: { id: taskId } });

      if (!task || (task.userId !== cbUser.id && task.assignedToId !== cbUser.id)) {
        await answerCallbackQuery(cbId, '❌ Task tidak ditemukan');
      } else if (task.status === 'done') {
        await answerCallbackQuery(cbId, '✅ Task ini sudah selesai sebelumnya');
        if (cbChatId && cbMessageId) {
          await editMessageText(cbChatId, cbMessageId, `✅ ~${task.title}~\n\n_Sudah selesai_`);
        }
      } else {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'done', completedAt: new Date() },
        });
        await answerCallbackQuery(cbId, '✅ Task ditandai selesai!');
        if (cbChatId && cbMessageId) {
          const title = task.title.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
          await editMessageText(cbChatId, cbMessageId, `✅ *Selesai\\!*\n\n~${title}~\n\nKerja bagus\\! 🎉`);
        }
      }
    } else {
      await answerCallbackQuery(cbId);
    }

    return NextResponse.json({ ok: true });
  }

  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return NextResponse.json({ ok: true });

  const chat = message.chat as Record<string, unknown>;
  const chatId = String(chat?.id ?? '');
  const text = ((message.text as string) || '').trim();

  if (!chatId || !text) return NextResponse.json({ ok: true });

  // ── /start ────────────────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    await sendTelegramMessage(
      chatId,
      '👋 *Halo\\! Ini adalah bot Mentio\\.*\n\nUntuk menghubungkan akunmu:\n1\\. Buka app Mentio → Settings → Integrations → Telegram\n2\\. Klik "Generate Kode"\n3\\. Kirim `/connect <KODE>` di sini',
    );
    return NextResponse.json({ ok: true });
  }

  // ── /help ─────────────────────────────────────────────────────────────────
  if (text === '/help') {
    await sendTelegramMessage(chatId, HELP_TEXT);
    return NextResponse.json({ ok: true });
  }

  // ── /status ───────────────────────────────────────────────────────────────
  if (text === '/status') {
    const user = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
    if (user) {
      await sendTelegramMessage(chatId, `✅ Terhubung sebagai *${user.name || user.email}*\nNotifikasi: ${user.telegramEnabled ? 'aktif' : 'nonaktif'}\n\nKetik /help untuk lihat semua command\\.`);
    } else {
      await sendTelegramMessage(chatId, '❌ Belum terhubung\\. Gunakan `/connect <KODE>` untuk menghubungkan\\.');
    }
    return NextResponse.json({ ok: true });
  }

  // ── /connect <CODE> ───────────────────────────────────────────────────────
  const connectMatch = text.match(/^\/connect\s+([A-Z0-9]{6,12})$/i);
  if (connectMatch) {
    const code = connectMatch[1].toUpperCase();
    const verification = await prisma.verification.findFirst({
      where: { identifier: { startsWith: 'tg_connect_' }, value: code, expiresAt: { gt: new Date() } },
    });

    if (!verification) {
      await sendTelegramMessage(chatId, '❌ Kode tidak valid atau sudah kadaluarsa\\.\nBuat kode baru di Settings → Integrations → Telegram\\.');
      return NextResponse.json({ ok: true });
    }

    const userId = verification.identifier.replace('tg_connect_', '');
    await Promise.all([
      prisma.user.update({ where: { id: userId }, data: { telegramChatId: chatId, telegramEnabled: true } }),
      prisma.verification.delete({ where: { id: verification.id } }),
    ]);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    await sendTelegramMessage(
      chatId,
      `✅ *Berhasil terhubung\\!*\n\nAkun *${user?.name || user?.email}* sudah terhubung\\.\n\nSekarang kamu bisa:\n• /task untuk buat task\n• /note untuk simpan catatan\n• /todo untuk lihat task aktif\n• /briefing untuk briefing pagi\n\nKetik /help untuk semua command\\.`,
    );
    return NextResponse.json({ ok: true });
  }

  // ── Commands yang butuh akun terhubung ────────────────────────────────────
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
    select: { id: true, name: true, telegramEnabled: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, '❌ Akun belum terhubung\\. Kirim /start untuk mulai\\.');
    return NextResponse.json({ ok: true });
  }

  const userId = user.id;

  // ── /task <title> ─────────────────────────────────────────────────────────
  const taskMatch = text.match(/^\/task\s+(.+)$/is);
  if (taskMatch) {
    const title = taskMatch[1].trim();
    if (!title) {
      await sendTelegramMessage(chatId, '⚠️ Judul task tidak boleh kosong\\.\nContoh: `/task Fix login bug`');
      return NextResponse.json({ ok: true });
    }
    const task = await createTaskFromTelegram(userId, title);
    await sendTelegramMessageWithButtons(
      chatId,
      `✅ *Task dibuat\\!*\n\n📌 ${task.title}`,
      [[{ text: 'Tandai Selesai', callback_data: `done:${task.id}` }]],
    );
    return NextResponse.json({ ok: true });
  }

  // ── /note <content> ───────────────────────────────────────────────────────
  const noteMatch = text.match(/^\/note\s+(.+)$/is);
  if (noteMatch) {
    const content = noteMatch[1].trim();
    if (!content) {
      await sendTelegramMessage(chatId, '⚠️ Isi catatan tidak boleh kosong\\.\nContoh: `/note Ide redesign landing page`');
      return NextResponse.json({ ok: true });
    }
    await createNoteFromTelegram(userId, content);
    await sendTelegramMessage(chatId, `📝 *Catatan disimpan ke Brain Inbox\\!*\n\n_${content.slice(0, 100)}${content.length > 100 ? '\\.\\.\\.' : ''}_`);
    return NextResponse.json({ ok: true });
  }

  // ── /todo ─────────────────────────────────────────────────────────────────
  if (text === '/todo') {
    const tasks = await getActiveTasks(userId);
    if (tasks.length === 0) {
      await sendTelegramMessage(chatId, '✨ Tidak ada task aktif saat ini\\.');
    } else {
      const lines = tasks.map((t, i) => {
        const pri = t.priority !== 'none' ? ` \\[${t.priority}\\]` : '';
        const due = t.dueDate
          ? ` · ${new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
          : '';
        return `${i + 1}\\. ${t.title}${pri}${due}`;
      });
      const msg = `📋 *Task Aktif* \\(${tasks.length}\\)\n\n${lines.join('\n')}\n\nTap tombol di bawah untuk menandai selesai:`;
      const keyboard = tasks.map((t) => [
        { text: t.title.slice(0, 40) + (t.title.length > 40 ? '…' : ''), callback_data: `done:${t.id}` },
      ]);
      await sendTelegramMessageWithButtons(chatId, msg, keyboard);
    }
    return NextResponse.json({ ok: true });
  }

  // ── /done <shortId> ───────────────────────────────────────────────────────
  const doneMatch = text.match(/^\/done\s+([a-z0-9]+)$/i);
  if (doneMatch) {
    const shortId = doneMatch[1].toLowerCase();
    const task = await markTaskDoneByShortId(userId, shortId);
    if (!task) {
      await sendTelegramMessage(chatId, `❌ Task \`${shortId}\` tidak ditemukan\\.\nGunakan /todo untuk lihat ID task aktif\\.`);
    } else {
      await sendTelegramMessage(chatId, `✅ *Selesai\\!*\n\n~~${task.title}~~\n\nKerja bagus\\! 🎉`);
    }
    return NextResponse.json({ ok: true });
  }

  // ── /tasks ────────────────────────────────────────────────────────────────
  if (text === '/tasks') {
    const { projectName, tasks } = await getAllProjectTasks(userId);
    if (tasks.length === 0) {
      await sendTelegramMessage(chatId, `✨ Tidak ada task open di project *${projectName ?? 'kamu'}*\\.`);
    } else {
      const STATUS_ICON: Record<string, string> = { todo: '○', in_progress: '◐', done: '●' };
      const lines = tasks.map((t) => {
        const icon = STATUS_ICON[t.status] ?? '?';
        const assignee = t.assignedTo ? ` → ${t.assignedTo.name}` : '';
        const due = t.dueDate
          ? ` · ${new Date(t.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
          : '';
        return `${icon} ${t.title}${assignee}${due}`;
      });
      const header = `📋 *${projectName ?? 'Project'} — Task Open* \\(${tasks.length}\\)\n\n`;
      const keyboard = tasks.map((t) => [
        { text: t.title.slice(0, 40) + (t.title.length > 40 ? '…' : ''), callback_data: `done:${t.id}` },
      ]);
      await sendTelegramMessageWithButtons(chatId, header + lines.join('\n'), keyboard);
    }
    return NextResponse.json({ ok: true });
  }

  // ── /briefing ─────────────────────────────────────────────────────────────
  if (text === '/briefing') {
    const data = await getBriefingData(userId);
    const formatted = formatBriefing(data);
    await sendTelegramMessage(chatId, formatted);
    return NextResponse.json({ ok: true });
  }

  // ── Unknown command ───────────────────────────────────────────────────────
  if (text.startsWith('/')) {
    await sendTelegramMessage(chatId, `❓ Command tidak dikenal\\. Ketik /help untuk lihat semua command\\.`);
  }

  return NextResponse.json({ ok: true });
}
