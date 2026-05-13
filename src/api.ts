import { createReadStream, statSync } from 'fs';
import { basename } from 'path';

const API_BASE = 'https://api.ffhub.io';

/** Unified HTTP error handler. 401 is reported with a hint about the API key;
 * other statuses read RFC 7807 fields from the body (detail → specific cause,
 * title → generic name), falling back to the HTTP status code if neither is
 * present. Body is only consumed on error, so callers can still res.json()
 * on success. */
async function ensureOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) {
    throw new Error(
      'API key invalid or revoked. Create a new one at https://www.ffhub.io/dashboard/api-keys, then run `ffhub config <api_key>`.'
    );
  }
  let body: { detail?: string; title?: string; message?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* body wasn't JSON — swallow */
  }
  // huma (RFC 7807): detail = specific reason ("invalid ffmpeg command: missing input")
  //                  title  = generic name ("Bad Request")
  // `message` is kept for backward compatibility with older server versions.
  const reason = body.detail || body.message || body.title;
  throw new Error(reason ? `${action}: ${reason}` : `${action}: HTTP ${res.status}`);
}

export interface TaskResult {
  task_id: string;
  status: string;
  progress: number;
  outputs: { url: string; filename: string; size: number }[];
  error?: string;
  created_at: string;
  finished_at?: string;
  total_elapsed?: string;
  elapsed?: string;
}

/** Create a task. */
export async function createTask(
  apiKey: string,
  command: string,
  withMetadata = false
): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, with_metadata: withMetadata }),
  });
  await ensureOk(res, 'Failed to create task');

  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

/** Fetch task status. GET /v1/tasks/{id} requires a Bearer token and only
 * returns tasks owned by the caller. */
export async function getTask(apiKey: string, taskId: string): Promise<TaskResult> {
  const res = await fetch(`${API_BASE}/v1/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await ensureOk(res, 'Failed to get task');
  return (await res.json()) as TaskResult;
}

/** Poll until the task reaches a terminal state. */
export async function waitForTask(
  apiKey: string,
  taskId: string,
  onProgress?: (progress: number, status: string) => void
): Promise<TaskResult> {
  const maxAttempts = 360; // 30 min max wait
  for (let i = 0; i < maxAttempts; i++) {
    const task = await getTask(apiKey, taskId);
    onProgress?.(task.progress, task.status);

    // Backend uses 'succeeded' since v2 (older builds returned 'completed');
    // accept both so we don't hang forever waiting for a status that will
    // never come.
    if (task.status === 'succeeded' || task.status === 'completed' || task.status === 'failed') {
      return task;
    }

    await sleep(5000);
  }
  throw new Error('Task timed out (30 min)');
}

/** Upload a local file.
 *
 * Two-step flow:
 *   1. POST /v1/uploads/sign to get a one-time presigned PUT URL.
 *   2. PUT directly to R2 using a Node Readable stream so the file body
 *      never lives in memory all at once.
 *
 * Replaces the old files-api.ffhub.io multipart path, which had 500 MB body
 * / 128 MB memory caps on Cloudflare Workers. R2 single-PUT cap is 5 GB.
 */
export async function uploadFile(
  apiKey: string,
  filePath: string
): Promise<string> {
  const filename = basename(filePath);
  const stat = statSync(filePath);
  const contentType = inferContentType(filename);

  // 1. Sign
  const signRes = await fetch(`${API_BASE}/v1/uploads/sign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      size: stat.size,
      content_type: contentType,
    }),
  });
  await ensureOk(signRes, 'Failed to sign upload');
  const signed = (await signRes.json()) as {
    upload_url: string;
    public_url: string;
    content_type: string;
  };

  // 2. PUT direct to R2. Node 18+ fetch accepts a ReadableStream body, so
  //    the file isn't buffered into memory.
  const putRes = await fetch(signed.upload_url, {
    method: 'PUT',
    // Content-Type must match what we signed with — R2 rejects mismatches.
    headers: {
      'Content-Type': signed.content_type,
      'Content-Length': String(stat.size),
    },
    body: createReadStream(filePath) as unknown as BodyInit,
    // streaming body requires an explicit duplex setting (HTTP spec; Node
    // fetch follows).
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  if (!putRes.ok) {
    throw new Error(`Upload failed: HTTP ${putRes.status}`);
  }

  console.log(
    `  Uploaded: ${filename} (${formatSize(stat.size)}) → ${signed.public_url}`
  );
  return signed.public_url;
}

// Rough ext → mime map. Anything missing falls back to application/octet-stream,
// which R2 accepts.
function inferContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    flv: 'video/x-flv',
    m4v: 'video/x-m4v',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    opus: 'audio/opus',
    ogg: 'audio/ogg',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Fetch the current user's info. */
export async function getMe(apiKey: string): Promise<{ user_id: string; email: string; remaining_credits: number }> {
  const res = await fetch(`${API_BASE}/v1/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await ensureOk(res, 'Failed to get user info');
  return (await res.json()) as { user_id: string; email: string; remaining_credits: number };
}

/** List the current user's tasks. */
export async function listTasks(
  apiKey: string,
  limit = 10,
  status?: string
): Promise<{ total: number; tasks: TaskResult[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set('status', status);

  const res = await fetch(`${API_BASE}/v1/tasks?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await ensureOk(res, 'Failed to list tasks');
  return (await res.json()) as { total: number; tasks: TaskResult[] };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
