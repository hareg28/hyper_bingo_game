'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { formatETB, LOTTERY_NUMBERS_TOTAL, LOTTERY_MAX_SLOTS, HYPER_SPECIAL_RULES, isWeekendSlotCurrentlyLive } from '../../lib/bingoUtils';
import { 
  Wallet, User as UserIcon, Shield, 
  Share2, Copy, Check, LogOut, Sparkles, 
  ChevronRight, ChevronLeft, Globe, X, Users,
  Gamepad2, Zap, Eye, Megaphone
} from 'lucide-react';
import BingoGameRoom from '../game/BingoGameRoom';
import WalletManager from '../wallet/WalletManager';
import AdminPanel from '../admin/AdminPanel';
import DailyLuckyWheelModal from '../rewards/DailyLuckyWheelModal';
import { isAdminTelegramId } from '../../lib/authUtils';
import { getGameLivePrizePool } from '../../lib/store';

const SUPPORT_PHONE_1 = process.env.NEXT_PUBLIC_SUPPORT_PHONE_1 || '0912738543';
const SUPPORT_PHONE_2 = process.env.NEXT_PUBLIC_SUPPORT_PHONE_2 || '0912738543';

// Dynamic reliable display title formatter
function getGameDisplayName(g: { entryPrice: number; gameType?: string; isWeekendSpecial?: boolean; name?: string; category?: string; weekendDay?: string; weekendSlot?: string }, lang: string): string {
  if (g.category === 'HYPER_FETAN' || g.name?.includes('Fetan')) {
    return lang === 'am' ? `⚡ ፈጣን ${g.entryPrice} ብር` : `⚡ Hyper Fetan ${g.entryPrice} ETB`;
  }
  if (g.category === 'HYPER_WEEKEND' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) {
    const day = g.weekendDay === 'FRI' ? (lang === 'am' ? 'ዓርብ' : 'Friday')
      : g.weekendDay === 'SAT' ? (lang === 'am' ? 'ቅዳሜ' : 'Saturday')
      : g.weekendDay === 'SUN' ? (lang === 'am' ? 'እሑድ' : 'Sunday')
      : '';
    const slot = g.weekendSlot === '2PM' ? (lang === 'am' ? '2:00 PM (8:00)' : '2:00 PM')
      : g.weekendSlot === '6PM' ? (lang === 'am' ? '6:00 PM (12:00)' : '6:00 PM')
      : '';
    if (day && slot) {
      return `🌟 ${day} ${slot} · ${g.entryPrice} ETB`;
    }
    return lang === 'am' ? `🌟 ሃይፐር ዊክኤንድ ${g.entryPrice} ብር` : `🌟 Hyper Weekend ${g.entryPrice} ETB`;
  }
  return lang === 'am' ? `🎲 ስፔሻል ${g.entryPrice} ብር` : `🎲 Hyper Special ${g.entryPrice} ETB`;
}

