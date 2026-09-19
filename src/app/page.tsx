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
  const [miniAppTab, setMiniAppTab] = useState<'lobby' | 'game' | 'wallet' | 'profile' | 'admin'>('lobby');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const requestedTab = urlParams.get('tab');
      if (requestedTab === 'admin' || requestedTab === 'game' || requestedTab === 'wallet' || requestedTab === 'profile') {
        setMiniAppTab(requestedTab as any);
      }

      const tg = window.Telegram?.WebApp;
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
    <div className="h-[100dvh] max-h-[100dvh] bg-slate-100 flex flex-col items-center justify-start text-slate-900 font-sans overflow-hidden">
      <div className="w-full max-w-[440px] h-full max-h-[100dvh] bg-white shadow-xl flex flex-col overflow-hidden">
        <MiniAppShell initialTab={miniAppTab} />
      </div>
    </div>
  );
}
