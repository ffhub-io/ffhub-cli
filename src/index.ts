import { existsSync } from 'fs';
import { resolve } from 'path';
import { createTask, formatSize, getMe, getTask, listTasks, uploadFile, waitForTask } from './api.js';
import { getApiKey, loadConfig, saveConfig } from './config.js';

const VERSION = '1.2.0';

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
    const task = await getTask(args[1]);
    printTaskResult(task);
    return;
  }

  // ffhub [ffmpeg args] — 提交任务
  const apiKey = requireApiKey();

  // 构建 FFmpeg 命令，处理本地文件上传
  const processedArgs = await processArgs(apiKey, args);
  const command = 'ffmpeg ' + processedArgs.join(' ');

  console.log(`\n  Command: ${command}\n`);

  // 创建任务
  const taskId = await createTask(apiKey, command);
  console.log(`  Task created: ${taskId}`);
  console.log('  Processing...\n');

  // 等待完成
  let lastProgress = -1;
  const task = await waitForTask(taskId, (progress, status) => {
    if (progress !== lastProgress) {
      lastProgress = progress;
      process.stdout.write(`\r  Progress: ${progress}% [${status}]`);
    }
  });

  console.log('');
  printTaskResult(task);
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

/** 处理参数：检测本地文件并上传 */
async function processArgs(apiKey: string, args: string[]): Promise<string[]> {
  const result: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // 检查 -i 后面的参数是否是本地文件
    if (arg === '-i' && i + 1 < args.length) {
      const input = args[i + 1];
      if (!input.startsWith('http://') && !input.startsWith('https://') && existsSync(resolve(input))) {
        console.log(`  Local file detected: ${input}, uploading...`);
        const url = await uploadFile(apiKey, resolve(input));
        result.push('-i', url);
        i++;
        continue;
      }
    }

    result.push(arg);
  }

  return result;
}

function printTaskResult(task: any) {
  if (task.status === 'completed') {
    console.log('  Done!\n');
    if (task.outputs && task.outputs.length > 0) {
      for (const output of task.outputs) {
        console.log(`  ${output.filename}`);
        console.log(`    URL:  ${output.url}`);
        console.log(`    Size: ${formatSize(output.size)}`);
        console.log('');
      }
    }
    if (task.elapsed) {
      console.log(`  Execution time: ${task.elapsed}s`);
    }
    if (task.total_elapsed) {
      console.log(`  Total time: ${task.total_elapsed}s`);
    }

    // 下载提示
    console.log('');
    console.log('  Download:');
    if (process.platform === 'win32') {
      console.log('    curl -O <url>');
      console.log('    Invoke-WebRequest -Uri <url> -OutFile <filename>');
    } else {
      console.log('    curl -O <url>');
      console.log('    wget <url>');
    }
    console.log('    or open the URL in your browser');
  } else if (task.status === 'failed') {
    console.error(`\n  Failed: ${task.error || 'unknown error'}`);
    process.exit(1);
  } else {
    console.log(`\n  Status: ${task.status} (${task.progress}%)`);
    console.log(`  Task ID: ${task.task_id}`);
    console.log(`  Run "ffhub status ${task.task_id}" to check again`);
  }
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

main().catch((err) => {
  console.error(`\n  Error: ${err.message}`);
  process.exit(1);
});
