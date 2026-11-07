export {};
declare global {
  interface Window {
    whatNowDesktop?: {
      captureSources(): Promise<Array<{ id: string; name: string; image: string }>>;
    };
  }
}
