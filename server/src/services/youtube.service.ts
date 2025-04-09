import { GetListByKeyword } from 'youtube-search-api';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable, PassThrough } from 'stream';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import youtubeDl from 'youtube-dl-exec';

// Configura o caminho do ffmpeg
const ffmpegPath = ffmpegStatic as string;
ffmpeg.setFfmpegPath(ffmpegPath);

interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
}

interface YouTubeApiResponse {
  type: string;
  id: string;
  title: string;
  thumbnail: Array<{ url: string }>;
  length?: { text: string };
  shortBylineText: string;
}

export const searchYouTube = async (query: string): Promise<YouTubeVideo[]> => {
  try {
    const results = await GetListByKeyword(query);
    return results.items
      .filter((item: YouTubeApiResponse) => item.type === 'video' && item.id)
      .map((item: YouTubeApiResponse) => ({
        id: item.id,
        title: item.title || '',
        thumbnail:
          item.thumbnail?.[0]?.url ||
          `https://i.ytimg.com/vi/${item.id}/default.jpg`,
        duration: item.length?.text || '',
        channelTitle: item.shortBylineText || '',
      }));
  } catch (error) {
    console.error('Error searching YouTube:', error);
    throw error;
  }
};

export const downloadYouTubeAudio = async (
  videoId: string
): Promise<{ stream: Readable; size: number }> => {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const tempFile = join(tmpdir(), `${videoId}.mp3`);
    const outputStream = new PassThrough();

    try {
      // Get video info first
      const info = (await youtubeDl(videoUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        preferFreeFormats: true,
        ffmpegLocation: ffmpegPath,
      })) as { duration: number };

      const estimatedSize = info?.duration
        ? Math.round((info.duration * 128 * 1000) / 8)
        : 0;

      // Download audio using youtube-dl
      await youtubeDl(videoUrl, {
        extractAudio: true,
        audioFormat: 'mp3',
        output: tempFile,
        audioQuality: 0, // Best quality
        ffmpegLocation: ffmpegPath,
      });

      // Create read stream from temp file and pipe it to output
      const fileStream = createReadStream(tempFile);
      fileStream.pipe(outputStream);

      // Handle errors and cleanup
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        outputStream.emit('error', new Error('Erro ao processar áudio'));
      });

      fileStream.on('end', async () => {
        try {
          await unlink(tempFile);
        } catch (error) {
          console.error('Error deleting temp file:', error);
        }
      });

      return { stream: outputStream, size: estimatedSize };
    } catch (error) {
      console.error('Error downloading YouTube audio:', error);
      throw new Error('Erro ao baixar áudio');
    }
  } catch (error) {
    console.error('Error in downloadYouTubeAudio:', error);
    throw new Error('Erro ao baixar áudio');
  }
};
