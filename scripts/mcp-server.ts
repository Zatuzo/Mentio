#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';
import { startServer } from '../lib/mcp/server.js';

// Auto-load .env.local / .env from project root so MENTIO_API_KEY doesn't
// need to be set manually in the shell environment.
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: false });
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });

startServer().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
