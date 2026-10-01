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
    approveDeposit,
    rejectDeposit,
    createGame, 
    updateGameStatus,
    drawNextBall,
    language,
    setLanguage,
    t,
    toggleUserRole,
    verifyAdminAccess
  } = useBingo();

  const [activeTab, setActiveTab] = useState<'overview' | 'broadcast' | 'games' | 'finance' | 'users' | 'audit'>('overview');
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

  // ── Separate Broadcast State ──────────────────────────────────────────────
  const [broadcastMode, setBroadcastMode] = useState<'weekend' | 'custom'>('weekend');

  // 1. Weekend Game Broadcast State
  const [weekendTarget, setWeekendTarget] = useState<'channel' | 'direct' | 'custom'>('channel');
  const [weekendCustomChatId, setWeekendCustomChatId] = useState('');

  // 2. Custom Announcement & Media Broadcast State
  const [customTarget, setCustomTarget] = useState<'channel' | 'direct' | 'custom'>('channel');
  const [customChatId, setCustomChatId] = useState('');
  const [customBroadcastText, setCustomBroadcastText] = useState('');
  const [broadcastMediaType, setBroadcastMediaType] = useState<'none' | 'photo' | 'document'>('none');
  const [broadcastMediaUrl, setBroadcastMediaUrl] = useState('');
  const [broadcastFileName, setBroadcastFileName] = useState('');

  // Shared Broadcast Status
  const [announcing, setAnnouncing] = useState(false);
  const [announceResult, setAnnounceResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Fancy Announcement Presets for quick 1-click attractive copy
  const CUSTOM_ANNOUNCEMENT_PRESETS = [
    {
      id: 'weekend',
      name: '🌟 Weekend Extravaganza',
      text: 
        `🌟👑 HYPER BINGO ETHIOPIA — WEEKEND MEGA EXTRAVAGANZA! 👑🌟\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🇪🇹 የሳምንቱ መጨረሻ ታላቅ የቢንጎ እና የሎተሪ ፌስቲቫል!\n` +
        `💰 የጃክፖት ፈንድ / Total Prize Pool: 100,000+ ETB!\n\n` +
        `⏰ የቀጥታ ዕጣ ማውጣት ሰዓቶች (Official Draw Times):\n` +
        `   🏆 2:00 PM (ከሰዓት 8:00) — ⚡ Mega Kickoff Draw\n` +
        `   🏆 5:00 PM (ከቀኑ 11:00) — 🎲 Golden Rush Mega Draw\n` +
        `   🏆 7:00 PM (ምሽት 1:00) — 👑 Super Jackpot Finale\n\n` +
        `💎 ልዩ ጥቅሞች (Why Play Now):\n` +
        `   ✅ 80% የተጣራ ክፍያ ለአሸናፊዎች (80% Return to Players)\n` +
        `   ✅ ፈጣን ክፍያ በቴሌብር እና ሲቢኢ ብር (Instant Cashout)\n` +
        `   🎁 20 ETB የመመዝገቢያ ቦነስ (Play-only Welcome Bonus)\n\n` +
        `🚀 ዕድልዎን አሁኑኑ ይሞክሩ! ካርዶችዎን ቀድመው ይያዙ!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 ከታች ያለውን አዝራር ተጭነው አሁኑኑ ይቀላቀሉ!`,
    },
    {
      id: 'fetan',
      name: '⚡ Hyper Fetan Blitz',
      text:
        `⚡🔥 HYPER FETAN FLASH TOURNAMENT IS LIVE! 🔥⚡\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🇪🇹 የሃይፐር ፈጣን ዙር ውድድር ተጀምሯል!\n` +
        `⏱️ እያንዳንዱ ዙር በ1 ደቂቃ ብቻ ይጠናቀቃል! ፈጣን አሸናፊ ይሁኑ!\n\n` +
        `💰 ውርርድ፡ ከ 5 እስከ 50 ETB ብቻ\n` +
        `🏆 አሸናፊ ሕግ፡ 1 መስመር ወይም 4 ማዕዘናት\n` +
        `⚡ ፈጣን ተቀማጭና ወጪ በቴሌብር እና ሲቢኢ ብር\n\n` +
        `🎯 አሁኑኑ ይግቡ እና በቀጥታ ይጫወቱ!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 ከታች ያለውን የፈጣን ጨዋታ አዝራር ይጫኑ!`,
    },
    {
      id: 'jackpot',
      name: '🎁 20 ETB Bonus & Jackpot',
      text:
        `🎁✨ WELCOME BONUS & MEGA JACKPOT ALERT! ✨🎁\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🎉 ለሁሉም አዲስ ተጫዋቾች የ 20 ETB መመዝገቢያ ጉርሻ ተዘጋጅቷል!\n` +
        `💰 ይህንን ቦነስ ተጠቅመው ሁሉንም የቢንጎ ጨዋታዎች መጫወት ይችላሉ!\n\n` +
        `💎 100% የታመነ እና ፈጣን ክፍያ በ Telebirr & CBE Birr\n` +
        `👥 ጓደኛዎን ይጋብዙ — በእያንዳንዱ አሸናፊነት 1% የትርፍ ኮሚሽን ያግኙ!\n\n` +
        `🚀 አሁኑኑ ተቀላቅለው የዛሬው ዕድለኛ አሸናፊ ይሁኑ!\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👇 አሁኑኑ Play Hyper Bingo ን ይጫኑ!`,
    },
    {
      id: 'notice',
      name: '📢 Official System Notice',
      text:
        `📢🛡️ OFFICIAL SYSTEM NOTICE / አስፈላጊ ማሳሰቢያ 🛡️📢\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `ውድ የሃይፐር ቢንጎ ተጫዋቾቻችን፡\n` +
        `የጨዋታውን ጥራት እና ደህንነት ይበልጥ ለማሻሻል አዳዲስ ዝመናዎች ተደርገዋል!\n\n` +
        `✅ ፈጣን የገንዘብ ማስገቢያ እና ማውጫ ማረጋገጫ\n` +
        `✅ የተሻሻለ የቀጥታ የካርድ መምረጫ ሰንጠረዥ\n` +
        `✅ 24/7 የደንበኞች አገልግሎት ድጋፍ (@HyperBingoSupport)\n\n` +
        `መልካም እድል ለሁላችሁም! 🇪🇹✨\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    },
  ];

  // Helper to format Weekend Broadcast preview (clean, high-energy, without duplicate game list)
  const getWeekendBroadcastPreview = () => {
    return (
      `🌟👑 HYPER BINGO ETHIOPIA — WEEKEND MEGA EXTRAVAGANZA! 👑🌟\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🇪🇹 የሳምንቱ መጨረሻ ታላቅ የቢንጎ እና የሎተሪ ፌስቲቫል!\n` +
      `💰 የጃክፖት ፈንድ / Total Prize Pool: 100,000+ ETB!\n\n` +
      `⏰ የቀጥታ ዕጣ ማውጣት ሰዓቶች (Official Draw Times):\n` +
      `   🏆 2:00 PM (ከሰዓት 8:00) — ⚡ Mega Kickoff Draw\n` +
      `   🏆 5:00 PM (ከቀኑ 11:00) — 🎲 Golden Rush Mega Draw\n` +
      `   🏆 7:00 PM (ምሽት 1:00) — 👑 Super Jackpot Finale\n\n` +
      `💎 ልዩ ጥቅሞች (Why Play Now):\n` +
      `   ✅ 80% የተጣራ ክፍያ ለአሸናፊዎች (80% Return to Players)\n` +
      `   ✅ ፈጣን ክፍያ በቴሌብር እና ሲቢኢ ብር (Instant Cashout)\n` +
      `   🎁 20 ETB የመመዝገቢያ ቦነስ (Play-only Welcome Bonus)\n\n` +
      `🚀 ዕድልዎን አሁኑኑ ይሞክሩ! ካርዶችዎን ቀድመው ይያዙ!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👇 ከታች ያለውን አዝራር ተጭነው አሁኑኑ ይቀላቀሉ!`
    );
  };

  // Helper to format Custom Broadcast preview
  const getCustomBroadcastPreview = () => {
    let mediaPrefix = '';
    if (broadcastMediaType === 'photo') {
      mediaPrefix = `[📸 PICTURE ATTACHED: ${broadcastFileName || 'Image'}]\n\n`;
    } else if (broadcastMediaType === 'document') {
      mediaPrefix = `[📄 DOCUMENT ATTACHED: ${broadcastFileName || 'Document'}]\n\n`;
    }
    return mediaPrefix + (customBroadcastText || 'Select a fancy preset above or type your announcement text to see live preview...');
  };

  // Handler for Weekend Broadcast
  const handleSendWeekendBroadcast = async (overrideTarget?: string) => {
    setAnnouncing(true);
    setAnnounceResult(null);

    const weekendGames = games.filter(g => g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial);
    const target = overrideTarget || (
      weekendTarget === 'direct'
        ? (user?.telegramId || '')
        : weekendTarget === 'channel'
        ? '@HyperBingoChannel'
        : (weekendCustomChatId.trim() || user?.telegramId || '')
    );

    const activeList = weekendGames.length > 0 ? weekendGames : [
      { name: 'Weekend Mega Draw (2:00 PM)', entryPrice: 100, prizePool: 25000, currentPlayers: 28, maxPlayers: 100, drawInterval: 10 },
      { name: 'Weekend High Roller (5:00 PM)', entryPrice: 200, prizePool: 50000, currentPlayers: 18, maxPlayers: 80, drawInterval: 10 },
      { name: 'Sunday Night Jackpot (7:00 PM)', entryPrice: 500, prizePool: 100000, currentPlayers: 42, maxPlayers: 150, drawInterval: 10 }
    ];

    const payload = {
      adminTelegramId: user?.telegramId || user?.username || '',
      chatId: target,
      weekendGames: activeList,
    };

    try {
      const res = await fetch('/api/admin/announce-weekend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const isSuccess = Boolean(data?.success || data?.ok);

      try {
        window.dispatchEvent(new CustomEvent('hyperbingo:bot-broadcast', {
          detail: {
            preset: 'weekend_draws',
            text: getWeekendBroadcastPreview(),
            weekendGames: activeList,
          }
        }));
      } catch {}

      if (isSuccess) {
        setAnnounceResult({
          ok: true,
          msg: `✅ Weekend games successfully broadcasted to ${target}! Active announcement is now visible to all players.`
        });
      } else {
        const tip = data?.tip || '';
        setAnnounceResult({
          ok: false,
          msg: `⚠️ Announcement saved in app! Telegram API notice: ${data?.error || 'Delivered to active banner'} ${tip ? `\n💡 TIP: ${tip}` : ''}`
        });
      }
    } catch (err: any) {
      setAnnounceResult({ ok: false, msg: `Broadcast error: ${err.message}` });
    } finally {
      setAnnouncing(false);
    }
  };

  // Handler for Custom Broadcast
  const handleSendCustomBroadcast = async (overrideTarget?: string) => {
    if (!customBroadcastText.trim()) {
      setAnnounceResult({ ok: false, msg: 'Please type an announcement message before broadcasting.' });
      return;
    }

    setAnnouncing(true);
    setAnnounceResult(null);

    const target = overrideTarget || (
      customTarget === 'direct'
        ? (user?.telegramId || '')
        : customTarget === 'channel'
        ? (customChatId.trim() || '@HyperBingoChannel')
        : (customChatId.trim() || user?.telegramId || '')
    );

    const payload = {
      adminTelegramId: user?.telegramId || user?.username || '',
      chatId: target,
      customText: customBroadcastText.trim(),
      mediaUrl: broadcastMediaType !== 'none' ? broadcastMediaUrl : undefined,
      mediaType: broadcastMediaType !== 'none' ? broadcastMediaType : undefined,
      fileName: broadcastMediaType === 'document' ? broadcastFileName : undefined,
    };

    try {
      const res = await fetch('/api/admin/announce-weekend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const isSuccess = Boolean(data?.success || data?.ok);

      try {
        window.dispatchEvent(new CustomEvent('hyperbingo:bot-broadcast', {
          detail: {
            preset: 'custom',
            text: customBroadcastText.trim(),
            mediaUrl: payload.mediaUrl,
            mediaType: payload.mediaType,
            fileName: payload.fileName,
          }
        }));
      } catch {}

      if (isSuccess) {
        setAnnounceResult({
          ok: true,
          msg: `✅ Custom announcement published to ${target}! Players opening the bot or app will see this announcement.`
        });
      } else {
        const tip = data?.tip || '';
        setAnnounceResult({
          ok: false,
          msg: `⚠️ Announcement saved in app! Telegram API notice: ${data?.error || 'Active banner updated'} ${tip ? `\n💡 TIP: ${tip}` : ''}`
        });
      }
    } catch (err: any) {
      setAnnounceResult({ ok: false, msg: `Broadcast error: ${err.message}` });
    } finally {
      setAnnouncing(false);
    }
  };

  const handleClearAnnouncement = async () => {
    setAnnouncing(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminTelegramId: user?.telegramId || user?.username || '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAnnounceResult({ ok: true, msg: '✅ Active announcement removed! Users will no longer see the banner.' });
        window.dispatchEvent(new CustomEvent('hyperbingo:bot-broadcast', { detail: { text: '' } }));
      } else {
        setAnnounceResult({ ok: false, msg: `❌ Failed to clear announcement: ${data.error || 'Unknown error'}` });
      }
    } catch (err: any) {
      setAnnounceResult({ ok: false, msg: `❌ Error clearing announcement: ${err.message}` });
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

        {/* Navigation Tabs (Organized at the top of the Admin Panel) */}
        <div className="flex items-center gap-1.5 border-b border-slate-800 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'overview', label: t('overview'), icon: FileText },
            { id: 'broadcast', label: language === 'am' ? '📢 ማስታወቂያ ማሰራጫ' : '📢 Broadcast Center', icon: Megaphone },
            { id: 'games', label: t('games'), icon: Gamepad2 },
            { id: 'finance', label: `${t('finance')} (${pendingWithdrawals.length})`, icon: Wallet },
            { id: 'users', label: `${t('users')} (${registeredUsers.length || dbStats?.totalUsers || 0})`, icon: Users },
            { id: 'audit', label: t('audit'), icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setAnnounceResult(null); }}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* BROADCAST CENTER TAB (Separated Weekend Games vs Custom Rich Media) */}
        {activeTab === 'broadcast' && (
          <div className="space-y-4">
            {/* Top Selector Card */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                      {language === 'am' ? 'የቴሌግራም እና ሚኒ አፕ ማስታወቂያ ማሰራጫ' : 'Telegram & In-App Broadcast Studio'}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {language === 'am'
                        ? 'የሳምንቱን መጨረሻ ጨዋታዎች ወይም የራስዎን ልዩ ማስታወቂያ ለይተው ያሰራጩ'
                        : 'Choose between automated weekend lottery game alerts or custom rich media announcements'}
                    </p>
                  </div>
                </div>

                {/* Separate Mode Switcher */}
                <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setBroadcastMode('weekend'); setAnnounceResult(null); }}
                    className={`py-2 px-3.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      broadcastMode === 'weekend'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌟</span>
                    <span>{language === 'am' ? 'የሳምንቱ መጨረሻ ጨዋታዎች' : 'Weekend Games Broadcast'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBroadcastMode('custom'); setAnnounceResult(null); }}
                    className={`py-2 px-3.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                      broadcastMode === 'custom'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>✍️</span>
                    <span>{language === 'am' ? 'ልዩ ማስታወቂያ እና ፎቶ/ሰነድ' : 'Custom Announcement & Media'}</span>
                  </button>
                </div>
              </div>

              {/* Status Alert Notification */}
              {announceResult && (
                <div className={`text-xs font-bold whitespace-pre-wrap leading-relaxed p-3.5 rounded-xl border ${
                  announceResult.ok
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500 text-rose-200'
                }`}>
                  {announceResult.msg}
                </div>
              )}
            </div>

            {/* ── MODE 1: WEEKEND GAMES ANNOUNCEMENT ────────────────────────── */}
            {broadcastMode === 'weekend' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left 7 cols: Weekend Broadcast Config */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 text-base">🌟</span>
                        <div>
                          <h3 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                            {language === 'am' ? 'የሳምንቱ መጨረሻ ጨዋታዎች ማሰራጫ' : 'Weekend Lottery Game Broadcast'}
                          </h3>
                          <span className="text-[11px] text-slate-300">
                            {language === 'am' ? 'ዕለታት፡ አርብ፣ ቅዳሜ፣ እሑድ (2:00, 5:00 & 7:00 PM)' : 'Draw Times: Fri–Sun at 2:00 PM, 5:00 PM & 7:00 PM'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full uppercase">
                        Automated Format
                      </span>
                    </div>

                    {/* Destination Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        {language === 'am' ? 'የሚላክበት አድራሻ (Target)' : 'Broadcast Destination'}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => { setWeekendTarget('channel'); setWeekendCustomChatId(''); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            weekendTarget === 'channel'
                              ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          📢 @HyperBingoChannel
                        </button>
                        <button
                          type="button"
                          onClick={() => { setWeekendTarget('direct'); setWeekendCustomChatId(''); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            weekendTarget === 'direct'
                              ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          💬 {language === 'am' ? 'ለኔ ቴሌግራም' : 'My Telegram'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWeekendTarget('custom')}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            weekendTarget === 'custom'
                              ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          ✍️ {language === 'am' ? 'ሌላ Chat ID' : 'Custom Target'}
                        </button>
                      </div>
                      {weekendTarget === 'custom' && (
                        <input
                          type="text"
                          placeholder="e.g. @YourChannel or -1001234567890"
                          value={weekendCustomChatId}
                          onChange={e => setWeekendCustomChatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 mt-1"
                        />
                      )}
                    </div>

                    {/* Weekend Grand Schedule Card — Clean, High-Contrast & Fancy */}
                    <div className="space-y-2 p-3.5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 border border-amber-500/40">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <span>🏆</span> {language === 'am' ? 'የሳምንቱ መጨረሻ የዕጣ ሰዓቶች እና ሽልማቶች' : 'Official Draw Times & Prize Pools'}
                        </span>
                        <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          100,000+ ETB Total
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-amber-400 uppercase block">2:00 PM Draw</span>
                            <span className="text-xs font-black text-white block mt-0.5">⚡ Mega Kickoff</span>
                          </div>
                          <span className="text-xs font-mono font-black text-emerald-400 mt-2">
                            🏆 25,000 ETB
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-amber-400 uppercase block">5:00 PM Draw</span>
                            <span className="text-xs font-black text-white block mt-0.5">🎲 Golden Rush</span>
                          </div>
                          <span className="text-xs font-mono font-black text-emerald-400 mt-2">
                            🏆 50,000 ETB
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-amber-400 uppercase block">7:00 PM Draw</span>
                            <span className="text-xs font-black text-white block mt-0.5">👑 Super Jackpot</span>
                          </div>
                          <span className="text-xs font-mono font-black text-emerald-400 mt-2">
                            🏆 100,000 ETB
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 text-[11px] text-slate-200 flex items-center justify-between border-t border-slate-800/80">
                        <span>💰 80% Win Payout · 20% House</span>
                        <span className="text-amber-300 font-bold">Fri, Sat & Sun Weekly</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => { if (user?.telegramId) handleSendWeekendBroadcast(user.telegramId); }}
                        disabled={announcing || !user?.telegramId}
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-bold text-xs border border-slate-700 cursor-pointer text-center"
                      >
                        ✉️ {language === 'am' ? 'ለኔ ቴሌግራም ሞክር' : 'Send Test to Me'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendWeekendBroadcast()}
                        disabled={announcing}
                        className="flex-1 py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:brightness-105 active:scale-98 disabled:opacity-50 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Megaphone className="w-4 h-4 text-slate-950" />
                        {announcing ? 'Broadcasting...' : (language === 'am' ? 'የሳምንቱን መጨረሻ ጨዋታዎች አሰራጭ' : 'Broadcast Weekend Games Now')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right 5 cols: Live Preview */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200 border-b border-slate-800 pb-2">
                      <span className="flex items-center gap-1.5 text-white">
                        <span>💬</span> Telegram Live Preview
                      </span>
                      <span className="text-[10px] text-amber-400 font-mono font-bold">Auto Synchronized</span>
                    </div>

                    <div className="bg-[#17212b] p-4 rounded-xl border border-sky-900/40 text-slate-100 text-xs font-sans leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {getWeekendBroadcastPreview()}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-normal">
                      💡 <strong>Note:</strong> Standalone fancy broadcast without game list clutter. Updates the top banner for all users.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── MODE 2: CUSTOM ANNOUNCEMENT & MEDIA POST ─────────────────── */}
            {broadcastMode === 'custom' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left 7 cols: Custom Text & Media Uploader */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-base">✍️</span>
                        <div>
                          <h3 className="text-sm font-black text-indigo-300 uppercase tracking-wide">
                            {language === 'am' ? 'ልዩ ማስታወቂያ እና ፎቶ/ሰነድ መለጠፊያ' : 'Custom Announcement & Media Studio'}
                          </h3>
                          <span className="text-[11px] text-slate-300">
                            {language === 'am' ? 'ማንኛውንም ጽሑፍ፣ ምስል ወይም ሰነድ ለተጫዋቾች ይለጥፉ' : 'Write custom text, attach pictures, flyers, or documents'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-1 rounded-full uppercase">
                        Custom Media
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wider block">
                        ⚡ {language === 'am' ? 'ፈጣን የአማራጭ ጽሑፎች (1-Click Presets)' : '1-Click Announcement Presets'}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {CUSTOM_ANNOUNCEMENT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setCustomBroadcastText(preset.text)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 text-[11px] font-bold transition cursor-pointer"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Destination Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                        {language === 'am' ? 'የሚላክበት አድራሻ (Target)' : 'Broadcast Destination'}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => { setCustomTarget('channel'); setCustomChatId(''); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            customTarget === 'channel'
                              ? 'bg-indigo-600 text-white font-black border-indigo-400 shadow-md'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          📢 @HyperBingoChannel
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCustomTarget('direct'); setCustomChatId(''); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            customTarget === 'direct'
                              ? 'bg-indigo-600 text-white font-black border-indigo-400 shadow-md'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          💬 {language === 'am' ? 'ለኔ ቴሌግራም' : 'My Telegram'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomTarget('custom')}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                            customTarget === 'custom'
                              ? 'bg-indigo-600 text-white font-black border-indigo-400 shadow-md'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          ✍️ {language === 'am' ? 'ሌላ Chat ID' : 'Custom Target'}
                        </button>
                      </div>
                      {customTarget === 'custom' && (
                        <input
                          type="text"
                          placeholder="e.g. @YourChannel or -1001234567890"
                          value={customChatId}
                          onChange={e => setCustomChatId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-400 mt-1"
                        />
                      )}
                    </div>

                    {/* Custom Textarea */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          {language === 'am' ? 'የማስታወቂያው መልእክት ጽሑፍ' : 'Announcement Message (HTML Supported)'}
                        </label>
                        <span className="text-[10px] text-slate-300 font-mono">
                          {customBroadcastText.length} chars
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={customBroadcastText}
                        onChange={e => setCustomBroadcastText(e.target.value)}
                        placeholder="🎉 የዛሬው ልዩ ውድድር ተጀምሯል! አሁኑኑ ተቀላቀሉ..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                      />
                    </div>

                    {/* Media Attachment Selector */}
                    <div className="space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <span>📎</span> {language === 'am' ? 'ምስል ወይም ሰነድ አያይዝ' : 'Attach Photo or Document'}
                        </label>
                        <span className="text-[10px] text-indigo-400 font-bold uppercase">Optional Attachment</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setBroadcastMediaType('none'); setBroadcastMediaUrl(''); setBroadcastFileName(''); }}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                            broadcastMediaType === 'none'
                              ? 'bg-slate-800 text-white border-slate-600 font-black'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          📝 Text Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setBroadcastMediaType('photo')}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                            broadcastMediaType === 'photo'
                              ? 'bg-indigo-600 text-white border-indigo-400 font-black shadow-md'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          🖼️ Photo / Picture
                        </button>
                        <button
                          type="button"
                          onClick={() => setBroadcastMediaType('document')}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                            broadcastMediaType === 'document'
                              ? 'bg-indigo-600 text-white border-indigo-400 font-black shadow-md'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          📄 Document / PDF
                        </button>
                      </div>

                      {/* Photo Attachment inputs */}
                      {broadcastMediaType === 'photo' && (
                        <div className="space-y-2 pt-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Paste image URL (https://...) or choose file"
                              value={broadcastMediaUrl.startsWith('data:') ? `[Uploaded image: ${broadcastFileName}]` : broadcastMediaUrl}
                              onChange={e => { setBroadcastMediaUrl(e.target.value); setBroadcastFileName(''); }}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                            />
                            <label className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                              📁 Upload
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setBroadcastFileName(file.name);
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      if (typeof reader.result === 'string') {
                                        setBroadcastMediaUrl(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                          {broadcastMediaUrl && (
                            <div className="relative w-full max-h-40 rounded-xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center">
                              <img src={broadcastMediaUrl} alt="Preview" className="max-h-40 object-contain" />
                              <button
                                type="button"
                                onClick={() => { setBroadcastMediaUrl(''); setBroadcastFileName(''); }}
                                className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full cursor-pointer"
                              >
                                ✕ Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Document Attachment inputs */}
                      {broadcastMediaType === 'document' && (
                        <div className="space-y-2 pt-1.5">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Paste document URL (https://...) or upload file"
                              value={broadcastMediaUrl.startsWith('data:') ? `[Uploaded doc: ${broadcastFileName}]` : broadcastMediaUrl}
                              onChange={e => { setBroadcastMediaUrl(e.target.value); setBroadcastFileName(''); }}
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                            />
                            <label className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                              📁 Upload
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xlsx,.png,.jpg"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setBroadcastFileName(file.name);
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      if (typeof reader.result === 'string') {
                                        setBroadcastMediaUrl(reader.result);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                          {broadcastFileName && (
                            <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200">
                              <span className="truncate font-bold">📄 {broadcastFileName}</span>
                              <button
                                type="button"
                                onClick={() => { setBroadcastMediaUrl(''); setBroadcastFileName(''); }}
                                className="text-rose-400 hover:text-rose-300 text-xs font-bold ml-2 cursor-pointer"
                              >
                                ✕ Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => { if (user?.telegramId) handleSendCustomBroadcast(user.telegramId); }}
                        disabled={announcing || !user?.telegramId}
                        className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer text-center"
                      >
                        ✉️ {language === 'am' ? 'ለኔ ቴሌግራም ሞክር' : 'Send Test to Me'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAnnouncement}
                        disabled={announcing}
                        className="py-2.5 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 disabled:opacity-50 text-rose-300 font-bold text-xs border border-rose-800/60 cursor-pointer text-center"
                        title="Remove current active announcement from all players"
                      >
                        🗑️ {language === 'am' ? 'ማስታወቂያ አጥፋ' : 'Clear Active'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendCustomBroadcast()}
                        disabled={announcing}
                        className="flex-1 py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-98 disabled:opacity-50 text-white font-black text-xs transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Megaphone className="w-4 h-4 text-white" />
                        {announcing ? 'Publishing...' : (language === 'am' ? 'ማስታወቂያውን አሰራጭ' : 'Broadcast Custom Post')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right 5 cols: Live Preview */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 shadow-lg space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
                      <span className="flex items-center gap-1.5 text-white">
                        <span>💬</span> Telegram & App Preview
                      </span>
                      <span className="text-[10px] text-indigo-400 font-mono font-bold">Live Sync</span>
                    </div>

                    {broadcastMediaType === 'photo' && broadcastMediaUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-700 bg-black flex items-center justify-center max-h-48">
                        <img src={broadcastMediaUrl} alt="Preview" className="max-h-48 object-contain" />
                      </div>
                    )}

                    {broadcastMediaType === 'document' && broadcastFileName && (
                      <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-700/60 flex items-center gap-2 text-xs text-indigo-200">
                        <span className="text-xl">📄</span>
                        <div className="truncate">
                          <p className="font-bold text-white truncate">{broadcastFileName}</p>
                          <span className="text-[10px] text-indigo-300">Document attachment</span>
                        </div>
                      </div>
                    )}

                    <div className="bg-[#17212b] p-4 rounded-xl border border-sky-900/40 text-slate-100 text-xs font-sans leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {customBroadcastText || 'Type your message on the left to see live preview...'}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-normal">
                      📢 <strong>Audience:</strong> Will immediately display in the Top Lobby Banner of the Mini App and be broadcasted to your selected Telegram destination.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Live Top Header Ticker: Total Players and Weekend Games Minutes Countdown */}
            {(() => {
              const totalLivePlayers = games.reduce((acc, g) => acc + (g.currentPlayers || 0), 0);
              const weekendGames = games.filter(g => g.gameType === 'WEEKEND_LOTTERY' || g.isWeekendSpecial);

              return (
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        {language === 'am' ? 'የቀጥታ ስታቲስቲክስ' : 'Live Platform Status'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-slate-300 font-bold">
                        {language === 'am' ? 'አጠቃላይ ተጫዋቾች:' : 'Total Live Players:'}
                      </span>
                      <span className="text-sm font-black text-purple-300">{totalLivePlayers}</span>
                    </div>
                  </div>

                  {/* Weekend Games Live Countdown Bar */}
                  <div className="space-y-2">
                    <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>{language === 'am' ? 'የሳምንቱ መጨረሻ ጨዋታዎች የቀረ ደቂቃ' : 'Weekend Lottery Games Countdown & Live Players'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {weekendGames.map((wg, idx) => {
                        const cycleMinutes = idx === 0 ? 15 : idx === 1 ? 8 : 22;
                        const elapsedSec = Math.floor(now / 1000) % (cycleMinutes * 60);
                        const remSec = (cycleMinutes * 60) - elapsedSec;
                        const remMins = Math.floor(remSec / 60);
                        const remSecs = remSec % 60;

                        return (
                          <div key={wg.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="font-black text-xs text-amber-300 flex items-center gap-1">
                                <span>🌟 {wg.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-300 flex items-center gap-2 mt-0.5">
                                <span>👥 {wg.currentPlayers} players</span>
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

            {/* Quick Broadcast Action Cards on Overview */}
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  {language === 'am' ? 'ፈጣን ማስታወቂያ ማሰራጫ' : 'Quick Broadcast Actions'}
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {language === 'am'
                    ? 'የሳምንቱን መጨረሻ ጨዋታዎች ወይም አዲስ ማስታወቂያ ለተጠቃሚዎች ያሰራጩ'
                    : 'Jump directly to broadcast weekend draws or publish a custom media post'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setActiveTab('broadcast'); setBroadcastMode('weekend'); }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>🌟</span> {language === 'am' ? 'የሳምንቱ ጨዋታዎች' : 'Weekend Draws'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('broadcast'); setBroadcastMode('custom'); }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>✍️</span> {language === 'am' ? 'ልዩ ማስታወቂያ' : 'Custom Post'}
                </button>
              </div>
            </div>

            {/* KPI Summary Cards — High Contrast & Clear */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-md">
                <div className="text-slate-200 text-xs font-black uppercase tracking-wider">{t('totalRevenue')}</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{formatETB(totalRevenue)}</div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-md">
                <div className="text-slate-200 text-xs font-black uppercase tracking-wider">{t('totalDeposits')}</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{formatETB(totalDeposits)}</div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-md">
                <div className="text-slate-200 text-xs font-black uppercase tracking-wider">
                  {language === 'am' ? 'አጠቃላይ ተጠቃሚዎች' : 'Total Users'}
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-300 mt-1">
                  {registeredUsers.length || dbStats?.totalUsers || 1}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-md">
                <div className="text-slate-200 text-xs font-black uppercase tracking-wider">{t('pendingWithdrawals')}</div>
                <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1">{pendingWithdrawals.length}</div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-md">
                <div className="text-slate-200 text-xs font-black uppercase tracking-wider">{t('activeGames')}</div>
                <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
                  {games.filter((g) => g.status !== 'COMPLETED').length}
                </div>
              </div>
            </div>

            {/* Quick Pending Actions */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-md space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                {t('payoutApprovals')} ({pendingWithdrawals.length})
              </h3>

              {pendingWithdrawals.length > 0 ? (
                <div className="space-y-2">
                  {pendingWithdrawals.map((wd) => (
                    <div
                      key={wd.id}
                      className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-100">
                          @{wd.username} • <span className="text-amber-400 font-black">{formatETB(wd.amount)}</span>
                        </div>
                        <div className="text-[11px] text-slate-300 mt-0.5">
                          {wd.paymentMethod} ({wd.accountNumber}) • {wd.accountName}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => approveWithdrawal(wd.id, user?.username || 'admin')}
                          className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition cursor-pointer"
                        >
                          ✓ {t('approve')}
                        </button>
                        <button
                          onClick={() => rejectWithdrawal(wd.id, user?.username || 'admin')}
                          className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer"
                        >
                          ✕ {t('reject')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300 italic">{t('noPendingWithdrawals')}</p>
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
                      <span className="text-[10px] text-slate-300 font-mono">ID: {g.id}</span>
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

                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-300 block">{t('entry')}</span>
                      <div className="font-bold text-amber-400">{formatETB(g.entryPrice)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-300 block">{t('prize')}</span>
                      <div className="font-bold text-emerald-400">{formatETB(g.prizePool)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-300 block">{t('players')}</span>
                      <div className="font-bold text-purple-300">{g.currentPlayers} / {g.maxPlayers} {g.minPlayers ? `(min: ${g.minPlayers})` : ''}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => drawNextBall(g.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs hover:bg-amber-500/30 transition flex items-center gap-1 cursor-pointer"
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
          <div className="space-y-6">
            {/* PENDING DEPOSITS REVIEW SECTION */}
            <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>{language === 'am' ? 'የተጠቃሚዎች ገቢ ማረጋገጫ (Pending Deposits)' : 'Deposit Verifications & Approvals'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {language === 'am'
                      ? 'የተጫዋቾች የ CBE/ቴሌብር የክፍያ መለያ ኮድ (Transaction ID) እዚህ ይመልከቱ እና ያረጋግጡ።'
                      : 'Verify player CBE / Telebirr Transaction ID / SMS codes and approve to credit balance.'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {transactions.filter((t) => t.type === 'DEPOSIT' && t.status === 'PENDING').length} {language === 'am' ? 'በመጠባበቅ ላይ' : 'Pending'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-200 border-b border-slate-700 uppercase font-black tracking-wider text-[11px]">
                      <th className="p-2.5">Tx ID</th>
                      <th className="p-2.5">{t('users')}</th>
                      <th className="p-2.5">{t('gateway')}</th>
                      <th className="p-2.5">Transaction ID / Code (FT ቁጥር)</th>
                      <th className="p-2.5">{t('amountETB')}</th>
                      <th className="p-2.5">{t('status')}</th>
                      <th className="p-2.5">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {transactions.filter((t) => t.type === 'DEPOSIT').length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-300 italic">
                          {language === 'am' ? 'ምንም የገቢ ጥያቄ የለም' : 'No deposits recorded yet'}
                        </td>
                      </tr>
                    ) : (
                      transactions
                        .filter((t) => t.type === 'DEPOSIT')
                        .map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-900/40">
                            <td className="p-2.5 font-mono text-[11px] text-slate-300">{tx.id}</td>
                            <td className="p-2.5 font-bold text-slate-100">@{tx.username}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700">
                                {tx.paymentProvider}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono text-xs font-bold text-amber-300 bg-amber-950/20 px-2 py-1 rounded">
                              {tx.reference || '—'}
                            </td>
                            <td className="p-2.5 font-bold text-emerald-400 font-mono">{formatETB(tx.amount)}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tx.status === 'COMPLETED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : tx.status === 'PENDING'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {tx.status === 'PENDING' ? (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => approveDeposit(tx.id, user?.username || 'admin')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-black cursor-pointer shadow-xs transition"
                                  >
                                    ✓ {t('approve')}
                                  </button>
                                  <button
                                    onClick={() => rejectDeposit(tx.id, user?.username || 'admin')}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer transition"
                                  >
                                    ✕ {t('reject')}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">
                                  {tx.status === 'COMPLETED' ? 'Credited' : 'Rejected'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* WITHDRAWALS APPROVAL SECTION */}
            <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-800 space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100">{t('payoutApprovals')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 border-b border-slate-700 uppercase font-black tracking-wider text-[11px]">
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
                      <td className="p-2.5 font-mono text-[11px] text-slate-300">{w.id}</td>
                      <td className="p-2.5 font-bold text-slate-100">@{w.username}</td>
                      <td className="p-2.5 text-slate-200">{w.paymentMethod}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-300">{w.accountNumber}</td>
                      <td className="p-2.5 font-bold text-amber-400 font-mono">{formatETB(w.amount)}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            w.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : w.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-black cursor-pointer shadow-xs transition"
                            >
                              ✓ {t('approve')}
                            </button>
                            <button
                              onClick={() => rejectWithdrawal(w.id, user?.username || 'admin')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer transition"
                            >
                              ✕ {t('reject')}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">{t('completed')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-200 border-b border-slate-700 uppercase font-black tracking-wider text-[11px]">
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
                            <div className="text-[10px] text-slate-300">{u.name}</div>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-200">
                            {u.phone || '—'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-300">
                            {u.telegramId || '—'}
                          </td>
                          <td className="p-2.5 font-bold text-emerald-400 font-mono">
                            {formatETB(u.balance ?? 0)}
                          </td>
                          <td className="p-2.5 font-bold text-amber-400 font-mono">
                            {formatETB(u.bonusBalance ?? 20)}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-purple-300 font-bold">
                            {u.referralCode || '—'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-300">
                            {u.referredBy || u.referred_by || '—'}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-slate-800 text-slate-200 border border-slate-700'
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
          <div className="glass-panel p-4 sm:p-5 rounded-2xl border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-100">{t('auditLogLedger')}</h3>
                <p className="text-[10px] sm:text-xs text-slate-300">Strict legal recording of administrative activities</p>
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
                    <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span className="text-amber-400 font-mono">[{log.adminUsername}]</span>
                      <span>{log.action}</span>
                      <span className="text-slate-300">→ {log.target}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
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
