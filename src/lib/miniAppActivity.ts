type ActivityListener = (active: boolean) => void;
let telegramActivityOverride: boolean | null = null;

function getTelegramWebApp(): any {
  return typeof window === 'undefined' ? null : (window as any).Telegram?.WebApp;
}

export function isMiniAppActive(): boolean {
  if (typeof document === 'undefined' || document.hidden) return false;
  if (telegramActivityOverride !== null) return telegramActivityOverride;
  return getTelegramWebApp()?.isActive !== false;
}

/** Telegram can minimize a Mini App without making its document hidden. */
export function subscribeToMiniAppActivity(listener: ActivityListener): () => void {
  if (typeof document === 'undefined') return () => {};

  const webApp = getTelegramWebApp();
  const onDocumentVisibility = () => {
    if (document.hidden) {
      telegramActivityOverride = false;
      listener(false);
      return;
    }
    telegramActivityOverride = null;
    listener(isMiniAppActive());
  };
  const onActivated = () => {
    telegramActivityOverride = true;
    listener(!document.hidden);
  };
  const onDeactivated = () => {
    telegramActivityOverride = false;
    listener(false);
  };

  document.addEventListener('visibilitychange', onDocumentVisibility);
  webApp?.onEvent?.('activated', onActivated);
  webApp?.onEvent?.('deactivated', onDeactivated);
  listener(isMiniAppActive());

  return () => {
    document.removeEventListener('visibilitychange', onDocumentVisibility);
    webApp?.offEvent?.('activated', onActivated);
    webApp?.offEvent?.('deactivated', onDeactivated);
  };
}
