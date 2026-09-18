# ffhub

**English** · [中文](README.zh.md) · [日本語](README.ja.md) · [Português](README.pt.md) · [Deutsch](README.de.md)

Cloud FFmpeg CLI — process video/audio files via [FFHub.io](https://ffhub.io) API. No local FFmpeg installation required.

## Install

```bash
npm install -g ffhub
```

Or run directly:

```bash
npx ffhub -i https://example.com/video.mp4 -c:v libx264 output.mp4
```

## Setup

```bash
# Save your API key
ffhub config YOUR_API_KEY

# Or use environment variable
export FFHUB_API_KEY=YOUR_API_KEY
```

Get your API key at [ffhub.io](https://ffhub.io). Signing up grants 100 credits, once; after that you top up with one-time credit packs (no subscription).

## Usage

Use the same FFmpeg arguments you already know:

```bash
# Compress video
ffhub -i https://example.com/video.mp4 -c:v libx264 -crf 28 output.mp4

# Convert format
ffhub -i https://example.com/video.mov -c:v libx264 -c:a aac output.mp4

# Extract audio
ffhub -i https://example.com/video.mp4 -vn -c:a libmp3lame output.mp3

# Trim video
ffhub -i https://example.com/video.mp4 -ss 00:00:10 -to 00:00:30 -c copy clip.mp4

# Resize to 720p
ffhub -i https://example.com/video.mp4 -vf scale=-1:720 output.mp4

# Create GIF
ffhub -i https://example.com/video.mp4 -ss 5 -t 3 -vf "fps=10,scale=480:-1" output.gif
```

### Local Files

Local files are automatically uploaded:

```bash
ffhub -i ./my-video.mp4 -c:v libx264 output.mp4
ffhub -i ~/Downloads/recording.mov -vn output.mp3
```

### Output Files

When a task finishes, the result is streamed into the directory you ran the command from,
with a progress bar. Existing files are never overwritten — if `output.mp4` is already
there, the new file is saved as `output-2.mp4`, then `output-3.mp4`, and so on. Ctrl+C
cancels a download: the partial file is deleted and the CLI prints a `curl` command you can
use to fetch it later.

### Account and Tasks

```bash
# Current account and credit balance
ffhub whoami

# 10 most recent tasks
ffhub list

# Filter by status (pending, running, succeeded, failed) and change the count
ffhub list --status=failed --limit=20

# A single task — if it has already finished, its output is downloaded again
ffhub status <task_id>
```

## How It Works

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ Detect local file → upload to FFHub cloud
  ├─ Submit FFmpeg command to API
  ├─ Poll progress until complete
  └─ Download the output into the current directory
```

## Commands

| Command | Description |
|---------|-------------|
| `ffhub [ffmpeg args]` | Submit an FFmpeg task, then download the output |
| `ffhub whoami` | Show the current account and credit balance |
| `ffhub list [--status=X] [--limit=N]` | List recent tasks (10 by default); `ffhub ls` is an alias |
| `ffhub status <id>` | Check a task and download its output if it is ready |
| `ffhub config <key>` | Save API key to `~/.ffhub/config.json` |
| `ffhub config` | Show current API key (masked) |
| `ffhub help` | Show help (`-h` / `--help` work too) |
| `ffhub --version` | Print the CLI version (`-v` works too) |

## Requirements

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
