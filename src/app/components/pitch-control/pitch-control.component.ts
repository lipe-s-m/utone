import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';
import { AudioProcessorService } from '../../services/audio-processor.service';

@Component({
  selector: 'app-pitch-control',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    FormsModule,
  ],
  template: `
    <div class="pitch-control" role="region" aria-label="Controle de tom">
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
          [disabled]="currentPitch() <= -12"
          aria-label="Diminuir tom"
        >
          <mat-icon>remove</mat-icon>
        </button>

        <mat-slider min="-12" max="12" step="1">
          <input
            matSliderThumb
            [value]="currentPitch()"
            (valueChange)="onSliderChange($event)"
            aria-label="Controle deslizante de tom"
          />
        </mat-slider>

        <button
          mat-mini-fab
          color="primary"
          (click)="incrementPitch()"
          [disabled]="currentPitch() >= 12"
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
    `,
  ],
})
export class PitchControlComponent {
  currentPitch;

  constructor(private audioProcessor: AudioProcessorService) {
    this.currentPitch = this.audioProcessor.pitch;
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
    const newPitch = Math.min(this.currentPitch() + 1, 12);
    this.setPitch(newPitch);
  }

  decrementPitch() {
    const newPitch = Math.max(this.currentPitch() - 1, -12);
    this.setPitch(newPitch);
  }

  setPitch(semitones: number) {
    this.audioProcessor.setPitch(semitones);
  }

  onSliderChange(value: number | null) {
    if (value !== null) {
      this.setPitch(value);
    }
  }
}
