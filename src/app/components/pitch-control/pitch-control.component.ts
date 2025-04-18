import { Component, HostListener, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { AudioProcessorService } from '../../services/audio-processor.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-pitch-control',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    FormsModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="pitch-control" role="region" aria-label="Controle de tom">
      <div class="loading-overlay" *ngIf="isProcessingPitch()">
        <mat-spinner diameter="48"></mat-spinner>
        <span>Processando Tom...</span>
      </div>

      <div class="pitch-display">
        <span class="label">Tom:</span>
        <span
          class="value"
          [class.positive]="currentPitch() > 0"
          [class.negative]="currentPitch() < 0"
        >
          {{ currentPitch() >= 0 ? '+' : '' }}{{ currentPitch() }}
        </span>
      </div>

      <div class="controls">
        <button
          mat-mini-fab
          color="primary"
          (click)="decrementPitch()"
          [disabled]="currentPitch() <= -12 || isProcessingPitch()"
          aria-label="Diminuir tom"
        >
          <mat-icon>remove</mat-icon>
        </button>

        <mat-slider min="-12" max="12" step="1">
          <input
            matSliderThumb
            [value]="currentPitch()"
            (valueChange)="onSliderChange($event)"
            [disabled]="isProcessingPitch()"
            aria-label="Controle deslizante de tom"
          />
        </mat-slider>

        <button
          mat-mini-fab
          color="primary"
          (click)="incrementPitch()"
          [disabled]="currentPitch() >= 12 || isProcessingPitch()"
          aria-label="Aumentar tom"
        >
          <mat-icon>add</mat-icon>
        </button>
      </div>

      <div class="semitone-buttons">
        <button
          mat-stroked-button
          *ngFor="let semitone of [-2, -1, 0, 1, 2]"
          (click)="setPitch(semitone)"
          [class.active]="currentPitch() === semitone"
          [disabled]="isProcessingPitch()"
          [attr.aria-label]="
            'Definir tom para ' + (semitone >= 0 ? '+' : '') + semitone
          "
        >
          {{ semitone >= 0 ? '+' : '' }}{{ semitone }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .pitch-control {
        padding: 1rem;
        background: #2a2a2a;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        position: relative;
      }

      .pitch-display {
        text-align: center;
        margin-bottom: 1rem;
      }

      .label {
        font-size: 1.1rem;
        color: #888;
        margin-right: 0.5rem;
      }

      .value {
        font-size: 1.5rem;
        font-weight: 600;
        font-family: monospace;
      }

      .value.positive {
        color: #4caf50;
      }

      .value.negative {
        color: #f44336;
      }

      .controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      mat-slider {
        flex: 1;
      }

      .semitone-buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
      }

      .semitone-buttons button {
        min-width: 48px;
      }

      .semitone-buttons button.active {
        background-color: #7c4dff;
        color: white;
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(42, 42, 42, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: 8px;
        color: white;
        gap: 1rem;
      }
    `,
  ],
})
export class PitchControlComponent {
  currentPitch: WritableSignal<number>;
  isProcessingPitch: WritableSignal<boolean>;

  constructor(private audioProcessor: AudioProcessorService) {
    this.currentPitch = this.audioProcessor.pitch;
    this.isProcessingPitch = this.audioProcessor.isProcessingPitch;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      this.incrementPitch();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      this.decrementPitch();
    }
  }

  incrementPitch() {
    if (this.isProcessingPitch()) return;
    const newPitch = Math.min(this.currentPitch() + 1, 12);
    this.setPitch(newPitch);
  }

  decrementPitch() {
    if (this.isProcessingPitch()) return;
    const newPitch = Math.max(this.currentPitch() - 1, -12);
    this.setPitch(newPitch);
  }

  setPitch(semitones: number) {
    if (this.isProcessingPitch()) return;
    if (semitones !== this.currentPitch()) {
      this.audioProcessor.setPitch(semitones);
    }
  }

  onSliderChange(value: number | null) {
    if (this.isProcessingPitch()) return;
    if (value !== null) {
      this.setPitch(value);
    }
  }
}
