'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { formatETB } from '../../lib/bingoUtils';
import { localizeGameName, localizeGameTime } from '../../lib/translations';
import { getGameLivePrizePool } from '../../lib/store';
import { 
  Gamepad2, Zap, Wallet, User as UserIcon, Shield, 
  ArrowUpRight, Share2, Copy, Check, LogOut, Sparkles, 
  ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Gift, Globe, X,
  ExternalLink
} from 'lucide-react';
import BingoGameRoom from '../game/BingoGameRoom';
import WalletManager from '../wallet/WalletManager';
import AdminPanel from '../admin/AdminPanel';
import DailyLuckyWheelModal from '../rewards/DailyLuckyWheelModal';
import { isAdminTelegramId } from '../../lib/authUtils';

// Dynamic reliable display title formatter
function getGameDisplayName(g: { entryPrice: number; gameType?: string; isWeekendSpecial?: boolean; name?: string }, lang: string): string {
  if (g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) {
    return lang === 'am' ? `🌟 የሳምንት መጨረሻ ሃይፐር ${g.entryPrice}` : `🌟 Weekend Hyper ${g.entryPrice}`;
  }
  const icons: Record<number, string> = {
    5: '⚡',
    10: '⚡',
    20: '🎲',
    30: '🎯',
    100: '🔥',
    200: '💎',
    300: '🏅',
    500: '👑',
    1000: '🏆'
  };
  const icon = icons[g.entryPrice] || '⚡';
  return lang === 'am' ? `${icon} ሃይፐር ${g.entryPrice}` : `${icon} Hyper ${g.entryPrice}`;
}

