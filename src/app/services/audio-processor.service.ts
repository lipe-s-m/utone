import { Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import WaveSurfer from 'wavesurfer.js';
import { ToastService } from './toast.service';

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

  constructor(private toast: ToastService) {
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
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }

    try {
      console.log('Loading audio file:', file.name);
      const url = URL.createObjectURL(file);
      await this.wavesurfer.load(url);
      URL.revokeObjectURL(url);
      this.toast.success('Áudio carregado com sucesso');
    } catch (error) {
      console.error('Error loading audio file:', error);
      this.toast.error('Erro ao carregar o arquivo de áudio');
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

  setPitch(semitones: number) {
    if (!this.isInitialized || !this.wavesurfer) {
      this.toast.error('Player de áudio não inicializado');
      return;
    }

    try {
      // Convert semitones to pitch rate
      const pitchRate = Math.pow(2, semitones / 12);
      const currentTempo = this.tempo();
      this.wavesurfer.setPlaybackRate(pitchRate * currentTempo);
      this.pitch.set(semitones);
      console.log('Pitch set to:', semitones, 'Rate:', pitchRate);
    } catch (error) {
      console.error('Error setting pitch:', error);
      this.toast.error('Erro ao ajustar o tom');
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
