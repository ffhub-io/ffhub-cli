# ffhub

[English](README.md) · **中文** · [日本語](README.ja.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

云端 FFmpeg CLI — 通过 [FFHub.io](https://ffhub.io) API 处理视频/音频文件，无需本地安装 FFmpeg。

## 安装

```bash
npm install -g ffhub
```

或直接运行：

```bash
npx ffhub -i https://example.com/video.mp4 -c:v libx264 output.mp4
```

## 配置

```bash
# 保存 API key
ffhub config YOUR_API_KEY

# 或用环境变量
export FFHUB_API_KEY=YOUR_API_KEY
```

在 [ffhub.io](https://ffhub.io) 注册即可拿到 API key（有免费额度）。

## 用法

参数和 FFmpeg 完全一致：

```bash
# 压缩视频
ffhub -i https://example.com/video.mp4 -c:v libx264 -crf 28 output.mp4

# 格式转换
ffhub -i https://example.com/video.mov -c:v libx264 -c:a aac output.mp4

# 提取音频
ffhub -i https://example.com/video.mp4 -vn -c:a libmp3lame output.mp3

# 剪辑视频
ffhub -i https://example.com/video.mp4 -ss 00:00:10 -to 00:00:30 -c copy clip.mp4

# 缩放到 720p
ffhub -i https://example.com/video.mp4 -vf scale=-1:720 output.mp4

# 生成 GIF
ffhub -i https://example.com/video.mp4 -ss 5 -t 3 -vf "fps=10,scale=480:-1" output.gif
```

### 本地文件

本地文件会自动上传：

```bash
ffhub -i ./my-video.mp4 -c:v libx264 output.mp4
ffhub -i ~/Downloads/recording.mov -vn output.mp3
```

### 查询任务状态

```bash
ffhub status <task_id>
```

## 工作流程

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ 检测到本地文件 → 上传到 FFHub 云端
  ├─ 提交 FFmpeg 命令到 API
  ├─ 轮询进度直到完成
  └─ 返回下载 URL + 文件信息
```

## 命令一览

| 命令 | 说明 |
|---------|-------------|
| `ffhub [ffmpeg args]` | 提交 FFmpeg 任务 |
| `ffhub status <id>` | 查询任务状态 |
| `ffhub config <key>` | 把 API key 存到 `~/.ffhub/config.json` |
| `ffhub config` | 显示当前 API key |
| `ffhub help` | 查看帮助 |

## 环境要求

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
