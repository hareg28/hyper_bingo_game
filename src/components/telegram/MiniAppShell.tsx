'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { formatETB } from '../../lib/bingoUtils';
import { localizeGameName, localizeGameTime } from '../../lib/translations';
import { 
  Gamepad2, Zap, Wallet, User as UserIcon, Shield, 
  ArrowUpRight, Share2, Copy, Check, LogOut, Sparkles, 
  ChevronRight, ChevronDown, ChevronUp, Gift, Globe, X 
} from 'lucide-react';
import BingoGameRoom from '../game/BingoGameRoom';
import WalletManager from '../wallet/WalletManager';
import AdminPanel from '../admin/AdminPanel';
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
  initialTab?: 'lobby' | 'game' | 'wallet' | 'profile' | 'admin';
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
    language,
    setLanguage,
    t,
    openAuthModal,
    toggleUserRole
  } = useBingo();

  const [activeTab, setActiveTab] = useState<'lobby' | 'game' | 'wallet' | 'profile' | 'admin'>(initialTab);
  const [copiedRef, setCopiedRef] = useState(false);
  const [gameFilter, setGameFilter] = useState<'ALL' | 'SMALL' | 'HIGH'>('ALL');
  const [showAllGames, setShowAllGames] = useState(false);

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
    ? { height: '100%', maxHeight: '100%', overflow: 'hidden' as const }
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
              <span className="text-[10px] text-slate-500 font-bold block truncate">{t('telegramMiniApp')} v4.0</span>
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
      <div className={`flex-1 min-h-0 overflow-x-hidden ${activeTab === 'game' ? 'overflow-y-hidden p-1 pb-16 flex flex-col justify-start' : 'overflow-y-auto overscroll-contain p-3 pb-24 space-y-3'} bg-slate-50/70`}>
        {/* LOBBY TAB */}
        {activeTab === 'lobby' && (
          <div className="space-y-3">
            {/* Featured Banner - Clean High-Contrast Amber Card */}
            <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 p-4 rounded-2xl text-slate-950 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {t('quickBingo')}
                </span>
                <span className="text-[10px] font-bold opacity-90">
                  {localizeGameTime(quickBingo.startTime, language)}
                </span>
              </div>
              <h3 className="text-lg font-black">{getGameDisplayName(quickBingo, language)}</h3>
              <p className="text-xs font-semibold opacity-90 mb-3">
                {t('prizePool')}: <strong className="text-base font-black">{formatETB(quickBingo.prizePool)}</strong>
              </p>
              <button
                onClick={() => { joinGame(quickBingo.id); setActiveTab('game'); }}
                className="w-full py-2.5 bg-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-xl transition hover:bg-slate-800 flex items-center justify-center gap-1.5 shadow cursor-pointer"
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

              {/* Weekend Hyper Announcement Banner - 3-Column Responsive Grid */}
              {games.some((g) => g.isWeekendSpecial || g.gameType === 'WEEKEND_LOTTERY') && (
                <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 p-3.5 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🌟</span>
                      <div className="flex flex-col">
                        <span className="text-slate-950 text-xs font-black uppercase tracking-wider leading-none">
                          {language === 'am' ? 'የሳምንት መጨረሻ ሃይፐር ድራው' : 'WEEKEND HYPER DRAWS'}
                        </span>
                        <span className="text-slate-900 text-[10px] font-bold opacity-80 mt-0.5">
                          {language === 'am' ? 'ዓርብ–እሑድ ማታ 4:00 (10:00 PM)' : 'Fri–Sun Opens at 10:00 PM (ማታ 4:00)'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] font-black bg-slate-950 text-amber-300 px-2 py-0.5 rounded-full uppercase shadow-xs">
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
                          className="p-2 rounded-xl bg-slate-950 text-white flex flex-col items-center justify-center shadow-xs hover:bg-slate-800 transition cursor-pointer text-center"
                        >
                          <span className="text-amber-400 text-xs font-black leading-tight">⚡ {g.entryPrice} ETB</span>
                          <span className="text-emerald-400 text-[9px] font-bold leading-tight mt-0.5">{formatETB(g.prizePool)}</span>
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
                            <span>Prize: <strong className="text-emerald-600 font-bold">{formatETB(g.prizePool)}</strong></span>
                            <span>👥 {g.currentPlayers}{g.minPlayers ? ` (min ${g.minPlayers})` : ''}</span>
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
                  <p className="text-[10px] text-white font-bold whitespace-nowrap">10:00 PM EAT</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GAME ROOM TAB */}
        {activeTab === 'game' && <BingoGameRoom gameId={activeGameId || games[0].id} onBack={() => setActiveTab('lobby')} />}

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
                      <span className="font-bold text-emerald-300 text-[11px]">Fri–Sun 10:00 PM (ማታ 4:00)</span>
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
      <div className="bg-white border-t border-slate-200 px-3 py-1.5 flex items-center justify-around z-30 shadow-md shrink-0 w-full">
        <button
          onClick={() => setActiveTab('lobby')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
            activeTab === 'lobby' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          {t('lobby')}
        </button>

        <button
          onClick={() => setActiveTab('game')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
            activeTab === 'game' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Zap className="w-5 h-5" />
          {t('liveRoom')}
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
            activeTab === 'wallet' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-5 h-5" />
          {t('wallet')}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
            activeTab === 'profile' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          {t('profile')}
        </button>

        {isUserAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition cursor-pointer ${
              activeTab === 'admin' ? 'text-amber-600 font-black' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Shield className="w-5 h-5" />
            {t('adminTab')}
          </button>
        )}
      </div>
    </div>
  );
}
