import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { extname, join, parse, resolve } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createTask, formatSize, getMe, getTask, listTasks, uploadFile, waitForTask } from './api.js';
import { getApiKey, loadConfig, saveConfig } from './config.js';

const VERSION = '1.3.7';

const HELP = `
  ffhub - Cloud FFmpeg CLI (v${VERSION})
  https://ffhub.io

  Usage:
    ffhub [ffmpeg args]           Run an FFmpeg command in the cloud
    ffhub whoami                  Show current user and credits
    ffhub list [--status=X]       List recent tasks (default: 10)
    ffhub status <task_id>        Check task status
    ffhub config <api_key>        Save API key
    ffhub help                    Show help

  Examples:
    ffhub -i https://example.com/video.mp4 -c:v libx264 output.mp4
    ffhub -i ./local-video.mp4 -c:v libx264 -crf 28 compressed.mp4
    ffhub -i input.mp4 -vn -c:a libmp3lame output.mp3
    ffhub -i input.mp4 -ss 00:00:10 -to 00:00:30 -c copy clip.mp4

  Local files are automatically uploaded before processing.

  Setup:
    1. Sign up at https://ffhub.io to get an API key
    2. ffhub config <your_api_key>
       or set env: export FFHUB_API_KEY=<your_api_key>
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log(VERSION);
    return;
  }

  // ffhub config <api_key>
  if (args[0] === 'config') {
    if (!args[1]) {
      const config = loadConfig();
      if (config.api_key) {
        const masked = config.api_key.slice(0, 8) + '...' + config.api_key.slice(-4);
        console.log(`API Key: ${masked}`);
      } else {
        console.log('No API key configured. Run: ffhub config <your_api_key>');
      }
      return;
    }
    saveConfig({ api_key: args[1] });
    console.log('API key saved to ~/.ffhub/config.json');
    return;
  }

  // ffhub whoami
  if (args[0] === 'whoami') {
    const apiKey = requireApiKey();
    const me = await getMe(apiKey);
    console.log(`\n  Email:    ${me.email}`);
    console.log(`  User ID:  ${me.user_id}`);
    console.log(`  Credits:  ${me.remaining_credits}`);
    console.log('');
    return;
  }

  // ffhub list [--status=X] [--limit=N]
  if (args[0] === 'list' || args[0] === 'ls') {
    const apiKey = requireApiKey();
    let limit = 10;
    let status: string | undefined;
    for (const arg of args.slice(1)) {
      if (arg.startsWith('--status=')) status = arg.split('=')[1];
      if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1]) || 10;
    }
    const result = await listTasks(apiKey, limit, status);
    printTaskList(result.tasks, result.total);
    return;
  }

  // ffhub status <task_id>
  if (args[0] === 'status') {
    if (!args[1]) {
      console.error('Please specify a task ID: ffhub status <task_id>');
      process.exit(1);
    }
    const apiKey = requireApiKey();
    const task = await getTask(apiKey, args[1]);
    await printTaskResult(task);
    return;
  }

  // ffhub [ffmpeg args] — submit a task
  const apiKey = requireApiKey();

  // Build the FFmpeg command, uploading any local file inputs as we go.
  const processedArgs = await processArgs(apiKey, args);
  const command = 'ffmpeg ' + processedArgs.join(' ');

  console.log(`\n  Command: ${command}\n`);

  // Create the task
  const taskId = await createTask(apiKey, command);
  console.log(`  Task created: ${taskId}`);
  console.log('  Processing...\n');

  // Poll until terminal state. FFmpeg work reports 0–100; after 100 the worker
  // is uploading the result to R2 — say so, otherwise the user sees a stuck
  // "100% [running]".
  let lastLine = '';
  const task = await waitForTask(apiKey, taskId, (progress, status) => {
    const line =
      progress >= 100 && status === 'running'
        ? '  Finalizing output (uploading to storage)...'
        : `  Progress: ${progress}% [${status}]`;
    if (line !== lastLine) {
      lastLine = line;
      // pad to overwrite leftover chars from the previous shorter line
      process.stdout.write(`\r${line.padEnd(60)}`);
    }
  });

  console.log('');
  await printTaskResult(task);
}

function requireApiKey(): string {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('No API key configured.\n');
    console.error('  ffhub config <your_api_key>');
    console.error('  or set env: export FFHUB_API_KEY=<your_api_key>');
    console.error('\n  Sign up at https://ffhub.io to get an API key');
    process.exit(1);
  }
  return apiKey;
}

/** Walk the ffmpeg args, uploading any local file referenced by -i and
 * replacing it with the resulting public URL. URLs and missing paths pass
 * through untouched. */
async function processArgs(apiKey: string, args: string[]): Promise<string[]> {
  const result: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // The arg after -i is the input; check whether it's a local file path.
    if (arg === '-i' && i + 1 < args.length) {
      const input = args[i + 1];
      if (!input.startsWith('http://') && !input.startsWith('https://') && existsSync(resolve(input))) {
        console.log(`  Uploading ${input} (Ctrl+C to cancel)`);
        const { url, size } = await uploadFile(apiKey, resolve(input), (done, total) => {
          drawTransferProgress(done, total);
        });
        process.stdout.write('\r' + ' '.repeat(70) + '\r');
        console.log(`  Uploaded: ${input} (${formatSize(size)})`);
        result.push('-i', url);
        i++;
        continue;
      }
    }

    result.push(arg);
  }

  return result;
}

async function printTaskResult(task: any): Promise<void> {
  // Accept both 'succeeded' (v2 backend) and 'completed' (older builds).
  if (task.status === 'succeeded' || task.status === 'completed') {
    console.log('  Done!\n');
    if (task.elapsed) {
      console.log(`  Execution time: ${task.elapsed}s`);
    }
    if (task.total_elapsed) {
      console.log(`  Total time: ${task.total_elapsed}s`);
    }

    if (task.outputs && task.outputs.length > 0) {
      console.log('');
      for (const output of task.outputs) {
        await downloadOutput(output);
      }
    }
  } else if (task.status === 'failed') {
    console.error(`\n  Failed: ${task.error || 'unknown error'}`);
    process.exit(1);
  } else {
    console.log(`\n  Status: ${task.status} (${task.progress}%)`);
    console.log(`  Task ID: ${task.task_id}`);
    console.log(`  Run "ffhub status ${task.task_id}" to check again`);
  }
}

/**
 * Stream a single output file to the current directory, picking a non-clashing
 * name (xxx.mp3 → xxx-2.mp3 → xxx-3.mp3 ...) so we never overwrite a paid
 * artifact the user already has. Ctrl+C aborts mid-stream — we clean the
 * partial file and remind the user how to resume manually.
 */
async function downloadOutput(output: { url: string; filename: string; size: number }): Promise<void> {
  const targetPath = resolveUniquePath(process.cwd(), output.filename);
  const displayName =
    targetPath.endsWith(output.filename) ? output.filename : `${output.filename} → ${parse(targetPath).base}`;

  console.log(`  Downloading ${displayName} (${formatSize(output.size)}, Ctrl+C to cancel)`);

  const ctrl = new AbortController();
  const onSigint = () => ctrl.abort();
  process.on('SIGINT', onSigint);

  try {
    const res = await fetch(output.url, { signal: ctrl.signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    const total = Number(res.headers.get('content-length')) || output.size || 0;
    let done = 0;

    // Hook progress drawing into the byte stream before piping to disk.
    const src = Readable.fromWeb(res.body as unknown as import('stream/web').ReadableStream<Uint8Array>);
    src.on('data', (chunk: Buffer) => {
      done += chunk.length;
      drawTransferProgress(done, total);
    });

    await pipeline(src, createWriteStream(targetPath));

    // Clear progress line, then print final state.
    process.stdout.write('\r' + ' '.repeat(70) + '\r');
    console.log(`  Saved: ${parse(targetPath).base}`);
  } catch (err: any) {
    // Always try to clean up a partial file so disk doesn't fill on repeated aborts.
    if (existsSync(targetPath)) {
      try {
        unlinkSync(targetPath);
      } catch {
        /* best effort */
      }
    }
    process.stdout.write('\r' + ' '.repeat(70) + '\r');
    if (err?.name === 'AbortError') {
      console.log(`  Cancelled. To resume manually:\n    curl -O '${output.url}'`);
      process.exit(130); // SIGINT exit code
    }
    console.error(`  Download failed: ${err?.message || err}`);
    console.error(`  You can retry manually: curl -O '${output.url}'`);
  } finally {
    process.off('SIGINT', onSigint);
  }
}

/** Pick a path in `dir` that doesn't collide with an existing file.
 * xxx.mp3 → xxx-2.mp3 → xxx-3.mp3 ... (mirrors OS Finder / Files behaviour). */
function resolveUniquePath(dir: string, filename: string): string {
  const first = join(dir, filename);
  if (!existsSync(first)) return first;
  const ext = extname(filename);
  const stem = filename.slice(0, filename.length - ext.length);
  for (let n = 2; n < 1000; n++) {
    const candidate = join(dir, `${stem}-${n}${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  // 1000+ collisions in one dir — give up nicely with a timestamp suffix.
  return join(dir, `${stem}-${Date.now()}${ext}`);
}

