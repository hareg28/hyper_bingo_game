'use client';

import React, { useEffect } from 'react';
import MiniAppShell from '../../components/telegram/MiniAppShell';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export default function DedicatedMiniAppPage() {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      } catch (e) {
        console.error('Telegram WebApp init error:', e);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start text-slate-900 font-sans">
      <div className="w-full max-w-[440px] min-h-screen bg-white">
        <MiniAppShell initialTab="lobby" />
      </div>
    </div>
  );
}
