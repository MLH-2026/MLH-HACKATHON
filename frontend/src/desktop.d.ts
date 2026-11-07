export {};
declare global {
  interface Window {
    whatNowDesktop?: {
      minimize(): Promise<void>;
      setReady(ready: boolean): Promise<void>;
      setBusy(busy: boolean): Promise<void>;
      captureNow(): Promise<void>;
      onNudge(callback: (result: { image?: string; error?: string }) => void): () => void;
      onPaused(callback: (paused: boolean) => void): () => void;
    };
  }
}
