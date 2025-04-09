declare module 'youtube-search-api' {
  interface ThumbnailInfo {
    url: string;
    width: number;
    height: number;
  }

  interface VideoResult {
    id: string;
    title: string;
    thumbnail: {
      thumbnails: ThumbnailInfo[];
    };
    length: {
      simpleText: string;
    };
    channelTitle: string;
  }

  interface SearchResult {
    items: VideoResult[];
    nextPage?: {
      token: string;
    };
  }

  export function searchYoutube(
    query: string,
    options?: { pageToken?: string }
  ): Promise<SearchResult>;
}
