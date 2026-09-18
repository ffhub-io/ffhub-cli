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

API key gibt's auf [ffhub.io](https://ffhub.io). Bei der Registrierung gibt es einmalig 100 Credits; danach lädst du per Einmalkauf Credit-Pakete nach (kein Abo).

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

### Ergebnisdateien

Ist ein Task fertig, wird die Datei mit Fortschrittsanzeige in **das Verzeichnis gestreamt,
aus dem du den Befehl gestartet hast**. Vorhandene Dateien werden nie überschrieben: gibt es
`output.mp4` schon, landet die neue Datei als `output-2.mp4`, dann `output-3.mp4` und so
weiter. Mit Strg+C brichst du den Download ab — die unvollständige Datei wird gelöscht und
die CLI zeigt einen `curl`-Befehl, mit dem du sie später holen kannst.

### Konto und Tasks

```bash
# Aktuelles Konto und Credit-Guthaben
ffhub whoami

# Die 10 neuesten Tasks
ffhub list

# Nach Status filtern (pending, running, succeeded, failed) und Anzahl setzen
ffhub list --status=failed --limit=20

# Einzelner Task — ist er schon fertig, wird das Ergebnis erneut heruntergeladen
ffhub status <task_id>
```

## Wie es funktioniert

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ Lokale Datei erkannt → in die FFHub-Cloud hochladen
  ├─ FFmpeg-Befehl an die API senden
  ├─ Fortschritt pollen bis fertig
  └─ Ergebnisdatei ins aktuelle Verzeichnis herunterladen
```

## Befehle

| Command | Beschreibung |
|---------|-------------|
| `ffhub [ffmpeg args]` | FFmpeg-Task einreichen und Ergebnis herunterladen |
| `ffhub whoami` | Aktuelles Konto und Credit-Guthaben anzeigen |
| `ffhub list [--status=X] [--limit=N]` | Letzte Tasks auflisten (Standard: 10); `ffhub ls` ist ein Alias |
| `ffhub status <id>` | Task prüfen und fertiges Ergebnis herunterladen |
| `ffhub config <key>` | API key in `~/.ffhub/config.json` speichern |
| `ffhub config` | Aktuellen API key anzeigen (maskiert) |
| `ffhub help` | Hilfe anzeigen (`-h` / `--help` ebenfalls) |
| `ffhub --version` | CLI-Version ausgeben (`-v` ebenfalls) |

## Voraussetzungen

- Node.js >= 18
- [FFHub.io](https://ffhub.io) API key

## License

MIT