export default function MiniAppShell({ 
  onClose,
  initialTab = 'lobby',
  embedded = false
}: { 
  onClose?: () => void;
  initialTab?: 'lobby' | 'game' | 'wallet' | 'profile' | 'admin' | 'lottery';
  embedded?: boolean;
}) {
  const { 
    games, 
    user, 
    wallet, 
    activeGameId, 
    setActiveGameId, 
    promotions, 
    referrals, 
    logout, 
    joinGame,
    addCardToGame,
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
  const [gameFilter, setGameFilter] = useState<'ALL' | 'SMALL' | 'HIGH'>('ALL');
  const [showAllGames, setShowAllGames] = useState(false);
  const [showLuckyWheel, setShowLuckyWheel] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const quickBingo = games.find((g) => g.gameType === 'QUICK_BINGO') || games[0];
  const isUserAdmin = Boolean(
    user && 
    (user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  const handleCopyReferral = () => {
    if (!user) {
      openAuthModal('register');
      return;
    }
    navigator.clipboard.writeText(`https://t.me/HyperBingoBot?start=${user.referralCode}`);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const heightStyle = embedded
    ? { flex: '1 1 0%', minHeight: 0, maxHeight: '100%', overflow: 'hidden' as const }
    : { height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' as const };

  return (
    <>
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

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
            className="px-1.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] border border-slate-300 transition flex items-center gap-0.5 cursor-pointer"
            title="Switch Language / ቋንቋ ይምረጡ"
          >
            <Globe className="w-3 h-3 text-slate-600" />
            {language === 'en' ? '🇪🇹 አማ' : '🇬🇧 EN'}
          </button>

          {/* Daily Spin Button */}
          <button
            type="button"
            onClick={() => setShowLuckyWheel(true)}
            className="px-2 py-1 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] hover:brightness-105 active:scale-95 transition flex items-center gap-1 shadow-xs cursor-pointer border border-amber-300 ring-1 ring-amber-300/50 animate-pulse"
            title={language === 'am' ? 'ዕለታዊ ነፃ እድል' : 'Daily Free Spin'}
          >
            <span className="text-xs">🎁</span>
            <span className="font-extrabold">{language === 'am' ? 'እድል' : 'Spin'}</span>
          </button>

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

      {/* Main Content Area */}
      <div className={`flex-1 min-h-0 overflow-x-hidden ${activeTab === 'game' || activeTab === 'lottery' ? 'overflow-hidden flex flex-col min-h-0' : 'overflow-y-auto overscroll-contain p-3 pb-28 space-y-3 bg-slate-50/70'}`}>
        {/* LOBBY TAB */}
        {activeTab === 'lobby' && (
          <div className="space-y-3">
            {/* 📢 OFFICIAL TELEGRAM CHANNEL BANNER */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-3 text-white shadow-md flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0 shadow-inner">
                  📢
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black uppercase tracking-wider leading-tight text-white flex items-center gap-1.5">
                    <span>@HyperBingoChannel</span>
                    <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full font-black">Official</span>
                  </h4>
                  <p className="text-[10px] text-blue-100 truncate mt-0.5 font-medium">
                    {language === 'am' ? 'የነፃ ካርድ ኮዶች፣ የጨዋታ ሰዓቶች እና የአሸናፊዎች ዝርዝር!' : 'Daily free card promos, draw schedules & winner lists!'}
                  </p>
                </div>
              </div>
              <a
                href="https://t.me/HyperBingoSupport"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-black text-xs shrink-0 transition flex items-center gap-1 shadow-sm"
              >
                <span>{language === 'am' ? 'ይቀላቀሉ' : 'Join'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Featured Banner - Soft Light Amber / Cream Card */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 p-4 rounded-2xl text-slate-900 shadow-xs border-2 border-amber-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" /> {t('quickBingo')}
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded-full border border-amber-200">
                  {localizeGameTime(quickBingo.startTime, language)}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-950">{getGameDisplayName(quickBingo, language)}</h3>
              <button
                onClick={() => { joinGame(quickBingo.id); setActiveTab('game'); }}
                className="w-full py-2.5 bg-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-xl transition hover:bg-slate-800 flex items-center justify-center gap-1.5 shadow cursor-pointer mt-2.5"
              >
                {t('playNow')} ({quickBingo.entryPrice} ETB) <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            {/* Available Games Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-amber-500" />
                  {t('availableGames')} ({games.filter(g => g.gameType !== 'WEEKEND_LOTTERY' && !g.isWeekendSpecial).length} Live)
                </h3>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  🟢 Live Now
                </span>
              </div>

              {/* Weekend Hyper Announcement Banner - Soft Light Gold / Amber Card */}
              {games.some((g) => g.isWeekendSpecial || g.gameType === 'WEEKEND_LOTTERY') && (
                <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/60 p-3.5 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🌟</span>
                      <div className="flex flex-col">
                        <span className="text-slate-950 text-xs font-black uppercase tracking-wider leading-none">
                          {language === 'am' ? 'የሳምንት መጨረሻ ሃይፐር ድራው' : 'WEEKEND HYPER DRAWS'}
                        </span>
                        <span className="text-slate-600 text-[10px] font-bold opacity-90 mt-0.5">
                          {language === 'am' ? 'ዓርብ–እሑድ 8:00፣ 11:00 እና 1:00' : 'Fri–Sun: 2:00 PM, 5:00 PM & 7:00 PM'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase shadow-xs">
                      Mega
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {games
                      .filter((g) => g.isWeekendSpecial || g.gameType === 'WEEKEND_LOTTERY')
                      .map((g) => (
                        <button
                          key={g.id}
                          onClick={() => { setActiveGameId(g.id); setActiveTab('game'); }}
                          className="p-2 rounded-xl bg-white border border-amber-200 text-slate-900 flex flex-col items-center justify-center shadow-xs hover:border-amber-400 hover:bg-amber-50 transition cursor-pointer text-center"
                        >
                          <span className="text-amber-700 text-xs font-black leading-tight">⚡ {g.entryPrice} ETB</span>
                          <span className="text-[9px] font-bold leading-tight mt-0.5 opacity-80 text-slate-600">Entry</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Filter Pills — Weekend games are EXCLUDED from Live Room */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'ALL', label: '🎮 All Live Games' },
                  { id: 'SMALL', label: '💰 Small (5-30 ETB)' },
                  { id: 'HIGH', label: `🔥 ${t('highStakes')}` },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setGameFilter(tier.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition whitespace-nowrap cursor-pointer ${
                      gameFilter === tier.id
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              {/* Game List: Live Room ALWAYS excludes Weekend Lottery games */}
              {(() => {
                const filteredLiveGames = games.filter((g) => {
                  // Weekend lottery games are NEVER shown in the Live Room
                  if (g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) return false;
                  if (gameFilter === 'SMALL') {
                    return g.entryPrice <= 30;
                  }
                  if (gameFilter === 'HIGH') {
                    return g.entryPrice >= 100;
                  }
                  // DEFAULT / ALL: all non-weekend games
                  return true;
                });

                return (
                  <div className="space-y-2">
                    {filteredLiveGames.map((g) => (
                      <div
                        key={g.id}
                        className="bg-white p-3.5 rounded-2xl flex items-center justify-between border border-slate-200 shadow-xs hover:border-amber-400 transition"
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">{getGameDisplayName(g, language)}</span>
                            {(g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">🌟 WEEKEND MEGA</span>
                            )}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              g.status === 'RUNNING' ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : g.status === 'STARTING' ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {g.status === 'RUNNING' ? '● LIVE' : g.status === 'STARTING' ? 'STARTING' : 'OPEN'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span>Entry: <strong className="text-slate-900">{formatETB(g.entryPrice)}</strong></span>
                            {g.blockedCards && g.blockedCards.length > 0 && (
                              <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                🚫 {g.blockedCards.length} {language === 'am' ? 'የታገዱ' : 'Blocked'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => { setActiveGameId(g.id); setActiveTab('game'); }}
                          className="ml-3 px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs transition shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          PLAY <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Promotions */}
            {promotions.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-2xl">
                <h4 className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-purple-600" /> {t('activePromotion')}
                </h4>
                <div className="text-xs">
                  <div className="font-bold text-purple-950">{promotions[0].title}</div>
                  <p className="text-purple-700 text-[11px] mt-0.5">{promotions[0].description}</p>
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
                  <p className="text-[11px] font-black uppercase tracking-wider text-amber-400 leading-none mb-0.5">
                    Support / ድጋፍ
                  </p>
                  <a
                    href="tel:+251911234567"
                    className="text-sm font-black text-white hover:text-amber-300 transition block leading-tight"
                  >
                    +251 91 123 4567
                  </a>
                  <a
                    href="https://t.me/HyperBingoSupport"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-300 hover:text-amber-300 transition block leading-tight mt-0.5"
                  >
                    @HyperBingoSupport
                  </a>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-slate-400 font-bold uppercase leading-none">Weekend Draw</p>
                  <p className="text-[10px] text-amber-300 font-black whitespace-nowrap">Fri–Sun</p>
                  <p className="text-[10px] text-white font-bold whitespace-nowrap">2:00, 5:00 & 7:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GAME ROOM TAB */}
        {activeTab === 'game' && <BingoGameRoom gameId={activeGameId || games[0].id} onBack={() => setActiveTab('lobby')} />}

        {/* WEEKEND LOTTERY NUMBER CARD PICKER TAB */}
        {activeTab === 'lottery' && (
          <WeekendLotteryNumberPicker
            games={games}
            user={user}
            wallet={wallet}
            language={language}
            openAuthModal={openAuthModal}
            getLotterySoldNumbers={getLotterySoldNumbers}
            purchaseLotteryNumbers={purchaseLotteryNumbers}
            onPickCards={(gameId, cardNumbers) => {
              if (!user) { openAuthModal('register'); return; }
              if (cardNumbers.length > 0) {
                joinGame(gameId, [cardNumbers[0]]);
                cardNumbers.slice(1).forEach((n) => addCardToGame(gameId, n));
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
                  <div className="pt-2 text-center text-[11px] text-slate-500">
                    <span>📞 {language === 'am' ? 'ጥያቄ ካለዎት:' : 'Need help?'} </span>
                    <a href="tel:+251911234567" className="font-bold text-amber-600 hover:underline">+251 91 123 4567</a>
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
                      value={`https://t.me/HyperBingoBot?start=${user.referralCode}`}
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
                      <span className="text-slate-400 text-[11px] font-medium">ስልክ (Phone):</span>
                      <a href="tel:+251911234567" className="font-bold text-amber-300 hover:underline">
                        +251 91 123 4567
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
                      <span className="font-bold text-emerald-300 text-[11px]">Fri–Sun 2:00 PM, 5:00 PM & 7:00 PM</span>
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
          onClick={() => setActiveTab('lottery')}
          className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold transition cursor-pointer px-2 py-1 rounded-xl ${
            activeTab === 'lottery' ? 'text-amber-600 font-black bg-amber-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>{language === 'am' ? 'ሎተሪ' : 'Lottery'}</span>
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
    </div>
  );
}

// ================================================================
// Weekend Lottery Number Card Picker
// (Shows 1-500 number grid, 2 card slots to fill, like reference image)
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
}: {
  games: ReturnType<typeof useBingo>['games'];
  user: ReturnType<typeof useBingo>['user'];
  wallet: ReturnType<typeof useBingo>['wallet'];
  language: string;
  openAuthModal: (mode?: 'register' | 'login') => void;
  getLotterySoldNumbers: ReturnType<typeof useBingo>['getLotterySoldNumbers'];
  purchaseLotteryNumbers: ReturnType<typeof useBingo>['purchaseLotteryNumbers'];
  onPickCards: (gameId: string, cardNumbers: string[]) => void;
  onBack: () => void;
}) {
  const isAm = language === 'am';
  const weekendGames = games.filter((g) => g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial);
  const [selectedGameIdx, setSelectedGameIdx] = React.useState(0);
  const selectedGame = weekendGames[selectedGameIdx] || weekendGames[0];
  const entryPrice = selectedGame?.entryPrice || 50;

  const TOTAL_NUMBERS = 500;
  const NUM_SLOTS = 2;
  const [slotNumbers, setSlotNumbers] = React.useState<(number | null)[]>(
    Array.from({ length: NUM_SLOTS }, () => null)
  );
  const [drawCountdown, setDrawCountdown] = React.useState('00:00:00');

  React.useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      const totalSecToday = currentHour * 3600 + currentMinute * 60 + currentSecond;

      const slot1Sec = 14 * 3600; // 2:00 PM
      const slot2Sec = 17 * 3600; // 5:00 PM
      const slot3Sec = 19 * 3600; // 7:00 PM

      let diffSec = 0;
      if (totalSecToday < slot1Sec) {
        diffSec = slot1Sec - totalSecToday;
      } else if (totalSecToday < slot2Sec) {
        diffSec = slot2Sec - totalSecToday;
      } else if (totalSecToday < slot3Sec) {
        diffSec = slot3Sec - totalSecToday;
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
  }, []);

  const soldSet = React.useMemo(() => {
    if (!selectedGame) return new Set<number>();
    return getLotterySoldNumbers(selectedGame.id);
  }, [selectedGame?.id, getLotterySoldNumbers]);

  // Mark some numbers "reserved" if they're in active slots (light blue)
  const activeSlotSet = new Set(slotNumbers.filter((n): n is number => n !== null));

  const slotCountFilled = slotNumbers.filter((n) => n !== null).length;
  const totalCost = slotCountFilled * entryPrice;
  const canAfford = wallet.availableBalance >= totalCost;

  const firstEmptySlotIdx = slotNumbers.findIndex((n) => n === null);

  const handlePickNumber = (num: number) => {
    if (!user) { openAuthModal('register'); return; }
    if (soldSet.has(num)) return; // already sold
    // If already in a slot, remove it
    const existingIdx = slotNumbers.indexOf(num);
    if (existingIdx >= 0) {
      const next = [...slotNumbers];
      next[existingIdx] = null;
      setSlotNumbers(next);
      return;
    }
    if (firstEmptySlotIdx < 0) {
      // All full — bounce (no-op, user can remove to change)
      return;
    }
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
      // Reset slots and optionally jump to game
      setSlotNumbers(Array.from({ length: NUM_SLOTS }, () => null));
      onPickCards(selectedGame.id, result.purchased || nums.map((n) => String(n).padStart(3, '0')));
    }
  };

  const regCode = user ? user.referralCode?.toUpperCase() || '---' : '---';

  return (
    <div className="h-full flex flex-col min-h-0 overflow-y-auto overscroll-contain bg-slate-100 pb-36 select-none">
      {/* Sticky Header with Back button, Title & Balance */}
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
              <span>🌟</span>
              <span>{isAm ? 'የሳምንት መጨረሻ ሃይፐር ሎተሪ' : 'Weekend Hyper Lottery'}</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-bold">
              {isAm ? 'አርብ · ቅዳሜ · እሑድ 8:00፣ 11:00 እና 1:00' : 'Fri · Sat · Sun: 2 PM, 5 PM & 7 PM'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="px-2 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-mono font-black text-[10px] flex items-center gap-1 shadow-2xs">
            <Wallet className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{wallet.availableBalance} ETB</span>
          </div>
        </div>
      </div>

      {/* ⏳ LIVE COUNTDOWN TO NEXT WEEKEND DRAW (2:00 PM, 5:00 PM, 7:00 PM) */}
      <div className="mx-2 mt-2 p-2.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border border-amber-400/40 text-white shadow-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center text-base shrink-0 animate-pulse">
            ⏳
          </div>
          <div className="min-w-0">
            <span className="text-[9px] uppercase tracking-widest text-amber-300 font-black block leading-none">
              {isAm ? 'ቀጣዩ ሜጋ ድራው በ:' : 'Next Mega Draw In:'}
            </span>
            <span className="text-[10px] text-slate-300 font-bold truncate block mt-0.5">
              {selectedGame?.name || 'Weekend Draw'} · {selectedGame?.startTime || '2:00 PM (Fri–Sun)'}
            </span>
          </div>
        </div>
        <div className="px-3 py-1 rounded-xl bg-amber-400/10 border border-amber-400/40 text-amber-300 font-mono font-black text-sm tracking-widest tabular-nums shadow-inner shrink-0">
          {drawCountdown}
        </div>
      </div>

      {/* Light top stats card: SOLD | REG CODE | STAKE */}
      <div className="mx-2 mt-2 flex items-stretch rounded-2xl overflow-hidden bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 text-slate-900 shadow-xs border border-amber-200 shrink-0">
        <div className="flex-1 flex flex-col items-center justify-center py-2 px-1 border-r border-amber-200">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">
            {isAm ? 'የተሸጠ' : 'Sold'}
          </span>
          <span className="text-base font-black leading-tight mt-0.5 tabular-nums text-slate-900">
            {soldSet.size} / {TOTAL_NUMBERS}
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

      {/* Selected Slots Card (Right at top so user sees their pick immediately!) */}
      <div className="mx-2 mt-2 bg-white rounded-2xl border border-slate-200 p-2.5 shadow-xs space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {isAm ? 'የተመረጡ ካርዶች' : 'Your Selected Slots'} ({slotCountFilled}/{NUM_SLOTS})
          </span>
          <span className="text-[11px] font-black text-amber-700 font-mono">
            {totalCost > 0 ? `${totalCost} ETB` : ''}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: NUM_SLOTS }, (_, i) => {
            const num = slotNumbers[i];
            const filled = num !== null;
            return (
              <div
                key={i}
                className={`h-11 rounded-xl border-2 flex items-center justify-between px-2.5 transition-all ${
                  filled
                    ? 'border-amber-400 bg-amber-50 text-slate-950 shadow-2xs'
                    : 'border-dashed border-slate-300 bg-slate-50 text-slate-500'
                }`}
              >
                {filled ? (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-200/80 px-1 rounded">
                        S{i + 1}
                      </span>
                      <span className="text-base font-black font-mono tabular-nums text-slate-950">
                        #{String(num).padStart(3, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearSlot(i)}
                      className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-rose-500 hover:text-white transition cursor-pointer shrink-0"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-1 w-full text-slate-500 text-xs font-bold">
                    <span>+</span>
                    <span>{isAm ? `ካርድ ${i + 1} ምረጥ` : `Slot ${i + 1} Empty`}</span>
                  </div>
                )}
              </div>
            );
          })}
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

      {/* Master 500 Numbers Table — Clean White Background, Bold Black Numbers, 10 Columns */}
      <div className="mx-2 mt-2 bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
            {isAm ? 'የቁጥሮች ሰንጠረዥ (1-500)' : 'Master Lottery Board (1–500)'}
          </span>
          <span className="text-[10px] text-slate-500 font-bold">
            {TOTAL_NUMBERS - soldSet.size} {isAm ? 'ቀሪዎች' : 'Available'}
          </span>
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
            isAm ? `ተጨማሪ ${totalCost - wallet.availableBalance} ETB ያስፈልጋል` : `Need ${totalCost} ETB (Insufficient Balance)`
          ) : (
            `🏆 ${isAm ? 'ይግዙ' : 'BUY'} · ${slotCountFilled}×${entryPrice} = ${totalCost} ETB`
          )}
        </button>
      </div>
    </div>

    {/* ── DAILY LUCKY WHEEL MODAL ─────────────────────────────────────── */}
    <DailyLuckyWheelModal
      isOpen={showLuckyWheel}
      onClose={() => setShowLuckyWheel(false)}
    />
    </>
  );
}
