import { Request, Response } from 'express';
import { Readable } from 'stream';
import {
  searchYouTube,
  downloadYouTubeAudio,
} from '../services/youtube.service';

export const searchVideos = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: 'Missing query parameter' });
      return;
    }

    const videos = await searchYouTube(query);
    res.json(videos);
  } catch (error) {
    console.error('Error searching videos:', error);
    res.status(500).json({
      error: 'Erro ao buscar vídeos',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
};

export const downloadVideo = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      res.status(400).json({ error: 'ID do vídeo é obrigatório' });
      return;
    }

    const { stream: audioStream, size } = await downloadYouTubeAudio(videoId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${videoId}.mp3"`
    );
    res.setHeader('Content-Length', size);
    res.setHeader('Transfer-Encoding', 'chunked');

    // Configura timeout mais longo para downloads grandes
    res.setTimeout(300000); // 5 minutos

    let bytesDownloaded = 0;

    audioStream.on('data', (chunk) => {
      bytesDownloaded += chunk.length;
      const progress = Math.round((bytesDownloaded / size) * 100);
      // Envia o progresso como um evento SSE
      res.write(`event: progress\ndata: ${progress}\n\n`);
    });

    audioStream.on('error', (error: Error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Erro ao processar áudio',
          details: error.message,
        });
      }
    });

    audioStream.pipe(res);

    // Limpa o timeout quando o download terminar
    res.on('finish', () => {
      console.log('Download completed');
      res.setTimeout(0);
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erro ao baixar vídeo',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }
};
