// Full-screen table for the landscape card games (掼蛋 / 升级).
// While a board is mounted: the site header is hidden and the page can't scroll
// (html.px-immersive, see games.css), and on browsers with the Fullscreen API
// (Android) the first tap takes the page truly full screen. iPhone Safari has no
// page fullscreen, so there the fixed layer + hidden header is the fallback.
import { useEffect } from 'react';

export function useImmersive() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('px-immersive');
    window.scrollTo(0, 0);
    let entered = false;
    const goFull = () => {
      if (document.fullscreenElement || !html.requestFullscreen || !document.fullscreenEnabled) return;
      html.requestFullscreen({ navigationUI: 'hide' })
        .then(() => { entered = true; return window.screen?.orientation?.lock?.('landscape'); })
        .catch(() => {});
    };
    window.addEventListener('pointerdown', goFull, { once: true, capture: true });
    return () => {
      html.classList.remove('px-immersive');
      window.removeEventListener('pointerdown', goFull, { capture: true });
      if (entered && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);
}
