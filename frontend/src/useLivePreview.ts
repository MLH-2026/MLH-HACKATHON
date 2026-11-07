import { useEffect, useRef, useState } from 'react';

type Source = { id: string; name: string; image: string };

export function useLivePreview() {
  const [sources, setSources] = useState<Source[]>([]);
  const [source, setSource] = useState<Source | null>(null);
  const [image, setImage] = useState('');
  const [playing, setPlaying] = useState(true);
  const [systemPaused, setSystemPaused] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [error, setError] = useState('');
  const pending = useRef<{ id: string; promise: Promise<string> } | null>(null);
  const active = !!source && playing && !systemPaused && visible;

  useEffect(() => {
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const remove = window.whatNowDesktop?.onPaused(setSystemPaused);
    return () => { document.removeEventListener('visibilitychange', visibility); remove?.(); };
  }, []);

  function frame(id: string): Promise<string> {
    if (pending.current?.id === id) return pending.current.promise;
    const promise = window.whatNowDesktop!.captureFrame(id);
    pending.current = { id, promise };
    void promise.finally(() => {
      if (pending.current?.promise === promise) pending.current = null;
    }).catch(() => {});
    return promise;
  }

  useEffect(() => {
    if (!active || !source) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await frame(source!.id);
        if (!cancelled) {
          setImage(next);
          setError('');
          timer = setTimeout(refresh, 1200);
        }
      } catch (failure) {
        if (!cancelled) {
          setPlaying(false);
          setError(failure instanceof Error ? failure.message : 'Could not refresh this window.');
        }
      }
    }
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, source]);

  async function choose() {
    setError('');
    try {
      // Wait for the current frame to finish before enumerating other windows.
      await pending.current?.promise.catch(() => {});
      const list = await window.whatNowDesktop!.captureSources();
      if (!list.length) throw new Error('No windows found. Check screen recording permission.');
      setSources(list);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not list windows.');
    }
  }

  function select(next: Source) {
    setSource(next);
    setImage(next.image);
    setSources([]);
    setPlaying(true);
    setError('');
  }

  async function capture() {
    if (!source || !active) throw new Error('Choose a window and resume its preview first.');
    const data = await frame(source.id);
    setImage(data);
    const bytes = Uint8Array.from(atob(data.split(',')[1]), character => character.charCodeAt(0));
    return new File([bytes], 'current-work.jpg', { type: 'image/jpeg' });
  }

  return {
    sources, source, image, active, playing, systemPaused, error,
    choose, select, capture, setPlaying,
    cancel: () => setSources([]),
    stop: () => { setSource(null); setImage(''); setSources([]); setError(''); },
  };
}
