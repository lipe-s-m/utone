import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { YoutubeService } from '../../services/youtube.service';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  switchMap,
  tap,
} from 'rxjs/operators';
import { Subject } from 'rxjs';

interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration: string;
}

interface AutocompleteSuggestion {
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration: string;
}

@Component({
  selector: 'app-youtube-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './youtube-search.component.html',
  styleUrls: ['./youtube-search.component.scss'],
})
export class YoutubeSearchComponent {
  @Output() audioSelected = new EventEmitter<string>();

  searchControl = new FormControl('');
  searchResults = signal<YoutubeVideo[]>([]);
  selectedVideo = signal<YoutubeVideo | null>(null);
  isLoading = signal(false);
  isSearchingSuggestions = signal(false);
  private searchSubject = new Subject<string>();

  constructor(private youtubeService: YoutubeService) {
    this.setupSearch();
  }

  private setupSearch() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        filter((query): query is string => !!query && query.length > 2),
        tap(() => this.isSearchingSuggestions.set(true)),
        switchMap((query: string) => {
          if (this.isYoutubeUrl(query)) {
            this.handleUrlInput();
            this.isSearchingSuggestions.set(false);
            return [];
          }
          return this.youtubeService.getAutocompleteSuggestions(query);
        })
      )
      .subscribe(
        (results) => {
          this.isSearchingSuggestions.set(false);
          if (Array.isArray(results)) {
            this.searchResults.set(results);
          }
        },
        (error) => {
          console.error('Error fetching suggestions:', error);
          this.isSearchingSuggestions.set(false);
          this.searchResults.set([]);
        }
      );
  }

  onSearchInput(query: string) {
    this.searchSubject.next(query);
  }

  onVideoSelect(video: YoutubeVideo) {
    this.selectedVideo.set(video);
    this.searchControl.setValue('');
    this.searchResults.set([]);
  }

  async downloadAudio() {
    if (!this.selectedVideo()) return;

    try {
      this.isLoading.set(true);
      const audioBlob = await this.youtubeService.downloadAudio(
        this.selectedVideo()!.id
      );
      // Convert blob URL to string before emitting
      this.audioSelected.emit(URL.createObjectURL(audioBlob));
    } catch (error) {
      console.error('Error downloading audio:', error);
      // TODO: Add error handling/notification
    } finally {
      this.isLoading.set(false);
    }
  }

  clearSelection() {
    this.selectedVideo.set(null);
  }

  isYoutubeUrl(url: string): boolean {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
  }

  private getVideoIdFromUrl(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  async handleUrlInput() {
    const searchValue = this.searchControl.value || '';
    if (this.isYoutubeUrl(searchValue)) {
      try {
        const videoId = this.getVideoIdFromUrl(searchValue);
        if (!videoId) return;

        this.isLoading.set(true);
        const video = await this.youtubeService.search(videoId).toPromise();
        if (video && video.length > 0) {
          this.onVideoSelect(video[0]);
        }
      } catch (error) {
        console.error('Error processing YouTube URL:', error);
        // TODO: Add error handling/notification
      } finally {
        this.isLoading.set(false);
      }
    }
  }
}
