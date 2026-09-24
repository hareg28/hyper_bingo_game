'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { formatETB } from '../../lib/bingoUtils';
import { 
  Users, Gamepad2, Wallet, ShieldCheck, FileText, PlusCircle, 
  CheckCircle, XCircle, Search, RefreshCw, AlertTriangle, ArrowLeft, 
  Sparkles, Check, Clock, Globe, Shield, Flame, Trophy, Timer, Megaphone
} from 'lucide-react';
import Link from 'next/link';
import { GameType, GameStatus } from '../../lib/types';
import { isAdminTelegramId } from '../../lib/authUtils';

export default function AdminPanel({ isStandalone = false }: { isStandalone?: boolean }) {
  const { 
    games, 
    withdrawals, 
    auditLogs, 
    transactions, 
    user, 
    approveWithdrawal, 
    rejectWithdrawal, 
    createGame, 
    updateGameStatus,
    drawNextBall,
    language,
    setLanguage,
    t,
    toggleUserRole,
    verifyAdminAccess
  } = useBingo();

  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'finance' | 'users' | 'audit'>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  // Admin Registered Users Roster and Stats
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState<{ totalUsers: number; totalDeposited: number; totalWithdrawn: number; pendingWithdrawals: number } | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Live ticking countdown for game minutes remaining
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Telegram Broadcast Suite
  const [broadcastTarget, setBroadcastTarget] = useState<'channel' | 'custom'>('channel');
  const [announceChatId, setAnnounceChatId] = useState('@HyperBingoChannel');
  const [broadcastPreset, setBroadcastPreset] = useState<'weekend_draws' | 'daily_spin' | 'custom'>('weekend_draws');
  const [customBroadcastText, setCustomBroadcastText] = useState('');
  const [announcing, setAnnouncing] = useState(false);
  const [announceResult, setAnnounceResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const getBroadcastPreview = () => {
    if (broadcastPreset === 'weekend_draws') {
      const weekendGames = games.filter(g => g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial);
      const lines = weekendGames.map((g, i) => `${i + 1}. 🌟 ${g.name} | 💵 ${g.entryPrice} ETB | 🏆 ${formatETB(g.prizePool)}`).join('\n');
      return `🎉🌟 WEEKEND HYPER BINGO — Special Lottery Draws!\n⏰ Live Draw Schedule: 2:00 PM, 5:00 PM, and 7:00 PM (Fri–Sun)\n\n${lines || '1. Weekend Mega Draw (25,000 ETB)'}\n\n⚡ Pick your cards now on Hyper Bingo Telegram Mini App!`;
    }
    if (broadcastPreset === 'daily_spin') {
      return `🎁 Daily Free Lucky Spin Wheel is Ready!\n\nSpin every 24 hours to win free ETB bonus credits or free card tickets! Open Hyper Bingo and claim your spin today. 🎡✨`;
    }
    return customBroadcastText || 'Enter your custom announcement message here...';
  };

  const handleSendBroadcast = async () => {
    setAnnouncing(true);
    setAnnounceResult(null);
    try {
      const weekendGames = games.filter(g => g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial);
      const target = broadcastTarget === 'channel' ? (announceChatId.trim() || '@HyperBingoChannel') : (announceChatId.trim() || user?.telegramId);
      
      const payload: any = {
        adminTelegramId: user?.telegramId || user?.username || '',
        chatId: target,
      };

      if (broadcastPreset === 'weekend_draws') {
        payload.weekendGames = weekendGames.length > 0 ? weekendGames : [
          { name: 'Weekend Mega Draw (2:00 PM)', entryPrice: 100, prizePool: 25000, currentPlayers: 28, maxPlayers: 100, drawInterval: 10 },
          { name: 'Weekend High Roller (5:00 PM)', entryPrice: 200, prizePool: 50000, currentPlayers: 18, maxPlayers: 80, drawInterval: 10 },
          { name: 'Sunday Night Jackpot (7:00 PM)', entryPrice: 500, prizePool: 100000, currentPlayers: 42, maxPlayers: 150, drawInterval: 10 }
        ];
      } else if (broadcastPreset === 'daily_spin') {
        payload.customText = `🎁 <b>Daily Free Lucky Spin Wheel is Ready!</b> 🎡\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🇪🇹 <b>የዕለቱ የነጻ ዕድል ማዞሪያ ዝግጁ ነው!</b>\n\n` +
          `በየቀኑ ያሽከርክሩ እና እስከ <b>200 ETB የቦነስ ሽልማት</b> ወይም ነፃ የቢንጎ ቲኬቶችን ያሸንፉ! ✨\n\n` +
          `📲 አሁኑኑ አፑን ከፍተው ዕድልዎን ይሞክሩ!\n\n` +
          `💰 ፈጣን ክፍያ በቴሌብር እና ሲቢኢ ብር`;
      } else {
        if (!customBroadcastText.trim()) {
          setAnnounceResult({ ok: false, msg: 'Please type an announcement text.' });
          setAnnouncing(false);
          return;
        }
        payload.customText = customBroadcastText.trim();
      }

      const res = await fetch('/api/admin/announce-weekend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setAnnounceResult({ ok: true, msg: `Broadcast successfully sent to ${target}! ✅` });
      } else {
        setAnnounceResult({ ok: false, msg: data.error || 'Failed to send broadcast.' });
      }
    } catch (e: any) {
      setAnnounceResult({ ok: false, msg: e.message });
    } finally {
      setAnnouncing(false);
    }
  };

  // Fetch registered users & stats for admin
  useEffect(() => {
    const fetchAdminData = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (data.success) {
          setRegisteredUsers(data.users || []);
          setDbStats(data.stats || null);
        }
      } catch (err) {
        console.error('Failed to fetch admin users/stats', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchAdminData();
  }, []);

  // Admin Verification Gate State
  const [adminInput, setAdminInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // New Game Form state
  const [newGameName, setNewGameName] = useState('⚡ Super Speed Bingo');
  const [newGameType, setNewGameType] = useState<GameType>('QUICK_BINGO');
  const [newEntryPrice, setNewEntryPrice] = useState<number>(30);
  const [newMinPlayers, setNewMinPlayers] = useState<number>(10);
  const [newMaxPlayers, setNewMaxPlayers] = useState<number>(150);
  const [newDrawInterval, setNewDrawInterval] = useState<number>(3);
  const [newPrizePool, setNewPrizePool] = useState<number>(6000);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isUserAdmin = Boolean(
    user && 
    user.role === 'admin' && 
    (isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminInput.trim()) return;
    setVerifying(true);
    setVerifyError(null);
    const res = await verifyAdminAccess(adminInput.trim());
    if (!res.success || !res.isAdmin) {
      setVerifyError(
        res.message || (
          language === 'am'
            ? `መዳረሻ ተከልክሏል፡ የቴሌግራም መታወቂያ '${adminInput}' በአገልጋዩ የአስተዳዳሪ ዝርዝር ውስጥ አልተገኘም።`
            : `Access Denied: Telegram ID / Username '${adminInput}' is not in the server administrator whitelist (ADMIN_TELEGRAM_IDS).`
        )
      );
    }
    setVerifying(false);
  };

  const handleTelegramSessionVerify = async () => {
    if (typeof window === 'undefined') return;
    const tg = (window as any).Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
      setAdminInput(String(tgUser.id));
      setVerifying(true);
      setVerifyError(null);
      const res = await verifyAdminAccess(String(tgUser.id));
      if (!res.success || !res.isAdmin) {
        setVerifyError(
          res.message || (
            language === 'am'
              ? `መዳረሻ ተከልክሏል፡ የቴሌግራም መታወቂያዎ (${tgUser.id}) በአስተዳዳሪ ዝርዝር ውስጥ አልተገኘም።`
              : `Access Denied: Your Telegram ID (${tgUser.id}) is not authorized in server ADMIN_TELEGRAM_IDS.`
          )
        );
      }
      setVerifying(false);
    } else {
      setVerifyError(
        language === 'am'
          ? 'የቴሌግራም ክፍለ-ጊዜ አልተገኘም። እባክዎ የቴሌግራም መታወቂያዎን በእጅ ያስገቡ።'
          : 'No Telegram WebApp session detected. Please enter your Telegram ID manually.'
      );
    }
  };

  // Security Check: If user is not verified admin, show Verification Portal
  if (!isUserAdmin) {
    return (
      <div className={`space-y-4 ${isStandalone ? 'min-h-screen bg-[#090b13] text-slate-100 font-sans p-4 sm:p-8 flex items-center justify-center' : 'text-slate-100 font-sans p-4'}`}>
        <div className="glass-panel p-6 sm:p-8 rounded-3xl max-w-md w-full text-center space-y-5 border-amber-500/30 shadow-2xl bg-[#0c101d]">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Shield className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-100">
              {language === 'am' ? 'የአስተዳዳሪ ማረጋገጫ' : 'Administrator Verification'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {language === 'am'
                ? 'ይህ ገጽ በአገልጋይ ውቅር (ADMIN_TELEGRAM_IDS) ውስጥ ለተመዘገቡ አስተዳዳሪዎች ብቻ የተጠበቀ ነው።'
                : 'This portal is strictly restricted to administrators whose Telegram ID or Username is configured in the server environment (ADMIN_TELEGRAM_IDS).'}
            </p>
          </div>

          {verifyError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{verifyError}</span>
            </div>
          )}

          <form onSubmit={handleAdminVerify} className="space-y-3 pt-1">
            <div className="text-left">
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                {language === 'am' ? 'የአስተዳዳሪ ቴሌግራም ID ወይም የተጠቃሚ ስም' : 'Admin Telegram ID or Username'}
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 570615212 or admin_username"
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {verifying ? (
                <span>{language === 'am' ? 'በማረጋገጥ ላይ...' : 'Verifying...'}</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{language === 'am' ? 'ማረጋገጥና መግባት' : 'Verify & Enter'}</span>
                </>
              )}
            </button>

            {typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user && (
              <button
                type="button"
                onClick={handleTelegramSessionVerify}
                disabled={verifying}
                className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'am' ? 'በቴሌግራም ሴሽን አረጋግጥ' : 'Verify Telegram Session'}</span>
              </button>
            )}
          </form>

          {isStandalone && (
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {language === 'am' ? 'ወደ መነሻ ገጽ ተመለስ' : 'Return to Home'}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }


  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'PENDING');
  const totalRevenue = transactions
    .filter((t) => t.type === 'GAME_ENTRY')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalDeposits = transactions
    .filter((t) => t.type === 'DEPOSIT' && t.status === 'COMPLETED')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleCreateGameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGame({
      name: newGameName,
      gameType: newGameType,
      entryPrice: newEntryPrice,
      minPlayers: newMinPlayers,
      maxPlayers: newMaxPlayers,
      startTime: language === 'am' ? 'በቅርቡ ይጀምራል' : 'Starting soon',
      drawInterval: newDrawInterval,
      prizePool: newPrizePool,
      status: 'OPEN',
    });
    setShowCreateModal(false);
  };

  return (
    <div className={`space-y-4 ${isStandalone ? 'min-h-screen bg-[#090b13] text-slate-100 font-sans p-4 sm:p-8' : 'text-slate-100 font-sans'}`}>
      <div className={isStandalone ? 'max-w-7xl mx-auto space-y-6' : 'space-y-4'}>
        {/* Top Admin Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            {isStandalone && (
              <Link
                href="/"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {t('adminDashboard')}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400">{t('adminSubtitle')}</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-100 tracking-tight mt-0.5">
                {t('adminPanelTitle')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            {/* Role switch helper (Only for verified admin telegram IDs) */}
            {isAdminTelegramId(user?.telegramId) && (
              <button
                onClick={toggleUserRole}
                className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-[10px] sm:text-xs border border-purple-500/40 transition"
                title="Toggle between Admin and Player"
              >
                {user?.role === 'admin' ? `🛡️ ${t('adminModeActive')}` : `👤 ${t('playerModeActive')}`}
              </button>
            )}

            {/* Language toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
              className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 transition flex items-center gap-1"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'en' ? '🇪🇹 አማ' : '🇬🇧 EN'}
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-lg shrink-0"
            >
              <PlusCircle className="w-4 h-4" /> {t('createNewGame')}
            </button>
          </div>
        </div>

        {/* Live Top Header Ticker: Total Players and Weekend Games Minutes Countdown */}
        {(() => {
          const totalLivePlayers = games.reduce((acc, g) => acc + (g.currentPlayers || 0), 0);
          const weekendGames = games.filter(g => g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial);

          return (
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3.5 rounded-2xl border border-amber-500/30 shadow-lg space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {language === 'am' ? 'የቀጥታ ስታቲስቲክስ' : 'Live Platform Status'}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1 rounded-xl border border-slate-700">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-300 font-bold">
                    {language === 'am' ? 'አጠቃላይ ተጫዋቾች በሁሉም ጨዋታዎች:' : 'Total Live Players:'}
                  </span>
                  <span className="text-sm font-black text-purple-300">{totalLivePlayers}</span>
                </div>
              </div>

              {/* Weekend Games Live Countdown Bar */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === 'am' ? 'የሳምንቱ መጨረሻ ጨዋታዎች የቀረ ደቂቃ (Weekend Games Live Countdown)' : 'Weekend Lottery Games Countdown & Players'}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {weekendGames.map((wg, idx) => {
                    // Calculate mock or real minutes left based on simulated next draw
                    const cycleMinutes = idx === 0 ? 15 : idx === 1 ? 8 : 22;
                    const elapsedSec = Math.floor(now / 1000) % (cycleMinutes * 60);
                    const remSec = (cycleMinutes * 60) - elapsedSec;
                    const remMins = Math.floor(remSec / 60);
                    const remSecs = remSec % 60;

                    return (
                      <div key={wg.id} className="bg-slate-950/90 p-2.5 rounded-xl border border-amber-500/20 flex items-center justify-between">
                        <div>
                          <div className="font-black text-xs text-amber-300 flex items-center gap-1">
                            <span>🌟 {wg.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>👥 {wg.currentPlayers} {language === 'am' ? 'ተጫዋቾች' : 'players'}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">{formatETB(wg.prizePool)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {language === 'am' ? 'የቀረ ደቂቃ' : 'Time Left'}
                          </span>
                          <span className="font-mono font-black text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                            <Timer className="w-3 h-3 animate-spin" />
                            {remMins}m {remSecs < 10 ? `0${remSecs}` : remSecs}s
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Admin Telegram Broadcast Studio */}
        <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 p-4 rounded-2xl border border-purple-500/30 shadow-xl space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-300">
                  {language === 'am' ? 'የቴሌግራም ማስታወቂያ ማሰራጫ ስቱዲዮ' : 'Telegram Broadcast Studio'}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {language === 'am' ? 'ወደ ኦፊሴላዊ ቻናል ወይም ተጫዋቾች ቀጥታ መልእክት ያስተላልፉ' : 'Broadcast draw times, promotions, and updates to Telegram channels'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
              Bot Broadcast Active
            </span>
          </div>

          {/* Target & Preset Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Target Channel */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {language === 'am' ? 'የሚላክበት አድራሻ (Target)' : 'Broadcast Destination'}
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setBroadcastTarget('channel'); setAnnounceChatId('@HyperBingoChannel'); }}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer text-left flex items-center gap-1.5 ${
                    broadcastTarget === 'channel'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 ring-1 ring-purple-400'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span>📢</span>
                  <span className="truncate">@HyperBingoChannel</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setBroadcastTarget('custom'); setAnnounceChatId(''); }}
                  className={`py-1.5 px-3 rounded-xl text-xs font-black border transition cursor-pointer flex items-center gap-1 ${
                    broadcastTarget === 'custom'
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200 ring-1 ring-purple-400'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span>✍️ Custom</span>
                </button>
              </div>
              {broadcastTarget === 'custom' && (
                <input
                  type="text"
                  placeholder="Chat ID, @channel, or Group ID"
                  value={announceChatId}
                  onChange={e => setAnnounceChatId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 mt-1"
                />
              )}
            </div>

            {/* Template Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {language === 'am' ? 'የመልእክት ዓይነት (Preset)' : 'Broadcast Template'}
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'weekend_draws', label: '🌟 2/5/7 PM' },
                  { id: 'daily_spin', label: '🎁 Lucky Spin' },
                  { id: 'custom', label: '📝 Custom' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBroadcastPreset(item.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-black border transition cursor-pointer truncate ${
                      broadcastPreset === item.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Custom text editor if custom preset */}
          {broadcastPreset === 'custom' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                {language === 'am' ? 'የመልእክት ጽሑፍ አስገባ' : 'Type Broadcast Message (HTML Supported)'}
              </label>
              <textarea
                rows={3}
                value={customBroadcastText}
                onChange={e => setCustomBroadcastText(e.target.value)}
                placeholder="🎉 Big weekend jackpots are live! Join now..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          )}

          {/* Telegram Preview Box */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Telegram Message Preview</span>
              <span className="text-purple-400 font-mono">HTML Formatted</span>
            </div>
            <pre className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pr-1">
              {getBroadcastPreview()}
            </pre>
          </div>

          {/* Action Button & Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
            <div className="text-[10px] text-slate-400">
              Target: <code className="text-purple-300 font-bold">{announceChatId || '@HyperBingoChannel'}</code>
            </div>
            <button
              onClick={handleSendBroadcast}
              disabled={announcing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              {announcing ? 'Broadcasting...' : (language === 'am' ? 'መልእክቱን በቴሌግራም አሰራጭ' : 'Broadcast to Telegram')}
            </button>
          </div>

          {announceResult && (
            <div className={`text-xs font-bold px-3 py-2 rounded-xl border ${
              announceResult.ok
                ? 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-900/40 border-rose-500/40 text-rose-300'
            }`}>
              {announceResult.msg}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-slate-800 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'overview', label: t('overview'), icon: FileText },
            { id: 'games', label: t('games'), icon: Gamepad2 },
            { id: 'finance', label: `${t('finance')} (${pendingWithdrawals.length})`, icon: Wallet },
            { id: 'users', label: `${t('users')} (${registeredUsers.length || dbStats?.totalUsers || 0})`, icon: Users },
            { id: 'audit', label: t('audit'), icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
              <div className="glass-panel p-3.5 sm:p-5 rounded-2xl border-slate-800">
                <div className="text-slate-400 text-[11px] font-semibold">{t('totalRevenue')}</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{formatETB(totalRevenue)}</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-2xl border-slate-800">
                <div className="text-slate-400 text-[11px] font-semibold">{t('totalDeposits')}</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{formatETB(totalDeposits)}</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-2xl border-slate-800">
                <div className="text-slate-400 text-[11px] font-semibold">
                  {language === 'am' ? 'አጠቃላይ ተጠቃሚዎች' : 'Total Users'}
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">
                  {registeredUsers.length || dbStats?.totalUsers || 1}
                </div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-2xl border-slate-800">
                <div className="text-slate-400 text-[11px] font-semibold">{t('pendingWithdrawals')}</div>
                <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">{pendingWithdrawals.length}</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-5 rounded-2xl border-slate-800">
                <div className="text-slate-400 text-[11px] font-semibold">{t('activeGames')}</div>
                <div className="text-xl sm:text-2xl font-black text-purple-400 mt-1">
                  {games.filter((g) => g.status !== 'COMPLETED').length}
                </div>
              </div>
            </div>

            {/* Quick Pending Actions */}
            <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-800 space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                {t('payoutApprovals')} ({pendingWithdrawals.length})
              </h3>

              {pendingWithdrawals.length > 0 ? (
                <div className="space-y-2">
                  {pendingWithdrawals.map((wd) => (
                    <div
                      key={wd.id}
                      className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-100">
                          @{wd.username} • <span className="text-amber-400">{formatETB(wd.amount)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {wd.paymentMethod} ({wd.accountNumber}) • {wd.accountName}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => approveWithdrawal(wd.id, user?.username || 'admin')}
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                        >
                          {t('approve')}
                        </button>
                        <button
                          onClick={() => rejectWithdrawal(wd.id, user?.username || 'admin')}
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                        >
                          {t('reject')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">{t('noPendingWithdrawals')}</p>
              )}
            </div>
          </div>
        )}

        {/* GAMES MANAGEMENT TAB */}
        {activeTab === 'games' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-slate-200">{t('gameManagement')}</h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                + {t('createNewGame')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {games.map((g) => (
                <div key={g.id} className="glass-panel p-4 rounded-2xl border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-100 text-sm sm:text-base">{g.name}</h4>
                      <span className="text-[10px] text-slate-400">ID: {g.id}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        g.status === 'RUNNING'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {g.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400">{t('entry')}</span>
                      <div className="font-bold text-amber-400">{formatETB(g.entryPrice)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">{t('prize')}</span>
                      <div className="font-bold text-emerald-400">{formatETB(g.prizePool)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">{t('players')}</span>
                      <div className="font-bold text-purple-400">{g.currentPlayers} / {g.maxPlayers} {g.minPlayers ? `(min: ${g.minPlayers})` : ''}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => drawNextBall(g.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs hover:bg-amber-500/30 transition flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> {t('drawBall')} ({g.drawnNumbers.length}/75)
                    </button>

                    <select
                      value={g.status}
                      onChange={(e) => updateGameStatus(g.id, e.target.value as GameStatus)}
                      className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="OPEN">OPEN</option>
                      <option value="STARTING">STARTING</option>
                      <option value="RUNNING">RUNNING</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINANCE TAB */}
        {activeTab === 'finance' && (
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-800 space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-200">{t('payoutApprovals')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <th className="p-2.5">Req ID</th>
                    <th className="p-2.5">{t('users')}</th>
                    <th className="p-2.5">{t('gateway')}</th>
                    <th className="p-2.5">{t('accountNumber')}</th>
                    <th className="p-2.5">{t('amountETB')}</th>
                    <th className="p-2.5">{t('status')}</th>
                    <th className="p-2.5">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-900/40">
                      <td className="p-2.5 font-mono text-[11px]">{w.id}</td>
                      <td className="p-2.5 font-bold text-slate-200">@{w.username}</td>
                      <td className="p-2.5">{w.paymentMethod}</td>
                      <td className="p-2.5 font-mono text-[11px]">{w.accountNumber}</td>
                      <td className="p-2.5 font-bold text-amber-400">{formatETB(w.amount)}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            w.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : w.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="p-2.5">
                        {w.status === 'PENDING' ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => approveWithdrawal(w.id, user?.username || 'admin')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                            >
                              {t('approve')}
                            </button>
                            <button
                              onClick={() => rejectWithdrawal(w.id, user?.username || 'admin')}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                            >
                              {t('reject')}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">{t('completed')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>{t('userManagement')}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {registeredUsers.length || dbStats?.totalUsers || (user ? 1 : 0)} {language === 'am' ? 'ተጠቃሚዎች' : 'Total Registered'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'am' ? 'የተመዘገቡ ተጠቃሚዎች፣ ስልክ ቁጥር፣ ሚዛን እና ሪፈራል ኮድ' : 'All registered players with phone numbers, wallet balance, and referral status'}
                </p>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === 'am' ? 'በስም ወይም በስልክ ፈልግ...' : 'Search by username or phone...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Current Admin Quick Action Card */}
            {user && (
              <div className="bg-slate-900/90 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="font-bold text-xs text-slate-200">
                    {language === 'am' ? 'የእርስዎ አድሚን አካውንት:' : 'Current Admin Session:'} @{user.username} ({user.name})
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {user.role.toUpperCase()}
                  </span>
                </div>
                {isAdminTelegramId(user.telegramId) && (
                  <button
                    onClick={toggleUserRole}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition"
                  >
                    {user.role === 'admin' ? t('switchToPlayer') : t('switchToAdmin')}
                  </button>
                )}
              </div>
            )}

            {/* Full Registered Users Table */}
            {loadingUsers ? (
              <div className="text-center py-8 text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                <span>{language === 'am' ? 'ተጠቃሚዎችን በመጫን ላይ...' : 'Loading registered players roster...'}</span>
              </div>
            ) : (() => {
              const displayUsers = registeredUsers.length > 0 ? registeredUsers : user ? [user] : [];
              const filtered = displayUsers.filter((u) => {
                if (!searchTerm.trim()) return true;
                const q = searchTerm.toLowerCase();
                return (
                  (u.username && u.username.toLowerCase().includes(q)) ||
                  (u.name && u.name.toLowerCase().includes(q)) ||
                  (u.phone && u.phone.toLowerCase().includes(q)) ||
                  (u.referralCode && u.referralCode.toLowerCase().includes(q))
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-6 text-xs text-slate-500 italic">
                    {language === 'am' ? 'ምንም ተጠቃሚ አልተገኘም' : 'No users match the search criteria'}
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <th className="p-2.5">User</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Telegram ID</th>
                        <th className="p-2.5">Main Balance</th>
                        <th className="p-2.5">Bonus Balance</th>
                        <th className="p-2.5">Referral Code</th>
                        <th className="p-2.5">Referred By</th>
                        <th className="p-2.5">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                      {filtered.map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-900/60 transition">
                          <td className="p-2.5">
                            <div className="font-bold text-slate-100">@{u.username}</div>
                            <div className="text-[10px] text-slate-400">{u.name}</div>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-300">
                            {u.phone || '—'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">
                            {u.telegramId || '—'}
                          </td>
                          <td className="p-2.5 font-bold text-emerald-400 font-mono">
                            {formatETB(u.balance ?? 0)}
                          </td>
                          <td className="p-2.5 font-bold text-amber-400 font-mono">
                            {formatETB(u.bonusBalance ?? 20)}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-purple-300">
                            {u.referralCode || '—'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-400">
                            {u.referredBy || u.referred_by || '—'}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {u.role ? u.role.toUpperCase() : 'PLAYER'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === 'audit' && (
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-200">{t('auditLogLedger')}</h3>
                <p className="text-[10px] sm:text-xs text-slate-400">Strict legal recording of administrative activities</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold border border-purple-500/40">
                AUDIT LIVE
              </span>
            </div>

            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-200 flex items-center gap-1.5 flex-wrap">
                      <span className="text-amber-400 font-mono">[{log.adminUsername}]</span>
                      <span>{log.action}</span>
                      <span className="text-slate-400">→ {log.target}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      IP: {log.ipAddress} • {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {log.amount && (
                    <div className="font-mono font-bold text-emerald-400 text-xs">
                      {formatETB(log.amount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create New Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateGameSubmit}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 max-w-md w-full space-y-3.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-slate-100 text-sm">{t('createNewGame')}</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {t('gameTitle')}
              </label>
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {t('selectGameType')}
                </label>
                <select
                  value={newGameType}
                  onChange={(e) => setNewGameType(e.target.value as GameType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="QUICK_BINGO">Quick Bingo (3s)</option>
                  <option value="TURBO_EXPRESS">Turbo Express (2s)</option>
                  <option value="CLASSIC_75">Classic 75 (5s)</option>
                  <option value="HIGH_STAKES">High Stakes VIP</option>
                  <option value="WEEKEND_LOTTERY">🌟 Weekend Mega Lottery (Fri-Sun)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {t('drawIntervalSeconds')}
                </label>
                <input
                  type="number"
                  value={newDrawInterval}
                  onChange={(e) => setNewDrawInterval(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  min={1}
                  max={10}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {t('entry')} (ETB)
                </label>
                <input
                  type="number"
                  value={newEntryPrice}
                  onChange={(e) => setNewEntryPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  min={1}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {t('prize')} (ETB)
                </label>
                <input
                  type="number"
                  value={newPrizePool}
                  onChange={(e) => setNewPrizePool(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  min={10}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Min Players
                </label>
                <input
                  type="number"
                  value={newMinPlayers}
                  onChange={(e) => setNewMinPlayers(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  min={2}
                  max={500}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Max Players
                </label>
                <input
                  type="number"
                  value={newMaxPlayers}
                  onChange={(e) => setNewMaxPlayers(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  min={10}
                  max={1000}
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg"
              >
                {t('createGameSubmit')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
