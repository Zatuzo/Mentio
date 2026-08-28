import OpenAI from 'openai';
import {
  getCodebaseContext,
  getFileContent,
  createBranch,
  commitFile,
  createPullRequest,
  type GithubConfig,
  type PullRequest,
} from './github';
import { buildTaskPrompt, type PromptTask, type PromptProject } from './prompt-builder';
import { prisma } from './db';

export type AgentModel = 'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-coder';

export const AGENT_MODELS: { id: AgentModel; label: string; description: string }[] = [
  { id: 'deepseek-chat',     label: 'DeepSeek V3',      description: 'Cepat & hemat, cocok untuk task umum' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1',      description: 'Reasoning mendalam, cocok untuk task kompleks' },
  { id: 'deepseek-coder',    label: 'DeepSeek Coder V2', description: 'Spesialis coding, paling akurat untuk code' },
];

let _deepseek: OpenAI | null = null;
function getDeepseek() {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY ?? 'missing',
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return _deepseek;
}

export type AgentInput = {
  task: PromptTask & { id: string };
  project: PromptProject;
  repo: {
    fullName: string;
    branch: string;
    token: string;
  };
  model?: AgentModel;
};

export type AgentResult = {
  pr: PullRequest;
  branch: string;
  summary: string;
  filesChanged: string[];
};

export type AgentLogEntry = {
  time: string;
  type: 'info' | 'read' | 'write' | 'think' | 'done' | 'error';
  message: string;
};

type FileWrite = { path: string; content: string };

const MAX_TURNS = 20;

class AgentLogger {
  private entries: AgentLogEntry[] = [];
  private taskId: string;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  async log(type: AgentLogEntry['type'], message: string) {
    this.entries.push({ time: new Date().toISOString(), type, message });
    await prisma.task.update({
      where: { id: this.taskId },
      data: { agentLog: JSON.stringify(this.entries) },
    }).catch(() => {});
  }

  getEntries() { return this.entries; }
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const { task, project, repo, model = 'deepseek-coder' } = input;
  const cfg: GithubConfig = { repo: repo.fullName, branch: repo.branch, token: repo.token };
  const cfgWrite = { repo: repo.fullName, token: repo.token };
  const logger = new AgentLogger(task.id);

  await logger.log('info', `Memulai agent untuk task: ${task.title}`);
  await logger.log('info', `Mengambil struktur codebase dari ${repo.fullName}…`);

  const codebase = await getCodebaseContext(cfg);
  if (codebase.fileCount > 0) {
    await logger.log('info', `Ditemukan ${codebase.fileCount} file di repo (branch: ${repo.branch})`);
  }

  const systemPrompt = buildTaskPrompt(task, project, codebase) + `

## Agent mode
You are running as an autonomous coding agent. You have tools to read and write files directly to the GitHub repo.

Rules:
- Read only the files you NEED — maximum 8 files total before you must start writing
- After reading, immediately implement changes using write_file (full file content)
- Write every file that needs changes — do not skip any
- Call finish with a concise markdown summary once all files are written
- Do NOT ask clarifying questions — make your best judgment and proceed
- Do NOT read more files after you have started writing unless absolutely necessary`;

  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the content of a file from the repository',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to repo root' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write or update a file in the repository',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path relative to repo root' },
            content: { type: 'string', description: 'Full file content' },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'finish',
        description: 'Signal that the task is complete and provide a summary',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Markdown summary of what was changed and why' },
          },
          required: ['summary'],
        },
      },
    },
  ];

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Task: ${task.title}\n\n${task.description ?? ''}`.trim() },
  ];

  await logger.log('think', 'Menganalisis task dan menentukan file yang perlu diubah…');

  const pendingWrites: FileWrite[] = [];
  let summary = '';
  let turns = 0;
  let readCount = 0;
  const MAX_READS = 8; // nudge model to write after this many reads

  while (turns < MAX_TURNS) {
    turns++;

    // After too many reads with no writes, hard-nudge the model to start writing.
    // Do this BEFORE the API call so the message is in context.
    if (readCount >= MAX_READS && pendingWrites.length === 0) {
      await logger.log('think', `Sudah membaca ${readCount} file — meminta model untuk mulai menulis…`);
      messages.push({
        role: 'user',
        content: `You have read ${readCount} files already. Stop reading and implement the changes NOW. Call write_file for every file you need to modify, then call finish. Do not read any more files.`,
      });
      readCount = 0; // reset so we don't spam
    }

    const toolChoice: OpenAI.Chat.ChatCompletionToolChoiceOption =
      pendingWrites.length === 0 ? 'required' : 'auto';

    const response = await getDeepseek().chat.completions.create({
      model,
      max_tokens: 8192,
      tools,
      tool_choice: toolChoice,
      messages,
    });

    const choice = response.choices[0];
    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    if (assistantMsg.content) {
      const text = assistantMsg.content.trim();
      if (text.length > 0) {
        await logger.log('think', text.length > 200 ? text.slice(0, 200) + '…' : text);
      }
    }

    // No tool calls — nudge or stop
    if (choice.finish_reason === 'stop' || !assistantMsg.tool_calls?.length) {
      if (pendingWrites.length > 0) break; // already wrote something, done
      messages.push({
        role: 'user',
        content: 'You must use write_file to write the code changes, then call finish. Do not stop without writing at least one file.',
      });
      continue;
    }

    let finished = false;
    let wroteThisTurn = false;

    for (const toolCall of assistantMsg.tool_calls!) {
      if (toolCall.type !== 'function') continue;
      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, string>;
      let result = '';

      if (fnName === 'read_file') {
        readCount++;
        await logger.log('read', `Membaca file: ${args.path}`);
        const file = await getFileContent(cfg, args.path);
        result = file ? file.content : `File not found: ${args.path}`;
        if (!file) await logger.log('info', `File tidak ditemukan: ${args.path}`);
      } else if (fnName === 'write_file') {
        wroteThisTurn = true;
        await logger.log('write', `Menulis file: ${args.path}`);
        pendingWrites.push({ path: args.path, content: args.content });
        result = `Queued write: ${args.path}`;
      } else if (fnName === 'finish') {
        summary = args.summary ?? '';
        finished = true;
        result = 'Done';
      }

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
    }

    // Once model writes something, reset read counter so it can read again if needed
    if (wroteThisTurn) readCount = 0;

    if (finished) break;
  }

  if (pendingWrites.length === 0) {
    throw new Error('Agent tidak menghasilkan perubahan file apapun setelah ' + turns + ' langkah');
  }

  const branchName = `mentio/task-${task.id.slice(-8)}-${Date.now()}`;
  await logger.log('info', `Membuat branch: ${branchName}`);
  await createBranch(cfgWrite, branchName, repo.branch);

  for (const file of pendingWrites) {
    await logger.log('write', `Commit: ${file.path}`);
    const existing = await getFileContent({ ...cfg, branch: branchName }, file.path);
    await commitFile(
      cfgWrite,
      file.path,
      file.content,
      `[mentio] ${task.title}`,
      branchName,
      existing?.sha
    );
  }

  await logger.log('info', 'Membuat Pull Request draft…');
  const pr = await createPullRequest(
    cfgWrite,
    `[Mentio] ${task.title}`,
    `## Task\n${task.title}\n\n${task.description ?? ''}\n\n## Changes\n${summary}`,
    branchName,
    repo.branch
  );

  await logger.log('done', `PR siap: ${pr.url} — ${pendingWrites.length} file diubah`);

  return {
    pr,
    branch: branchName,
    summary,
    filesChanged: pendingWrites.map((f) => f.path),
  };
}
