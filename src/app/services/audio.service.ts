import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

export interface AudioState {
  isPlaying: boolean;
  pitch: number;
  tempo: number;
}

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private pitchNode: any; // Will be implemented with a pitch-shifting library
  private gainNode: GainNode;

  // Signals for reactive state
  readonly isPlaying = signal(false);
  readonly pitch = signal(0);
  readonly tempo = signal(1);

  constructor() {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }

  async loadAudio(source: string | File) {
    try {
      let arrayBuffer: ArrayBuffer;

      if (source instanceof File) {
        arrayBuffer = await source.arrayBuffer();
      } else {
        const response = await fetch(source);
        arrayBuffer = await response.arrayBuffer();
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.setupAudioNodes(audioBuffer);
    } catch (error) {
      console.error('Error loading audio:', error);
      throw error;
    }
  }

  private setupAudioNodes(audioBuffer: AudioBuffer) {
    // Stop any existing playback
    this.stop();

    // Create and configure source node
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = audioBuffer;

    // TODO: Implement pitch shifting
    // For now, connect directly to gain node
    this.sourceNode.connect(this.gainNode);

    // Apply current state
    this.sourceNode.playbackRate.value = this.tempo();
  }

  play() {
    if (this.sourceNode) {
      this.sourceNode.start();
      this.isPlaying.set(true);
    }
  }

  pause() {
    this.stop();
  }

  stop() {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
      this.isPlaying.set(false);
    }
  }

  setPitch(semitones: number) {
    this.pitch.set(semitones);
    // TODO: Implement pitch shifting
  }

  setTempo(rate: number) {
    this.tempo.set(rate);
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }
}
