# ffhub

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

Get your API key at [ffhub.io](https://ffhub.io) (free tier available).

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

### Check Task Status

```bash
ffhub status <task_id>
```

## How It Works

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ Detect local file → upload to FFHub cloud
  ├─ Submit FFmpeg command to API
  ├─ Poll progress until complete
  └─ Return download URL + file info
```

## Commands

| Command | Description |
|---------|-------------|
| `ffhub [ffmpeg args]` | Submit an FFmpeg task |
| `ffhub status <id>` | Check task status |
| `ffhub config <key>` | Save API key to `~/.ffhub/config.json` |
| `ffhub config` | Show current API key |
| `ffhub help` | Show help |

## Requirements

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
