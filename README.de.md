# ffhub

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Português](README.pt.md) · **Deutsch**

Cloud-FFmpeg-CLI — verarbeitet Video-/Audiodateien über die [FFHub.io](https://ffhub.io) API. Keine lokale FFmpeg-Installation nötig.

## Installation

```bash
npm install -g ffhub
```

Oder direkt ausführen:

```bash
npx ffhub -i https://example.com/video.mp4 -c:v libx264 output.mp4
```

## Einrichtung

```bash
# API key speichern
ffhub config YOUR_API_KEY

# Oder per Umgebungsvariable
export FFHUB_API_KEY=YOUR_API_KEY
```

API key gibt's auf [ffhub.io](https://ffhub.io) (kostenloses Kontingent verfügbar).

## Verwendung

Nimm dieselben FFmpeg-Argumente, die du schon kennst:

```bash
# Video komprimieren
ffhub -i https://example.com/video.mp4 -c:v libx264 -crf 28 output.mp4

# Format konvertieren
ffhub -i https://example.com/video.mov -c:v libx264 -c:a aac output.mp4

# Audio extrahieren
ffhub -i https://example.com/video.mp4 -vn -c:a libmp3lame output.mp3

# Video schneiden
ffhub -i https://example.com/video.mp4 -ss 00:00:10 -to 00:00:30 -c copy clip.mp4

# Auf 720p skalieren
ffhub -i https://example.com/video.mp4 -vf scale=-1:720 output.mp4

# GIF erstellen
ffhub -i https://example.com/video.mp4 -ss 5 -t 3 -vf "fps=10,scale=480:-1" output.gif
```

### Lokale Dateien

Lokale Dateien werden automatisch hochgeladen:

```bash
ffhub -i ./my-video.mp4 -c:v libx264 output.mp4
ffhub -i ~/Downloads/recording.mov -vn output.mp3
```

### Task-Status prüfen

```bash
ffhub status <task_id>
```

## Wie es funktioniert

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ Lokale Datei erkannt → in die FFHub-Cloud hochladen
  ├─ FFmpeg-Befehl an die API senden
  ├─ Fortschritt pollen bis fertig
  └─ Download-URL + Datei-Info zurückgeben
```

## Befehle

| Command | Beschreibung |
|---------|-------------|
| `ffhub [ffmpeg args]` | FFmpeg-Task einreichen |
| `ffhub status <id>` | Task-Status prüfen |
| `ffhub config <key>` | API key in `~/.ffhub/config.json` speichern |
| `ffhub config` | Aktuelle API key anzeigen |
| `ffhub help` | Hilfe anzeigen |

## Voraussetzungen

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