/** Single-line ASCII progress bar, rewritten in place. Shared by upload
 * and download since the shape (bar + bytes-done / bytes-total) is identical. */
function drawTransferProgress(done: number, total: number): void {
  const pct = total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
  const width = 24;
  const filled = total > 0 ? Math.floor((pct / 100) * width) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const totalStr = total > 0 ? formatSize(total) : '?';
  const line = `    ${bar} ${pct.toString().padStart(3)}%  ${formatSize(done)} / ${totalStr}`;
  process.stdout.write(`\r${line.padEnd(70)}`);
}

function printTaskList(tasks: any[], total: number) {
  if (tasks.length === 0) {
    console.log('\n  No tasks found.\n');
    return;
  }

  const statusIcon: Record<string, string> = {
    completed: '✓',
    failed: '✗',
    running: '►',
    pending: '○',
  };

  console.log(`\n  Recent tasks (${tasks.length} of ${total}):\n`);

  for (const task of tasks) {
    const icon = statusIcon[task.status] || ' ';
    const created = new Date(task.created_at).toLocaleString();
    console.log(`  ${icon} ${task.task_id}  ${task.status.padEnd(10)} ${String(task.progress).padStart(3)}%  ${created}`);
  }
  console.log('');
}

// ─── Update check ────────────────────────────────────────────────────────
//
// Kick off a registry lookup early in main(), await it just before exit so
// we don't add latency to the main path. Results are cached for 24h in
// ~/.ffhub/update-check.json — typical user sees one network roundtrip
// per day. All failures swallowed: this is a UX nicety, never a blocker.

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_CACHE_FILE = join(homedir(), '.ffhub', 'update-check.json');

