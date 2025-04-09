import { Response } from 'express';
import { Request } from 'express-serve-static-core';
import multer from 'multer';
import { processAudioFile } from '../services/audio.service';

interface AudioProcessRequest extends Request {
  file?: Express.Multer.File;
}

export const processAudio = async (
  req: AudioProcessRequest,
  res: Response
): Promise<void> => {
  try {
    const { pitch, tempo } = req.body;
    if (!req.file) {
      res.status(400).json({ error: 'Audio file is required' });
      return;
    }

    const processedAudio = await processAudioFile(
      req.file.buffer,
      pitch,
      tempo
    );
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(processedAudio);
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
};
