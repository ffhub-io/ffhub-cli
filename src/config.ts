import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.ffhub');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  api_key?: string;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveConfig(config: Config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

/** 获取 API Key：环境变量优先，其次配置文件 */
export function getApiKey(): string | undefined {
  return process.env.FFHUB_API_KEY || loadConfig().api_key;
}