function startUpdateCheck(currentVersion: string): Promise<string | null> {
  // Skip when stdout isn't a TTY (CI / piped output) — no humans, no prompt.
  if (!process.stdout.isTTY) return Promise.resolve(null);

  try {
    if (existsSync(UPDATE_CACHE_FILE)) {
      const cached = JSON.parse(readFileSync(UPDATE_CACHE_FILE, 'utf-8')) as {
        latest?: string;
        checkedAt?: number;
      };
      if (
        cached.latest &&
        cached.checkedAt &&
        Date.now() - cached.checkedAt < UPDATE_CHECK_INTERVAL_MS
      ) {
        return Promise.resolve(isNewer(cached.latest, currentVersion) ? cached.latest : null);
      }
    }
  } catch {
    /* corrupt cache — fall through to a fresh lookup */
  }

  return fetch('https://registry.npmjs.org/ffhub/latest', {
    headers: { Accept: 'application/json' },
  })
    .then((res) => (res.ok ? (res.json() as Promise<{ version?: string }>) : null))
    .then((data) => {
      const latest = data?.version;
      if (!latest) return null;
      try {
        mkdirSync(join(homedir(), '.ffhub'), { recursive: true });
        writeFileSync(UPDATE_CACHE_FILE, JSON.stringify({ latest, checkedAt: Date.now() }));
      } catch {
        /* best-effort */
      }
      return isNewer(latest, currentVersion) ? latest : null;
    })
    .catch(() => null); // offline / DNS / registry down — silent
}

/** Tiny semver compare for a.b.c style. Pre-release tags ignored. */
function isNewer(a: string, b: string): boolean {
  const pa = a.split('-')[0].split('.').map((x) => Number(x) || 0);
  const pb = b.split('-')[0].split('.').map((x) => Number(x) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

// Fire-and-forget at module load; awaited at the end of main().
const updateCheckPromise = startUpdateCheck(VERSION);

main()
  .then(async () => {
    const latest = await updateCheckPromise;
    if (latest) {
      console.log('');
      console.log(`  Update available: ${VERSION} → ${latest}`);
      console.log('  Run: npm install -g ffhub@latest');
    }
  })
  .catch((err) => {
    console.error(`\n  Error: ${err.message}`);
    process.exit(1);
  });
