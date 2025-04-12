import { Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import WaveSurfer from 'wavesurfer.js';
import { ToastService } from './toast.service';
import { HttpClient } from '@angular/common/http';

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  pitch: number;
  tempo: number;
  volume: number;
}

@Injectable({
  providedIn: 'root',
})
export class AudioProcessorService {
  private wavesurfer: WaveSurfer | null = null;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private currentAudioBlob: Blob | null = null;

  // Signals for reactive state management
  private audioStateSignal = signal<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    pitch: 0,
    tempo: 1,
    volume: 1,
  });

  // Exposed signals as readonly
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly pitch = signal(0);
  readonly tempo = signal(1);
  readonly volume = signal(1);
  readonly isProcessingPitch = signal(false);

  constructor(private toast: ToastService, private http: HttpClient) {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Error initializing AudioContext:', error);
      this.toast.error('Seu navegador não suporta Web Audio API');
    }
  }

  initWaveSurfer(container: HTMLElement) {
    if (!container) {
      console.error('Container element not found');
      return;
    }

    try {
      console.log('Starting WaveSurfer initialization...');

      if (this.wavesurfer) {
        console.log('Destroying existing WaveSurfer instance');
        this.wavesurfer.destroy();
      }

      this.wavesurfer = WaveSurfer.create({
        container,
        waveColor: '#4a4a4a',
        progressColor: '#7c4dff',
        cursorColor: '#7c4dff',
        height: 100,
        barWidth: 2,
        barGap: 1,
        normalize: true,
      });

      console.log('WaveSurfer instance created');
      this.setupWaveSurferEvents();
      this.isInitialized = true;
      console.log('WaveSurfer initialization complete');
    } catch (error) {
      console.error('Error initializing WaveSurfer:', error);
      this.toast.error('Erro ao inicializar o visualizador de áudio');
    }
  }

  private setupWaveSurferEvents() {
    if (!this.wavesurfer) {
      console.error('WaveSurfer not initialized');
      return;
    }

    this.wavesurfer.on('ready', () => {
      this.duration.set(this.wavesurfer?.getDuration() || 0);
      console.log('WaveSurfer ready, duration:', this.duration());
    });

    this.wavesurfer.on('audioprocess', (time: number) => {
      this.currentTime.set(time);
    });

    this.wavesurfer.on('play', () => {
      this.isPlaying.set(true);
      console.log('Audio playing');
    });

    this.wavesurfer.on('pause', () => {
      this.isPlaying.set(false);
      console.log('Audio paused');
    });

    this.wavesurfer.on('finish', () => {
      this.isPlaying.set(false);
      console.log('Audio finished');
    });

    this.wavesurfer.on('error', (error) => {
      console.error('WaveSurfer error:', error);
      this.toast.error('Erro ao processar áudio');
    });
  }

  async loadFile(file: File) {
    if (!this.wavesurfer) {
      console.error('WaveSurfer not initialized');
      return;
    }

    try {
      // Store the original audio file
      this.currentAudioBlob = file;

      // Load into wavesurfer
      await this.wavesurfer.loadBlob(file);

      // Reset audio state
      this.pitch.set(0);
      this.tempo.set(1);
      this.volume.set(1);
    } catch (error) {
      console.error('Error loading file:', error);
      this.toast.error('Erro ao carregar arquivo');
    }
  }

  play() {
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }
    this.wavesurfer.play();
  }

  pause() {
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }
    this.wavesurfer.pause();
  }

  stop() {
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }
    this.wavesurfer.stop();
    this.currentTime.set(0);
  }

  async setPitch(semitones: number) {
    if (!this.isInitialized || !this.wavesurfer || !this.currentAudioBlob) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }

    this.isProcessingPitch.set(true);
    const wasPlaying = this.isPlaying();
    if (wasPlaying) {
      this.pause();
    }

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', this.currentAudioBlob);
      formData.append('pitch', semitones.toString());
      formData.append('tempo', this.tempo().toString());

      // Send to backend
      const response = await this.http
        .post('http://localhost:3000/api/audio/process', formData, {
          responseType: 'blob',
        })
        .toPromise();

      if (response) {
        await this.wavesurfer?.loadBlob(response);
        this.pitch.set(semitones);

        if (wasPlaying) {
          this.play();
        }
      } else {
        this.toast.error('Resposta inválida do servidor ao ajustar o tom');
      }
    } catch (error: any) {
      console.error('Error setting pitch:', error);
      const errorDetail = error?.message || 'Erro desconhecido';
      this.toast.error(`Erro ao ajustar o tom: ${errorDetail}`);
    } finally {
      this.isProcessingPitch.set(false);
    }
  }

  setTempo(rate: number) {
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }

    try {
      const currentPitch = this.pitch();
      const pitchRate = Math.pow(2, currentPitch / 12);
      this.wavesurfer.setPlaybackRate(rate * pitchRate);
      this.tempo.set(rate);
      console.log('Tempo set to:', rate);
    } catch (error) {
      console.error('Error setting tempo:', error);
      this.toast.error('Erro ao ajustar o andamento');
    }
  }

  setVolume(level: number) {
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }

    try {
      this.wavesurfer.setVolume(level);
      this.volume.set(level);
    } catch (error) {
      console.error('Error setting volume:', error);
      this.toast.error('Erro ao ajustar o volume');
    }
  }

  destroy() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
      this.isInitialized = false;
    }
  }

  // Public method to check initialization status
  isWaveSurferInitialized(): boolean {
    return this.isInitialized;
  }
}
