'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../context/BingoContext';
import { 
  Gamepad2, Zap, ShieldCheck, Trophy, Smartphone, Wallet, 
  HelpCircle, ChevronRight, MessageSquare, ExternalLink, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Globe, Shield, User as UserIcon 
} from 'lucide-react';
import { formatETB } from '../lib/bingoUtils';
import { isAdminTelegramId } from '../lib/authUtils';
import BotSimulator from '../components/telegram/BotSimulator';
import MiniAppShell from '../components/telegram/MiniAppShell';
import Link from 'next/link';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export default function PublicWebsitePage() {
  const { games, promotions, wallet, user, isLoggedIn, language, setLanguage, t, openAuthModal } = useBingo();
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [isMiniAppOpen, setIsMiniAppOpen] = useState(false);
  const [isTelegramView, setIsTelegramView] = useState(false);
  const [miniAppTab, setMiniAppTab] = useState<'lobby' | 'game' | 'wallet' | 'profile' | 'admin'>('lobby');
  const [showResponsibleModal, setShowResponsibleModal] = useState(false);

  const isUserAdmin = Boolean(
    user && 
    user.role === 'admin' && 
    (isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const requestedTab = urlParams.get('tab');
      if (requestedTab === 'admin') {
        setMiniAppTab('admin');
      }

      const checkTelegram = () => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
          try {
            tg.ready();
            tg.expand();
          } catch (e) {}
        }

        const isInsideTelegram = 
          Boolean(tg?.initData) || 
          (Boolean(tg?.platform) && tg?.platform !== 'unknown') ||
          window.location.search.includes('tgWebApp') || 
          window.location.hash.includes('tgWebAppData') ||
          window.location.search.includes('app') ||
          window.self !== window.top;

        if (isInsideTelegram) {
          setIsTelegramView(true);
        }
      };

      checkTelegram();
      const timer = setTimeout(checkTelegram, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const openMiniAppWithTab = (tab: string = 'lobby') => {
    const validTabs: ('lobby' | 'game' | 'wallet' | 'profile' | 'admin')[] = ['lobby', 'game', 'wallet', 'profile', 'admin'];
    const selectedTab = validTabs.includes(tab as any) ? (tab as 'lobby' | 'game' | 'wallet' | 'profile' | 'admin') : 'lobby';
    setMiniAppTab(selectedTab);
    setIsMiniAppOpen(true);
    setIsBotOpen(false);
  };

  const handlePlayNow = (tab: string = 'lobby') => {
    if (!isLoggedIn) {
      openAuthModal('register');
      return;
    }
    openMiniAppWithTab(tab);
  };

  if (isTelegramView) {
    return (
      <div className="min-h-screen bg-[#0d111d] flex flex-col items-center justify-start text-slate-100 font-sans">
        <div className="w-full max-w-[440px] min-h-screen">
          <MiniAppShell initialTab={miniAppTab} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Marketing Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg">
              B
            </div>
            <div>
              <span className="font-black text-lg text-slate-100 tracking-tight flex items-center gap-1.5">
                HYPER BINGO
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                  ETB Real Money
                </span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1">Telegram & Web Engine</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#how-it-works" className="hover:text-amber-400 transition">How It Works</a>
            <a href="#games" className="hover:text-amber-400 transition">Live Games</a>
            <a href="#promotions" className="hover:text-amber-400 transition">Promotions</a>
            <a href="#faq" className="hover:text-amber-400 transition">FAQ</a>
            <button onClick={() => setShowResponsibleModal(true)} className="hover:text-amber-400 transition">
              Responsible Gaming
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
              className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-amber-300 transition flex items-center gap-1.5"
              title="Switch Language / ቋንቋ ይምረጡ"
            >
              <Globe className="w-4 h-4" />
              {language === 'en' ? '🇪🇹 አማርኛ' : '🇬🇧 English'}
            </button>

            {/* Admin Header Link - ONLY visible to verified admins configured in env */}
            {isUserAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-purple-950/80 hover:bg-purple-900 text-xs font-bold text-amber-300 transition shadow"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('admin')}</span>
              </Link>
            )}

            {/* User Account / Open Account CTA */}
            {isLoggedIn && user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openMiniAppWithTab('wallet')}
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono hover:bg-amber-500/20 transition"
                  title="Wallet Balance"
                >
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  {formatETB(wallet.availableBalance)}
                </button>
                <button
                  onClick={() => openMiniAppWithTab('profile')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:border-slate-500 transition"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                    {user.name.charAt(0)}
                  </div>
                  <span className="max-w-[70px] truncate font-medium">{user.name.split(' ')[0]}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => openAuthModal('register')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>{language === 'am' ? 'አካውንት ክፈት' : 'Open Account'}</span>
              </button>
            )}

            <button
              onClick={() => handlePlayNow('lobby')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-1.5"
            >
              <Smartphone className="w-4 h-4" /> {t('playOnTelegram')}
            </button>
          </div>
        </div>
      </header>


      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>ETHIOPIA'S #1 TELEGRAM & WEB BINGO PLATFORM</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-100 tracking-tight leading-tight uppercase">
            {t('heroTitle')}
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {t('heroDesc')}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handlePlayNow('lobby')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-slate-950 font-black text-sm uppercase tracking-wider hover:brightness-110 transition shadow-2xl flex items-center justify-center gap-2 animate-pulse hover:animate-none"
            >
              <Gamepad2 className="w-5 h-5" /> PLAY HYPER BINGO
            </button>

            <button
              onClick={() => setIsBotOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-700 hover:border-amber-500/50 text-slate-200 font-bold text-sm transition flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5 text-blue-400" /> OPEN BOT SIMULATOR
            </button>
          </div>

          {/* Quick Stats Ticker */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-12 max-w-4xl mx-auto text-left">
            <div className="glass-panel p-4 rounded-2xl border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Instant Withdrawals</div>
              <div className="text-lg font-black text-amber-400 mt-1">Telebirr & CBE Birr</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Live Game Engine</div>
              <div className="text-lg font-black text-emerald-400 mt-1">75-Ball Authoritative</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Quick Bingo Speed</div>
              <div className="text-lg font-black text-purple-400 mt-1">3 Sec Number Draws</div>
            </div>
            <div className="glass-panel p-4 rounded-2xl border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Active Prize Pool</div>
              <div className="text-lg font-black text-amber-400 mt-1">50,000+ ETB Daily</div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Games Advertisement Cards (Section 19) */}
      <section id="games" className="py-16 px-4 sm:px-6 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold uppercase border border-amber-500/20">
              LIVE BINGO LOBBY
            </span>
            <h2 className="text-3xl font-black text-slate-100">Featured Games & Tournaments</h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Outcomes are based on defined 75-Ball game rules and chance. Pick a room and enter the daubing arena!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {games.map((g) => (
              <div
                key={g.id}
                className="glass-panel p-6 rounded-2xl border-slate-800 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between space-y-4 shadow-xl group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {g.gameType.replace('_', ' ')}
                    </span>
                    {(g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow">
                        🌟 Fri-Sun Lottery
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">{g.startTime}</span>
                  </div>

                  <h3 className="text-xl font-black text-slate-100 group-hover:text-amber-400 transition">
                    {g.name}
                  </h3>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Entry</span>
                      <strong className="text-amber-400 font-mono text-xs sm:text-sm">{formatETB(g.entryPrice)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Prize Pool</span>
                      <strong className="text-emerald-400 font-mono text-xs sm:text-sm">{formatETB(g.prizePool)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Players</span>
                      <strong className="text-purple-400 font-mono text-xs sm:text-sm">
                        {g.currentPlayers}{g.minPlayers ? `/${g.minPlayers}` : ''}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handlePlayNow('game')}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5"
                >
                  PLAY NOW IN MINI APP <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works (Section 2) */}
      <section id="how-it-works" className="py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-100">How It Works in 3 Simple Steps</h2>
            <p className="text-sm text-slate-400">Start playing and winning within 60 seconds</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl text-center space-y-3 border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto text-xl font-black border border-blue-500/30">
                1
              </div>
              <h3 className="font-bold text-base text-slate-100">Join via Telegram</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Launch the official @HyperBingoBot Telegram Mini App without downloading separate heavy apps.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl text-center space-y-3 border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto text-xl font-black border border-emerald-500/30">
                2
              </div>
              <h3 className="font-bold text-base text-slate-100">Deposit Telebirr or CBE</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fund your wallet securely with Ethiopian Birr (ETB). Automated backend verification ensures fast processing.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl text-center space-y-3 border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl font-black border border-amber-500/30">
                3
              </div>
              <h3 className="font-bold text-base text-slate-100">Daub Numbers & Claim Winnings</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Follow real-time ball draws. Complete line or full house patterns to claim instant payouts to your wallet!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-16 px-4 sm:px-6 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-100">Frequently Asked Questions</h2>
            <p className="text-sm text-slate-400">Everything you need to know about playing on Hyper Bingo</p>
          </div>

          <div className="space-y-3 text-xs sm:text-sm">
            {[
              {
                q: 'Which payment methods are supported in Ethiopia?',
                a: 'We support Telebirr, CBE Birr, Commercial Bank of Ethiopia (CBE) direct transfers, and Chapa payment gateways.',
              },
              {
                q: 'How does number drawing and winning validation work?',
                a: 'The backend engine is 100% authoritative. Numbers 1 through 75 are drawn in real-time. When a player completes a Line, Two Lines, or Full House, server validation confirms the card before payout.',
              },
              {
                q: 'What happens if two players claim BINGO at the same time?',
                a: 'If multiple winners claim simultaneously, the game engine calculates the equal prize share distribution (e.g. 5,000 ETB divided evenly among confirmed winners).',
              },
              {
                q: 'How quickly are withdrawal requests processed?',
                a: 'Approved withdrawals are processed directly to your Telebirr or CBE Birr account after admin audit compliance.',
              },
            ].map((faq, i) => (
              <div key={i} className="glass-panel p-4 rounded-xl space-y-1.5 border-slate-800">
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  {faq.q}
                </h4>
                <p className="text-slate-400 pl-6 leading-relaxed text-xs">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div>
            <div className="font-bold text-slate-200 text-sm">Hyper Bingo Platform</div>
            <p className="mt-1">Real-Money Telegram Mini App & Web Game Engine for ETB.</p>
          </div>

          <div className="flex flex-wrap gap-4 text-slate-400">
            <button onClick={() => setShowResponsibleModal(true)} className="hover:text-amber-400">
              Responsible Gaming
            </button>
            <a href="#games" className="hover:text-amber-400">Terms of Service</a>
            <a href="#faq" className="hover:text-amber-400">Privacy Policy</a>
            <Link href="/admin" className="hover:text-amber-400">Admin Login</Link>
          </div>
        </div>
      </footer>

      {/* Embedded Telegram Bot Simulator Modal */}
      <BotSimulator
        isOpen={isBotOpen}
        onClose={() => setIsBotOpen(false)}
        onOpenMiniApp={openMiniAppWithTab}
      />

      {/* Embedded Telegram Mini App Container Drawer Modal */}
      {isMiniAppOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-[440px] max-h-[100vh] sm:max-h-[90vh] overflow-hidden rounded-none sm:rounded-3xl shadow-2xl relative">
            <MiniAppShell
              initialTab={miniAppTab}
              onClose={() => setIsMiniAppOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Responsible Gaming Modal (Section 29) */}
      {showResponsibleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" /> Responsible Gaming Policy
              </h3>
              <button onClick={() => setShowResponsibleModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                This platform is intended for entertainment purposes for authorized adults in target jurisdictions where legally permitted.
              </p>
              <p>
                • Set deposit limits and play within your means.<br />
                • Outcomes are determined strictly by game chance and 75-ball rules.<br />
                • Do not view gaming as a guaranteed income stream.
              </p>
            </div>

            <button
              onClick={() => setShowResponsibleModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl"
            >
              I UNDERSTAND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
