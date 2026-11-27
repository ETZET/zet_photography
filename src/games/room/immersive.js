// Full-screen table for the landscape card games (掼蛋 / 升级).
// While a board is mounted: the site header is hidden (html.px-immersive, see games.css)
// and the page keeps a little scroll room so a swipe up makes Safari hide its bars, and on browsers with the Fullscreen API
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

/** iPhone Safari can't go full screen; opened from the home screen it shows no browser bars at all. */
export function fullscreenTip() {
  const ios = /iPhone|iPod/.test(navigator.userAgent);
  if (!ios || navigator.standalone || window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches) return null;
  return 'iPhone 上方的地址栏：在牌桌空白处往上滑一下就会收起。想完全全屏：Safari 点「分享」→「添加到主屏幕」，从主屏幕图标打开就没有地址栏了。';
}
