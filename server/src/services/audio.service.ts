import ffmpeg from 'fluent-ffmpeg';
import { SoundTouch } from 'soundtouch-ts';
import { Readable } from 'stream';

// Converte AudioBuffer para formato interleaved (intercalado)
function asInterleaved(audioBuffer: AudioBuffer): Float32Array {
  const channels = audioBuffer.numberOfChannels;
  const output = new Float32Array(channels * audioBuffer.length);
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const chan = audioBuffer.getChannelData(c);
      output[i * channels + c] = chan[i];
    }
  }
  return output;
}

// Converte formato interleaved para AudioBuffer
function asPlanar(
  buffer: Float32Array,
  sampleRate: number,
  channels: number = 2
): AudioBuffer {
  const channelLength = Math.floor(buffer.length / channels);
  const output = new AudioBuffer({
    numberOfChannels: channels,
    length: channelLength,
    sampleRate: sampleRate,
  });

  for (let c = 0; c < channels; c++) {
    const chan = output.getChannelData(c);
    for (let i = 0; i < channelLength; i++) {
      chan[i] = buffer[i * channels + c];
    }
  }

  return output;
}

export const processAudioFile = async (
  audioBuffer: Buffer,
  pitch: number,
  tempo: number
): Promise<Buffer> => {
  try {
    // Primeiro, converte o áudio para o formato adequado usando ffmpeg
    const convertedBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const readableStream = new Readable();
      readableStream.push(audioBuffer);
      readableStream.push(null);

      const command = ffmpeg(readableStream)
        .toFormat('wav')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', () => {
          const finalBuffer = Buffer.concat(chunks);
          resolve(finalBuffer);
        })
        .on('error', reject);

      // Captura os dados do output
      const stream = command.pipe();
      stream.on('data', (chunk) => chunks.push(chunk));
    });

    // Pula o cabeçalho WAV (44 bytes) e converte para Float32Array
    const audioData = new Float32Array(
      new Float64Array(convertedBuffer.buffer, 44)
    );

    // Aplica as alterações de tom e velocidade usando SoundTouch
    const soundTouch = new SoundTouch(44100); // Taxa de amostragem padrão
    soundTouch.pitch = pitch;
    soundTouch.tempo = tempo;

    // Coloca os dados no buffer de entrada
    soundTouch.inputBuffer.putSamples(audioData);

    // Processa o áudio
    soundTouch.process();

    // Prepara o buffer de saída
    const outputBuffer = new Float32Array(Math.ceil(audioData.length / tempo));
    let receivedSamples = 0;

    // Recebe os dados processados
    while (soundTouch.outputBuffer.frameCount) {
      const queued = soundTouch.outputBuffer.frameCount;
      soundTouch.process();
      soundTouch.outputBuffer.receiveSamples(
        outputBuffer.subarray(receivedSamples),
        256
      );
      const remaining = soundTouch.outputBuffer.frameCount;
      receivedSamples = (queued - remaining) * 2; // 2 canais
    }

    // Converte Float32Array de volta para Buffer
    const processedBuffer = Buffer.from(outputBuffer.buffer);

    // Converte de volta para MP3
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      const readableStream = new Readable();
      readableStream.push(processedBuffer);
      readableStream.push(null);

      const command = ffmpeg(readableStream)
        .toFormat('mp3')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('end', () => {
          const finalBuffer = Buffer.concat(chunks);
          resolve(finalBuffer);
        })
        .on('error', reject);

      // Captura os dados do output
      const stream = command.pipe();
      stream.on('data', (chunk) => chunks.push(chunk));
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
};
