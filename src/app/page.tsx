'use client';

import React, { useState, useEffect } from 'react';
import MiniAppShell from '../components/telegram/MiniAppShell';
import BotSimulator from '../components/telegram/BotSimulator';
import { useBingo } from '../context/BingoContext';
import { Bot, Gamepad2 } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export default function PublicWebsitePage() {
  const { language, t } = useBingo();
  const [miniAppTab, setMiniAppTab] = useState<'lobby' | 'game' | 'wallet' | 'profile' | 'admin'>('lobby');
  const [isBotOpen, setIsBotOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'bot' | 'app'>('split');

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

  const handleOpenMiniApp = (tab?: string) => {
    if (tab === 'lobby' || tab === 'game' || tab === 'wallet' || tab === 'profile' || tab === 'admin') {
      setMiniAppTab(tab);
    } else {
      setMiniAppTab('lobby');
    }
    setViewMode('app');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-start text-slate-900 font-sans overflow-hidden">
      {/* Top View Switcher Bar */}
      <div className="w-full max-w-[880px] px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-slate-800/80 backdrop-blur rounded-xl p-1 border border-slate-700/60 shadow-lg">
          <button
            onClick={() => setViewMode('bot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'bot'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Telegram Bot Chat"
          >
            <Bot className="w-3.5 h-3.5" />
            {language === 'am' ? '🤖 ቦት' : '🤖 Bot'}
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'split'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Side-by-Side View"
          >
            {language === 'am' ? '◧ ሁለቱም' : '◧ Split'}
          </button>
          <button
            onClick={() => setViewMode('app')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'app'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Mini App Only"
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            {language === 'am' ? '🎮 ሚኒ አፕ' : '🎮 Mini App'}
          </button>
        </div>

        <button
          onClick={() => setIsBotOpen((prev) => !prev)}
          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow border ${
            isBotOpen
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30'
              : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
        >
          {isBotOpen ? 'Bot: ON' : 'Bot: OFF'}
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 w-full max-w-[880px] px-2 pb-2 flex items-stretch justify-center gap-2 min-h-0 ${
        viewMode === 'split' ? 'flex-row' : 'flex-row'
      }`}>
        {/* Bot Simulator Panel */}
        {(viewMode === 'split' || viewMode === 'bot') && isBotOpen && (
          <div
            className={`rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl shrink-0 ${
              viewMode === 'split' ? 'w-[48%] max-w-[420px]' : 'w-full max-w-[440px]'
            }`}
            style={{ height: 'calc(100vh - 60px)', maxHeight: 'calc(100vh - 60px)' }}
          >
            <BotSimulator
              isOpen={isBotOpen}
              onClose={() => setIsBotOpen(false)}
              onOpenMiniApp={handleOpenMiniApp}
              embedded={true}
            />
          </div>
        )}

        {/* Mini App Panel */}
        {(viewMode === 'split' || viewMode === 'app') && (
          <div
            className={`rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shrink-0 ${
              viewMode === 'split' ? 'w-[48%] max-w-[420px]' : 'w-full max-w-[440px]'
            }`}
            style={{ height: 'calc(100vh - 60px)', maxHeight: 'calc(100vh - 60px)' }}
          >
            <div className="w-full h-full bg-white shadow-xl flex flex-col overflow-hidden relative">
              <MiniAppShell initialTab={miniAppTab} embedded={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
