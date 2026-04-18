import { createReadStream, statSync } from 'fs';
import { basename } from 'path';

const API_BASE = 'https://api.ffhub.io';
const FILES_API_BASE = 'https://files-api.ffhub.io';

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

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as any).message || `创建任务失败: HTTP ${res.status}`
    );
  }

  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

/** 查询任务状态 */
export async function getTask(taskId: string): Promise<TaskResult> {
  const res = await fetch(`${API_BASE}/v1/tasks/${taskId}`);
  if (!res.ok) {
    throw new Error(`查询任务失败: HTTP ${res.status}`);
  }
  return (await res.json()) as TaskResult;
}

/** 轮询等待任务完成 */
export async function waitForTask(
  taskId: string,
  onProgress?: (progress: number, status: string) => void
): Promise<TaskResult> {
  const maxAttempts = 360; // 最多等 30 分钟
  for (let i = 0; i < maxAttempts; i++) {
    const task = await getTask(taskId);
    onProgress?.(task.progress, task.status);

    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }

    await sleep(5000);
  }
  throw new Error('任务超时（30 分钟）');
}

/** 上传本地文件 */
export async function uploadFile(
  apiKey: string,
  filePath: string
): Promise<string> {
  const filename = basename(filePath);
  const stat = statSync(filePath);
  const stream = createReadStream(filePath);

  // 构造 multipart/form-data（使用 Node.js 内置能力）
  const formData = new FormData();
  const blob = new Blob([await streamToBuffer(stream)], {
    type: 'application/octet-stream',
  });
  formData.append('file', blob, filename);

  const res = await fetch(`${FILES_API_BASE}/api/upload/file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as any).message || `上传失败: HTTP ${res.status}`
    );
  }

  const data = (await res.json()) as { url: string; size: number };
  console.log(
    `  已上传: ${filename} (${formatSize(stat.size)}) → ${data.url}`
  );
  return data.url;
}

async function streamToBuffer(
  stream: ReturnType<typeof createReadStream>
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
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

  if (!res.ok) {
    throw new Error(`Failed to list tasks: HTTP ${res.status}`);
  }

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
