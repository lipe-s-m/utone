import {
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  signal,
  EventEmitter,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import WaveSurfer from 'wavesurfer.js';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-audio-recorder',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="audio-recorder" role="region" aria-label="Gravador de áudio">
      <button
        mat-raised-button
        color="primary"
        (click)="toggleRecording()"
        [disabled]="isProcessing()"
      >
        <mat-icon>{{ isRecording() ? 'stop' : 'mic' }}</mat-icon>
        {{ isRecording() ? 'Parar Gravação' : 'Gravar Voz' }}
      </button>

      <div class="recording-indicator" *ngIf="isRecording()">
        <div class="wave"></div>
        <div class="wave"></div>
        <div class="wave"></div>
        <span class="time">{{ recordingTime() }}</span>
      </div>

      <div #waveform class="waveform-container"></div>

      <div class="playback-controls" *ngIf="hasRecording()">
        <div class="time-display">
          <span>{{ currentTime() }}</span>
          <span>/</span>
          <span>{{ totalDuration() }}</span>
        </div>
        <div class="buttons">
          <button mat-icon-button color="primary" (click)="togglePlayPause()">
            <mat-icon>{{ isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
          </button>
          <button mat-icon-button color="warn" (click)="stop()">
            <mat-icon>stop</mat-icon>
          </button>
        </div>
      </div>

      <div class="processing-overlay" *ngIf="isProcessing()">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Processando áudio...</p>
      </div>
    </div>
  `,
  styles: [
    `
      .audio-recorder {
        padding: 2rem;
        background: #2a2a2a;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        position: relative;
        min-height: 100px;
      }

      .recording-indicator {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .wave {
        width: 4px;
        height: 20px;
        background: #7c4dff;
        animation: wave 1s ease-in-out infinite;
        border-radius: 2px;

        &:nth-child(2) {
          animation-delay: 0.2s;
        }

        &:nth-child(3) {
          animation-delay: 0.4s;
        }
      }

      @keyframes wave {
        0%,
        100% {
          height: 20px;
        }
        50% {
          height: 40px;
        }
      }

      .time {
        color: #888;
        font-family: monospace;
        font-size: 1.1rem;
      }

      .waveform-container {
        width: 100%;
        height: 128px;
        background: #1a1a1a;
        border-radius: 4px;
      }

      .playback-controls {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1rem;
      }

      .time-display {
        font-family: monospace;
        font-size: 1rem;
        color: #888;
        display: flex;
        gap: 0.5rem;
      }

      .buttons {
        display: flex;
        gap: 1rem;
      }

      .processing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(42, 42, 42, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        border-radius: 8px;

        p {
          color: white;
          margin: 0;
        }
      }
    `,
  ],
})
export class AudioRecorderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('waveform') waveformElement!: ElementRef;
  @Output() audioRecorded = new EventEmitter<string>();

  private wavesurfer: WaveSurfer | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private timer: any;
  private updateTimer: any;

  // Signals
  readonly isRecording = signal(false);
  readonly hasRecording = signal(false);
  readonly isPlaying = signal(false);
  readonly duration = signal(0);
  readonly currentTime = signal('00:00');
  readonly totalDuration = signal('00:00');
  readonly isProcessing = signal(false);
  readonly recordingTime = signal('00:00');

  constructor(private toast: ToastService) {}

  ngAfterViewInit() {
    this.initWaveSurfer();
    this.setupRecordingTimer();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private initWaveSurfer() {
    if (this.waveformElement) {
      this.wavesurfer = WaveSurfer.create({
        container: this.waveformElement.nativeElement,
        waveColor: '#4a4a4a',
        progressColor: '#7c4dff',
        cursorColor: '#7c4dff',
        barWidth: 2,
        barGap: 1,
        height: 128,
        normalize: true,
      });

      // Atualiza o estado de reprodução quando o áudio termina
      this.wavesurfer.on('finish', () => {
        this.isPlaying.set(false);
        this.currentTime.set(this.totalDuration());
      });

      // Atualiza o estado de reprodução quando o áudio é pausado
      this.wavesurfer.on('pause', () => {
        this.isPlaying.set(false);
        this.stopTimeUpdate();
      });

      // Atualiza o estado de reprodução quando o áudio começa a tocar
      this.wavesurfer.on('play', () => {
        this.isPlaying.set(true);
        this.startTimeUpdate();
      });

      // Atualiza a duração total quando o áudio é carregado
      this.wavesurfer.on('ready', () => {
        if (this.wavesurfer) {
          const duration = this.wavesurfer.getDuration();
          this.totalDuration.set(this.formatDuration(duration * 1000));
          this.currentTime.set('00:00');
        }
      });
    }
  }

  private startTimeUpdate() {
    this.stopTimeUpdate(); // Limpa o timer anterior se existir
    this.updateTimer = setInterval(() => {
      if (this.wavesurfer) {
        const currentTime = this.wavesurfer.getCurrentTime();
        this.currentTime.set(this.formatDuration(currentTime * 1000));
      }
    }, 100); // Atualiza a cada 100ms para maior precisão
  }

  private stopTimeUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  private setupRecordingTimer() {
    setInterval(() => {
      if (this.isRecording()) {
        const elapsed = Date.now() - this.startTime;
        this.duration.set(elapsed);
        this.recordingTime.set(this.formatDuration(elapsed));
      }
    }, 1000);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }

  async toggleRecording() {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  togglePlayPause() {
    if (this.wavesurfer) {
      this.wavesurfer.playPause();
    }
  }

  stop() {
    if (this.wavesurfer) {
      this.wavesurfer.stop();
      this.isPlaying.set(false);
      this.currentTime.set('00:00');
      this.stopTimeUpdate();
    }
  }

  private async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.startTime = Date.now();
      this.isRecording.set(true);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        this.audioRecorded.emit(audioUrl);
        this.hasRecording.set(true);
        this.wavesurfer?.load(audioUrl);
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      this.toast.error('Erro ao iniciar gravação');
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.isRecording.set(false);
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
  }

  private cleanup() {
    this.stopRecording();
    this.stopTimeUpdate();
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
    }
    clearInterval(this.timer);
  }
}
