import {
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  effect,
  ChangeDetectorRef,
} from '@angular/core';
import {
  AudioProcessorService,
  AudioState,
} from './services/audio-processor.service';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { YoutubeSearchComponent } from './components/youtube-search/youtube-search.component';
import { AudioRecorderComponent } from './components/audio-recorder/audio-recorder.component';
import { MaterialModule } from './material.module';
import { HttpClientModule } from '@angular/common/http';
import { YoutubeService } from './services/youtube.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    YoutubeSearchComponent,
    AudioRecorderComponent,
    MaterialModule,
    HttpClientModule,
  ],
  providers: [AudioProcessorService, YoutubeService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('waveform') waveformElement!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  audioUploaded = false;
  audioState: AudioState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    pitch: 0,
    tempo: 1,
    volume: 1,
  };

  private pendingAudioFile: File | null = null;

  constructor(
    private audioService: AudioProcessorService,
    private cdr: ChangeDetectorRef
  ) {
    // Use effect to automatically update audioState when signals change
    effect(() => {
      this.audioState = {
        isPlaying: this.audioService.isPlaying(),
        currentTime: this.audioService.currentTime(),
        duration: this.audioService.duration(),
        pitch: this.audioService.pitch(),
        tempo: this.audioService.tempo(),
        volume: this.audioService.volume(),
      };
    });
  }

  ngAfterViewInit() {
    // Initialize WaveSurfer immediately
    if (this.waveformElement?.nativeElement) {
      console.log('Initializing WaveSurfer...');
      this.audioService.initWaveSurfer(this.waveformElement.nativeElement);

      // If there's a pending audio file, load it
      if (this.pendingAudioFile) {
        this.loadAudioFile(this.pendingAudioFile);
        this.pendingAudioFile = null;
      }
    } else {
      console.error('Waveform element not found in the view');
    }
  }

  ngOnDestroy() {
    this.audioService.destroy();
  }

  private async loadAudioFile(file: File) {
    try {
      console.log('Loading audio file:', file.name);
      await this.audioService.loadFile(file);
      this.audioUploaded = true;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading audio file:', error);
      this.audioUploaded = false;
      this.cdr.detectChanges();
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      await this.loadAudioFile(file);
    }
  }

  onPlayPause() {
    if (this.audioState.isPlaying) {
      this.audioService.pause();
    } else {
      this.audioService.play();
    }
  }

  onStop() {
    this.audioService.stop();
  }

  onPitchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.audioService.setPitch(Number(value));
  }

  onTempoChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.audioService.setTempo(Number(value));
  }

  async onAudioSelected(audioUrl: string) {
    try {
      console.log('Loading audio from URL:', audioUrl);
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const file = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });

      // If WaveSurfer is not initialized yet, store the file for later
      if (!this.audioService.isWaveSurferInitialized()) {
        this.pendingAudioFile = file;
        return;
      }

      await this.loadAudioFile(file);
    } catch (error) {
      console.error('Error loading audio:', error);
      this.audioUploaded = false;
      this.cdr.detectChanges();
    }
  }
}
