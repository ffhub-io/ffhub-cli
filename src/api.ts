import { createReadStream, statSync } from 'fs';
import { basename } from 'path';

const API_BASE = 'https://api.ffhub.io';

/** 统一 HTTP 错误处理 —— 401 单独识别（API key 失效），其他状态从 huma
 * 返回的 RFC 7807 body 取 detail（具体原因）/ title（通用名），都没有时
 * 才回落到 HTTP 状态码。成功时不消费 body，调用方可继续 res.json()。 */
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
    /* body 不是 JSON 也吞掉 */
  }
  // huma (RFC 7807): detail = 具体原因 ("invalid ffmpeg command: missing input")
  // title  = 通用名 ("Bad Request")
  // message 是早期版本字段，兼容保留。
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

/** 创建任务 */
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

/** 查询任务状态。GET /v1/tasks/{id} 需要 Bearer token（且只能查自己的任务）。 */
export async function getTask(apiKey: string, taskId: string): Promise<TaskResult> {
  const res = await fetch(`${API_BASE}/v1/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await ensureOk(res, 'Failed to get task');
  return (await res.json()) as TaskResult;
}

/** 轮询等待任务完成 */
export async function waitForTask(
  apiKey: string,
  taskId: string,
  onProgress?: (progress: number, status: string) => void
): Promise<TaskResult> {
  const maxAttempts = 360; // 最多等 30 分钟
  for (let i = 0; i < maxAttempts; i++) {
    const task = await getTask(apiKey, taskId);
    onProgress?.(task.progress, task.status);

    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }

    await sleep(5000);
  }
  throw new Error('Task timed out (30 min)');
}

/** 上传本地文件
 *
 * 两步流程：
 *   1. POST /v1/uploads/sign 拿一次性 presigned PUT URL
 *   2. fetch PUT 直传 R2，body 是 Node Readable stream，文件不全部进内存
 *
 * 替代了老的 files-api.ffhub.io multipart 路径，那条路径在 Cloudflare
 * Workers 上有 500MB body / 128MB 内存上限。新路径上限是 R2 单 PUT 5GB。
 */
export async function uploadFile(
  apiKey: string,
  filePath: string
): Promise<string> {
  const filename = basename(filePath);
  const stat = statSync(filePath);
  const contentType = inferContentType(filename);

  // 1. 签名
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

  // 2. PUT 直传 R2。Node 18+ fetch 接受 ReadableStream body，不会 buffer 全文件。
  const putRes = await fetch(signed.upload_url, {
    method: 'PUT',
    // Content-Type 必须跟签名时一致，R2 才认。
    headers: {
      'Content-Type': signed.content_type,
      'Content-Length': String(stat.size),
    },
    body: createReadStream(filePath) as unknown as BodyInit,
    // streaming body 需要显式声明 duplex（HTTP 标准要求，Node fetch 跟随）
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  if (!putRes.ok) {
    throw new Error(`Upload failed: HTTP ${putRes.status}`);
  }

  console.log(
    `  已上传: ${filename} (${formatSize(stat.size)}) → ${signed.public_url}`
  );
  return signed.public_url;
}

// 粗糙的扩展名 → mime 映射。漏掉的回落到 application/octet-stream，R2 接受。
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

/** 获取当前用户信息 */
export async function getMe(apiKey: string): Promise<{ user_id: string; email: string; remaining_credits: number }> {
  const res = await fetch(`${API_BASE}/v1/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await ensureOk(res, 'Failed to get user info');
  return (await res.json()) as { user_id: string; email: string; remaining_credits: number };
}

/** 查询任务列表 */
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
