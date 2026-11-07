export {};
declare global {
  interface Window {
    whatNowDesktop?: {
      captureFrame(sourceId: string): Promise<string>;
      onPaused(callback: (paused: boolean) => void): () => void;
      captureSources(): Promise<Array<{ id: string; name: string; image: string }>>;
    };
  }
}
