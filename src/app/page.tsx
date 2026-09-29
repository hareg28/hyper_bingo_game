'use client';

import React, { useState, useEffect } from 'react';
import MiniAppShell from '../components/telegram/MiniAppShell';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export default function PublicWebsitePage() {
  const [miniAppTab, setMiniAppTab] = useState<
    'lobby' | 'game' | 'wallet' | 'profile' | 'admin' | 'lottery'
  >('lobby');
  const [initialGameId, setInitialGameId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const requestedTab = urlParams.get('tab');
      const tg = window.Telegram?.WebApp;
      const requestedGame = urlParams.get('game') || (tg?.initDataUnsafe as any)?.start_param;

      if (requestedGame) {
        setInitialGameId(requestedGame);
        setMiniAppTab('game');
      } else if (
        requestedTab === 'admin' ||
        requestedTab === 'game' ||
        requestedTab === 'wallet' ||
        requestedTab === 'profile' ||
        requestedTab === 'lottery' ||
        requestedTab === 'lobby'
      ) {
        setMiniAppTab(requestedTab as any);
      }

      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch (e) {
          console.error('Telegram WebApp init error:', e);
        }
      }
    }
  }, []);

  return (
    <div className="h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center text-slate-900 font-sans overflow-hidden">
      {/* Mini App fills the whole page — single app, no bot or split views */}
      <div className="flex-1 min-h-0 w-full max-w-[460px] flex items-stretch justify-center">
        <div className="w-full h-full shadow-2xl overflow-hidden rounded-none sm:rounded-2xl border border-slate-200 bg-white flex flex-col">
          <MiniAppShell initialTab={miniAppTab} initialGameId={initialGameId} embedded={true} />
        </div>
      </div>
    </div>
  );
}
