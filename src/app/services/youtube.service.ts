import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastService } from './toast.service';
import { Observable, catchError, map, of } from 'rxjs';

export interface YoutubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
}

@Injectable({
  providedIn: 'root',
})
export class YoutubeService {
  private readonly API_URL = 'http://localhost:3000/api/youtube';

  // Signals
  readonly isLoading = signal(false);
  readonly searchResults = signal<YoutubeSearchResult[]>([]);
  readonly selectedVideo = signal<YoutubeSearchResult | null>(null);

  constructor(private http: HttpClient, private toast: ToastService) {}

  search(query: string): Observable<YoutubeSearchResult[]> {
    if (!query.trim()) {
      return of([]);
    }

    this.isLoading.set(true);

    return this.http
      .get<YoutubeSearchResult[]>(
        `${this.API_URL}/search?q=${encodeURIComponent(query)}`
      )
      .pipe(
        map((results) => {
          this.searchResults.set(results);
          return results;
        }),
        catchError((error) => {
          this.toast.error('Erro ao buscar vídeos do YouTube');
          return of([]);
        })
      );
  }

  async downloadAudio(videoId: string): Promise<Blob> {
    this.isLoading.set(true);

    try {
      const response = await fetch(`${this.API_URL}/download/${videoId}`);
      if (!response.ok) {
        throw new Error('Erro ao baixar áudio');
      }

      const blob = await response.blob();
      this.toast.success('Áudio baixado com sucesso');
      return blob;
    } catch (error) {
      this.toast.error('Erro ao baixar áudio do YouTube');
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  validateYoutubeUrl(url: string): string | null {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  selectVideo(video: YoutubeSearchResult) {
    this.selectedVideo.set(video);
  }

  clearSelection() {
    this.selectedVideo.set(null);
  }
}
