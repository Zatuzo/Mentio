// Run: node src/list-groups.js
// Lists all WhatsApp groups you are a member of, with their JIDs.
// Requires an active auth session (run npm run listener first to scan QR).

const path = require('path');
const AUTH_DIR = path.join(__dirname, '..', 'auth_info');

async function main() {
  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { useMultiFileAuthState, fetchLatestBaileysVersion } = baileys;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    logger: baileys.P({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log('No active session found. Run "npm run listener" first to scan QR and login.');
      process.exit(1);
    }

    if (connection === 'open') {
      console.log('Connected. Fetching groups...\n');
      try {
        const chats = await sock.groupFetchAllParticipating();
        const groups = Object.values(chats);

        if (groups.length === 0) {
          console.log('No groups found.');
        } else {
          console.log(`Found ${groups.length} group(s):\n`);
          groups.forEach((g) => {
            console.log(`Name : ${g.subject}`);
            console.log(`JID  : ${g.id}`);
            console.log('---');
          });

          console.log('\nCopy the JID(s) you want to monitor into .env:');
          console.log('WA_GROUPS=' + groups.map((g) => g.id).join(','));
        }
      } catch (err) {
        console.error('Failed to fetch groups:', err.message);
      }
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
