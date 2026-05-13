# ffhub

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md) · **Português** · [Deutsch](README.de.md)

CLI FFmpeg na nuvem — processa arquivos de vídeo/áudio via API do [FFHub.io](https://ffhub.io). Sem instalação local do FFmpeg.

## Instalação

```bash
npm install -g ffhub
```

Ou rode direto:

```bash
npx ffhub -i https://example.com/video.mp4 -c:v libx264 output.mp4
```

## Configuração

```bash
# Salve sua API key
ffhub config YOUR_API_KEY

# Ou use uma variável de ambiente
export FFHUB_API_KEY=YOUR_API_KEY
```

Pegue sua API key em [ffhub.io](https://ffhub.io) (tem plano gratuito).

## Uso

Usa os mesmos argumentos do FFmpeg que você já conhece:

```bash
# Comprimir vídeo
ffhub -i https://example.com/video.mp4 -c:v libx264 -crf 28 output.mp4

# Converter formato
ffhub -i https://example.com/video.mov -c:v libx264 -c:a aac output.mp4

# Extrair áudio
ffhub -i https://example.com/video.mp4 -vn -c:a libmp3lame output.mp3

# Cortar vídeo
ffhub -i https://example.com/video.mp4 -ss 00:00:10 -to 00:00:30 -c copy clip.mp4

# Redimensionar para 720p
ffhub -i https://example.com/video.mp4 -vf scale=-1:720 output.mp4

# Criar GIF
ffhub -i https://example.com/video.mp4 -ss 5 -t 3 -vf "fps=10,scale=480:-1" output.gif
```

### Arquivos locais

Arquivos locais são enviados automaticamente:

```bash
ffhub -i ./my-video.mp4 -c:v libx264 output.mp4
ffhub -i ~/Downloads/recording.mov -vn output.mp3
```

### Status da tarefa

```bash
ffhub status <task_id>
```

## Como funciona

```
ffhub -i video.mp4 -c:v libx264 output.mp4
  │
  ├─ Detecta arquivo local → envia para a nuvem FFHub
  ├─ Submete comando FFmpeg para a API
  ├─ Acompanha o progresso até concluir
  └─ Retorna URL de download + info do arquivo
```

## Comandos

| Command | Descrição |
|---------|-------------|
| `ffhub [ffmpeg args]` | Submeter tarefa FFmpeg |
| `ffhub status <id>` | Status da tarefa |
| `ffhub config <key>` | Salvar API key em `~/.ffhub/config.json` |
| `ffhub config` | Mostrar API key atual |
| `ffhub help` | Mostrar ajuda |

## Requisitos

- Node.js >= 18
- API key do [FFHub.io](https://ffhub.io)

## License

MIT
