'use client';

import React, { useState } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Gamepad2, Wallet, User as UserIcon, Trophy, Zap, 
  Share2, Copy, Check, Clock, Gift, ShieldCheck, Sparkles, X, ChevronRight, ArrowUpRight, Globe, Shield, LogOut 
} from 'lucide-react';
import { formatETB } from '../../lib/bingoUtils';
import { isAdminTelegramId } from '../../lib/authUtils';
import { localizeGameName, localizeGameTime } from '../../lib/translations';
import BingoGameRoom from '../game/BingoGameRoom';
import WalletManager from '../wallet/WalletManager';
import AdminPanel from '../admin/AdminPanel';

export default function MiniAppShell({
  initialTab = 'lobby',
  onClose,
}: {
  initialTab?: 'lobby' | 'game' | 'wallet' | 'profile' | 'admin';
  onClose?: () => void;
}) {
  const { 
    user, 
    wallet, 
    games, 
    promotions, 
    referrals, 
    setActiveGameId, 
    activeGameId, 
    joinGame, 
    language, 
    setLanguage, 
    t,
    toggleUserRole,
    openAuthModal,
    logout
  } = useBingo();
  const [activeTab, setActiveTab] = useState<'lobby' | 'game' | 'wallet' | 'profile' | 'admin'>(initialTab);
  const [gameFilter, setGameFilter] = useState<'ALL' | 'SMALL' | 'STANDARD' | 'HIGH' | 'LOTTERY'>('ALL');
  const [copiedRef, setCopiedRef] = useState(false);

  const isUserAdmin = Boolean(
    user && 
    user.role === 'admin' && 
    (isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  const quickBingo = games.find((g) => g.gameType === 'QUICK_BINGO') || games[0];

  const handleCopyReferral = () => {
    if (!user) {
      openAuthModal('register');
      return;
    }
    navigator.clipboard.writeText(`https://t.me/HyperBingoBot?start=${user.referralCode}`);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div className="tg-container flex flex-col text-slate-100 font-sans border-x border-slate-800">
      {/* Telegram WebApp Frame Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center shadow">
              {user.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1">
                @{user.username}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </h3>
              <span className="text-[10px] text-slate-400">{t('telegramMiniApp')} v2.4</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('register')}
            className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow flex items-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>{language === 'am' ? 'አካውንት ክፈት' : 'Open Account'}</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Admin Header Shortcut (Only for Admins) */}
          {isUserAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-2 py-1 rounded-xl font-bold text-xs border transition flex items-center gap-1 ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                  : 'bg-purple-950/80 text-purple-300 border-purple-500/50 hover:bg-purple-900'
              }`}
              title={t('adminDashboard')}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              {t('adminTab')}
            </button>
          )}

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
            className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 transition flex items-center gap-1"
            title="Switch Language / ቋንቋ ይምረጡ"
          >
            <Globe className="w-3.5 h-3.5" />
            {language === 'en' ? '🇪🇹 አማ' : '🇬🇧 EN'}
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs hover:bg-amber-500/20 transition flex items-center gap-1"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            {formatETB(wallet.availableBalance)}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {/* LOBBY TAB */}
        {activeTab === 'lobby' && (
          <div className="space-y-4">
            {/* Quick Bingo Featured Banner */}
            {/* Quick Bingo Featured Banner - Sleek Luxury Dark Glass */}
            <div className="bg-gradient-to-br from-amber-500/15 via-slate-900 to-purple-950/40 border border-amber-500/30 p-4 rounded-3xl text-slate-100 shadow-2xl relative overflow-hidden">
              <div className="relative z-10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> {t('quickBingo')}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700/60">
                    {localizeGameTime(quickBingo.startTime, language)}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {localizeGameName(quickBingo.name, language)}
                  </h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xs text-slate-400">{t('prizePool')}:</span>
                    <span className="text-2xl font-black text-amber-400 font-mono">{formatETB(quickBingo.prizePool)}</span>
                  </div>
                </div>

                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => {
                      joinGame(quickBingo.id);
                      setActiveTab('game');
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <span>{t('playNow')} ({quickBingo.entryPrice} ETB)</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Available Games Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Gamepad2 className="w-4 h-4 text-amber-400" />
                  {t('availableGames')} ({games.length})
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">Instant Payouts</span>
              </div>

              {/* Game Tiers Filter Tabs - Capsule Style */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: 'ALL', label: t('allRooms') },
                  { id: 'LOTTERY', label: '🌟 Weekend Lottery' },
                  { id: 'SMALL', label: t('smallStakes') },
                  { id: 'STANDARD', label: t('standardStakes') },
                  { id: 'HIGH', label: t('highStakes') },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => setGameFilter(tier.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition ${
                      gameFilter === tier.id
                        ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>

              {/* Filtered Games List - Clean Modern Cards */}
              <div className="space-y-2">
                {games
                  .filter((g) => {
                    if (gameFilter === 'LOTTERY') return g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial;
                    if (gameFilter === 'SMALL') return g.entryPrice <= 20;
                    if (gameFilter === 'STANDARD') return g.entryPrice > 20 && g.entryPrice <= 50;
                    if (gameFilter === 'HIGH') return g.entryPrice >= 100;
                    return true;
                  })
                  .map((g) => (
                    <div
                      key={g.id}
                      className="bg-slate-900/85 hover:bg-slate-900 p-3.5 rounded-2xl flex items-center justify-between border border-slate-800/80 hover:border-slate-700 transition shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-100">{localizeGameName(g.name, language)}</span>
                          {(g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial) && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow">
                              🌟 Mega
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase ${
                              g.status === 'RUNNING'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                : g.status === 'STARTING'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {g.status === 'RUNNING' ? 'Live' : g.status === 'STARTING' ? 'Starting' : 'Open'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>Entry: <strong className="text-slate-200">{formatETB(g.entryPrice)}</strong></span>
                          <span>Prize: <strong className="text-emerald-400 font-bold">{formatETB(g.prizePool)}</strong></span>
                          <span>👥 {g.currentPlayers}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setActiveGameId(g.id);
                          setActiveTab('game');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-100 font-bold text-xs transition border border-slate-700 hover:border-amber-400 shadow flex items-center gap-1"
                      >
                        <span>Play</span>
                        <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:text-slate-950" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Promotions Banner */}
            {promotions.length > 0 && (
              <div className="glass-panel p-3.5 rounded-xl border-purple-500/20">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-purple-400" /> {t('activePromotion')}
                </h4>
                <div className="bg-purple-950/40 border border-purple-500/30 p-3 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-amber-300">{promotions[0].title}</div>
                  <p className="text-slate-300 text-[11px]">{promotions[0].description}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GAME ROOM TAB */}
        {activeTab === 'game' && <BingoGameRoom gameId={activeGameId || games[0].id} />}

        {/* WALLET TAB */}
        {activeTab === 'wallet' && <WalletManager />}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && (
          isUserAdmin ? (
            <AdminPanel isStandalone={false} />
          ) : (
            <div className="glass-panel p-6 rounded-2xl text-center space-y-3 border-rose-500/30">
              <Shield className="w-12 h-12 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-100">Access Restricted</h3>
              <p className="text-xs text-slate-400">
                Only Telegram IDs configured in the environment whitelist (ADMIN_TELEGRAM_IDS) have administrator privileges.
              </p>
              <button
                onClick={() => setActiveTab('lobby')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
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
              <div className="glass-panel p-6 rounded-3xl border-slate-800 text-center space-y-4 bg-slate-900/60">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
                  <UserIcon className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-100">
                    {language === 'am' ? 'የእንግዳ ተጠቃሚ' : 'Guest Player'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                    {language === 'am'
                      ? 'እውነተኛ ገንዘብ የሚያሸልሙ የቢንጎ ጨዋታዎችን ለመጫወት እና አሸናፊነትዎን በቴሌብር እና ሲቢኢ ለማውጣት አካውንት ይክፈቱ።'
                      : 'Open an account with your Ethiopian phone number to play real-money games and withdraw winnings via Telebirr or CBE Birr.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => openAuthModal('register')}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{language === 'am' ? 'አካውንት ክፈት (50 ብር ቦነስ)' : 'Open Account (50 ETB Bonus)'}</span>
                  </button>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700"
                  >
                    {language === 'am' ? 'አካውንት አለኝ • ግባ' : 'Already have an account? Sign In'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="glass-panel p-4 rounded-2xl border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 flex items-center justify-center text-white text-xl font-black shadow-lg">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-base">{user.name}</h3>
                        <p className="text-xs text-slate-400">@{user.username} • ID: {user.telegramId}</p>
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mt-1">
                          {t('verifiedUser')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase border ${
                        user.role === 'admin' 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {user.role === 'admin' ? t('adminRole') : t('playerRole')}
                      </span>
                    </div>
                  </div>

                  {/* Admin Mode Switcher Button inside Profile (Only for verified admin telegram IDs) */}
                  {isUserAdmin && (
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-amber-400" />
                          {user.role === 'admin' ? t('adminModeActive') : t('playerModeActive')}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {t('inBotAdminNotice')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          toggleUserRole();
                          if (user.role !== 'admin') setActiveTab('admin');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
                      >
                        {user.role === 'admin' ? t('switchToPlayer') : t('switchToAdmin')}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400">{t('phoneNumber')}</span>
                      <div className="font-mono text-slate-200 mt-0.5">{user.phone || 'Not set'}</div>
                    </div>
                    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400">{t('registered')}</span>
                      <div className="text-slate-200 mt-0.5">Active</div>
                    </div>
                  </div>
                </div>

                {/* Referral Program Card */}
                <div className="glass-panel p-4 rounded-2xl border-amber-500/30 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Share2 className="w-4 h-4" /> {t('telegramReferral')}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {t('inviteFriendsText')}
                  </p>

                  <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <input
                      type="text"
                      readOnly
                      value={`https://t.me/HyperBingoBot?start=${user.referralCode}`}
                      className="flex-1 bg-transparent text-xs text-slate-300 font-mono focus:outline-none px-2"
                    />
                    <button
                      onClick={handleCopyReferral}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedRef ? t('copied') : t('copy')}
                    </button>
                  </div>

                  {/* Referrals list */}
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">{t('yourReferrals')} ({referrals.length})</div>
                    {referrals.map((ref) => (
                      <div key={ref.id} className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                        <span className="text-slate-200">{ref.referredName}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ref.status === 'REWARDED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {ref.status} (+{ref.rewardAmount} ETB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logout / Switch Account */}
                <div className="pt-1">
                  <button
                    onClick={logout}
                    className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-xs transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>{language === 'am' ? 'ከአካውንት ውጣ / ቀይር' : 'Sign Out / Switch Account'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sticky Telegram Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[440px] mx-auto bg-slate-900/95 border-t border-slate-800 px-3 py-2 flex items-center justify-around z-30 backdrop-blur-md">
        <button
          onClick={() => setActiveTab('lobby')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
            activeTab === 'lobby' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-5 h-5" />
          {t('lobby')}
        </button>

        <button
          onClick={() => setActiveTab('game')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
            activeTab === 'game' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-5 h-5" />
          {t('liveRoom')}
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
            activeTab === 'wallet' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="w-5 h-5" />
          {t('wallet')}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
            activeTab === 'profile' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          {t('profile')}
        </button>

        {isUserAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center gap-1 text-[11px] font-semibold transition ${
              activeTab === 'admin' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
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

