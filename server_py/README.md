# UTone Python Backend

Este é o backend em Python para o UTone, usando FastAPI para melhor performance no processamento de áudio.

## Requisitos

- Python 3.11+
- FFmpeg instalado no sistema
- Ambiente virtual Python (recomendado)

## Instalação

1. Instale o FFmpeg:

   - Windows: `choco install ffmpeg`
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

2. Crie e ative um ambiente virtual:

```bash
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. Instale as dependências:

```bash
pip install -r requirements.txt
```

## Executando o servidor

```bash
python main.py
```

O servidor estará disponível em `http://localhost:3000`

## Endpoints

### Audio Processing

- `POST /api/audio/process`
  - Processa arquivo de áudio com mudança de tom e velocidade
  - Parâmetros:
    - `file`: Arquivo de áudio (multipart/form-data)
    - `pitch`: Mudança de tom em semitons (float)
    - `tempo`: Mudança de velocidade (float)

### YouTube

- `GET /api/youtube/search?q={query}`
  - Busca vídeos no YouTube
- `GET /api/youtube/download/{video_id}`
  - Baixa o áudio de um vídeo do YouTube

## Desenvolvimento

O backend usa:

- FastAPI para a API REST
- librosa para processamento de áudio
- yt-dlp para integração com YouTube
- FFmpeg para conversão de áudio