export default function MiniAppShell({ 
  onClose,
  initialTab = 'lobby',
  initialGameId,
  embedded = false
}: { 
  onClose?: () => void;
  initialTab?: 'lobby' | 'game' | 'wallet' | 'profile' | 'admin' | 'lottery';
  initialGameId?: string;
  embedded?: boolean;
}) {
  const { 
    games, 
    user, 
    wallet, 
    activeGameId, 
    setActiveGameId, 
    updateGameEntryPrice,
    resetGameRound,
    promotions, 
    referrals, 
    logout, 
    joinGame,
    language,
    setLanguage,
    t,
    openAuthModal,
    toggleUserRole,
    getLotterySoldNumbers,
    purchaseLotteryNumbers,
  } = useBingo();

  const [activeTab, setActiveTab] = useState<'lobby' | 'game' | 'wallet' | 'profile' | 'admin' | 'lottery'>(initialTab);
  const [copiedRef, setCopiedRef] = useState(false);
  const [categoryTab, setCategoryTab] = useState<'FETAN' | 'SPECIAL' | 'WEEKEND'>('FETAN');
  const [selectedWeekendDay, setSelectedWeekendDay] = useState<'FRI' | 'SAT' | 'SUN'>('FRI');
  const [lotteryMode, setLotteryMode] = useState<'FETAN' | 'SPECIAL' | 'WEEKEND'>('FETAN');
  const [showLuckyWheel, setShowLuckyWheel] = useState(false);

  // Active Admin Announcement Banner & Modal State
  const [activeAnnouncement, setActiveAnnouncement] = useState<{
    id: string;
    text: string;
    title?: string;
    type?: string;
    mediaUrl?: string;
    mediaType?: string;
    fileName?: string;
    createdAt: string;
  } | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  const fetchAnnouncement = async () => {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        if (data.announcement && (data.announcement.text || data.announcement.mediaUrl)) {
          setActiveAnnouncement(data.announcement);
          const dismissedId = typeof window !== 'undefined' ? sessionStorage.getItem('dismissed_announcement_id') : null;
          if (dismissedId === data.announcement.id) {
            setAnnouncementDismissed(true);
          } else {
            setAnnouncementDismissed(false);
          }
        } else {
          setActiveAnnouncement(null);
        }
      }
    } catch (e) {
      console.error('Failed to fetch announcement:', e);
    }
  };

  useEffect(() => {
    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 20000);
    const onBroadcast = () => {
      fetchAnnouncement();
    };
    window.addEventListener('hyperbingo:bot-broadcast', onBroadcast);
    return () => {
      clearInterval(interval);
      window.removeEventListener('hyperbingo:bot-broadcast', onBroadcast);
    };
  }, []);

  const handleDismissAnnouncement = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (activeAnnouncement && typeof window !== 'undefined') {
      sessionStorage.setItem('dismissed_announcement_id', activeAnnouncement.id);
    }
    setAnnouncementDismissed(true);
  };

  const handleSelectGameToPickCards = (gameId: string, cat: 'FETAN' | 'SPECIAL' | 'WEEKEND') => {
    const targetGame = games.find((g) => g.id === gameId);
    if (targetGame && targetGame.status === 'COMPLETED') {
      resetGameRound(gameId);
    }
    setActiveGameId(gameId);
    setLotteryMode(cat);
    setActiveTab('lottery');
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialGameId) {
      setActiveGameId(initialGameId);
      setActiveTab('game');
    }
  }, [initialGameId, setActiveGameId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tgStart = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
      const gameParam = urlParams.get('game');
      const refParam = urlParams.get('ref') || urlParams.get('start') || (!gameParam && tgStart && !tgStart.startsWith('gm_') && tgStart !== 'play' ? tgStart : null);
      if (refParam) {
        sessionStorage.setItem('hb_referral_code', refParam);
        if (!user) {
          openAuthModal('register');
        }
      }
      const gParam = gameParam || (tgStart && tgStart.startsWith('gm_') ? tgStart : null);
      const catParam = urlParams.get('cat');
      if (gParam) {
        setActiveGameId(gParam);
        setActiveTab('game');
      } else if (catParam === 'FETAN' || catParam === 'SPECIAL') {
        setCategoryTab(catParam);
        setActiveTab('lobby');
      } else if (catParam === 'WEEKEND') {
        setCategoryTab('WEEKEND');
        setLotteryMode('WEEKEND');
        setActiveTab('lottery');
      }
    }
  }, [setActiveGameId]);

  const isUserAdmin = Boolean(
    user && 
    (user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  const handleCopyReferral = () => {
    if (!user) {
      openAuthModal('register');
      return;
    }
    const botUser = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'hyper_bingo_bot';
    navigator.clipboard.writeText(`https://t.me/${botUser}?start=${user.referralCode}`);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const heightStyle = embedded
    ? { flex: '1 1 0%', minHeight: 0, maxHeight: '100%', overflow: 'hidden' as const }
    : { height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' as const };

  return (
    <div className="tg-container flex flex-col bg-white text-slate-900 font-sans border-x border-slate-200" style={heightStyle}>
      {/* Telegram WebApp Frame Header - Clean White */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0 min-w-0 overflow-hidden">
        {user ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1 truncate">
                @{user.username}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
              </h3>
              <button onClick={() => window.location.reload()} className="text-[10px] text-slate-500 hover:text-slate-700 font-bold block truncate text-left cursor-pointer" title="Tap to refresh app">{t('telegramMiniApp')} v4.1 🔄</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('register')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>{language === 'am' ? 'አካውንት ክፈት' : 'Open Account'}</span>
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Admin Header Shortcut (Only for Admins) */}
          {isUserAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-2 py-1 rounded-xl font-bold text-[10px] border transition flex items-center gap-0.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
              title={t('adminDashboard')}
            >
              <Shield className="w-3 h-3 text-purple-700" />
              {t('adminTab')}
            </button>
          )}

          {/* Language Switcher: English & Amharic */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-300 text-[10px] font-black shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-1.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('am')}
              className={`px-1.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                language === 'am'
                  ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="አማርኛ"
            >
              አማ
            </button>
          </div>

          {/* Daily Spin Button — Lobby only */}
          {activeTab === 'lobby' && (
            <button
              type="button"
              onClick={() => setShowLuckyWheel(true)}
              className="px-2 py-1 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] hover:brightness-105 active:scale-95 transition flex items-center gap-1 shadow-xs cursor-pointer border border-amber-300 ring-1 ring-amber-300/50 animate-pulse"
              title={language === 'am' ? 'ዕለታዊ ነፃ እድል' : 'Daily Free Spin'}
            >
              <span className="text-xs">🎁</span>
              <span className="font-extrabold">{language === 'am' ? 'እድል' : 'Spin'}</span>
            </button>
          )}

          {/* Wallet Balance Chip */}
          <button
            onClick={() => setActiveTab('wallet')}
            className="px-2 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-black text-[10px] hover:bg-emerald-100 transition flex items-center gap-0.5 cursor-pointer"
          >
            <Wallet className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[52px]">{formatETB(wallet.availableBalance)}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active Admin Announcement Banner (Visible to everyone who opens the bot) */}
      {activeAnnouncement && !announcementDismissed && (
        <div 
          onClick={() => setShowAnnouncementModal(true)}
          className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 px-3 py-2 flex items-center justify-between gap-2 shadow-xs cursor-pointer border-b border-amber-500 hover:brightness-105 transition"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-amber-300 text-xs shadow-xs animate-bounce">
              📢
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] uppercase tracking-wider font-black text-slate-900/80 flex items-center gap-1">
                {language === 'am' ? 'የአስተዳዳሪ ማስታወቂያ' : 'Admin Announcement'}
                {activeAnnouncement.mediaType === 'photo' && (
                  <span className="text-[9px] bg-slate-950/20 px-1 py-0.2 rounded font-black text-slate-900">📸 Image</span>
                )}
                {activeAnnouncement.mediaType === 'document' && (
                  <span className="text-[9px] bg-slate-950/20 px-1 py-0.2 rounded font-black text-slate-900">📄 Doc</span>
                )}
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
              </span>
              <p className="text-xs font-bold truncate text-slate-950 leading-tight">
                {(activeAnnouncement.text || (activeAnnouncement.mediaType === 'photo' ? '📸 New Photo Broadcast' : '📄 New Document Broadcast')).replace(/<[^>]*>?/gm, '')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black bg-slate-950/20 text-slate-950 px-2 py-0.5 rounded-md hover:bg-slate-950/30">
              {language === 'am' ? 'ሙሉውን ይመልከቱ' : 'View'}
            </span>
            <button
              type="button"
              onClick={handleDismissAnnouncement}
              className="p-1 rounded-md hover:bg-slate-950/20 text-slate-950 transition cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div 
        className={`flex-1 min-h-0 overflow-x-hidden ${
          activeTab === 'game' || activeTab === 'lottery' 
            ? 'overflow-hidden flex flex-col min-h-0' 
            : 'overflow-y-auto overscroll-y-contain p-3 pb-36 space-y-3 bg-slate-50/70'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* LOBBY TAB */}
        {activeTab === 'lobby' && (
          <div className="space-y-3">
            {/* 3 Categories Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setCategoryTab('FETAN')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  categoryTab === 'FETAN'
                    ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-600 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="flex items-center gap-1 font-black">⚡ {language === 'am' ? 'ሃይፐር ፈጣን' : 'Hyper Fetan'}</span>
                <span className={`text-[9px] font-bold ${categoryTab === 'FETAN' ? 'text-amber-950' : 'text-slate-500'}`}>
                  10 ETB {language === 'am' ? 'ብቻ' : 'ONLY'} · 500 {language === 'am' ? 'ካርድ' : 'Cards'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryTab('SPECIAL')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  categoryTab === 'SPECIAL'
                    ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-600 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="flex items-center gap-1 font-black">🎲 {language === 'am' ? 'ሃይፐር ስፔሻል' : 'Hyper Special'}</span>
                <span className={`text-[9px] font-bold ${categoryTab === 'SPECIAL' ? 'text-amber-950' : 'text-slate-500'}`}>
                  10-100+ ETB · {language === 'am' ? 'የተጫዋች/ምክር ዋጋ' : 'Player/Rec Stake'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategoryTab('WEEKEND')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  categoryTab === 'WEEKEND'
                    ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-600 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="flex items-center gap-1 font-black">🌟 {language === 'am' ? 'ሃይፐር ዊክኤንድ' : 'Hyper Weekend'}</span>
                <span className={`text-[9px] font-bold ${categoryTab === 'WEEKEND' ? 'text-amber-950' : 'text-slate-500'}`}>
                  50 ETB · 1500 {language === 'am' ? 'ካርድ' : 'Cards'}
                </span>
              </button>
            </div>



            {/* When WEEKEND is selected: Show 3 Day Sub-groups: Friday, Saturday, Sunday */}
            {categoryTab === 'WEEKEND' && (
              <div className="bg-white p-2.5 rounded-2xl border border-amber-300 shadow-xs space-y-2 mb-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                    <span>📅</span> {language === 'am' ? 'የዕለት ንዑስ ክፍል (3 ቀናት):' : 'Weekend Day Subgroups:'}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700">
                    {language === 'am' ? '2:00 እና 6:00 PM (8:00 እና 12:00 ሰዓት)' : '2:00 PM & 6:00 PM Draws'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['FRI', 'SAT', 'SUN'] as const).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedWeekendDay(day)}
                      className={`py-2 px-1.5 rounded-xl text-xs font-black transition cursor-pointer border-2 text-center flex flex-col items-center justify-center gap-0.5 ${
                        selectedWeekendDay === day
                          ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-sm scale-[1.02]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-amber-300'
                      }`}
                    >
                      <span>
                        {day === 'FRI' ? (language === 'am' ? '📅 ዓርብ' : '📅 Friday')
                          : day === 'SAT' ? (language === 'am' ? '📅 ቅዳሜ' : '📅 Saturday')
                          : (language === 'am' ? '📅 እሑድ' : '📅 Sunday')}
                      </span>
                      <span className={`text-[9px] ${selectedWeekendDay === day ? 'text-slate-950 font-bold' : 'text-slate-500'}`}>
                        2 {language === 'am' ? 'ዕጣዎች' : 'Draws'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Games List (Styled like Hyper Special Live Room) */}
            <div className="space-y-2">
              {games
                .filter((g) => {
                  if (categoryTab === 'FETAN') {
                    return (g.category === 'HYPER_FETAN' || g.name?.includes('Fetan')) && g.category !== 'HYPER_SPECIAL' && !g.id.includes('special');
                  }
                  if (categoryTab === 'SPECIAL') {
                    return g.category === 'HYPER_SPECIAL' || g.id.includes('special');
                  }
                  // WEEKEND: filter by selected weekend day subgroup
                  const isWknd = g.category === 'HYPER_WEEKEND' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial;
                  if (!isWknd) return false;
                  if (g.weekendDay) {
                    return g.weekendDay === selectedWeekendDay;
                  }
                  return true;
                })
                .sort((a, b) => (a.weekendSlot === '2PM' ? -1 : 1))
                .map((g) => (
                  <div
                    key={g.id}
                    className="bg-white p-3.5 rounded-2xl flex items-center justify-between border border-slate-200 shadow-xs hover:border-amber-400 transition"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-slate-900">{getGameDisplayName(g, language)}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          categoryTab === 'FETAN' ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : categoryTab === 'WEEKEND' ? 'bg-purple-100 text-purple-900 border border-purple-300'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                        }`}>
                          {categoryTab === 'FETAN' ? (language === 'am' ? '1 መስመር/ማዕዘን' : '1 Line / Corners')
                            : categoryTab === 'WEEKEND' ? (language === 'am' ? 'ሙሉ ቤት' : 'Full House Only')
                            : (() => {
                                const rule = HYPER_SPECIAL_RULES[Math.abs(g.activeSpecialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
                                return language === 'am' ? rule.nameAm : rule.nameEn;
                              })()}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          (g.category === 'HYPER_WEEKEND' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial)
                            ? (isWeekendSlotCurrentlyLive(g)
                                ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                                : 'bg-purple-100 text-purple-900 border border-purple-300')
                            : g.status === 'RUNNING' ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : g.status === 'STARTING' ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {(g.category === 'HYPER_WEEKEND' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial)
                            ? (isWeekendSlotCurrentlyLive(g)
                                ? '● LIVE'
                                : (language === 'am' ? '📅 የተያዘለት (ክፍት)' : '📅 SCHEDULED'))
                            : g.status === 'RUNNING' ? '● LIVE' : g.status === 'STARTING' ? 'STARTING' : 'OPEN'}
                        </span>
                      </div>


                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span>Entry: <strong className="text-slate-900">{formatETB(g.entryPrice)}</strong></span>
                        <span className="flex items-center gap-1 text-amber-700 font-black">
                          🏆 {language === 'am' ? 'ሽልማት' : 'Prize'}: <strong className="text-amber-900">{formatETB(getGameLivePrizePool(g))}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-emerald-700 font-black">
                          <Users className="w-3 h-3" />
                          {g.currentPlayers || 0} {language === 'am' ? 'ተጫዋቾች' : 'players'}
                        </span>
                        {categoryTab === 'FETAN' && (
                          <span className="text-amber-800 font-bold text-[10px]">
                            ⚡ {language === 'am' ? '1 ደቂቃ ዙር' : '1 Min Round'}
                          </span>
                        )}
                        {categoryTab === 'WEEKEND' && (
                          <span className="text-purple-800 font-bold text-[10px]">
                            🏆 {language === 'am' ? '30k+ ብር ጃክፖት' : '30k+ ETB Jackpot'}
                          </span>
                        )}
                        {g.blockedCards && g.blockedCards.length > 0 && (
                          <span className="text-rose-600 font-bold flex items-center gap-0.5 text-[10px]">
                            🚫 {g.blockedCards.length} {language === 'am' ? 'የታገዱ' : 'Blocked'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      {/* Watch / Spectate Button: Allows player to view live game without buying cards */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGameId(g.id);
                          setActiveTab('game');
                        }}
                        className="px-2.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 cursor-pointer border border-slate-200"
                        title={language === 'am' ? 'ጨዋታውን በቀጥታ ይመልከቱ' : 'Watch game live'}
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">{language === 'am' ? 'እይ' : 'Watch'}</span>
                      </button>

                      {/* For Special: Choose Cards Button */}
                      {categoryTab === 'SPECIAL' && (
                        <button
                          type="button"
                          onClick={() => handleSelectGameToPickCards(g.id, 'SPECIAL')}
                          className="px-2.5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1 cursor-pointer shadow-xs border border-amber-600"
                          title={language === 'am' ? 'ካርድ ግዛ' : 'Buy Card'}
                        >
                          <span>{language === 'am' ? 'ካርድ ግዛ' : 'Buy Card'}</span>
                        </button>
                      )}

                      {/* Main Play Button */}
                      <button
                        onClick={() => {
                          if (categoryTab === 'SPECIAL') {
                            if (g.status === 'COMPLETED') {
                              resetGameRound(g.id);
                            }
                            setActiveGameId(g.id);
                            setActiveTab('game');
                          } else {
                            handleSelectGameToPickCards(g.id, categoryTab);
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-xs cursor-pointer ${
                          categoryTab === 'SPECIAL'
                            ? 'bg-slate-950 hover:bg-slate-800 text-white'
                            : categoryTab === 'WEEKEND'
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        }`}
                      >
                        <span>
                          {categoryTab === 'SPECIAL'
                            ? (language === 'am' ? 'ተጫወት' : 'PLAY')
                            : (language === 'am' ? 'ካርድ ግዛ' : 'Buy Card')}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* 🎁 Welcome Bonus Info Card - shown only for non-logged-in users */}
            {!user && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-white text-base">
                    🎁
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-emerald-900">
                      {language === 'am' ? '🎉 20 ብር የእንኳን ደህና መጡ ቦነስ!' : '🎉 20 ETB Welcome Bonus!'}
                    </h4>
                    <p className="text-[10px] text-emerald-700 mt-0.5 leading-snug">
                      {language === 'am'
                        ? 'አካውንት ሲፈጥሩ 20 ብር ቦነስ ወዲያው ይጨምርልዎታል። ቦነስ ለጨዋታ ብቻ ያገለግላል — ማውጣት አይቻልም።'
                        : 'Create an account and get 20 ETB bonus instantly. Bonus is for playing only — cannot be withdrawn.'}
                    </p>
                  </div>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-[10px] transition cursor-pointer shrink-0 shadow-xs"
                  >
                    {language === 'am' ? 'ክፈት' : 'Join'}
                  </button>
                </div>
              </div>
            )}

            {/* Contact / Support Card */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-3 text-white shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 text-slate-950 font-black text-base">
                  📞
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-amber-400 leading-none mb-1">
                    Support / ድጋፍ (24/7)
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <a
                      href={`tel:${SUPPORT_PHONE_1.replace(/\s+/g, '')}`}
                      className="text-xs font-black text-white hover:text-amber-300 transition flex items-center gap-1"
                    >
                      <span className="text-[10px] text-amber-300 font-bold">1:</span> {SUPPORT_PHONE_1}
                    </a>
                    <a
                      href={`tel:${SUPPORT_PHONE_2.replace(/\s+/g, '')}`}
                      className="text-xs font-black text-white hover:text-amber-300 transition flex items-center gap-1"
                    >
                      <span className="text-[10px] text-amber-300 font-bold">2:</span> {SUPPORT_PHONE_2}
                    </a>
                  </div>
                  <a
                    href="https://t.me/HyperBingoSupport"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-300 hover:text-amber-300 transition block leading-tight mt-1"
                  >
                    @HyperBingoSupport
                  </a>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-none">Weekend Draw</p>
                  <p className="text-[10px] text-amber-300 font-black whitespace-nowrap">Fri, Sat & Sun</p>
                  <p className="text-[10px] text-white font-bold whitespace-nowrap">2:00 & 6:00 PM (8:00 & 12:00)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GAME ROOM TAB */}
        {activeTab === 'game' && (
          <BingoGameRoom
            gameId={activeGameId || games[0].id}
            onBack={() => setActiveTab('lobby')}
            onChangeGameId={(newId) => setActiveGameId(newId)}
            onOpenLotteryTab={() => setActiveTab('lottery')}
            onOpenWalletTab={() => setActiveTab('wallet')}
          />
        )}

        {/* LOTTERY / CARD PICKER TAB */}
        {activeTab === 'lottery' && (
          <WeekendLotteryNumberPicker
            mode={lotteryMode}
            games={games}
            user={user}
            wallet={wallet}
            language={language}
            openAuthModal={openAuthModal}
            getLotterySoldNumbers={getLotterySoldNumbers}
            purchaseLotteryNumbers={purchaseLotteryNumbers}
            activeGameId={activeGameId || undefined}
            onChangeGameId={(newId) => setActiveGameId(newId)}
            onPickCards={(gameId, cardNumbers) => {
              if (!user) { openAuthModal('register'); return; }
              if (cardNumbers.length > 0) {
                joinGame(gameId, cardNumbers);
              }
              setActiveGameId(gameId);
              setActiveTab('game');
            }}
            onBack={() => setActiveTab('lobby')}
          />
        )}

        {/* WALLET TAB */}
        {activeTab === 'wallet' && <WalletManager />}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && (
          isUserAdmin ? (
            <AdminPanel isStandalone={false} />
          ) : (
            <div className="bg-white p-6 rounded-2xl text-center space-y-3 border border-rose-200 shadow-sm">
              <Shield className="w-12 h-12 text-rose-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
              <p className="text-xs text-slate-500">
                Only Telegram IDs configured in the environment whitelist (ADMIN_TELEGRAM_IDS) have administrator privileges.
              </p>
              <button
                onClick={() => setActiveTab('lobby')}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
          )
        )}

        {/* PROFILE & REFERRALS TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {!user ? (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
                  <UserIcon className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900">
                    {language === 'am' ? 'የእንግዳ ተጠቃሚ' : 'Guest Player'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    {language === 'am'
                      ? 'እውነተኛ ገንዘብ የሚያሸልሙ የቢንጎ ጨዋታዎችን ለመጫወት እና አሸናፊነትዎን በቴሌብር እና ሲቢኢ ለማውጣት አካውንት ይክፈቱ።'
                      : 'Open an account with your Ethiopian phone number to play real-money games and withdraw winnings via Telebirr or CBE Birr.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => openAuthModal('register')}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{language === 'am' ? 'አካውንት ክፈት (20 ብር ቦነስ)' : 'Open Account (20 ETB Bonus)'}</span>
                  </button>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-300 cursor-pointer"
                  >
                    {language === 'am' ? 'አካውንት አለኝ • ግባ' : 'Already have an account? Sign In'}
                  </button>
                  <div className="pt-2 text-center text-[11px] text-slate-500 space-y-0.5">
                    <div>📞 {language === 'am' ? 'የደንበኞች ድጋፍ:' : 'Customer Support:'}</div>
                    <div className="flex items-center justify-center gap-2 font-bold text-amber-600 flex-wrap">
                      <a href={`tel:${SUPPORT_PHONE_1.replace(/\s+/g, '')}`} className="hover:underline">{SUPPORT_PHONE_1}</a>
                      <span>•</span>
                      <a href={`tel:${SUPPORT_PHONE_2.replace(/\s+/g, '')}`} className="hover:underline">{SUPPORT_PHONE_2}</a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 text-xl font-black shadow-xs">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{user.name}</h3>
                        <p className="text-xs text-slate-500">@{user.username} • ID: {user.telegramId}</p>
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                          {t('verifiedUser')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
                        user.role === 'admin' 
                          ? 'bg-amber-100 text-amber-900 border-amber-300' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {user.role === 'admin' ? t('adminRole') : t('playerRole')}
                      </span>
                    </div>
                  </div>

                  {/* Admin Mode Switcher Button inside Profile */}
                  {isUserAdmin && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-amber-600" />
                          {user.role === 'admin' ? t('adminModeActive') : t('playerModeActive')}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {t('inBotAdminNotice')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          toggleUserRole();
                          if (user.role !== 'admin') setActiveTab('admin');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        {user.role === 'admin' ? t('switchToPlayer') : t('switchToAdmin')}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500">{t('phoneNumber')}</span>
                      <div className="font-mono font-bold text-slate-900 mt-0.5">{user.phone || 'Not set'}</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500">{t('registered')}</span>
                      <div className="text-slate-900 font-bold mt-0.5">Active</div>
                    </div>
                  </div>
                </div>

                {/* Referral Program Card */}
                <div className="bg-white p-4 rounded-2xl border border-amber-300 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-amber-600" /> {t('telegramReferral')}
                    </h4>
                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      1% Win Commission
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Invite friends to Hyper Bingo! Whenever your invited friend wins a game, you automatically earn <strong>1% of the house profit</strong> credited directly to your play-only bonus balance!
                  </p>

                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      readOnly
                      value={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'hyper_bingo_bot'}?start=${user.referralCode}`}
                      className="flex-1 bg-transparent text-xs text-slate-700 font-mono focus:outline-none px-2"
                    />
                    <button
                      onClick={handleCopyReferral}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedRef ? t('copied') : t('copy')}
                    </button>
                  </div>

                  {/* Referrals list */}
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">{t('yourReferrals')} ({referrals.length})</div>
                    {referrals.length > 0 ? (
                      referrals.map((ref) => (
                        <div key={ref.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-slate-800 font-medium">{ref.referredName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ref.status === 'REWARDED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ref.status} (+{ref.rewardAmount} ETB)
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No referrals yet. Share your link above!</p>
                    )}
                  </div>
                </div>

                {/* Customer Support Contact */}
                <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-2 border border-slate-800 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📞</span> {language === 'am' ? 'የደንበኞች አገልግሎት እና ድጋፍ' : 'Customer Support & Help'}
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">24/7 Live</span>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl">
                      <span className="text-slate-400 text-[11px] font-medium">ስልክ 1 (Phone 1):</span>
                      <a href={`tel:${SUPPORT_PHONE_1.replace(/\s+/g, '')}`} className="font-bold text-amber-300 hover:underline">
                        {SUPPORT_PHONE_1}
                      </a>
                    </div>
                    <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl">
                      <span className="text-slate-400 text-[11px] font-medium">ስልክ 2 (Phone 2):</span>
                      <a href={`tel:${SUPPORT_PHONE_2.replace(/\s+/g, '')}`} className="font-bold text-amber-300 hover:underline">
                        {SUPPORT_PHONE_2}
                      </a>
                    </div>
                    <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl">
                      <span className="text-slate-400 text-[11px] font-medium">ቴሌግራም (Telegram):</span>
                      <a href="https://t.me/HyperBingoSupport" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-300 hover:underline">
                        @HyperBingoSupport
                      </a>
                    </div>
                    <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-xl">
                      <span className="text-slate-400 text-[11px] font-medium">የዊክኤንድ ጨዋታ (Weekend Draw):</span>
                      <span className="font-bold text-emerald-300 text-[11px]">Fri, Sat, Sun: 2:00 PM & 6:00 PM (8:00 & 12:00)</span>
                    </div>
                  </div>
                </div>

                {/* Logout / Switch Account */}
                <div className="pt-1">
                  <button
                    onClick={logout}
                    className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>{language === 'am' ? 'ከአካውንት ውጣ / ቀይር' : 'Sign Out / Switch Account'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sticky Telegram Navigation Bar - Clean White */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] shrink-0 w-full mt-auto">
        <button
          onClick={() => setActiveTab('lobby')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
            activeTab === 'lobby' ? 'text-amber-600 font-black bg-amber-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          <span>{language === 'am' ? 'ሎቢ' : 'Lobby'}</span>
        </button>

        <button
          onClick={() => setActiveTab('game')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
            activeTab === 'game' ? 'text-amber-600 font-black bg-amber-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Zap className="w-5 h-5" />
          <span>{language === 'am' ? 'አዲስ ክፍል' : 'Live'}</span>
        </button>

        <button
          onClick={() => {
            setLotteryMode(categoryTab);
            setActiveTab('lottery');
          }}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
            activeTab === 'lottery' ? 'text-amber-600 font-black bg-amber-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>{language === 'am' ? 'ካርዶች / ሎተሪ' : 'Cards / Lottery'}</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
            activeTab === 'wallet' ? 'text-amber-600 font-black bg-amber-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span>{language === 'am' ? 'ኪስ ቦርሳ' : 'Wallet'}</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
            activeTab === 'profile' ? 'text-amber-600 font-black bg-amber-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span>{language === 'am' ? 'መገለጫ' : 'Profile'}</span>
        </button>

        {isUserAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
              activeTab === 'admin' ? 'text-purple-700 font-black bg-purple-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span>{language === 'am' ? 'አስተዳዳሪ' : 'Admin'}</span>
          </button>
        )}
      </div>

      {/* DAILY LUCKY WHEEL MODAL */}
      <DailyLuckyWheelModal
        isOpen={showLuckyWheel}
        onClose={() => setShowLuckyWheel(false)}
      />

      {/* FULL ANNOUNCEMENT MODAL */}
      {showAnnouncementModal && activeAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 relative text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-amber-400 uppercase tracking-wide">
                    {language === 'am' ? 'የአስተዳዳሪ ማስታወቂያ' : 'Official Announcement'}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {new Date(activeAnnouncement.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attached Photo Preview */}
            {activeAnnouncement.mediaUrl && (activeAnnouncement.mediaType === 'photo' || !activeAnnouncement.mediaType) && (
              <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 flex items-center justify-center max-h-72 shadow-lg">
                <img
                  src={activeAnnouncement.mediaUrl}
                  alt="Announcement Media"
                  className="w-full max-h-72 object-contain rounded-xl"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes('/api/telegram/media') && activeAnnouncement.mediaUrl?.includes('api.telegram.org')) {
                      const match = activeAnnouncement.mediaUrl.match(/file_[^.]+/);
                      if (match) target.src = `/api/telegram/media?file_id=${match[0]}`;
                    }
                  }}
                />
              </div>
            )}

            {/* Attached Document Card */}
            {activeAnnouncement.mediaUrl && activeAnnouncement.mediaType === 'document' && (
              <a
                href={activeAnnouncement.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={activeAnnouncement.fileName || 'document.pdf'}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/50 hover:bg-indigo-900/60 transition text-indigo-200 shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl shrink-0">📄</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white truncate">{activeAnnouncement.fileName || 'Attached Document'}</p>
                    <span className="text-[10px] text-indigo-300 font-bold">Tap to view / download document</span>
                  </div>
                </div>
                <span className="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl shrink-0 shadow-xs">
                  Download
                </span>
              </a>
            )}

            <div className="max-h-64 overflow-y-auto pr-1 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
              {(activeAnnouncement.text || (activeAnnouncement.mediaType === 'photo' ? '📸 Picture Announcement' : '📄 Document Announcement')).replace(/<[^>]*>?/gm, '')}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowAnnouncementModal(false);
                  setActiveTab('lobby');
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs hover:brightness-105 active:scale-98 transition shadow-md cursor-pointer text-center"
              >
                {language === 'am' ? '🎮 አሁኑኑ ይጫወቱ' : '🎮 Play Hyper Bingo Now'}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDismissAnnouncement();
                  setShowAnnouncementModal(false);
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                {language === 'am' ? 'ዝጋ' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================================
// Fast / Weekend Lottery Number Card Picker
// (Shows 1-500 number grid, 5 card slots S1..S5 to fill, Rule & Hit Info)
// ================================================================
function WeekendLotteryNumberPicker({
  games,
  user,
  wallet,
  language,
  openAuthModal,
  getLotterySoldNumbers,
  purchaseLotteryNumbers,
  onPickCards,
  onBack,
  activeGameId,
  onChangeGameId,
  mode = 'WEEKEND',
  hideBackBtn = false,
  onUpdateGameEntryPrice,
}: {
  onUpdateGameEntryPrice?: (gameId: string, price: number) => void;
  games: ReturnType<typeof useBingo>['games'];
  user: ReturnType<typeof useBingo>['user'];
  wallet: ReturnType<typeof useBingo>['wallet'];
  language: string;
  openAuthModal: (mode?: 'register' | 'login') => void;
  getLotterySoldNumbers: ReturnType<typeof useBingo>['getLotterySoldNumbers'];
  purchaseLotteryNumbers: ReturnType<typeof useBingo>['purchaseLotteryNumbers'];
  onPickCards: (gameId: string, cardNumbers: string[]) => void;
  onBack?: () => void;
  activeGameId?: string;
  onChangeGameId?: (gameId: string) => void;
  mode?: 'FETAN' | 'SPECIAL' | 'WEEKEND';
  hideBackBtn?: boolean;
}) {
  const isAm = language === 'am';
  
  const targetGames = React.useMemo(() => {
    if (mode === 'FETAN') {
      const list = games.filter(
        (g) => (g.category === 'HYPER_FETAN' || g.name?.includes('Fetan')) && g.category !== 'HYPER_SPECIAL' && !g.id.includes('special')
      );
      return list.slice(0, 1);
    }
    if (mode === 'SPECIAL') {
      const list = games.filter(
        (g) => g.category === 'HYPER_SPECIAL' || g.id.includes('special')
      );
      return list.slice(0, 1);
    }
    if (mode === 'WEEKEND') {
      return games.filter(
        (g) => g.category === 'HYPER_WEEKEND' || g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial
      );
    }
    return [];
  }, [games, mode]);

  // Find game by activeGameId if provided, otherwise default
  const getDefaultIdx = React.useCallback((tGames: typeof targetGames, aId?: string) => {
    if (aId) {
      const idx = tGames.findIndex((g) => g.id === aId);
      if (idx >= 0) return idx;
    }
    if (mode === 'FETAN') {
      const idx10 = tGames.findIndex((g) => g.entryPrice === 10);
      return idx10 >= 0 ? idx10 : 0;
    }
    if (mode === 'SPECIAL') {
      const idx20 = tGames.findIndex((g) => g.entryPrice === 20);
      return idx20 >= 0 ? idx20 : 0;
    }
    const idx50 = tGames.findIndex((g) => g.entryPrice === 50);
    return idx50 >= 0 ? idx50 : 0;
  }, [mode]);

  const [selectedGameIdx, setSelectedGameIdx] = React.useState(() => getDefaultIdx(targetGames, activeGameId));

  React.useEffect(() => {
    setSelectedGameIdx(getDefaultIdx(targetGames, activeGameId));
  }, [activeGameId, targetGames, getDefaultIdx]);

  const entryPrice = selectedGame?.entryPrice || (mode === 'FETAN' ? 10 : mode === 'SPECIAL' ? 20 : 50);

  const TOTAL_NUMBERS = mode === 'FETAN' ? 500 : 1500;
  const NUM_SLOTS = LOTTERY_MAX_SLOTS;
  const [slotNumbers, setSlotNumbers] = React.useState<(number | null)[]>(
    Array.from({ length: NUM_SLOTS }, () => null)
  );
  const [purchaseFeedback, setPurchaseFeedback] = React.useState<string | null>(null);
  const [drawCountdown, setDrawCountdown] = React.useState('00:00:00');
  const [fetanSeconds, setFetanSeconds] = React.useState(60);
  const [fetanIsIntermission, setFetanIsIntermission] = React.useState(false);

  // Synchronized clocks: 60s active / 30s pick loop for Fetan; 2pm/5pm/7pm countdown for Weekend
  React.useEffect(() => {
    if (mode === 'FETAN') {
      const updateFetanClock = () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const nowSec = Math.floor(Date.now() / 1000);
        const cycle = nowSec % 90; // 60s live + 30s card pick
        if (cycle < 60) {
          setFetanIsIntermission(false);
          setFetanSeconds(60 - cycle);
        } else {
          setFetanIsIntermission(true);
          setFetanSeconds(90 - cycle);
        }
      };
      updateFetanClock();
      const interval = setInterval(updateFetanClock, 1000);
      return () => clearInterval(interval);
    } else {
      const updateCountdown = () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        const totalSecToday = currentHour * 3600 + currentMinute * 60 + currentSecond;

        const slot1Sec = 14 * 3600; // 2:00 PM (ከሰዓት 8:00)
        const slot2Sec = 18 * 3600; // 6:00 PM (ምሽት 12:00)

        let diffSec = 0;
        if (totalSecToday < slot1Sec) {
          diffSec = slot1Sec - totalSecToday;
        } else if (totalSecToday < slot2Sec) {
          diffSec = slot2Sec - totalSecToday;
        } else {
          diffSec = (24 * 3600 - totalSecToday) + slot1Sec;
        }

        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        setDrawCountdown(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const soldSet = React.useMemo(() => {
    if (!selectedGame) return new Set<number>();
    return getLotterySoldNumbers(selectedGame.id);
  }, [selectedGame?.id, getLotterySoldNumbers]);

  const activeSlotSet = new Set(slotNumbers.filter((n): n is number => n !== null));
  const slotCountFilled = slotNumbers.filter((n) => n !== null).length;
  const totalCost = slotCountFilled * entryPrice;
  const playableBalance = wallet.availableBalance + wallet.bonusBalance;
  const canAfford = playableBalance >= totalCost;
  const firstEmptySlotIdx = slotNumbers.findIndex((n) => n === null);

  const handlePickNumber = (num: number) => {
    if (!user) { openAuthModal('register'); return; }
    if (soldSet.has(num)) return;
    const existingIdx = slotNumbers.indexOf(num);
    if (existingIdx >= 0) {
      const next = [...slotNumbers];
      next[existingIdx] = null;
      setSlotNumbers(next);
      return;
    }
    if (firstEmptySlotIdx < 0) return;
    const next = [...slotNumbers];
    next[firstEmptySlotIdx] = num;
    setSlotNumbers(next);
  };

  const clearSlot = (slotIdx: number) => {
    const next = [...slotNumbers];
    next[slotIdx] = null;
    setSlotNumbers(next);
  };

  const handleBuy = () => {
    if (!user) { openAuthModal('register'); return; }
    if (!selectedGame || slotCountFilled === 0) return;
    if (!canAfford) return;
    const nums = slotNumbers.filter((n): n is number => n !== null);
    const result = purchaseLotteryNumbers(selectedGame.id, nums);
    setPurchaseFeedback(result.message);
    setTimeout(() => setPurchaseFeedback(null), 3500);
    if (result.success) {
      setSlotNumbers(Array.from({ length: NUM_SLOTS }, () => null));
      onPickCards(selectedGame.id, result.purchased || nums.map((n) => String(n).padStart(4, '0')));
    }
  };

  const regCode = user ? user.referralCode?.toUpperCase() || '---' : '---';

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto overscroll-contain bg-slate-100 pb-36 select-none">
      {/* Sticky Header with Back button, Title & Balance (Only if not embedded in lobby) */}
      {!hideBackBtn && (
        <div className="bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between shrink-0 shadow-xs sticky top-0 z-30">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h3 className="text-xs font-black text-slate-900 leading-tight flex items-center gap-1">
                <span>{mode === 'FETAN' ? '⚡' : '🌟'}</span>
                <span>
                  {mode === 'FETAN' 
                    ? (isAm ? 'ሃይፐር ፈጣን ካርዶች (1-500)' : 'Hyper Fetan Cards (1-500)')
                    : (isAm 
                        ? `${selectedGame?.weekendDay === 'FRI' ? 'የዓርብ' : selectedGame?.weekendDay === 'SAT' ? 'የቅዳሜ' : 'የእሑድ'} ሜጋ ሎተሪ (1-1500)`
                        : `${selectedGame?.weekendDay === 'FRI' ? 'Friday' : selectedGame?.weekendDay === 'SAT' ? 'Saturday' : 'Sunday'} Mega Lottery (1-1500)`)}
                </span>
              </h3>
              <span className="text-[10px] text-slate-500 font-bold">
                {mode === 'FETAN' 
                  ? (isAm ? '1 ደቂቃ ዙር · 30 ሰከንድ ካርድ መምረጫ · 500 ካርዶች' : '1 Min Round · 30s Card Pick · 500 Cards')
                  : (isAm ? '50 ብር · 2:00 እና 6:00 PM · ሙሉ ቤት ብቻ (24/24)' : '50 ETB · 2:00 PM & 6:00 PM · Full House Only')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPickCards(selectedGame?.id || 'gm_weekend_fri_2pm', [])}
              className="px-2 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs cursor-pointer"
              title={isAm ? 'ጨዋታውን በቀጥታ ይመልከቱ' : 'Watch live game'}
            >
              <Eye className="w-3 h-3" />
              <span>{isAm ? 'እይ' : 'Watch'}</span>
            </button>
            <div className="px-2 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-black text-[10px] flex items-center gap-1 shadow-2xs">
              <Wallet className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{wallet.availableBalance} ETB</span>
            </div>
          </div>
        </div>
      )}



      {/* ⏳ TIMING CLOCK BANNER */}
      {mode === 'FETAN' ? (
        <div className={`mx-2 mt-2 p-2.5 rounded-2xl border text-white shadow-md flex items-center justify-between gap-2 ${
          fetanIsIntermission 
            ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950 border-emerald-400/50' 
            : 'bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-amber-400/40'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 animate-pulse ${
              fetanIsIntermission ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'
            }`}>
              {fetanIsIntermission ? '🎟️' : '⚡'}
            </div>
            <div className="min-w-0">
              <span className={`text-[9px] uppercase tracking-widest font-black block leading-none ${
                fetanIsIntermission ? 'text-emerald-300' : 'text-amber-300'
              }`}>
                {fetanIsIntermission 
                  ? (isAm ? 'የካርድ መምረጫ ጊዜ (30 ሰከንድ):' : 'PICK YOUR CARDS (30s INTERMISSION):')
                  : (isAm ? 'ፈጣን ዙር በመካሄድ ላይ (1 ደቂቃ):' : 'FAST ROUND IN PROGRESS (1 MIN):')
                }
              </span>
              <span className="text-[10px] text-slate-300 font-bold truncate block mt-0.5">
                {fetanIsIntermission 
                  ? (isAm ? 'ካርዶችን ይምረጡ · ቀጣዩ ዙር በቅርቡ ይጀምራል' : 'Select your cards now · Next round starting!')
                  : (isAm ? `ዙሩ በ ${fetanSeconds} ሰከንድ ውስጥ ይጠናቀቃል · 30 ሰከንድ ምርጫ ይቀጥላል` : `Round ends in ${fetanSeconds}s · 30s card pick follows`)
                }
              </span>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-xl border font-mono font-black text-sm tracking-widest tabular-nums shadow-inner shrink-0 ${
            fetanIsIntermission 
              ? 'bg-emerald-400/10 border-emerald-400/50 text-emerald-300 animate-pulse'
              : 'bg-amber-400/10 border-amber-400/40 text-amber-300'
          }`}>
            00:{fetanSeconds.toString().padStart(2, '0')}
          </div>
        </div>
      ) : mode === 'SPECIAL' ? (
        <div className="mx-2 mt-2 p-2.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-indigo-400/40 text-white shadow-md flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-base shrink-0 animate-pulse">
              🎲
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase tracking-widest text-indigo-300 font-black block leading-none">
                {isAm ? 'የስፔሻል ክፍል ካርድ መምረጫ:' : 'SPECIAL CARD SELECTION:'}
              </span>
              <span className="text-[10px] text-slate-300 font-bold truncate block mt-0.5">
                {selectedGame?.name || 'Hyper Special'} · {isAm ? 'እስከ 5 ካርዶች ይምረጡ' : 'Select up to 5 cards (S1..S5)'}
              </span>
            </div>
          </div>
          <div className="px-3 py-1 rounded-xl bg-indigo-400/10 border border-indigo-400/40 text-indigo-300 font-mono font-black text-xs tracking-wider shrink-0">
            {selectedGame?.status === 'RUNNING' ? '● LIVE' : 'STARTING'}
          </div>
        </div>
      ) : null}

      {/* ── Subgroup / Stake Tier Selector ── */}
      {mode === 'WEEKEND' ? (
        <div className="mx-2 mt-2 p-2.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 shadow-xs space-y-2 shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
              <span>🌟</span>
              <span>
                {isAm
                  ? `${selectedGame?.weekendDay === 'FRI' ? 'የዓርብ' : selectedGame?.weekendDay === 'SAT' ? 'የቅዳሜ' : 'የእሑድ'} ዕጣ (24/24 ሙሉ ቤት)`
                  : `${selectedGame?.weekendDay === 'FRI' ? 'Friday' : selectedGame?.weekendDay === 'SAT' ? 'Saturday' : 'Sunday'} Draw (Full House)`}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-amber-950 bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300">
                50 ETB · 50k ETB
              </span>
              <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-0.5">
                ⏳ {drawCountdown}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['2PM', '6PM'] as const).map((slot) => {
              const currentDay = selectedGame?.weekendDay || 'FRI';
              const isSlotSelected = (selectedGame?.weekendSlot || '2PM') === slot;
              const match = targetGames.find(g => (g.weekendDay || 'FRI') === currentDay && g.weekendSlot === slot) ||
                            targetGames.find(g => g.weekendSlot === slot);
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    if (match) {
                      const idx = targetGames.findIndex(g => g.id === match.id);
                      if (idx >= 0) setSelectedGameIdx(idx);
                      if (onChangeGameId) onChangeGameId(match.id);
                    }
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-black transition cursor-pointer border-2 text-center flex items-center justify-center gap-1.5 ${
                    isSlotSelected
                      ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-sm'
                      : 'bg-white border-amber-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <span className="text-xs font-black">
                    {slot === '2PM' ? (isAm ? '⏰ 2:00 PM (ከሰዓት 8:00)' : '⏰ 2:00 PM (Ethio 8:00)')
                      : (isAm ? '⏰ 6:00 PM (ምሽት 12:00)' : '⏰ 6:00 PM (Ethio 12:00)')}
                  </span>
                  {isSlotSelected && <span className="text-[9px] bg-amber-950 text-amber-300 px-1 py-0.5 rounded font-black">ACTIVE</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Light top stats card: SOLD | AVAILABLE | STAKE | REG CODE */}
      <div className="mx-2 mt-2 flex items-stretch rounded-2xl overflow-hidden bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 text-slate-900 shadow-xs border border-amber-200 shrink-0">
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 border-r border-amber-200">
          <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 leading-none">
            {isAm ? 'የተሸጠ' : 'Sold'}
          </span>
          <span className="text-base font-black leading-tight mt-0.5 tabular-nums text-rose-700">
            {soldSet.size}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 border-r border-amber-200">
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 leading-none">
            {isAm ? 'ነፃ' : 'Available'}
          </span>
          <span className="text-base font-black leading-tight mt-0.5 tabular-nums text-emerald-800">
            {TOTAL_NUMBERS - soldSet.size}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 border-r border-amber-200">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">
            {isAm ? 'ዋጋ' : 'Stake'}
          </span>
          <span className="text-base font-black leading-tight mt-0.5 tabular-nums text-slate-950">
            {entryPrice} ETB
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">
            {isAm ? 'ኮድ' : 'Reg Code'}
          </span>
          <span className="text-xs font-black leading-tight mt-0.5 font-mono text-slate-900">{regCode}</span>
        </div>
      </div>

      {/* Selected Slots Card: 2 slots per visible page with horizontal scrolling */}
      <div className="mx-2 mt-2 bg-white rounded-2xl border border-slate-200 p-2.5 shadow-xs space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {isAm ? 'የተመረጡ ካርዶች' : 'Your Selected Slots'} ({slotCountFilled}/{NUM_SLOTS})
            </span>
            <span className="text-[9px] text-slate-400 font-bold block">
              {isAm ? 'ወደ ጎን ያሸብልሉ (2 ስሎት በአንድ ገጽ)' : 'Scroll sideways (2 slots per page)'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-amber-700 font-mono">
              {totalCost > 0 ? `${totalCost} ETB` : ''}
            </span>
            <span className="text-[9px] text-slate-400 font-medium block">
              {isAm ? '1 ጨዋታ ብቻ' : '1 Game Only'}
            </span>
          </div>
        </div>

        {/* Minimized 2-slot per page scroll container */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 px-0.5 snap-x snap-mandatory scrollbar-thin">
          {Array.from({ length: NUM_SLOTS }, (_, i) => {
            const num = slotNumbers[i];
            const filled = num !== null;
            return (
              <div
                key={i}
                className={`w-[calc(50%-0.25rem)] min-w-[calc(50%-0.25rem)] shrink-0 snap-start h-11 rounded-xl border-2 flex items-center justify-between px-2.5 relative transition-all ${
                  filled
                    ? 'border-amber-400 bg-amber-50 text-slate-950 shadow-2xs'
                    : 'border-dashed border-slate-300 bg-slate-50 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                    filled ? 'text-amber-800 bg-amber-200/80' : 'text-slate-400 bg-slate-200/60'
                  }`}>
                    S{i + 1}
                  </span>
                  {filled ? (
                    <span className="text-xs font-black font-mono tabular-nums text-slate-950 truncate">
                      #{String(num).padStart(4, '0')}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">
                      {isAm ? 'ባዶ' : 'Empty'}
                    </span>
                  )}
                </div>
                {filled ? (
                  <button
                    type="button"
                    onClick={() => clearSlot(i)}
                    className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-rose-500 hover:text-white transition cursor-pointer shrink-0 border border-white shadow-2xs"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-slate-300 text-xs font-black shrink-0">+</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Visual scroll hint */}
        <div className="flex items-center justify-between text-[9px] text-slate-400 px-1 pt-0.5 border-t border-slate-100">
          <span>{isAm ? '← ወደ ጎን ያሸብልሉ →' : '← Swipe to see S3, S4, S5 →'}</span>
          <span>{slotCountFilled} {isAm ? 'ተመርጧል' : 'selected'}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mx-2 mt-2 py-1.5 bg-white rounded-xl border border-slate-200 text-[11px] shadow-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
          <span className="text-slate-800 font-bold">{isAm ? 'ነፃ' : 'Available'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-amber-500 bg-amber-400" />
          <span className="text-slate-800 font-bold">{isAm ? 'የተመረጠ' : 'Selected'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-slate-300 bg-slate-200" />
          <span className="text-slate-600 font-bold">{isAm ? 'የተሸጠ (ግራጫ)' : 'Sold (Gray)'}</span>
        </div>
      </div>

      {/* Master Lottery Numbers Table — Clean White Background, Bold Black Numbers */}
      <div className="mx-2 mt-2 bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
            {isAm ? `የቁጥሮች ሰንጠረዥ (1-${TOTAL_NUMBERS})` : `Master Lottery Board (1–${TOTAL_NUMBERS})`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ✓ {TOTAL_NUMBERS - soldSet.size} {isAm ? 'ነፃዎች' : 'Available'}
            </span>
            <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              ✗ {soldSet.size} {isAm ? 'የተሸጡ' : 'Sold'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).map((num) => {
            const sold = soldSet.has(num);
            const inSlot = activeSlotSet.has(num);
            return (
              <button
                key={num}
                type="button"
                onClick={() => handlePickNumber(num)}
                disabled={sold && !inSlot}
                className={`h-8 sm:h-9 rounded-lg text-xs font-black tabular-nums transition-all border select-none flex items-center justify-center ${
                  inSlot
                    ? 'bg-amber-400 border-amber-500 text-slate-950 shadow shadow-amber-300 scale-105 ring-2 ring-amber-500 z-10'
                    : sold
                    ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed line-through decoration-slate-400/80 font-bold'
                    : 'bg-white border-slate-300 text-slate-950 hover:bg-amber-50 hover:border-amber-400 active:scale-95 cursor-pointer shadow-2xs'
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* Purchase Feedback Toast */}
      {purchaseFeedback && (
        <div className="mx-2 mt-2 px-3 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black text-center shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {purchaseFeedback}
        </div>
      )}

      {/* Bottom Buy / Pick Cards Action Button */}
      <div className="mx-2 mt-3 space-y-2">
        <button
          type="button"
          onClick={handleBuy}
          disabled={slotCountFilled === 0 || !canAfford || !selectedGame}
          className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
            slotCountFilled === 0
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none border border-slate-300'
              : !canAfford
              ? 'bg-rose-100 text-rose-800 border border-rose-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-105 shadow-amber-300/60 active:scale-[0.99]'
          }`}
        >
          {!user ? (
            isAm ? 'መመዝገብ →' : 'Register to Play →'
          ) : slotCountFilled === 0 ? (
            isAm ? '👉 ከሰንጠረዡ ካርድ ቁጥር ይምረጡ' : '👉 Tap Numbers Above to Pick'
          ) : !canAfford ? (
            isAm ? `ተጨማሪ ${Math.max(0, totalCost - playableBalance)} ETB ያስፈልጋል (Bonus+Balance: ${Math.floor(playableBalance)} ETB)` : `Need ${Math.max(0, totalCost - playableBalance)} ETB more (Have ${Math.floor(playableBalance)} ETB)`
          ) : (
            `🏆 ${isAm ? 'ይግዙ' : 'BUY'} · ${slotCountFilled}×${entryPrice} = ${totalCost} ETB`
          )}
        </button>

        {/* Spectator Button: Watch live game without buying cards */}
        <button
          type="button"
          onClick={() => onPickCards(selectedGame?.id || 'gm_weekend_50_2pm', [])}
          className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-200/80 hover:bg-slate-300 text-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300/80"
        >
          <Eye className="w-3.5 h-3.5 text-blue-600" />
          <span>{isAm ? '👀 ያለ ካርድ ጨዋታውን በቀጥታ ይመልከቱ (Watch Live Game)' : '👀 Watch Live Game as Spectator'}</span>
        </button>
      </div>
    </div>
  );
}
