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

API key は [ffhub.io](https://ffhub.io) で取得できます。登録時に 100 クレジットが一度だけ付与され、以降は都度購入のクレジットパックで補充します（サブスクリプションはありません）。

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

### 出力ファイル

タスクが完了すると、成果物は**コマンドを実行したディレクトリ**へ進捗バー付きでストリーミング
ダウンロードされます。既存ファイルを上書きすることはありません。`output.mp4` がすでにある
場合は `output-2.mp4`、`output-3.mp4` … という名前で保存されます。ダウンロード中に Ctrl+C
で中断でき、書きかけのファイルは削除され、あとで取得するための `curl` コマンドが表示されます。

### アカウントとタスク

```bash
# 現在のアカウントとクレジット残高
ffhub whoami

# 直近 10 件のタスク
ffhub list

# ステータス（pending / running / succeeded / failed）と件数を指定
ffhub list --status=failed --limit=20

# 単一タスクの確認。完了済みなら成果物を改めてダウンロードします
ffhub status <task_id>
```

## 仕組み

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ ローカルファイルを検出 → FFHub クラウドへアップロード
  ├─ FFmpeg コマンドを API に送信
  ├─ 完了まで進捗をポーリング
  └─ 出力ファイルをカレントディレクトリにダウンロード
```

## コマンド一覧

| Command | 説明 |
|---------|-------------|
| `ffhub [ffmpeg args]` | FFmpeg タスクを送信し、成果物をダウンロード |
| `ffhub whoami` | 現在のアカウントとクレジット残高を表示 |
| `ffhub list [--status=X] [--limit=N]` | 最近のタスクを一覧表示（デフォルト 10 件）。`ffhub ls` は別名 |
| `ffhub status <id>` | タスクの状態を確認し、完了していれば成果物をダウンロード |
| `ffhub config <key>` | API key を `~/.ffhub/config.json` に保存 |
| `ffhub config` | 現在の API key を表示（マスク済み） |
| `ffhub help` | ヘルプを表示（`-h` / `--help` も可） |
| `ffhub --version` | CLI のバージョンを表示（`-v` も可） |

## 必要要件

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
