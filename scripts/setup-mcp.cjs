#!/usr/bin/env node
/**
 * Setup script: generates .mcp.json for Claude Code / Claude Desktop.
 * Run once: node scripts/setup-mcp.cjs
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const mcpJsonPath = path.join(projectRoot, '.mcp.json');
const distEntry = path.join(projectRoot, 'dist', 'mcp-server.js');
const claudeDesktopConfig = path.join(
  os.homedir(),
  'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'
);

// ── Read MENTIO_API_KEY from .env.local / .env ─────────────────────────────

function readEnvVar(envPath, key) {
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf-8');
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

const apiKey =
  readEnvVar(path.join(projectRoot, '.env.local'), 'MENTIO_API_KEY') ||
  readEnvVar(path.join(projectRoot, '.env'), 'MENTIO_API_KEY');

// Prefer explicit MENTIO_BASE_URL, then APP_URL (production), fallback to localhost
const baseUrl =
  readEnvVar(path.join(projectRoot, '.env.local'), 'MENTIO_BASE_URL') ||
  readEnvVar(path.join(projectRoot, '.env'), 'MENTIO_BASE_URL') ||
  readEnvVar(path.join(projectRoot, '.env'), 'APP_URL') ||
  'https://mentio.space';

// ── Rebuild dist if stale ──────────────────────────────────────────────────

function rebuildDist() {
  const { execSync } = require('child_process');
  process.stdout.write('Building MCP server bundle...\n');
  try {
    execSync('npm run build:mcp', { cwd: projectRoot, stdio: 'inherit' });
    process.stdout.write('Build done.\n');
  } catch {
    process.stderr.write('Warning: build failed, using existing dist.\n');
  }
}

// ── Write .mcp.json ────────────────────────────────────────────────────────

function writeMcpJson(key) {
  const config = {
    mcpServers: {
      mentio: {
        command: 'node',
        args: [distEntry],
        env: {
          MENTIO_API_KEY: key,
          MENTIO_BASE_URL: baseUrl,
        },
      },
    },
  };
  fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n');
  process.stdout.write(`✓ .mcp.json written → ${mcpJsonPath}\n`);
}

// ── Update Claude Desktop config ───────────────────────────────────────────

function updateClaudeDesktop(key) {
  let existing = { mcpServers: {} };
  if (fs.existsSync(claudeDesktopConfig)) {
    try { existing = JSON.parse(fs.readFileSync(claudeDesktopConfig, 'utf-8')); }
    catch { existing = { mcpServers: {} }; }
  }
  existing.mcpServers = existing.mcpServers ?? {};
  existing.mcpServers.mentio = {
    command: 'node',
    args: [distEntry],
    env: {
      MENTIO_API_KEY: key,
      MENTIO_BASE_URL: baseUrl,
    },
  };
  fs.mkdirSync(path.dirname(claudeDesktopConfig), { recursive: true });
  fs.writeFileSync(claudeDesktopConfig, JSON.stringify(existing, null, 2) + '\n');
  process.stdout.write(`✓ Claude Desktop config updated → ${claudeDesktopConfig}\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  process.stdout.write('\n=== Mentio MCP Setup ===\n\n');

  rebuildDist();

  if (!fs.existsSync(distEntry)) {
    process.stderr.write(`Error: dist/mcp-server.js not found. Run: npm run build:mcp\n`);
    process.exit(1);
  }

  let key = apiKey;

  if (!key) {
    process.stdout.write(
      '\nMENTIO_API_KEY tidak ditemukan di .env.local\n' +
      'Buat API Key di: ' + baseUrl + '/developer\n\n'
    );
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    key = await new Promise((resolve) => {
      rl.question('Paste API Key kamu: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  } else {
    process.stdout.write(`✓ MENTIO_API_KEY ditemukan di .env.local\n`);
  }

  if (!key) {
    process.stderr.write('Error: API Key diperlukan.\n');
    process.exit(1);
  }

  process.stdout.write(`✓ Base URL: ${baseUrl}\n\n`);

  writeMcpJson(key);
  updateClaudeDesktop(key);

  process.stdout.write(`
Done! Langkah selanjutnya:
  1. Restart Claude Desktop (Cmd+Q, lalu buka kembali)
  2. Atau reload project di Claude Code
  3. Test: tanya Claude "list semua project di Mentio"

Untuk update key atau URL, jalankan ulang: node scripts/setup-mcp.cjs
`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
