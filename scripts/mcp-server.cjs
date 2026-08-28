#!/usr/bin/env node
// Entry point untuk MCP server — jalankan via: node scripts/mcp-server.cjs
// Atau tambahkan ke Claude Code settings.local.json

const { execFileSync } = require('child_process');
const path = require('path');

const tsx = path.resolve(__dirname, '../node_modules/.bin/tsx');
const entry = path.resolve(__dirname, 'mcp-server.ts');

// Spawn tsx dengan tsconfig mcp — forward stdin/stdout untuk stdio transport
const proc = require('child_process').spawn(tsx, ['--tsconfig', 'tsconfig.mcp.json', entry], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.resolve(__dirname, '..'),
});

proc.on('exit', (code) => process.exit(code ?? 0));
proc.on('error', (err) => {
  process.stderr.write(`Failed to start MCP server: ${err.message}\n`);
  process.exit(1);
});
