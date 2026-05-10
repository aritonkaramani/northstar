export interface ClipObject {
  id: string;
  url: string;
  platform: 'twitch' | 'youtube';
  clipId: string;
  embedUrl: string | null;
  title?: string;
  addedBy: string;
  addedById: string;
  addedAt: number;
}
