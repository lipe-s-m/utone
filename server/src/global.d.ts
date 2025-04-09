declare module 'youtube-search-api' {
  interface SearchResult {
    id: string;
    title: string;
    thumbnail: {
      thumbnails: Array<{ url: string }>;
    };
    length: { simpleText: string };
    channelTitle: string;
  }

  interface SearchResponse {
    items: SearchResult[];
    nextPage: {
      nextPageToken: string;
      nextPageContext: any;
    };
  }

  export function GetListByKeyword(
    keyword: string,
    withPlaylist?: boolean,
    limit?: number,
    options?: Array<{ type?: string }>
  ): Promise<SearchResponse>;
}
