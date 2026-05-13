# ffhub

[English](README.md) · [中文](README.zh.md) · **日本語** · [Português](README.pt.md) · [Deutsch](README.de.md)

クラウド FFmpeg CLI — [FFHub.io](https://ffhub.io) API 経由で動画/音声ファイルを処理。ローカルに FFmpeg をインストールする必要なし。

## インストール

```bash
npm install -g ffhub
```

または直接実行:

```bash
npx ffhub -i https://example.com/video.mp4 -c:v libx264 output.mp4
```

## セットアップ

```bash
# API key を保存
ffhub config YOUR_API_KEY

# または環境変数で指定
export FFHUB_API_KEY=YOUR_API_KEY
```

API key は [ffhub.io](https://ffhub.io) で取得（無料枠あり）。

## 使い方

FFmpeg と同じ引数をそのまま使えます:

```bash
# 動画を圧縮
ffhub -i https://example.com/video.mp4 -c:v libx264 -crf 28 output.mp4

# フォーマット変換
ffhub -i https://example.com/video.mov -c:v libx264 -c:a aac output.mp4

# 音声を抽出
ffhub -i https://example.com/video.mp4 -vn -c:a libmp3lame output.mp3

# 動画をカット
ffhub -i https://example.com/video.mp4 -ss 00:00:10 -to 00:00:30 -c copy clip.mp4

# 720p にリサイズ
ffhub -i https://example.com/video.mp4 -vf scale=-1:720 output.mp4

# GIF を作成
ffhub -i https://example.com/video.mp4 -ss 5 -t 3 -vf "fps=10,scale=480:-1" output.gif
```

### ローカルファイル

ローカルファイルは自動でアップロードされます:

```bash
ffhub -i ./my-video.mp4 -c:v libx264 output.mp4
ffhub -i ~/Downloads/recording.mov -vn output.mp3
```

### タスクの状態確認

```bash
ffhub status <task_id>
```

## 仕組み

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ ローカルファイルを検出 → FFHub クラウドへアップロード
  ├─ FFmpeg コマンドを API に送信
  ├─ 完了まで進捗をポーリング
  └─ ダウンロード URL + ファイル情報を返却
```

## コマンド一覧

| Command | 説明 |
|---------|-------------|
| `ffhub [ffmpeg args]` | FFmpeg タスクを送信 |
| `ffhub status <id>` | タスクの状態を確認 |
| `ffhub config <key>` | API key を `~/.ffhub/config.json` に保存 |
| `ffhub config` | 現在の API key を表示 |
| `ffhub help` | ヘルプを表示 |

## 必要要件

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
