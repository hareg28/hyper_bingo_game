'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Volume2, VolumeX, Sparkles, Zap, 
  Plus, Star, Hash, Lightbulb, X, Grid, ChevronLeft,
  Undo2, Redo2, Settings, Menu, ShieldAlert, Trophy,
  Trash2, Maximize2, Users, AlertTriangle, Eye, Wallet, CheckCircle2, CreditCard
} from 'lucide-react';
import { 
  formatETB, 
  checkFullHouseWin, 
  checkFourCornersWin,
  countRemainingNumbers,
  playBingoVictoryFanfare,
  WINNING_RULES_PATTERNS,
  HYPER_SPECIAL_RULES,
  HYPER_FETAN_RULES,
  getBestWinningRule,
  WinningRuleMatch,
  checkOneAwayStatus,
  getGameHitRequirement,
  isWeekendSlotCurrentlyLive,
} from '../../lib/bingoUtils';
import confetti from 'canvas-confetti';
import CardNumberSelector from './CardNumberSelector';
import { isAdminTelegramId } from '../../lib/authUtils';
import { getGameLivePrizePool } from '../../lib/store';
import { audioManager } from '../../lib/audioManager';

const amharicNumbers = [
  '', 'አንድ', 'ሁለት', 'ሶስት', 'አራት', 'አምስት', 'ስድስት', 'ሰባት', 'ስምንት', 'ዘጠኝ', 'አሰር',
  'አስራአንድ', 'አስራሁለት', 'አስራሶስት', 'አስራአራት', 'አስራአምስት', 'አስራስድስት', 'አስራሰባት', 'አስራስምንት', 'አስራዘጠኝ', 'ሃያ',
  'ሃያ አንድ', 'ሃያ ሁለት', 'ሃያ ሶስት', 'ሃያ አራት', 'ሃያ አምስት', 'ሃያ ስድስት', 'ሃያ ሰባት', 'ሃያ ስምንት', 'ሃያ ዘጠኝ', 'ሰላሳ',
  'ሰላሳ አንድ', 'ሰላሳ ሁለት', 'ሰላሳ ሶስት', 'ሰላሳ አራት', 'ሰላሳ አምስት', 'ሰላሳ ስድስት', 'ሰላሳ ሰባት', 'ሰላሳ ስምንት', 'ሰላሳ ዘጠኝ', 'አርባ',
  'አርባ አንድ', 'አርባ ሁለት', 'አርባ ሶስት', 'አርባ አራት', 'አርባ አምስት', 'አርባ ስድስት', 'አርባ ሰባት', 'አርባ ስምንት', 'አርባ ዘጠኝ', 'ሃምሳ',
  'ሃምሳ አንድ', 'ሃምሳ ሁለት', 'ሃምሳ ሶስት', 'ሃምሳ አራት', 'ሃምሳ አምስት', 'ሃምሳ ስድስት', 'ሃምሳ ሰባት', 'ሃምሳ ስምንት', 'ሃምሳ ዘጠኝ', 'ስድሳ',
  'ስድሳ አንድ', 'ስድሳ ሁለት', 'ስድሳ ሶስት', 'ስድሳ አራት', 'ስድሳ አምስት', 'ስድሳ ስድስት', 'ስድሳ ሰባት', 'ስድሳ ስምንት', 'ስድሳ ዘጠኝ', 'ሰባ',
  'ሰባ አንድ', 'ሰባ ሁለት', 'ሰባ ሶስት'
];

const getAmharicTens = (n: number): string => {
  if (n <= 70) return amharicNumbers[n] || String(n);
  if (n < 80) return 'ሰባ ' + amharicNumbers[n - 70];
  if (n === 80) return 'ሰማንያ';
  if (n < 90) return 'ሰማንያ ' + amharicNumbers[n - 80];
  if (n === 90) return 'ዘጠና';
  if (n < 100) return 'ዘጠና ' + amharicNumbers[n - 90];
  return String(n);
};

const numberToAmharic = (n: number): string => {
  if (n <= 70) return amharicNumbers[n] || String(n);
  if (n < 100) return getAmharicTens(n);
  if (n === 100) return 'መቶ';
  if (n < 200) return 'መቶ ' + getAmharicTens(n - 100);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hunWord = hundreds <= 70 ? (amharicNumbers[hundreds] || String(hundreds)) : String(hundreds);
  return hunWord + ' መቶ' + (rest > 0 ? ' ' + getAmharicTens(rest) : '');
};

const amharicNumberPhonetic: string[] = [
  '',
  'a-nd', 'hoo-lat', 'so-sat', 'a-rat', 'a-mist', 'si-dist', 'sə-bat', 'sə-mint', 'ze-te-ɲ', 'a-sər',
  'as-ra a-nd', 'as-ra hoo-lat', 'as-ra so-sat', 'as-ra a-rat', 'as-ra a-mist', 'as-ra si-dist', 'as-ra sə-bat', 'as-ra sə-mint', 'as-ra ze-te-ɲ', 'ha-ya',
  'ha-ya a-nd', 'ha-ya hoo-lat', 'ha-ya so-sat', 'ha-ya a-rat', 'ha-ya a-mist', 'ha-ya si-dist', 'ha-ya sə-bat', 'ha-ya sə-mint', 'ha-ya ze-te-ɲ', 'sə-la-sa',
  'sə-la-sa a-nd', 'sə-la-sa hoo-lat', 'sə-la-sa so-sat', 'sə-la-sa a-rat', 'sə-la-sa a-mist', 'sə-la-sa si-dist', 'sə-la-sa sə-bat', 'sə-la-sa sə-mint', 'sə-la-sa ze-te-ɲ', 'ar-ba',
  'ar-ba a-nd', 'ar-ba hoo-lat', 'ar-ba so-sat', 'ar-ba a-rat', 'ar-ba a-mist', 'ar-ba si-dist', 'ar-ba sə-bat', 'ar-ba sə-mint', 'ar-ba ze-te-ɲ', 'ham-sa',
  'ham-sa a-nd', 'ham-sa hoo-lat', 'ham-sa so-sat', 'ham-sa a-rat', 'ham-sa a-mist', 'ham-sa si-dist', 'ham-sa sə-bat', 'ham-sa sə-mint', 'ham-sa ze-te-ɲ', 'sə-də-sa',
  'sə-də-sa a-nd', 'sə-də-sa hoo-lat', 'sə-də-sa so-sat', 'sə-də-sa a-rat', 'sə-də-sa a-mist', 'sə-də-sa si-dist', 'sə-də-sa sə-bat', 'sə-də-sa sə-mint', 'sə-də-sa ze-te-ɲ', 'sə-ba',
  'sə-ba a-nd', 'sə-ba hoo-lat', 'sə-ba so-sat',
];

const getPhoneticTens = (n: number): string => {
  if (n <= 70) return amharicNumberPhonetic[n] || String(n);
  if (n < 80) return 'sə-ba ' + (amharicNumberPhonetic[n - 70] || String(n - 70));
  if (n === 80) return 'sə-ma-nya';
  if (n < 90) return 'sə-ma-nya ' + (amharicNumberPhonetic[n - 80] || String(n - 80));
  if (n === 90) return 'ze-te-na';
  if (n < 100) return 'ze-te-na ' + (amharicNumberPhonetic[n - 90] || String(n - 90));
  return String(n);
};

const numberToPhonetic = (n: number): string => {
  if (n <= 70) return amharicNumberPhonetic[n] || String(n);
  if (n < 100) return getPhoneticTens(n);
  if (n === 100) return 'ma-to';
  if (n < 200) return 'ma-to ' + getPhoneticTens(n - 100);
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hunWord = (amharicNumberPhonetic[hundreds] || String(hundreds));
  return hunWord + ' ma-to ' + (rest > 0 ? getPhoneticTens(rest) : '');
};

const letterPhoneticSpell: Record<string, string> = {
  B: 'Bee',
  I: 'Ee',
  N: 'En',
  G: 'Jee',
  O: 'Oo',
};

const amharicLetterSpell: Record<string, string> = {
  B: 'ቢ',
  I: 'አይ',
  N: 'ኤን',
  G: 'ጂ',
  O: 'ኦ',
};

const AMHARIC_VOICE_NAMES_BY_PLATFORM: string[] = [
  'Microsoft Haregeweyen',
  'Microsoft Haregeweyen - Amharic (Ethiopia)',
  'Microsoft Haregeweyen - Amharic',
  'Microsoft Haregeweyen (Ethiopia)',
  'Microsoft Haregeweyen (am-ET)',
  'Microsoft Amharic',
  'Google አማርኛ',
  'Google Amharic (Ethiopia)',
  'Google Amharic',
  'Google TTS Amharic',
  'Amharic',
  'Amharic (Ethiopia)',
  'Tigist',
  'Tigist (Enhanced)',
  'Samsung Amharic',
  'Huawei Amharic',
  'Amazon Amharic',
  'Polly Amharic',
  'Mamul',
];

const MALE_VOICE_NAME_HINTS: string[] = [
  'Male',
  'Microsoft Daniel', 'Microsoft David', 'Microsoft Mark', 'Microsoft Richard',
  'Mikael', 'Ephrem', 'Getachew', 'Kiros',
];

const ENGLISH_GIRL_VOICE_NAMES: string[] = [
  'Microsoft Aria',
  'Microsoft Aria Neural',
  'Microsoft Jenny',
  'Microsoft Jenny Neural',
  'Microsoft Zira',
  'Microsoft Sonia',
  'Microsoft Sonia Neural',
  'Microsoft Libby',
  'Microsoft Libby Neural',
  'Microsoft Hazel',
  'Microsoft Hazel Neural',
  'Microsoft Susan',
  'Microsoft Susan Neural',
  'Microsoft Catherine',
  'Google UK English Female',
  'Google US English',
  'Samantha',
  'Victoria',
  'Karen',
  'Moira',
  'Tessa',
  'Fiona',
];

interface BingoGameRoomProps {
  gameId: string;
  onBack?: () => void;
  onChangeGameId?: (newGameId: string) => void;
  onOpenLotteryTab?: () => void;
  onOpenWalletTab?: () => void;
}

export default function BingoGameRoom({ gameId, onBack, onChangeGameId, onOpenLotteryTab, onOpenWalletTab }: BingoGameRoomProps) {
  const { 
    games, 
    userCards, 
    daubCell, 
    claimBingo, 
    blockCard,
    resetGameRound,
    drawNextBall, 
    autoDaubEnabled, 
    toggleAutoDaub,
    joinGame,
    addCardToGame,
    removeCard,
    user,
    wallet,
    openAuthModal,
    language,
    t,
    purchaseLotteryNumbers,
    getLotterySoldNumbers,
    addSpecialCards,
    toggleSpecialCardRegistration,
    startSpecialRound,
  } = useBingo();

  // Ref that tracks whether the app is currently hidden (backgrounded).
  // All interval callbacks check this ref first — prevents state-update storms when the
  // user switches away to another app and comes back inside Telegram Mini App.
  const isHiddenRef = React.useRef(typeof document !== 'undefined' && document.hidden);

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [specialToast, setSpecialToast] = useState<string | null>(null);
  // Cached voices + robust preload via onvoiceschanged (fixes empty voice list on first speak)
  const [loadedVoices, setLoadedVoices] = useState<SpeechSynthesisVoice[]>([]);
  // Cached picked voice so we don't re-scan getVoices() on every ball draw (major perf fix)
  const pickedVoiceRef = React.useRef<{ voice: SpeechSynthesisVoice | null; isAmharic: boolean } | null>(null);
  // Runtime voice-quality signal
  const [voiceBanner, setVoiceBanner] = useState<
    null | { kind: 'warning'; titleEn: string; titleAm: string; bodyEn: string; bodyAm: string; }
  >(null);

  // Best-effort client-side detection of running OS — used only to pick the correct Amharic-voice install instructions.
  const detectClientOs = (): 'windows' | 'mac' | 'ios' | 'android' | 'linux' | 'other' => {
    if (typeof navigator === 'undefined') return 'other';
    const p = (navigator.platform || '').toLowerCase();
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/mac/.test(p) || /mac os x/.test(ua)) return 'mac';
    if (/android/.test(ua)) return 'android';
    if (/win/.test(p) || /windows/.test(ua)) return 'windows';
    if (/linux|x11/.test(ua)) return 'linux';
    return 'other';
  };

  const recheckVoiceHealth = React.useCallback(
    (_voices: SpeechSynthesisVoice[]) => {
      const lower = (s: string) => String(s || '').toLowerCase();
      const isAmharic = (v: SpeechSynthesisVoice) => {
        const l = lower(v.lang);
        if (/^(am|amh)/.test(l) || l === 'am-et' || l === 'am_et' || l === 'am') return true;
        const hay = lower(v.name) + ' ' + lower(v.lang);
        if (/(haregeweyen|microsoft amharic|amharic|amhara|ethiop|tigray|tigist|amazon amharic)/.test(hay)) return true;
        return false;
      };
      const amharicVoices = _voices.filter(isAmharic);
      if (amharicVoices.length > 0) { setVoiceBanner(null); return; }

      const os = detectClientOs();
      const byOs: Record<string, { titleEn: string; titleAm: string; bodyEn: string; bodyAm: string }> = {
        windows: {
          titleEn: 'Windows: Amharic (Girl) voice not installed',
          titleAm: 'የ Windows: የአማርኛ (ሴት) ድምፅ አልተገጠመም',
          bodyEn: "This PC doesn't have Microsoft Haregeweyen — open Settings → Time & language → Speech → Manage voices → Add voice → search \"Amharic (Ethiopia)\" → install, then reload this page. Meanwhile we'll use the clearest girl English voice with Amharic phonetics.",
          bodyAm: 'በዚህ ፒሲ ላይ «Microsoft Haregeweyen» የአማርኛ ድምፅ የለም። — ሴቲንግ → ጊዜ እና ቋንቋ → ንግግር → ድምፆችን አስተዳድር → ድምፅ ጨምር → «አማርኛ (ኢትዮጵያ)» ይፈልጉ → ይጫኑ ከዚያ ይህ ገጽ እንደገና ይክፈቱ። በዚህ መካከል በግልጽ የሚሰማ የሴት ኢንግሊዝ ድምፅ በአማርኛ የግል ግላዊነት (phonetics) ይነጋግራል።',
        },
        mac: {
          titleEn: 'macOS: Add Tigist (Enhanced) for Amharic',
          titleAm: 'macOS: ለአማርኛ «Tigist (Enhanced)» ያክሉ',
          bodyEn: "Open System Settings → Accessibility → Spoken Content → System voice → Manage voices → add Amharic → Tigist (Enhanced), then reload this page. Meanwhile we'll use a young-girl English voice with Amharic phonetics.",
          bodyAm: 'System Settings → Accessibility → Spoken Content → System voice → Manage voices → Amharic → Tigist (Enhanced) ይጫኑ ከዚያ ይህ ገጽ ይደምምሩ። በዚህ መካከል የሴት ኢንግሊዝ ድምፅ በአማርኛ phonetics ይነጋግራል።',
        },
        ios: {
          titleEn: 'iPhone/iPad: Turn on Amharic voices',
          titleAm: 'iPhone/iPad: የአማርኛ ድምፆችን ይክፈቱ',
          bodyEn: "Open Settings → Accessibility → Spoken Content → Voices → Amharic → download Tigist, then reload. Meanwhile we'll use a girl English voice with Amharic phonetics.",
          bodyAm: 'Settings → Accessibility → Spoken Content → Voices → Amharic → Tigist ይክፈቱ ከዚያ ይህ ገጽ ይደምምሩ።',
        },
        android: {
          titleEn: 'Android: Install Google TTS Amharic',
          titleAm: 'Android: የ Google TTS አማርኛ ድምፅ ይጫኑ',
          bodyEn: "Open Settings → System → Languages → Text-to-speech → install / select Google Text-to-speech → Languages → Amharic, then reload this page.",
          bodyAm: 'Settings → System → Languages → Text-to-speech → Google TTS ይምረጡ → Languages → አማርኛ ይጫኑ።',
        },
        linux: {
          titleEn: 'Amharic TTS voice not found',
          titleAm: 'የአማርኛ TTS ድምፅ አልተገኘም',
          bodyEn: "Install an am-ET text-to-speech voice (e.g. RHVoice Amharic, eSpeak NG with am data) and reload the page. Meanwhile we'll use a girl English voice with Amharic phonetics.",
          bodyAm: 'የአማርኛ TTS ድምፅ (ለምሳሌ RHVoice Amharic ወይም eSpeak NG + am data) ይጫኑ ከዚያ ይህ ገጽ ይደምምሩ።',
        },
        other: {
          titleEn: 'Amharic voice not available',
          titleAm: 'የአማርኛ ድምፅ ሊገኝ አልቻለም',
          bodyEn: "Your device doesn't expose an Amharic voice. We'll use the clearest English girl voice with Amharic pronunciation written phonetically.",
          bodyAm: 'በመሳሪያዎ ላይ የአማርኛ ድምፅ የለም። በግልጽ የሚሰማ የሴት ኢንግሊዝ ድምፅ በአማርኛ phonetics ይነጋግራል።',
        },
      };
      // Real Amharic audio stream is provided via audioManager without needing OS installations
      setVoiceBanner(null);
    },
    []
  );

  // ─── Central Visibility Manager ──────────────────────────────────────────
  // One listener for the whole component. On hide: stops audio, suspends AudioContext.
  // On show: resumes AudioContext. All setInterval callbacks use isHiddenRef.current.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      const hidden = document.hidden;
      isHiddenRef.current = hidden;
      if (hidden) {
        audioManager.pause(); // stops audio + suspends AudioContext
        // Also cancel any stacked SpeechSynthesis utterances
        try { window.speechSynthesis?.cancel(); } catch {}
      } else {
        audioManager.resume(); // wakes AudioContext back up
      }
    };
    // Sync immediately in case page loads hidden
    isHiddenRef.current = document.hidden;
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Preload SpeechSynthesis voices via onvoiceschanged ASAP & after first sound toggle
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    let cancelled = false;
    const refreshVoices = () => {
      if (cancelled) return;
      try {
        const list = window.speechSynthesis.getVoices();
        const arr: SpeechSynthesisVoice[] = Array.isArray(list) ? list : [];
        if (arr.length > 0) {
          setLoadedVoices(arr);
          recheckVoiceHealth(arr);
        }
      } catch {}
    };
    // Immediate first attempt (some browsers populate before event)
    refreshVoices();
    // Wait for async voice list load (Chrome/Safari/Firefox all fire onvoiceschanged)
    try {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    } catch {}
    return () => {
      cancelled = true;
      try { window.speechSynthesis.onvoiceschanged = null; } catch {}
    };
  }, [recheckVoiceHealth]);
  // Trigger an extra voices refresh the moment user toggles sound ON (some browsers lazy-load until a user gesture)
  useEffect(() => {
    if (!soundEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const v = window.speechSynthesis.getVoices();
      const arr: SpeechSynthesisVoice[] = Array.isArray(v) ? v : [];
      if (arr.length > 0) {
        setLoadedVoices(arr);
        recheckVoiceHealth(arr);
      }
      window.speechSynthesis.cancel();
    } catch {}
  }, [soundEnabled, recheckVoiceHealth]);
  const currentGame = games.find((g) => g.id === gameId) || games[0];
  const activeGameCards = userCards.filter((c) => c.gameId === currentGame.id);
  const initialCardNumbers = React.useMemo(
    () => activeGameCards.map((c) => c.cardNumber),
    [activeGameCards.map((c) => c.cardNumber).join(',')]
  );
  const isWeekendGame = currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.category === 'HYPER_WEEKEND' || currentGame.isWeekendSpecial;
  const weekendGames = games.filter((g) => g.gameType === 'WEEKEND_LOTTERY' || g.category === 'HYPER_WEEKEND' || g.isWeekendSpecial);

  // Plain function — NOT a hook — so it can be called inside useState initializer
  const computeIsWeekendLive = (game: typeof currentGame) => {
    return isWeekendSlotCurrentlyLive(game);
  };

  const isWeekendLive = computeIsWeekendLive(currentGame);

  // Outside scheduled live draw times, weekend games remain in scheduled/open entry mode without auto-drawing
  const [isAutoDrawing, setIsAutoDrawing] = useState(() => {
    if (isWeekendGame) return computeIsWeekendLive(currentGame);
    const isSpecial = currentGame.category === 'HYPER_SPECIAL' || currentGame.gameType === 'HYPER_SPECIAL';
    if (isSpecial) {
      if (currentGame.status === 'RUNNING' || currentGame.drawnNumbers.length > 0) return true;
      if (currentGame.nextRoundStartsAt && Date.now() < currentGame.nextRoundStartsAt) return false;
      if (currentGame.drawnNumbers.length === 0 && (!currentGame.winners || currentGame.winners.length === 0)) return false;
    }
    return true;
  });
  const [claimStatus, setClaimStatus] = useState<{ success?: boolean; message?: string; prize?: number } | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [expandCardModal, setExpandCardModal] = useState(false);
  const [hintCardId, setHintCardId] = useState<string | null>(null);
  const [patternHint, setPatternHint] = useState<boolean[][] | null>(null);
  const [gameHitFeedback, setGameHitFeedback] = useState<string | null>(null);
  const [showMoreNumbers, setShowMoreNumbers] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showPatternHintModal, setShowPatternHintModal] = useState(false);
  const [showGameInfo, setShowGameInfo] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<{ id: string; cardNumber: string } | null>(null);


  // Active card (kept for handlers, but UI now shows ALL cards)
  const activeUserCard = 
    activeGameCards.find((c) => c.id === selectedCardId) || 
    activeGameCards[0] || 
    userCards[0];

  const isUserAdmin = Boolean(
    user && (user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  // Live clock for header — skip update when page is hidden to save CPU
  useEffect(() => {
    const updateTime = () => {
      if (isHiddenRef.current) return;
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Audio buzzer for false bingo / blocked attempts
  const playErrorBuzzer = () => {
    if (!soundEnabled) return;
    audioManager.playErrorBuzzer();
  };

  const fallbackSpeechAnnounce = (num: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const letter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
    const amLetter = amharicLetterSpell[letter] || letter;
    const amWord = numberToAmharic(num);
    const phLetter = letterPhoneticSpell[letter] || letter;
    const phWord = numberToPhonetic(num);

    // Cancel any stale utterance
    try { window.speechSynthesis.cancel(); } catch {}

    // Use cached voices (avoids expensive getVoices() on every ball draw = mobile perf fix)
    let voices: SpeechSynthesisVoice[] = loadedVoices;
    if (voices.length === 0) {
      try {
        const fresh = window.speechSynthesis.getVoices() || [];
        voices = Array.isArray(fresh) ? fresh : [];
        if (voices.length > 0) setLoadedVoices(voices);
      } catch { voices = []; }
    }

    const lower = (s: string) => String(s || '').toLowerCase();

    // Helper: exact (case-insensitive) prefix/substring check on a voice name
    const nameMatchesAny = (v: SpeechSynthesisVoice, needles: string[]) =>
      needles.some(n => lower(v.name).includes(lower(n)));

    const isMaleBlocked = (v: SpeechSynthesisVoice) =>
      MALE_VOICE_NAME_HINTS.some(m => lower(v.name).includes(lower(m)));

    const isAmharicLang = (v: SpeechSynthesisVoice) => {
      const l = lower(v.lang);
      return /^(am|amh)/.test(l) || l === 'am-et' || l === 'am_et' || l === 'am';
    };

    const hasAnyAmharicVoice = voices.some(v => isAmharicLang(v) || nameMatchesAny(v, AMHARIC_VOICE_NAMES_BY_PLATFORM));

    let picked: SpeechSynthesisVoice | null = null;
    let pickedAmharic = false;

    if (hasAnyAmharicVoice) {
      picked = voices.find(v => (isAmharicLang(v) || nameMatchesAny(v, AMHARIC_VOICE_NAMES_BY_PLATFORM)) && !isMaleBlocked(v)) || null;
      pickedAmharic = Boolean(picked);
    }

    if (!picked) {
      picked = voices.find(v =>
        nameMatchesAny(v, ENGLISH_GIRL_VOICE_NAMES) &&
        !isMaleBlocked(v) &&
        /^en|en-us|en-gb/.test(lower(v.lang))
      ) || voices.find(v => /^en/.test(lower(v.lang)) && !isMaleBlocked(v))
        || voices.find(v => !isMaleBlocked(v))
        || voices[0]
        || null;
      pickedAmharic = false;
    }

    const textToSpeak = pickedAmharic
      ? `${amLetter} ... ${amWord}`
      : `${phLetter} ... ${phWord}`;

    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.rate = 1.15;
    utter.pitch = 2.0;
    utter.volume = 1.0;

    const reapplyTune = () => {
      try { utter.rate = 1.15; } catch {}
      try { utter.pitch = 2.0; } catch {}
      try { utter.volume = 1.0; } catch {}
      try { if (picked) utter.voice = picked; } catch {}
      try {
        if (pickedAmharic) utter.lang = 'am-ET';
        else utter.lang = /^en/.test(lower(picked?.lang || '')) ? (picked?.lang || 'en-US') : 'en-US';
      } catch {}
    };
    try { utter.onstart    = reapplyTune; } catch {}
    try { utter.onboundary = reapplyTune; } catch {}
    setTimeout(reapplyTune, 0);

    setTimeout(() => {
      try {
        const finalV = window.speechSynthesis.getVoices() || [];
        const finalArr: SpeechSynthesisVoice[] = Array.isArray(finalV) ? finalV : [];
        if (finalArr.length > 0 && (!picked || !finalArr.includes(picked))) {
          const freshIsAmharic = finalArr.some(v => isAmharicLang(v) || nameMatchesAny(v, AMHARIC_VOICE_NAMES_BY_PLATFORM));
          if (freshIsAmharic) {
            const fresh = finalArr.find(v => (isAmharicLang(v) || nameMatchesAny(v, AMHARIC_VOICE_NAMES_BY_PLATFORM)) && !isMaleBlocked(v));
            if (fresh) { picked = fresh; pickedAmharic = true; }
          } else {
            const fresh = finalArr.find(v =>
              nameMatchesAny(v, ENGLISH_GIRL_VOICE_NAMES) &&
              !isMaleBlocked(v) &&
              /^en|en-us|en-gb/.test(lower(v.lang))
            ) || finalArr.find(v => /^en/.test(lower(v.lang)) && !isMaleBlocked(v))
              || finalArr.find(v => !isMaleBlocked(v)) || finalArr[0];
            if (fresh) { picked = fresh; pickedAmharic = false; }
          }
        }
        if (picked) { try { utter.voice = picked; } catch {} }
      } catch {}
      reapplyTune();
      try { window.speechSynthesis.speak(utter); } catch {}
    }, 25);
  };

  const announceBall = React.useCallback((num: number) => {
    if (!soundEnabled) return;
    audioManager.playCall(num, () => {
      fallbackSpeechAnnounce(num);
    });
  }, [soundEnabled, loadedVoices]);

  const announceBallRef = React.useRef(announceBall);
  useEffect(() => {
    announceBallRef.current = announceBall;
  }, [announceBall]);

  // Live Countdown Timer
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const ballsLeft = Math.max(0, 75 - (currentGame?.drawnNumbers?.length || 0));
    return ballsLeft * (currentGame?.drawInterval || 3);
  });

  useEffect(() => {
    const ballsLeft = Math.max(0, 75 - (currentGame?.drawnNumbers?.length || 0));
    setSecondsRemaining(ballsLeft * (currentGame?.drawInterval || 3));
  }, [currentGame?.drawnNumbers?.length, currentGame?.drawInterval]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isHiddenRef.current) return;
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hyper Fetan 1-minute round + 30-second card pick period live loop
  // RULE: If within 1 minute there is NO winner, game MUST continue drawing balls until a winner arrives!
  const [fetanSecondsLeft, setFetanSecondsLeft] = useState<number>(60);
  const [fetanIsIntermission, setFetanIsIntermission] = useState<boolean>(false);
  const [fetanOvertime, setFetanOvertime] = useState<boolean>(false);

  const isFetanGame = currentGame.category === 'HYPER_FETAN' || currentGame.name?.includes('Fetan') || currentGame.winningRule === 'ONE_LINE_OR_CORNERS';
  const isSpecialGame = currentGame.category === 'HYPER_SPECIAL' || currentGame.gameType === 'HYPER_SPECIAL';
  // Keep a ref to nextRoundStartsAt so the interval tick always has the latest server value
  const nextRoundStartsAtRef = React.useRef<number | undefined>(currentGame.nextRoundStartsAt);
  useEffect(() => {
    nextRoundStartsAtRef.current = currentGame.nextRoundStartsAt;
  }, [currentGame.nextRoundStartsAt]);

  const [specialSecondsLeft, setSpecialSecondsLeft] = useState<number>(() => {
    if (isSpecialGame && currentGame.nextRoundStartsAt && Date.now() < currentGame.nextRoundStartsAt) {
      return Math.max(0, Math.ceil((currentGame.nextRoundStartsAt - Date.now()) / 1000));
    }
    return 300;
  });
  const [specialIsIntermission, setSpecialIsIntermission] = useState<boolean>(() => {
    if (!isSpecialGame) return false;
    if (currentGame.status === 'RUNNING' || currentGame.drawnNumbers.length > 0) return false;
    if (currentGame.nextRoundStartsAt && Date.now() < currentGame.nextRoundStartsAt) return true;
    // If status is OPEN with no drawn numbers and no nextRoundStartsAt yet, start intermission
    if (currentGame.status === 'OPEN' && currentGame.drawnNumbers.length === 0 && (!currentGame.winners || currentGame.winners.length === 0)) return true;
    return false;
  });
  const hasGameWinner = Boolean((currentGame.winners && currentGame.winners.length > 0) || currentGame.status === 'COMPLETED');

  // Sync specialIsIntermission whenever the server's nextRoundStartsAt or game status changes
  useEffect(() => {
    if (!isSpecialGame) return;
    if (currentGame.status === 'RUNNING' || currentGame.drawnNumbers.length > 0) {
      setSpecialIsIntermission(false);
      return;
    }
    if (currentGame.nextRoundStartsAt) {
      const remaining = Math.max(0, Math.ceil((currentGame.nextRoundStartsAt - Date.now()) / 1000));
      if (remaining > 0) {
        // Server has a valid intermission window — sync the countdown to server time
        setSpecialSecondsLeft(remaining);
        setSpecialIsIntermission(true);
        setIsAutoDrawing(false);
      } else {
        // nextRoundStartsAt is in the past — intermission should have ended already
        setSpecialIsIntermission(false);
      }
    }
  }, [isSpecialGame, currentGame.nextRoundStartsAt, currentGame.status, currentGame.drawnNumbers.length]);

  // Unified 10-second winner announcement countdown for ALL games (redirects to card buy board or 5-min special gap)
  const [announcementSecondsLeft, setAnnouncementSecondsLeft] = useState<number>(10);

  useEffect(() => {
    if (!hasGameWinner) return;

    setAnnouncementSecondsLeft(10);
    setIsAutoDrawing(false);

    const timer = setInterval(() => {
      if (isHiddenRef.current) return;
      setAnnouncementSecondsLeft((prev) => {
        if (prev <= 1) {
          // Exactly 10 seconds finished! Redirect to card buy board
          clearInterval(timer);
          setShowWinnerModal(false);
          resetGameRound(currentGame.id);
          if (isSpecialGame) {
            // For Hyper Special: enter 5-minute intermission between rounds.
            // The actual countdown is driven by the server's nextRoundStartsAt (set during reset).
            // We enter intermission mode here; the server poll + sync effect will set the real seconds.
            setSpecialIsIntermission(true);
            setIsAutoDrawing(false);
            // Set a provisional 300s — the server sync will correct it within ~3s
            setSpecialSecondsLeft(300);
          } else if (onOpenLotteryTab) {
            onOpenLotteryTab();
          } else {
            setIsSelectorOpen(true);
          }
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasGameWinner, currentGame.id, resetGameRound, onOpenLotteryTab, isSpecialGame]);

  // Auto-show winner announcement celebration modal to EVERYONE when a winner claims Bingo!
  const prevWinnersCountRef = React.useRef(currentGame.winners?.length || 0);
  useEffect(() => {
    const count = currentGame.winners?.length || 0;
    if (count > 0 && count !== prevWinnersCountRef.current) {
      setShowWinnerModal(true);
    }
    prevWinnersCountRef.current = count;
  }, [currentGame.winners?.length]);

  useEffect(() => {
    if (!isSpecialGame || !specialIsIntermission) return;

    const timer = setInterval(() => {
      if (isHiddenRef.current) return;

      // Always derive remaining time from server's nextRoundStartsAt so all clients stay in sync.
      // This means a player who joins 3 min into the intermission sees exactly 2 min left.
      const serverDeadline = nextRoundStartsAtRef.current;
      if (!serverDeadline) return;
      const remaining = serverDeadline
        ? Math.max(0, Math.ceil((serverDeadline - Date.now()) / 1000))
        : 0;

      setSpecialSecondsLeft(remaining);

      if (remaining <= 0) {
        // Intermission finished — start the live round!
        clearInterval(timer);
        setSpecialIsIntermission(false);
        setIsSelectorOpen(false);
        setIsAutoDrawing(true);
        startSpecialRound(currentGame.id);
        // Draw first ball immediately to kick off the live game
        setTimeout(() => {
          const first = drawNextBall(currentGame.id);
          if (first) announceBallRef.current(first);
        }, 350);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSpecialGame, specialIsIntermission, currentGame.id, startSpecialRound, drawNextBall]);

  // Fetan 1-second countdown ticker
  useEffect(() => {
    if (!isFetanGame) return;

    const timer = setInterval(() => {
      // Skip update when app is backgrounded (prevents stacking on mobile)
      if (isHiddenRef.current) return;
      if (fetanIsIntermission) {
        // Intermission countdown: card picking
        setFetanSecondsLeft((prev) => {
          if (prev <= 1) {
            // Intermission ended -> start next round fresh! Redirect to live game
            resetGameRound(currentGame.id);
            setFetanIsIntermission(false);
            setFetanOvertime(false);
            setIsSelectorOpen(false);
            setIsAutoDrawing(true);
            return 60;
          }
          return prev - 1;
        });
      } else {
        // Active round countdown
        setFetanSecondsLeft((prev) => {
          if (prev > 0) {
            return prev - 1;
          }
          // Reached 0 seconds! BUT NO WINNER YET:
          // Keep drawing until the winner comes!
          setFetanOvertime(true);
          return 0;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isFetanGame, fetanIsIntermission, currentGame.id, resetGameRound]);

  // drawnSet must be defined before the topHitRequirement useMemo that references it
  const drawnSet = new Set(currentGame.drawnNumbers || []);
  const cardDrawnSet = drawnSet;

  // Dynamic Hit Requirement calculation for active cards
  const topHitRequirement = React.useMemo(() => {
    const isAm = language === 'am';
    if (activeGameCards.length === 0) {
      if (currentGame.winningRule === 'ONE_LINE_OR_CORNERS' || currentGame.category === 'HYPER_FETAN') {
        return {
          isHit: false,
          hitTitle: isAm ? '🎯 የሚያስፈልገው: 1 አግድም፣ 1 ቀጥታ (Vertical)፣ 1 ዲያጎናል ወይም 4 ማዕዘናት' : '🎯 Win Condition: 1 Horizontal, 1 Vertical, 1 Diagonal, or 4 Corners',
          hitDetail: isAm 
            ? 'ለመጫወት ካርታ ይምረጡ (ከ1-500 እስከ 5 ካርዶች)። ለማሸነፍ ማንኛውም 1 መስመር (አግድም፣ ቀጥታ፣ ዲያጎናል) ወይም አራቱ ማዕዘናት ያስፈልጋል።' 
            : 'Pick cards (1–500, up to 5 slots) to enter. Complete any 1 line (Row, Col, Diagonal) or 4 Corners to win!',
          progressText: isAm ? '5 ክፍተቶች' : '5 Slots',
          neededNumber: null,
        };
      }
      if (currentGame.winningRule === 'FULL_HOUSE_ONLY' || currentGame.category === 'HYPER_WEEKEND') {
        return {
          isHit: false,
          hitTitle: isAm ? '🏆 የሚያስፈልገው: ሙሉ ቤት ብቻ (Full House Only)' : '🏆 Win Condition: Full House Only',
          hitDetail: isAm 
            ? 'ለመጫወት ካርታ ይምረጡ። በካርዱ ላይ ያሉትን ሁሉንም 24 ቁጥሮች ምልክት በማድረግ ሜጋ ጃክፖት ያሸንፉ!' 
            : 'Pick cards to enter. Every cell on the card must be marked to claim Full House jackpot!',
          progressText: isAm ? 'ሙሉ ቤት' : 'Full House',
          neededNumber: null,
        };
      }
      const activeRule = HYPER_SPECIAL_RULES[Math.abs(currentGame.activeSpecialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
      return {
        isHit: false,
        hitTitle: isAm ? `🎲 የዚህ ዙር ሕግ: ${activeRule.nameAm}` : `🎲 Round Law: ${activeRule.nameEn}`,
        hitDetail: isAm ? activeRule.descAm : activeRule.descEn,
        progressText: isAm ? 'ንቁ ሕግ' : 'Active Law',
        neededNumber: null,
      };
    }

    // Check if any active card has a 1-away hit
    const isFetan = currentGame.category === 'HYPER_FETAN' || currentGame.name?.includes('Fetan') || currentGame.id.includes('fetan') || isFetanGame;
    const isWeekend = !!currentGame.isWeekendSpecial || currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.category === 'HYPER_WEEKEND' || isWeekendGame;
    const effectiveRuleType = isFetan
      ? 'ONE_LINE_OR_CORNERS'
      : isWeekend
      ? 'FULL_HOUSE_ONLY'
      : currentGame.winningRule;

    for (const card of activeGameCards) {
      const cardEffectiveMarked = (card.numbers || []).map((row, rIdx) =>
        (row || []).map((val, cIdx) => (rIdx === 2 && cIdx === 2) || Boolean(card.marked?.[rIdx]?.[cIdx]) || cardDrawnSet.has(val))
      );
      const hit = getGameHitRequirement(cardEffectiveMarked, card.numbers || [], effectiveRuleType, language, currentGame.activeSpecialRuleIndex);
      if (hit.isHit) {
        return {
          ...hit,
          hitDetail: `[Card #${card.cardNumber}] ${hit.hitDetail}`,
        };
      }
    }

    // Otherwise return best general requirement with progress
    if (activeGameCards.length > 0) {
      const firstCard = activeGameCards[0];
      const firstCardEffectiveMarked = (firstCard.numbers || []).map((row, rIdx) =>
        (row || []).map((val, cIdx) => (rIdx === 2 && cIdx === 2) || Boolean(firstCard.marked?.[rIdx]?.[cIdx]) || cardDrawnSet.has(val))
      );
      return getGameHitRequirement(firstCardEffectiveMarked, firstCard.numbers || [], effectiveRuleType, language, currentGame.activeSpecialRuleIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameCards, currentGame.winningRule, currentGame.activeSpecialRuleIndex, currentGame.category, language, currentGame.drawnNumbers]);

  const formatTimeRemaining = (totalSec: number): string => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Auto Draw interval timer simulation — calls balls automatically without requiring player action
  // Pauses when the page/app is hidden (backgrounded) to prevent phone freezing/stacking
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    const isSpecialIntermissionNow = isSpecialGame && (
      specialIsIntermission || (currentGame?.status !== 'RUNNING' && currentGame?.nextRoundStartsAt ? Date.now() < currentGame.nextRoundStartsAt : false)
    );

    const canAutoDraw = isAutoDrawing && 
      currentGame && 
      currentGame.status !== 'COMPLETED' && 
      (!currentGame.winners || currentGame.winners.length === 0) &&
      currentGame.drawnNumbers.length < 75 && 
      !fetanIsIntermission &&
      !isSpecialIntermissionNow &&
      (!isWeekendGame || isWeekendLive);

    if (canAutoDraw) {
      interval = setInterval(() => {
        // Skip tick if app is backgrounded — prevents stacking/freezing on mobile
        if (isHiddenRef.current) return;
        const next = drawNextBall(currentGame.id);
        if (next) {
          announceBall(next);
        }
      }, Math.max(2500, (currentGame.drawInterval || 3) * 1000));
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  // Use stable primitives (id, status, drawnNumbers.length) instead of the whole currentGame
  // object so the interval is NOT recreated on every single ball draw — major perf fix.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoDrawing, currentGame?.id, currentGame?.status, currentGame?.drawnNumbers?.length, drawNextBall, soundEnabled, fetanIsIntermission, specialIsIntermission, isSpecialGame, isWeekendGame, isWeekendLive]);

  // Automatically trigger Winner Celebration Modal when game ends or a winner is registered
  useEffect(() => {
    if (currentGame && ((currentGame.winners && currentGame.winners.length > 0) || currentGame.status === 'COMPLETED')) {
      setShowWinnerModal(true);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch {}
    }
  }, [currentGame?.winners?.length, currentGame?.status]);

  const handleManualDraw = () => {
    if (!currentGame || currentGame.drawnNumbers.length >= 75 || currentGame.status === 'COMPLETED') return;
    const next = drawNextBall(currentGame.id);
    if (next) {
      announceBall(next);
    }
  };

  // Auto-dismiss claim alerts after 4 seconds
  useEffect(() => {
    if (claimStatus) {
      const timer = setTimeout(() => {
        setClaimStatus(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [claimStatus]);

  // Helper to determine ball letter column
  const getBallLetter = (num: number): string => {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
  };

  const getLetterColor = (letter: string): string => {
    switch (letter) {
      case 'B': return 'from-blue-600 to-blue-500 text-white';
      case 'I': return 'from-red-600 to-red-500 text-white';
      case 'N': return 'from-amber-400 to-amber-500 text-slate-950';
      case 'G': return 'from-emerald-600 to-emerald-500 text-white';
      case 'O': return 'from-purple-600 to-purple-500 text-white';
      default: return 'from-slate-700 to-slate-600 text-white';
    }
  };

  // Pattern Hint Logic - tailored to each game type's exact winning rules
  const computePatternHint = (card: typeof activeGameCards[0]): boolean[][] => {
    const hint = Array.from({ length: 5 }, () => Array(5).fill(false));
    if (!card) return hint;

    // 1. HYPER WEEKEND: Full House Only (all unmarked numbers needed)
    if (currentGame.winningRule === 'FULL_HOUSE_ONLY' || currentGame.category === 'HYPER_WEEKEND') {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!card.marked[r][c]) {
            hint[r][c] = true;
          }
        }
      }
      return hint;
    }

    // 2. HYPER SPECIAL: 15 Official Laws (one law per game round until finished)
    if (currentGame.category === 'HYPER_SPECIAL' || currentGame.activeSpecialRuleIndex !== undefined) {
      const ruleIdx = Math.abs(currentGame.activeSpecialRuleIndex || 0) % HYPER_SPECIAL_RULES.length;
      const activeRule = HYPER_SPECIAL_RULES[ruleIdx];

      // Dynamic 2 lines (Rule 0 or Rule 4)
      if (ruleIdx === 0 || ruleIdx === 4) {
        let bestScore = -1;
        let bestPair: [number, number][] = [];
        let isRows = true;

        for (let r1 = 0; r1 < 5; r1++) {
          for (let r2 = r1 + 1; r2 < 5; r2++) {
            const mCount = [0, 1, 2, 3, 4].filter(c => card.marked[r1][c]).length + [0, 1, 2, 3, 4].filter(c => card.marked[r2][c]).length;
            if (mCount > bestScore) {
              bestScore = mCount;
              bestPair = [[r1, 0], [r2, 0]];
              isRows = true;
            }
          }
        }
        for (let c1 = 0; c1 < 5; c1++) {
          for (let c2 = c1 + 1; c2 < 5; c2++) {
            const mCount = [0, 1, 2, 3, 4].filter(r => card.marked[r][c1]).length + [0, 1, 2, 3, 4].filter(r => card.marked[r][c2]).length;
            if (mCount > bestScore) {
              bestScore = mCount;
              bestPair = [[0, c1], [0, c2]];
              isRows = false;
            }
          }
        }

        if (isRows && bestPair.length >= 2) {
          const r1 = bestPair[0][0];
          const r2 = bestPair[1][0];
          for (let c = 0; c < 5; c++) {
            if (!card.marked[r1][c]) hint[r1][c] = true;
            if (!card.marked[r2][c]) hint[r2][c] = true;
          }
        } else if (bestPair.length >= 2) {
          const c1 = bestPair[0][1];
          const c2 = bestPair[1][1];
          for (let r = 0; r < 5; r++) {
            if (!card.marked[r][c1]) hint[r][c1] = true;
            if (!card.marked[r][c2]) hint[r][c2] = true;
          }
        }
        return hint;
      }

      // Dynamic 3 lines (Rule 1)
      if (ruleIdx === 1) {
        const rowScores = [0, 1, 2, 3, 4].map(r => ({ r, score: [0, 1, 2, 3, 4].filter(c => card.marked[r][c]).length })).sort((a, b) => b.score - a.score);
        const colScores = [0, 1, 2, 3, 4].map(c => ({ c, score: [0, 1, 2, 3, 4].filter(r => card.marked[r][c]).length })).sort((a, b) => b.score - a.score);
        const top3RowsScore = rowScores[0].score + rowScores[1].score + rowScores[2].score;
        const top3ColsScore = colScores[0].score + colScores[1].score + colScores[2].score;

        if (top3RowsScore >= top3ColsScore) {
          for (let i = 0; i < 3; i++) {
            const r = rowScores[i].r;
            for (let c = 0; c < 5; c++) {
              if (!card.marked[r][c]) hint[r][c] = true;
            }
          }
        } else {
          for (let i = 0; i < 3; i++) {
            const c = colScores[i].c;
            for (let r = 0; r < 5; r++) {
              if (!card.marked[r][c]) hint[r][c] = true;
            }
          }
        }
        return hint;
      }

      // Pattern-based rules (Letter X, 4 Corners, Full House, Letter L, Box, Frame, Plus, Stamps, Pyramid, etc.)
      if (activeRule && activeRule.pattern) {
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (activeRule.pattern[r][c] && !card.marked[r][c]) {
              hint[r][c] = true;
            }
          }
        }
        return hint;
      }
    }

    // 3. HYPER FETAN (ONE_LINE_OR_CORNERS):
    // Closest win among: 4 Corners, 5 Rows, 5 Columns, 2 Diagonals
    let bestScore = -1;
    let bestCells: [number, number][] = [];

    // 4 Corners
    const corners: [number, number][] = [[0, 0], [0, 4], [4, 0], [4, 4]];
    const markedCorners = corners.filter(([rr, cc]) => card.marked[rr][cc]).length;
    if (markedCorners < 4 && markedCorners > bestScore) {
      bestScore = markedCorners;
      bestCells = corners.filter(([rr, cc]) => !card.marked[rr][cc]);
    }

    // Rows
    for (let r = 0; r < 5; r++) {
      const cells: [number, number][] = Array.from({ length: 5 }, (_, c) => [r, c]);
      const marked = cells.filter(([rr, cc]) => card.marked[rr][cc]).length;
      if (marked < 5 && marked > bestScore) {
        bestScore = marked;
        bestCells = cells.filter(([rr, cc]) => !card.marked[rr][cc]);
      }
    }
    // Cols
    for (let c = 0; c < 5; c++) {
      const cells: [number, number][] = Array.from({ length: 5 }, (_, r) => [r, c]);
      const marked = cells.filter(([rr, cc]) => card.marked[rr][cc]).length;
      if (marked < 5 && marked > bestScore) {
        bestScore = marked;
        bestCells = cells.filter(([rr, cc]) => !card.marked[rr][cc]);
      }
    }
    // Diag TL-BR
    {
      const cells: [number, number][] = Array.from({ length: 5 }, (_, i) => [i, i]);
      const marked = cells.filter(([rr, cc]) => card.marked[rr][cc]).length;
      if (marked < 5 && marked > bestScore) {
        bestScore = marked;
        bestCells = cells.filter(([rr, cc]) => !card.marked[rr][cc]);
      }
    }
    // Diag TR-BL
    {
      const cells: [number, number][] = Array.from({ length: 5 }, (_, i) => [i, 4 - i]);
      const marked = cells.filter(([rr, cc]) => card.marked[rr][cc]).length;
      if (marked < 5 && marked > bestScore) {
        bestScore = marked;
        bestCells = cells.filter(([rr, cc]) => !card.marked[rr][cc]);
      }
    }
    bestCells.forEach(([rr, cc]) => { hint[rr][cc] = true; });
    return hint;
  };

  // 💡 LIGHT SYMBOL GAME HIT / PATTERN HINTS
  const handleLightGameHit = (targetCard?: typeof activeGameCards[0]) => {
    setShowPatternHintModal(true);
    const card = targetCard || activeUserCard || activeGameCards[0];
    if (!card) {
      return;
    }

    const drawnSet = new Set(currentGame.drawnNumbers);
    let hitCount = 0;
    let hitNumbers: number[] = [];

    // Daub all drawn numbers on this card that player hasn't marked yet
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) continue; // Free center
        const val = card.numbers[r][c];
        if (drawnSet.has(val) && !card.marked[r][c]) {
          daubCell(card.id, r, c);
          hitCount++;
          hitNumbers.push(val);
        }
      }
    }

    setHintCardId(card.id);
    const hint = computePatternHint(card);
    setPatternHint(hint);

    if (hitCount > 0) {
      playBingoVictoryFanfare();
      setGameHitFeedback(
        language === 'am'
          ? `💡 ፍንጭ! ${hitNumbers.length} የወጡ ቁጥሮች በካርድ #${card.cardNumber} ተሞሉ!`
          : `💡 HIT! ${hitNumbers.length} number${hitNumbers.length > 1 ? 's' : ''} daubed on #${card.cardNumber}!`
      );
    } else {
      const remaining = countRemainingNumbers(card.marked);
      setGameHitFeedback(
        language === 'am'
          ? `💡 የወጡ ኳሶች ተሞልተዋል። ${remaining} ቁጥሮች ቀርተዋል!`
          : `💡 All marked! Only ${remaining} to BINGO on #${card.cardNumber}!`
      );
    }

    setTimeout(() => {
      setGameHitFeedback(null);
    }, 3500);
  };

  // Claim Bingo
  const handleClaimBingo = (cardId?: string) => {
    if (activeGameCards.length === 0) {
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? 'እባክዎ መጀመሪያ የቢንጎ ካርድ ይምረጡ!'
          : 'Please pick a bingo card first to play!'
      });
      return;
    }

    const targetCardId = cardId || activeUserCard?.id || activeGameCards[0]?.id;
    const targetCard = activeGameCards.find(c => c.id === targetCardId) || activeGameCards[0];

    if (!targetCard) return;

    // Check if card is already blocked
    if (currentGame.blockedCards?.includes(targetCard.cardNumber)) {
      playErrorBuzzer();
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? `🚫 ካርድ #${targetCard.cardNumber} በዚህ ዙር ታግዷል!`
          : `🚫 Card #${targetCard.cardNumber} is disqualified and blocked in this game!`
      });
      return;
    }

    // Check pattern completeness according to game's winning rule:
    // Fetan: 1 Horizontal, 1 Vertical, 1 Diagonal, 4 Corners | Weekend: Full House Only | Special: Active Rule
    const isFetan = currentGame.category === 'HYPER_FETAN' || currentGame.name?.includes('Fetan') || currentGame.id.includes('fetan') || isFetanGame;
    const isWeekend = !!currentGame.isWeekendSpecial || currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.category === 'HYPER_WEEKEND' || isWeekendGame;
    const effectiveRuleType = isFetan
      ? 'ONE_LINE_OR_CORNERS'
      : isWeekend
      ? 'FULL_HOUSE_ONLY'
      : currentGame.winningRule;

    const gameDrawnSet = new Set(currentGame.drawnNumbers);
    const effectiveMarked = targetCard.numbers.map((row, rIdx) =>
      row.map((val, cIdx) => (rIdx === 2 && cIdx === 2) || targetCard.marked[rIdx][cIdx] || gameDrawnSet.has(val))
    );

    const bestRule: WinningRuleMatch | null = getBestWinningRule(effectiveMarked, effectiveRuleType, currentGame.activeSpecialRuleIndex);

    if (!bestRule) {
      // FALSE BINGO -> BLOCK THE PLAYER & CARD
      playErrorBuzzer();
      const rem = countRemainingNumbers(effectiveMarked);
      claimBingo(targetCard.id); // This adds card to blockedCards in context
      const isAm = language === 'am';
      const ruleName = effectiveRuleType === 'ONE_LINE_OR_CORNERS'
        ? (isAm ? '1 አግድም፣ 1 ቀጥታ (Vertical)፣ 1 ዲያጎናል ወይም 4 ማዕዘናት' : '1 Horizontal, 1 Vertical, 1 Diagonal, or 4 Corners')
        : effectiveRuleType === 'FULL_HOUSE_ONLY'
        ? (isAm ? 'ሙሉ ቤት (Full House Only)' : 'Full House Only')
        : (() => {
            const activeRule = HYPER_SPECIAL_RULES[Math.abs(currentGame.activeSpecialRuleIndex || 0) % HYPER_SPECIAL_RULES.length];
            return isAm ? activeRule.nameAm : activeRule.nameEn;
          })();

      setClaimStatus({
        success: false,
        message: language === 'am'
          ? `🚫 ታግደዋል! ካርድ #${targetCard.cardNumber} ያለ ${ruleName} ቢንጎ ስላሉ ታግደዋል። (${rem} ቁጥሮች ቀርተዋል)`
          : `🚫 BLOCKED! Card #${targetCard.cardNumber} disqualified for false claim without ${ruleName} (${rem} numbers left).`
      });
      return;
    }

    // VALID BINGO WIN! (1 Line / 2 Lines / Letter X / Full House)
    if (soundEnabled) {
      playBingoVictoryFanfare();
    }
    const result = claimBingo(targetCard.id);
    setClaimStatus(result);

    if (result.success) {
      confetti({
        particleCount: 220,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#2563eb', '#dc2626', '#f59e0b', '#16a34a', '#9333ea'],
      });
      setShowWinnerModal(true);
    }
  };

  const isFullHouseWin = activeUserCard ? checkFullHouseWin(activeUserCard.marked) : false;

  const handleConfirmCardNumbers = (selectedCardNumbers: string[]) => {
    if (!user || user.id === 'usr_guest') {
      openAuthModal('register');
      return;
    }
    // Only join for numbers that are not already purchased in userCards
    const existingCards = userCards.filter((c) => c.gameId === currentGame.id);
    const existingCardNumbers = new Set(existingCards.map((c) => c.cardNumber));
    const unpurchasedNumbers = selectedCardNumbers.filter((num) => !existingCardNumbers.has(num));
    if (unpurchasedNumbers.length > 0) {
      joinGame(currentGame.id, unpurchasedNumbers);
    }
    if (!isWeekendGame || isWeekendLive) {
      setIsAutoDrawing(true);
    }
    setIsSelectorOpen(false);
  };

  const handleQuickPlay = () => {
    if (!user || user.id === 'usr_guest') {
      openAuthModal('register');
      return;
    }
    const joined = joinGame(currentGame.id);
    if (joined && (!isWeekendGame || isWeekendLive)) {
      setIsAutoDrawing(true);
    }
  };

  // 75-Ball rows for master board (always visible inline, not a modal)
  // drawnSet / cardDrawnSet already declared above the topHitRequirement useMemo
  const drawnNumbersArr = currentGame.drawnNumbers || [];
  const currentBallNum = drawnNumbersArr.length > 0 ? drawnNumbersArr[drawnNumbersArr.length - 1] : null;
  const previousBalls = drawnNumbersArr.length > 1 ? drawnNumbersArr.slice(Math.max(0, drawnNumbersArr.length - 4), drawnNumbersArr.length - 1) : [];
  const rows = [
    { letter: 'B', range: Array.from({ length: 15 }, (_, i) => i + 1), color: 'bg-blue-600 text-white' },
    { letter: 'I', range: Array.from({ length: 15 }, (_, i) => i + 16), color: 'bg-rose-600 text-white' },
    { letter: 'N', range: Array.from({ length: 15 }, (_, i) => i + 31), color: 'bg-amber-500 text-white' },
    { letter: 'G', range: Array.from({ length: 15 }, (_, i) => i + 46), color: 'bg-emerald-600 text-white' },
    { letter: 'O', range: Array.from({ length: 15 }, (_, i) => i + 61), color: 'bg-purple-600 text-white' },
  ];

  const gameStatus = ((): string => {
    if ((currentGame.winners && currentGame.winners.length > 0) || (currentGame.blockedCards && currentGame.blockedCards.length > 0)) {
      return language === 'am' ? 'የተጠናቀቀ' : 'Checking';
    }
    if (isWeekendGame) {
      if (isWeekendLive) {
        return language === 'am' ? 'በመጫወት ላይ' : 'Playing';
      }
      return language === 'am' ? 'የተያዘለት (ክፍት)' : 'Scheduled (Open)';
    }
    if (fetanOvertime) {
      return language === 'am' ? 'ተጨማሪ ሰዓት (እስከ አሸናፊ)' : 'Overtime (Until Winner)';
    }
    if (fetanIsIntermission) {
      return language === 'am' ? 'ካርድ መምረጫ' : 'Picking Cards';
    }
    if (currentGame.drawnNumbers.length > 0) return language === 'am' ? 'በመጫወት ላይ' : 'Playing';
    return language === 'am' ? 'የሚጠበቅ' : 'Waiting';
  })();

  const gameShortId = (currentGame.id || 'game').slice(0, 8);
  const soldNumbers = getLotterySoldNumbers(currentGame.id);
  const registeredCardsCount = activeGameCards.filter((c) => c.isRegistered).length;
  const totalCardsSold = isSpecialGame
    ? Math.max(soldNumbers?.size || 0, registeredCardsCount)
    : Math.max(
        currentGame.currentPlayers || 0,
        soldNumbers?.size || 0,
        activeGameCards.length
      );
  const totalGrossMoney = (currentGame.entryPrice || 10) * totalCardsSold;
  const gamePrizeDisplay = (currentGame.isWeekendSpecial || currentGame.gameType === 'WEEKEND_LOTTERY')
    ? (currentGame.prizePool || 0)
    : Math.round(totalGrossMoney * 0.80);
  const playableBalance = (wallet?.availableBalance || 0) + (wallet?.bonusBalance || 0);
  const hasSufficientBalance = playableBalance >= (currentGame?.entryPrice || 0);

  const displaySeconds = isFetanGame
    ? fetanSecondsLeft
    : isSpecialGame && specialIsIntermission
    ? specialSecondsLeft
    : secondsRemaining;
  const timerMinutes = Math.floor(displaySeconds / 60);
  const timerSecs = displaySeconds % 60;
  const formattedTimerLeft = `${timerMinutes.toString().padStart(2, '0')}:${timerSecs.toString().padStart(2, '0')}`;

  // =========================================================================
  // 🔽 SINGLE UNIFIED RENDER (used for both weekend & regular games)
  // =========================================================================
  return (
    <div 
      className="w-full h-full min-h-0 max-w-sm sm:max-w-md mx-auto flex flex-col select-none overflow-hidden"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
      onClickCapture={() => audioManager.unlockAudio()}
      onTouchStartCapture={() => audioManager.unlockAudio()}
    >

      {/* ================================================================
          SCROLLABLE BODY — Modern Card Layout (Matches Telegram Mockup)
          ================================================================ */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-32 bg-slate-100/70 p-2.5 sm:p-3 space-y-2.5">

        {voiceBanner && (
          <div className="sticky top-0 z-40 bg-amber-50 border-b border-amber-300 px-3 py-2.5 shadow-sm">
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-6 h-6 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
                <Lightbulb className="w-3.5 h-3.5 text-amber-800 fill-amber-500" />
              </span>
              <div className="flex-1 min-w-0 space-y-0.5">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                  {language === 'am' ? voiceBanner.titleAm : voiceBanner.titleEn}
                </h5>
                <p className="text-[11px] leading-snug text-amber-900/85 whitespace-pre-line">
                  {language === 'am' ? voiceBanner.bodyAm : voiceBanner.bodyEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVoiceBanner(null)}
                className="shrink-0 w-5 h-5 rounded-md bg-amber-100 border border-amber-200 text-amber-900 flex items-center justify-center"
                title={language === 'am' ? 'ይዝጋ' : 'Dismiss'}
              >
                <span className="text-[11px] leading-none font-black">×</span>
              </button>
            </div>
          </div>
        )}


      {/* ── Clean & Simple Weekend Bar (No Crowding, Single Slim Row) ── */}
      {isWeekendGame && (
        <div className="mx-2 mt-1.5 px-3 py-1.5 bg-white rounded-xl border border-amber-300 shadow-2xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs shrink-0">🎟️</span>
            <span className="text-[11px] font-black text-slate-900 truncate">
              {currentGame.weekendDay === 'FRI' ? (language === 'am' ? 'ዓርብ' : 'Friday')
                : currentGame.weekendDay === 'SAT' ? (language === 'am' ? 'ቅዳሜ' : 'Saturday')
                : (language === 'am' ? 'እሑድ' : 'Sunday')} · {currentGame.weekendSlot === '2PM' ? '2:00 PM (8:00)' : '6:00 PM (12:00)'} · 50 ETB
            </span>
          </div>
          {onOpenLotteryTab && (
            <button
              type="button"
              onClick={onOpenLotteryTab}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 transition shadow-2xs cursor-pointer"
            >
              <span>🎟️</span>
              <span>{language === 'am' ? 'ካርድ ምረጥ' : 'Pick Cards'}</span>
            </button>
          )}
        </div>
      )}

      {/* ================================================================
          CARD 1: Game Stats & Controls
          HYPER FETAN & HYPER SPECIAL: Clean plain-text header with stats & bingo balls
          OTHER GAMES: Standard white card
          ================================================================ */}
      {isFetanGame || isSpecialGame ? (
        /* ── Hyper Fetan & Hyper Special Plain Text Header (No Box, Plain Text) ── */
        <div className="px-1 py-1 space-y-1">
          {/* Top row: Back Arrow + Game Name */}
          <div className="flex items-center gap-2 px-0.5 pb-1">
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-xl bg-amber-100 hover:bg-amber-200 text-slate-800 flex items-center justify-center transition cursor-pointer shadow-xs border border-amber-300 shrink-0"
              title={language === 'am' ? 'ተመለስ ወደ ሎቢ' : 'Back to Lobby'}
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-slate-900 tracking-tight">
                {isSpecialGame ? '🎲 ' : '⚡ '}
                {isSpecialGame
                  ? (language === 'am' ? 'ሃይፐር ስፔሻል' : 'HYPER SPECIAL')
                  : (language === 'am' ? 'ሃይፐር ፈጣን' : 'HYPER FETAN')}{' '}
                <span className="italic tracking-widest">BINGO</span>
              </span>
            </div>
          </div>
          {/* Top row stats: DERASH | BALLS | PLAYERS */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 px-1">
            {/* DERASH */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {language === 'am' ? 'ደርሻ' : 'DERASH'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono leading-tight">
                {formatETB(gamePrizeDisplay)}
              </div>
            </div>

            {/* BALLS */}
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {language === 'am' ? 'ኳሶች' : 'BALLS'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono leading-tight">
                {currentGame.drawnNumbers.length}<span className="text-sm text-slate-400">/75</span>
              </div>
            </div>

            {/* PLAYERS */}
            <div className="text-center">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {language === 'am' ? 'ተጫዋቾች' : 'PLAYERS'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono leading-tight">
                {Math.max(activeGameCards.length > 0 ? 1 : 0, currentGame.currentPlayers || 0)}
              </div>
            </div>

            {/* Current Ball — Bingo Ball Style */}
            <div className="flex items-center justify-center shrink-0">
              {currentBallNum != null ? (
                <div
                  className={`rounded-full bg-gradient-to-br ${getLetterColor(getBallLetter(currentBallNum))} shadow-lg flex flex-col items-center justify-center relative overflow-hidden ball-active-anim`}
                  style={{width:'52px',height:'52px',border:'3px solid white',boxShadow:'0 4px 15px rgba(0,0,0,0.3)'}}
                >
                  <div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.45) 0%, transparent 60%)'}} />
                  <span className="text-[9px] font-black uppercase leading-none text-white z-10">{getBallLetter(currentBallNum)}</span>
                  <span className="text-[15px] font-black text-white leading-tight z-10">{currentBallNum}</span>
                </div>
              ) : (
                <div className="rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-white" style={{width:'52px',height:'52px'}}>
                  <span className="text-[8px] font-black text-slate-400 text-center leading-tight">GET<br/>READY</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls: Hit, Sound only */}
          <div className="flex items-center gap-1.5 px-1 pt-0.5">
            <button
              type="button"
              onClick={() => setShowPatternHintModal(true)}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition active:scale-95 shadow-2xs"
            >
              <span>💡</span><span>Hit</span>
            </button>
            <button
              type="button"
              onClick={() => { setSoundEnabled((prev) => { const next = !prev; if (next) audioManager.unlockAudio(); return next; }); }}
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                soundEnabled ? 'bg-sky-50 text-sky-700 border-sky-300' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-600" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

          </div>

          {/* ── Middle Area: Previous balls + Intermission timer ── */}
          <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-slate-50 rounded-xl border border-slate-200 mx-1">
            {/* Previous 3 balls — bingo ball style */}
            <div className="flex items-center gap-1">
              {previousBalls.length > 0 ? previousBalls.map((pb, idx) => {
                const pbLetter = getBallLetter(pb);
                const pbColor = getLetterColor(pbLetter);
                return (
                  <div
                    key={`mid-prev-${idx}-${pb}`}
                    className={`rounded-full bg-gradient-to-br ${pbColor} opacity-70 shadow flex flex-col items-center justify-center relative overflow-hidden`}
                    style={{width:'30px',height:'30px',border:'2px solid white'}}
                  >
                    <div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, transparent 65%)'}} />
                    <span className="text-[6px] font-black uppercase leading-none text-white z-10">{pbLetter}</span>
                    <span className="text-[9px] font-black text-white leading-tight z-10">{pb}</span>
                  </div>
                );
              }) : null}
            </div>

            {/* Intermission timer for Fetan or Hyper Special */}
            {isFetanGame && fetanIsIntermission && (
              <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg font-black text-xs shadow-xs animate-pulse">
                <span>⏳</span>
                <span>{language === 'am' ? 'ካርድ ይምረጡ' : 'Pick Cards'}:</span>
                <span className="font-mono text-sm">{fetanSecondsLeft}s</span>
              </div>
            )}
            {isSpecialGame && specialIsIntermission && (
              <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg font-black text-xs shadow-xs animate-pulse">
                <span>⏳</span>
                <span>{language === 'am' ? 'ካርድ ይምረጡ' : 'Pick Cards'}:</span>
                <span className="font-mono text-sm">{formatTimeRemaining(specialSecondsLeft)}</span>
              </div>
            )}
          </div>

          {/* Show Less / Show More toggle */}
          {showMoreNumbers ? (
            <button
              type="button"
              onClick={() => setShowMoreNumbers(false)}
              className="w-full flex items-center justify-end gap-1 px-1 text-[11px] font-bold text-rose-600 pt-0.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
              <span>{language === 'am' ? 'ከሌላ በኩል አሳይ' : 'Show Less'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowMoreNumbers(true)}
              className="w-full flex items-center justify-end gap-1 px-1 text-[11px] font-bold text-rose-600 pt-0.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 -rotate-90" />
              <span>{language === 'am' ? 'በጣም አሳይ' : 'Show More'}</span>
            </button>
          )}
        </div>
      ) : (
        /* ── Hyper Weekend: Styled Gradient Header + Cards ── */
        <div className="space-y-2.5">
          {/* 1. GRADIENT HEADER BAR */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-2.5 sm:p-3 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={onBack} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer shadow-inner" title={language === 'am' ? 'ተመለስ ወደ ሎቢ' : 'Back to Lobby'}>
                <ChevronLeft className="w-5 h-5 sm:w-5 sm:h-5" />
              </button>
              <span className="text-white font-black text-sm sm:text-base tracking-tight">
                {isWeekendGame
                  ? (language === 'am' ? 'ሃይፐር ዊክኤንድ' : 'HYPER WEEKEND')
                  : (language === 'am' ? 'ሃይፐር ስፔሻል' : 'HYPER SPECIAL')}
                {' '}
                <span className="italic tracking-widest">BINGO</span>
              </span>
            </div>
          </div>

          {/* Current Ball with 3 Previous Balls — Bingo Ball Style */}
          <div className="flex items-center justify-center gap-2 py-1">
            {previousBalls.length > 0 && previousBalls.map((pb, idx) => {
              const pbLetter = getBallLetter(pb);
              const pbColor = getLetterColor(pbLetter);
              return (
                <div
                  key={`prev-sw-${idx}-${pb}`}
                  className={`rounded-full bg-gradient-to-br ${pbColor} opacity-60 shadow flex flex-col items-center justify-center relative overflow-hidden`}
                  style={{width:'38px',height:'38px',border:'2.5px solid rgba(255,255,255,0.8)'}}
                >
                  <div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4) 0%, transparent 65%)'}} />
                  <span className="text-[7px] font-black uppercase leading-none text-white z-10">{pbLetter}</span>
                  <span className="text-[11px] font-black text-white leading-tight z-10">{pb}</span>
                </div>
              );
            })}
            {currentBallNum != null ? (
              <div
                className={`rounded-full bg-gradient-to-br ${getLetterColor(getBallLetter(currentBallNum))} flex flex-col items-center justify-center relative overflow-hidden ball-active-anim`}
                style={{width:'56px',height:'56px',border:'3px solid white',boxShadow:'0 6px 20px rgba(0,0,0,0.35)'}}
              >
                <div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.5) 0%, transparent 60%)'}} />
                <span className="text-[9px] font-black uppercase leading-none text-white z-10">{getBallLetter(currentBallNum)}</span>
                <span className="text-lg font-black text-white leading-tight z-10">{currentBallNum}</span>
              </div>
            ) : (
              <div className="rounded-full border-2 border-dashed border-white/50 flex items-center justify-center bg-white/10" style={{width:'56px',height:'56px'}}>
                <span className="text-[9px] font-black text-white/70 text-center leading-tight">GET<br/>READY</span>
              </div>
            )}
          </div>

          {/* Show Less / Show More toggle below header */}
          {showMoreNumbers ? (
            <button
              type="button"
              onClick={() => setShowMoreNumbers(false)}
              className="w-full flex items-center justify-end gap-1 px-1 text-[11px] font-bold text-rose-600"
            >
              <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
              <span>{language === 'am' ? 'ከሌላ በኩል አሳይ' : 'Show Less'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowMoreNumbers(true)}
              className="w-full flex items-center justify-end gap-1 px-1 text-[11px] font-bold text-rose-600"
            >
              <ChevronLeft className="w-3.5 h-3.5 -rotate-90" />
              <span>{language === 'am' ? 'በጣም አሳይ' : 'Show More'}</span>
            </button>
          )}

          {/* EXPANDED PANELS */}
          {showMoreNumbers && (
            <>
              <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none block">
                        {language === 'am' ? 'ጨዋታ' : 'Game'}
                      </span>
                      <div className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight truncate">
                        {language === 'am' ? 'ሙሉ ቤት ብቻ (Full House 24/24)' : 'Full House 24 out of 24 Numbers'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPatternHintModal(true)}
                    className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition cursor-pointer"
                    title={language === 'am' ? 'እርዳታ (Hit)' : 'Hint / Game Hit'}
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600 fill-amber-400" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">ID:</span>
                    <span className="text-[11px] font-mono font-black text-slate-800 truncate">{gameShortId}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 justify-center">
                    <div className="w-3 h-3 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">
                      {language === 'am' ? 'ሰዓት' : 'Time'}
                    </span>
                    <span className="text-[11px] font-mono font-black text-slate-800">{currentTime || '21:53'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 justify-end">
                    <div className="w-3 h-3 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 shrink-0">
                      {language === 'am' ? 'ሁኔታ' : 'Status'}
                    </span>
                    <span className="text-[11px] font-black text-slate-700">{gameStatus}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold text-xs">$</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {language === 'am' ? 'ዋጋ' : 'Price'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-600">{formatETB(currentGame.entryPrice || 10)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-blue-100 flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {language === 'am' ? 'ጨዋታዎች' : 'Games'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-blue-700">1</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {language === 'am' ? 'ሽልማት' : 'Prize'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-amber-600">{formatETB(gamePrizeDisplay)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 shadow-xs">
                <div className="text-center mb-2">
                  <span className="text-slate-500 font-bold text-sm sm:text-base">
                    {language === 'am' ? 'የተጠሩ' : 'Drawn'}
                    <span className="text-slate-800 font-black">: {currentGame.drawnNumbers.length}</span>
                  </span>
                </div>
                <div className="space-y-0.5 bg-slate-50/70 p-1 rounded-xl border border-slate-100">
                  {rows.map((row) => (
                    <div key={row.letter} className="flex items-center gap-1">
                      <div className={`w-6 h-5 sm:w-7 sm:h-6 rounded-md text-[9px] sm:text-[10px] font-black flex items-center justify-center shrink-0 ${row.color} shadow-xs`}>
                        {row.letter}
                      </div>
                      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                        {row.range.map((num) => {
                          const isDrawn = drawnSet.has(num);
                          const isCurrent = currentGame.currentBall === num;
                          return (
                            <div
                              key={num}
                              className={`h-5 sm:h-6 rounded-md text-[9px] sm:text-[10px] font-bold flex items-center justify-center transition-all ${
                                isCurrent
                                  ? 'bg-amber-400 text-slate-950 font-black scale-105 shadow-xs ring-1 ring-amber-400 z-10'
                                  : isDrawn
                                  ? `${row.color} font-black shadow-xs`
                                  : 'bg-white text-slate-500 border border-slate-200'
                              }`}
                            >
                              {num}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CARD 2: 75-Ball Master Table (Compact 1-Screen Layout for Fetan & Special) ── */}
      {(isFetanGame || isSpecialGame) && showMoreNumbers && (
        <>
      {/* ================================================================
          CARD 2: 75-Ball Master Table (Compact 1-Screen Layout)
          ================================================================ */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-xs">
        {/* Slim board title */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
            {language === 'am' ? 'የቢንጎ 75-ኳስ ሰንጠረዥ' : '75-Ball Master Board'}
          </span>
          <span className="text-[9px] font-mono font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            {currentGame.drawnNumbers.length} / 75 {language === 'am' ? 'የተጠሩ' : 'Drawn'}
          </span>
        </div>

        {/* 5 Rows B-I-N-G-O with 15 columns */}
        <div className="space-y-0.5 bg-slate-50/70 p-1 rounded-xl border border-slate-100">
          {rows.map((row) => (
            <div key={row.letter} className="flex items-center gap-1">
              <div className={`w-5 h-4 sm:w-6 sm:h-4.5 rounded text-[9px] font-black flex items-center justify-center shrink-0 ${row.color} shadow-xs`}>
                {row.letter}
              </div>
              <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                {row.range.map((num) => {
                  const isDrawn = drawnSet.has(num);
                  const isCurrent = currentGame.currentBall === num;
                  return (
                    <div
                      key={num}
                      className={`h-4 sm:h-4.5 rounded text-[8px] sm:text-[9px] font-bold flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'bg-yellow-300 text-slate-950 font-black scale-125 shadow-[0_0_12px_3px_rgba(250,204,21,0.85)] ring-2 ring-yellow-400 animate-pulse z-20 brightness-110'
                          : isDrawn
                          ? `${row.color} font-black shadow-xs`
                          : 'bg-white text-slate-400 border border-slate-100'
                      }`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked Cards Pill (Only shown if any cards are blocked) */}
      {(currentGame.blockedCards || []).length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowBlockedModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-black transition cursor-pointer shadow-xs"
            title="Disqualified & Blocked Cards"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>{language === 'am' ? 'የታገዱ ካርዶች:' : 'Blocked:'}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white border border-rose-300 font-mono text-rose-700 text-xs shadow-xs">
              {(currentGame.blockedCards || []).length}
            </span>
          </button>
        </div>
      )}
        </>
      )}

      {/* ================================================================
          5. WINNER ANNOUNCEMENT BANNER + TOAST ALERTS
          ================================================================ */}
      {currentGame.winners && currentGame.winners.length > 0 && (
        <div className="mx-2 mt-2 p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-md border-2 border-yellow-200 flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shrink-0 text-base shadow-xs">
              🏆
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 leading-tight">
                {language === 'am' ? '🎉 ቢንጎ አሸናፊ ይፋ ሆነ!' : '🎉 BINGO WINNER ANNOUNCED!'}
              </div>
              <div className="text-xs font-black truncate leading-tight">
                {language === 'am'
                  ? `ካርድ #${currentGame.winners[currentGame.winners.length - 1].cardNumber || ''} (${currentGame.winners[currentGame.winners.length - 1].username}) ${formatETB(currentGame.winners[currentGame.winners.length - 1].prizeWon)} አሸንፏል!`
                  : `Card #${currentGame.winners[currentGame.winners.length - 1].cardNumber || ''} (${currentGame.winners[currentGame.winners.length - 1].username}) WON ${formatETB(currentGame.winners[currentGame.winners.length - 1].prizeWon)}!`}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowWinnerModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 text-[11px] font-black shrink-0 transition cursor-pointer shadow-xs"
          >
            {language === 'am' ? 'ይመልከቱ' : 'View'}
          </button>
        </div>
      )}

      {claimStatus && (
        <div className={`mx-2 mt-2 px-2.5 py-1 rounded-xl border text-center text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0 animate-in fade-in ${
          claimStatus.success ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-amber-100 border-amber-400 text-amber-950'
        }`}>
          <span className="truncate">{claimStatus.message}</span>
          <button onClick={() => setClaimStatus(null)} className="p-0.5 text-slate-700 hover:text-slate-950 cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {gameHitFeedback && (
        <div className="mx-2 mt-1 px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0">
          <div className="flex items-center gap-1 truncate">
            <Lightbulb className="w-3.5 h-3.5 fill-amber-500 text-amber-900 shrink-0" />
            <span className="truncate">{gameHitFeedback}</span>
          </div>
          <button onClick={() => setGameHitFeedback(null)} className="p-0.5 text-amber-900 shrink-0 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================================================================
          6. BINGO CARDS — Each picked card gets its OWN separate table
          ================================================================ */}
      <div className="p-2 pb-4 bg-slate-100 flex flex-col gap-3">
        {/* Global Winner Announcement Banner — VISIBLE TO EVERYONE IN THE ROOM */}
        {hasGameWinner && (() => {
          const latestWinner = (currentGame.winners && currentGame.winners.length > 0)
            ? currentGame.winners[currentGame.winners.length - 1]
            : null;
          return (
            <div className={`border-2 rounded-2xl p-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-in slide-in-from-top-2 duration-300 ${
              isSpecialGame
                ? 'bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-indigo-400 text-white'
                : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border-amber-600 text-slate-950'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">🏆</span>
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2 flex-wrap">
                    <span>
                      {latestWinner
                        ? (language === 'am'
                          ? `🎉 ቢንጎ አሸናፊ: @${latestWinner.username} (ካርድ #${latestWinner.cardNumber})!`
                          : `🎉 BINGO WINNER: @${latestWinner.username} (Card #${latestWinner.cardNumber})!`)
                        : (isSpecialGame
                          ? (language === 'am' ? 'የስፔሻል ዙር ተጠናቋል!' : 'Hyper Special Round Finished!')
                          : (language === 'am' ? 'ዙሩ ተጠናቋል!' : 'Round Finished!'))
                      }
                    </span>
                    {latestWinner && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                        {formatETB(latestWinner.prizeWon)}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-black animate-pulse">
                      ⏳ {announcementSecondsLeft}s {language === 'am' ? 'ወደ ካርድ መግዣ...' : 'to card board...'}
                    </span>
                  </div>
                  <p className={`text-[11px] font-medium leading-tight mt-0.5 ${isSpecialGame ? 'text-indigo-200' : 'text-slate-900'}`}>
                    {isSpecialGame
                      ? (language === 'am'
                          ? `ቀጣዩ ዙር በአዲስ ሕግ (ሕግ #${((currentGame.activeSpecialRuleIndex ?? 0) + 1) % HYPER_SPECIAL_RULES.length + 1}) እና አዲስ ዋጋ ይጀምራል።`
                          : `Next game rotates to Law #${((currentGame.activeSpecialRuleIndex ?? 0) + 1) % HYPER_SPECIAL_RULES.length + 1} with a new price.`)
                      : (language === 'am'
                          ? 'እያንዳንዱ ካርድ ለአንድ ዙር ብቻ ያገለግላል። ቀጣዩን ዙር ለመጫወት አዲስ ካርድ መግዛት አለብዎት።'
                          : 'Cards are valid for 1 game only. To play again, please purchase new cards for the next round.')}
                  </p>
                </div>
              </div>
              {!isSpecialGame && <button
                type="button"
                onClick={() => {
                  resetGameRound(currentGame.id);
                  if (onOpenLotteryTab) {
                    onOpenLotteryTab();
                  } else {
                    setIsSelectorOpen(true);
                  }
                }}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-300 font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>🎮 {language === 'am' ? 'አዲስ ካርድ ይግዙና ይጫወቱ' : 'Purchase Cards to Play Again'}</span>
              </button>}
            </div>
          );
        })()}

        {isSpecialGame ? (
          /* ── Hyper Special: 2 Slots Per Screen with Rectangular Number Cells ── */
          <div className="space-y-2 pb-24">
            {/* 5-minute Intermission Countdown Banner for Hyper Special */}
            {specialIsIntermission && (
              <div className="mx-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 p-2.5 rounded-xl border border-amber-500 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⏳</span>
                  <div>
                    <span className="text-xs font-black block leading-tight">
                      {language === 'am' ? 'ካርድ ይምረጡ · ቀጣዩ ዙር ይጀምራል:' : 'Pick Cards · Next Round Starts In:'}
                    </span>
                    <span className="text-[10px] font-bold text-amber-950 block leading-tight">
                      {language === 'am' ? 'ከታች (+) በመጫን ካርድ ይምረጡ (ከ1-5 ካርዶች)' : 'Tap (+) button to select & register cards'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="bg-slate-950 text-amber-300 font-mono font-black text-sm px-2.5 py-1 rounded-lg border border-amber-400 shrink-0 shadow-xs">
                    {formatTimeRemaining(specialSecondsLeft)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-1.5 pt-0.5 text-xs">
              <span className="font-black text-slate-700">
                {language === 'am' ? 'የተመረጡ ካርዶች' : 'Selected Cards'}: {activeGameCards.length}/30
              </span>
              <span className="font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg shadow-2xs">
                {activeGameCards.filter((c) => c.isRegistered).length}/5 {language === 'am' ? 'የተመዘገቡ ካርዶች' : 'Registered Cards'}
              </span>
            </div>

            {/* When entering to choose cards: NO BINGO BOX initially until user chooses cards via the (+) button */}
            {activeGameCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-300 mx-1 shadow-2xs">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-800">
                    {language === 'am' ? 'ምንም የተመረጠ ካርድ የለም' : 'No Cards Selected Yet'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {language === 'am' ? 'አንድ ካርድ ለመጨመር በታች ያለውን + ይጫኑ' : 'Tap the + button below to add one card.'}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  {language === 'am' ? 'እስከ 30 ካርዶች መምረጥ እና 5 ካርዶች መመዝገብ ይችላሉ' : 'Select up to 30 cards, register up to 5'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pb-6">
                {activeGameCards.map((card) => {
                  const cardDrawnSet = new Set(currentGame.drawnNumbers || []);
                  const isRegistered = Boolean(card.isRegistered);
                  const effectiveCardMarked = (card.numbers || []).map((row, rIdx) =>
                    (row || []).map((val, cIdx) => (rIdx === 2 && cIdx === 2) || Boolean(card.marked?.[rIdx]?.[cIdx]) || cardDrawnSet.has(val))
                  );
                  const cardIsWin = Boolean(getBestWinningRule(effectiveCardMarked, currentGame.winningRule, currentGame.activeSpecialRuleIndex));
                  const cardIsBlocked = currentGame.blockedCards?.includes(card.cardNumber);

                  return (
                    <div
                      key={card.id}
                      className={`bg-white rounded-xl overflow-hidden border-2 shadow-xs transition-all flex flex-col justify-between ${
                        cardIsBlocked
                          ? 'border-rose-400 ring-1 ring-rose-200'
                          : cardIsWin
                          ? 'border-amber-400 ring-2 ring-amber-300 shadow-md shadow-amber-200 animate-pulse'
                          : isRegistered
                          ? 'border-emerald-500 shadow-emerald-100 ring-1 ring-emerald-400'
                          : 'border-slate-300'
                      }`}
                    >
                      {/* Top Bar: card number + intermission timer OR registered indicator + remove */}
                      <div className={`px-2 py-1 flex items-center justify-between font-mono font-black text-[11px] shadow-2xs ${
                        isRegistered ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-white'
                      }`}>
                        <div className="flex items-center gap-1 min-w-0">
                          <CreditCard className="w-3 h-3 shrink-0" />
                          <span className="truncate">{card.cardNumber}</span>
                          {isRegistered && specialIsIntermission && specialSecondsLeft > 0 && (
                            <span className="ml-1 font-mono text-[9px] bg-amber-400 text-slate-950 px-1 rounded font-black">
                              ⏳{formatTimeRemaining(specialSecondsLeft)}
                            </span>
                          )}
                          {isRegistered && !specialIsIntermission && (
                            <span className="ml-1 text-[9px] bg-white/20 px-1 rounded font-bold">✓</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCard(card.id)}
                          className={`hover:bg-black/20 p-0.5 rounded cursor-pointer transition shrink-0 ${
                            isRegistered ? 'text-white/80 hover:text-white' : 'text-white/70 hover:text-white'
                          }`}
                          title="Remove card"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="p-1.5 space-y-1 flex-1 flex flex-col justify-between">
                        {/* Register Card Button */}
                        <button
                          type="button"
                          onClick={() => {
                            toggleSpecialCardRegistration(card.id);
                            // Notification removed per requirement
                          }}
                          className={`w-full py-1 px-1 rounded-md font-bold text-[10px] sm:text-[11px] transition cursor-pointer shadow-2xs active:scale-95 ${
                            isRegistered
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1'
                              : 'bg-[#38bdf8] hover:bg-[#0ea5e9] text-white'
                          }`}
                        >
                          {isRegistered ? '✓ Registered' : 'Register Card'}
                        </button>

                        {/* B I N G O Header Row */}
                        <div className="grid grid-cols-5 gap-[2px] text-center font-black text-white text-[9px]">
                          <div className="bg-[#22c55e] py-0.5 rounded">B</div>
                          <div className="bg-[#ef4444] py-0.5 rounded">I</div>
                          <div className="bg-[#06b6d4] py-0.5 rounded">N</div>
                          <div className="bg-[#3b82f6] py-0.5 rounded">G</div>
                          <div className="bg-[#f59e0b] py-0.5 rounded">O</div>
                        </div>

                        {/* 5x5 Number Grid (Rectangle / Square Cells like others, center green F) */}
                        <div className="grid grid-cols-5 gap-[2px] text-center">
                          {card.numbers.map((row, rIdx) =>
                            row.map((val, cIdx) => {
                              const isFree = rIdx === 2 && cIdx === 2;
                              const isMarked = effectiveCardMarked[rIdx][cIdx];
                              const isCurrent = currentGame.currentBall === val && !isFree;
                              return (
                                <div
                                  key={`${rIdx}-${cIdx}`}
                                  onClick={() => !isFree && daubCell(card.id, rIdx, cIdx)}
                                  className={`rounded aspect-square flex items-center justify-center font-bold text-[9px] sm:text-[10px] cursor-pointer transition select-none ${
                                    isFree
                                      ? 'bg-[#22c55e] text-white border border-emerald-600 shadow-2xs font-black'
                                      : isCurrent
                                      ? 'bg-amber-300 text-slate-950 font-black ring-1 ring-amber-500 scale-105 z-10'
                                      : isMarked
                                      ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-500 font-black shadow-2xs'
                                      : 'bg-white border border-slate-200 text-slate-900 shadow-2xs hover:bg-slate-50'
                                  }`}
                                >
                                  {isFree ? 'F' : val}
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* BINGO Button on Registered Card */}
                        {isRegistered && (
                          <button
                            type="button"
                            disabled={cardIsBlocked}
                            onClick={() => {
                              if (cardIsBlocked) return;
                              handleClaimBingo(card.id);
                            }}
                            className={`w-full py-1.5 px-2 rounded-lg font-black italic tracking-wider transition-all relative flex items-center justify-center cursor-pointer shadow-xs ${
                              cardIsBlocked
                                ? 'bg-rose-900 text-rose-300 cursor-not-allowed text-[10px]'
                                : cardIsWin
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 animate-pulse shadow-amber-300 text-xs sm:text-sm font-black'
                                : 'bg-[#2563eb] hover:bg-blue-700 text-white active:scale-[0.99] text-xs sm:text-sm'
                            }`}
                          >
                            <span className="tracking-widest">
                              {cardIsBlocked ? '🚫 BLOCKED' : cardIsWin ? '🎉 BINGO!' : 'BINGO!'}
                            </span>
                            <span className="absolute right-1.5 bottom-0.5 text-[8px] font-mono font-bold text-blue-200">
                              #{card.cardNumber}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeGameCards.length > 0 ? (
          /* ── Render all slots in a scrollable grid (no pagination; all cards visible & scrollable) ── */
          (() => {
            const visibleCards = activeGameCards;

              return (
                <div className="space-y-1.5">
                  <div className={`grid gap-1.5 sm:gap-2 ${visibleCards.length === 1 ? 'grid-cols-1 max-w-[280px] mx-auto w-full' : 'grid-cols-2'} max-h-[58vh] overflow-y-auto pr-0.5`}>
                    {visibleCards.map((card, cardIdx) => {
                      const actualSlotNumber = cardIdx + 1;
                      const isFetan = currentGame.category === 'HYPER_FETAN' || currentGame.name?.includes('Fetan') || currentGame.id.includes('fetan') || isFetanGame;
                      const isWeekend = !!currentGame.isWeekendSpecial || currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.category === 'HYPER_WEEKEND' || isWeekendGame;
                      const effectiveRuleType = isFetan
                        ? 'ONE_LINE_OR_CORNERS'
                        : isWeekend
                        ? 'FULL_HOUSE_ONLY'
                        : currentGame.winningRule;

                      const cardDrawnSet = new Set(currentGame.drawnNumbers || []);
                      const effectiveCardMarked = (card.numbers || []).map((row, rIdx) =>
                        (row || []).map((val, cIdx) => (rIdx === 2 && cIdx === 2) || Boolean(card.marked?.[rIdx]?.[cIdx]) || cardDrawnSet.has(val))
                      );
                      const cardIsWin = Boolean(getBestWinningRule(effectiveCardMarked, effectiveRuleType, currentGame.activeSpecialRuleIndex));
                      const cardIsBlocked = currentGame.blockedCards?.includes(card.cardNumber);
                      const cardIsHint = hintCardId === card.id;
                      const oneAway = checkOneAwayStatus(effectiveCardMarked, card.numbers || [], effectiveRuleType, currentGame.activeSpecialRuleIndex);

                      return (
                        <div
                          key={card.id}
                          className={`bg-white rounded-2xl overflow-hidden p-2 shadow-xs border-2 transition-all flex flex-col justify-between ${
                            cardIsBlocked
                              ? 'border-rose-400 ring-2 ring-rose-200'
                              : cardIsWin
                              ? 'border-amber-400 ring-2 ring-amber-300 shadow-md shadow-amber-200 animate-pulse'
                              : oneAway.isOneAway
                              ? 'border-amber-400 ring-2 ring-amber-300 shadow-xs shadow-amber-200/50'
                              : 'border-slate-200/90'
                          }`}
                        >
                          {/* Top micro-bar: Slot #, Card #, 1-Away suspense & card tools */}
                          <div className="flex items-center justify-between px-0.5 pb-1 border-b border-slate-100 mb-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-[9px] font-black uppercase px-1 py-0.2 rounded bg-amber-100 text-amber-900 shrink-0">
                                S{actualSlotNumber}
                              </span>
                              <span className="font-mono font-black text-[11px] text-slate-800 truncate">
                                #{card.cardNumber}
                              </span>
                              {cardIsBlocked ? (
                                <span className="text-[7px] font-black bg-rose-600 text-white px-1 py-0.2 rounded uppercase shrink-0">
                                  BLOCKED
                                </span>
                              ) : oneAway.isOneAway && !cardIsWin ? (
                                <span className="text-[7px] font-black bg-amber-400 text-slate-950 px-1 py-0.2 rounded-full shadow-2xs animate-bounce shrink-0">
                                  🔥 #{oneAway.neededNumber}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => handleLightGameHit(card)}
                                className="text-amber-600 hover:bg-amber-50 p-0.5 rounded transition cursor-pointer"
                                title={language === 'am' ? 'ፍንጭ' : 'Hint'}
                              >
                                <Lightbulb className="w-3.5 h-3.5 fill-amber-500" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCardId(card.id);
                                  setExpandCardModal(true);
                                }}
                                className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 p-0.5 rounded transition cursor-pointer"
                                title="View fullscreen"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setCardToDelete({ id: card.id, cardNumber: card.cardNumber });
                                }}
                                className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-0.5 rounded transition cursor-pointer"
                                title="Remove card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* B I N G O Header Row */}
                          <div className="grid grid-cols-5 gap-[2px] mb-[2px]">
                            {[
                              { letter: 'B', bg: 'bg-[#2563eb]' },
                              { letter: 'I', bg: 'bg-[#dc2626]' },
                              { letter: 'N', bg: 'bg-[#f59e0b]' },
                              { letter: 'G', bg: 'bg-[#16a34a]' },
                              { letter: 'O', bg: 'bg-[#9333ea]' },
                            ].map((col) => (
                              <div
                                key={col.letter}
                                className={`${col.bg} text-white font-black italic rounded flex items-center justify-center text-[10px] shadow-2xs`}
                                style={{height:'16px'}}
                              >
                                {col.letter}
                              </div>
                            ))}
                          </div>

                          {/* 5x5 Number Grid — proportional compact cells */}
                          <div className="grid grid-cols-5 gap-[2px] flex-1 mb-0.5">
                            {card.numbers.map((row, rIdx) =>
                              row.map((val, cIdx) => {
                                const isFree = rIdx === 2 && cIdx === 2;
                                const isDrawn = !isFree && cardDrawnSet.has(val);
                                const isMarked = Boolean(card.marked?.[rIdx]?.[cIdx]);
                                const isCurrent = currentGame.currentBall === val && !isFree;
                                const isHintCell = cardIsHint && Boolean(patternHint?.[rIdx]?.[cIdx]) && !isMarked && !isFree;
                                const isTargetNumber = Boolean(oneAway?.isOneAway && oneAway?.neededNumber === val) && !isMarked && !isFree;

                                return (
                                  <button
                                    key={`${card.id}-${rIdx}-${cIdx}`}
                                    onClick={() => !isFree && daubCell(card.id, rIdx, cIdx)}
                                    className={`rounded flex items-center justify-center font-extrabold transition-all relative select-none cursor-pointer ${
                                      isFree
                                        ? 'bg-[#16a34a] border border-emerald-600 shadow-2xs'
                                        : isMarked || isDrawn
                                        ? 'bg-[#dc2626] border border-red-700 text-white shadow-inner'
                                        : isTargetNumber
                                        ? 'bg-amber-100 border border-amber-400 text-amber-950 ring-1 ring-amber-500 animate-pulse z-10'
                                        : isCurrent
                                        ? 'bg-amber-300 border border-amber-400 text-slate-950 ring-1 ring-amber-500 scale-105 z-10'
                                        : isHintCell
                                        ? 'bg-amber-100 border border-amber-400 text-amber-950 ring-1 ring-amber-400 animate-pulse'
                                        : 'bg-slate-50/90 hover:bg-slate-100 border border-slate-200/90 text-slate-900 shadow-2xs'
                                    }`}
                                    style={{aspectRatio:'1/1', minHeight:'0'}}
                                  >
                                    {isFree ? (
                                      <span className="text-[#2563eb] font-black text-[9px] leading-none">★</span>
                                    ) : (
                                      <span className={`text-[8px] sm:text-[9px] font-black leading-none ${
                                        isMarked || isDrawn ? 'text-white' : isCurrent ? 'text-slate-950 font-black' : 'text-slate-900'
                                      }`}>
                                        {val}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>

                          {/* Bottom Blue BINGO! Button (Smaller) */}
                          <button
                            disabled={cardIsBlocked}
                            onClick={() => !cardIsBlocked && handleClaimBingo(card.id)}
                            className={`w-full py-1 px-1.5 rounded-lg font-black italic tracking-wider transition-all relative flex items-center justify-center cursor-pointer shadow-xs ${
                              cardIsBlocked
                                ? 'bg-rose-900 text-rose-300 cursor-not-allowed text-[10px]'
                                : cardIsWin
                                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 animate-pulse shadow-amber-300 text-xs sm:text-sm'
                                : 'bg-[#2563eb] hover:bg-blue-700 text-white active:scale-[0.99] text-xs sm:text-sm'
                            }`}
                          >
                            <span className="tracking-widest">
                              {cardIsBlocked ? '🚫 BLOCKED' : 'BINGO!'}
                            </span>
                            <span className="absolute right-1.5 bottom-0.5 text-[8px] font-mono font-bold text-blue-200">
                              #{card.cardNumber}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
        ) : (
          /* No cards yet — Spectator Mode & Card Purchase Area */
          <div className="flex flex-col items-center justify-center py-6 px-3 text-center space-y-3.5 bg-white rounded-2xl border border-slate-200 mx-1 shadow-xs">
            {/* Live Spectator Mode Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-black shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'am' ? 'የቀጥታ እይታ ሞድ · Spectator Mode' : 'Live Spectator Mode'}</span>
            </div>

            <div className="space-y-1 px-4">
              <h3 className="text-sm font-black text-slate-900">
                {isWeekendGame
                  ? (language === 'am' ? '🌟 ሃይፐር ዊክኤንድ ጨዋታ እይታ' : '🌟 Hyper Weekend Live Spectator')
                  : (language === 'am' ? 'ጨዋታውን በቀጥታ እየተመለከቱ ነው' : 'Watching Live Game')}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {language === 'am'
                  ? 'ጨዋታውን ያለ ካርድ በቀጥታ መከታተል ይችላሉ። በጨዋታው ለመሳተፍ እና ለማሸነፍ ካርድ ይግዙ።'
                  : 'You can watch this game live without cards. To participate and win, purchase cards below.'}
              </p>
            </div>

            {/* Insufficient Balance Notice with Deposit Action */}
            {!hasSufficientBalance && (
              <div className="w-full max-w-xs mx-auto p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs text-center space-y-2 shadow-2xs">
                <div className="flex items-center justify-center gap-1.5 font-black text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{language === 'am' ? 'ዝቅተኛ ቀሪ ሒሳብ' : 'Insufficient Balance'}</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-tight">
                  {language === 'am'
                    ? `ለመጫወት ቢያንስ ${currentGame.entryPrice} ETB ያስፈልጋል። ያለ በቂ ሒሳብ መጫወት አይችሉም (ቀሪ ሒሳብዎ: ${Math.floor(playableBalance)} ETB)። መመልከት ይችላሉ!`
                    : `At least ${currentGame.entryPrice} ETB required. Without sufficient balance you cannot play (You have: ${Math.floor(playableBalance)} ETB). You can watch!`}
                </p>
                {onOpenWalletTab && (
                  <button
                    type="button"
                    onClick={onOpenWalletTab}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{language === 'am' ? '💳 ሒሳብ ሙላ (Deposit via Telebirr/CBE)' : '💳 Deposit to Play'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Action Buttons: Card purchase blocked if balance is insufficient */}
            {isWeekendGame ? (
              <div className="flex flex-col gap-2 px-4 w-full max-w-xs mx-auto">
                {onOpenLotteryTab && (
                  <button
                    type="button"
                    onClick={onOpenLotteryTab}
                    className="w-full px-3 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{language === 'am' ? '🎟️ ሎተሪ ካርታ ይምረጡ (1-1500)' : '🎟️ Pick Lottery Tickets (1–1500)'}</span>
                  </button>
                )}
                <button
                  disabled={!hasSufficientBalance}
                  onClick={handleQuickPlay}
                  className={`w-full px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 ${
                    !hasSufficientBalance
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white cursor-pointer'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    {!hasSufficientBalance
                      ? (language === 'am' ? `ሒሳብ ይሙሉ (${currentGame.entryPrice} ብር)` : `Deposit to Play (${currentGame.entryPrice} ETB)`)
                      : (language === 'am' ? '🚀 አሁኑኑ ይጫወቱ (Quick Play)' : '🚀 Quick Play (Join Now)')}
                  </span>
                </button>
              </div>
            ) : !isSpecialGame ? (
              <div className="flex flex-col sm:flex-row gap-2 px-4 w-full max-w-xs mx-auto">
                <button
                  disabled={!hasSufficientBalance}
                  onClick={() => (!user || user.id === 'usr_guest' ? openAuthModal('register') : isSpecialGame ? setIsSelectorOpen(true) : onOpenLotteryTab ? onOpenLotteryTab() : setIsSelectorOpen(true))}
                  className={`flex-1 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 ${
                    !hasSufficientBalance
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'am' ? 'ካርድ ቁጥር ይምረጡ' : 'Pick Cards'}</span>
                </button>
                <button
                  disabled={!hasSufficientBalance}
                  onClick={handleQuickPlay}
                  className={`flex-1 px-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 ${
                    !hasSufficientBalance
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white cursor-pointer'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    {!hasSufficientBalance
                      ? (language === 'am' ? `ሒሳብ ይሙሉ (${currentGame.entryPrice} ብር)` : `Deposit (${currentGame.entryPrice} ETB)`)
                      : (language === 'am' ? 'ፈጣን ጨዋታ' : 'Quick Play')}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </div>

      {/* ================================================================
          8. MODALS (ONE SET ONLY, no duplication)
          ================================================================ */}

      {/* FULL-SCREEN CARD EXPAND MODAL */}
      {expandCardModal && (() => {
        const fsCard =
          activeGameCards.find((c) => c.id === selectedCardId) || activeGameCards[0];
        if (!fsCard) return null;
        const fsBlocked = currentGame.blockedCards?.includes(fsCard.cardNumber);
        const isFetan = currentGame.category === 'HYPER_FETAN' || currentGame.name?.includes('Fetan') || currentGame.id.includes('fetan') || isFetanGame;
        const isWeekend = !!currentGame.isWeekendSpecial || currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.category === 'HYPER_WEEKEND' || isWeekendGame;
        const effectiveRuleType = isFetan
          ? 'ONE_LINE_OR_CORNERS'
          : isWeekend
          ? 'FULL_HOUSE_ONLY'
          : currentGame.winningRule;

        const fsDrawnSet = new Set(currentGame.drawnNumbers || []);
        const effectiveFsMarked = (fsCard.numbers || []).map((row, rIdx) =>
          (row || []).map((val, cIdx) => (rIdx === 2 && cIdx === 2) || Boolean(fsCard.marked?.[rIdx]?.[cIdx]) || fsDrawnSet.has(val))
        );
        const fsWin = Boolean(getBestWinningRule(effectiveFsMarked, effectiveRuleType, currentGame.activeSpecialRuleIndex));
        return (
          <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col select-none">
            {/* Header: card tabs to switch between all picked cards in full screen + delete + close */}
            <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 py-2 shrink-0 gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
                {activeGameCards.map((c) => {
                  const isActive = c.id === fsCard.id;
                  const isBlk = currentGame.blockedCards?.includes(c.cardNumber);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCardId(c.id)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition cursor-pointer shrink-0 ${
                        isActive
                          ? isBlk
                            ? 'bg-rose-700 text-white'
                            : 'bg-emerald-500 text-slate-950 shadow-md font-black'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }`}
                    >
                      #{c.cardNumber}
                      {isBlk && <span className="ml-1 text-[9px]">🚫</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setCardToDelete({ id: fsCard.id, cardNumber: fsCard.cardNumber });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-rose-500/40"
                  title="Delete this card"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'am' ? 'ሰርዝ' : 'Delete'}</span>
                </button>
                <button
                  onClick={() => setExpandCardModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Close fullscreen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* B I N G O Header Row (Smaller) */}
            <div className="grid grid-cols-5 gap-1.5 px-3 pt-3 bg-slate-900 shrink-0">
              {[
                { letter: 'B', bg: 'bg-[#2563eb]' },
                { letter: 'I', bg: 'bg-[#dc2626]' },
                { letter: 'N', bg: 'bg-[#f59e0b]' },
                { letter: 'G', bg: 'bg-[#16a34a]' },
                { letter: 'O', bg: 'bg-[#9333ea]' },
              ].map((col) => (
                <div
                  key={col.letter}
                  className={`${col.bg} text-white font-black italic rounded-lg h-8 sm:h-10 flex items-center justify-center text-base sm:text-lg shadow-xs`}
                >
                  {col.letter}
                </div>
              ))}
            </div>

            {/* Full-screen 5x5 grid (Smaller) */}
            <div className="flex-1 grid grid-cols-5 gap-1.5 p-3 bg-slate-900">
              {fsCard.numbers.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isFree = rIdx === 2 && cIdx === 2;
                  const isDrawn = !isFree && fsDrawnSet.has(val);
                  const isMarked = Boolean(fsCard.marked?.[rIdx]?.[cIdx]);
                  const isCurrent = currentGame.currentBall === val && !isFree;
                  return (
                    <button
                      key={`fs-${rIdx}-${cIdx}`}
                      onClick={() => !isFree && daubCell(fsCard.id, rIdx, cIdx)}
                      className={`flex items-center justify-center font-extrabold rounded-xl border transition-all cursor-pointer aspect-square ${
                        isFree
                          ? 'bg-[#16a34a] border-emerald-500 shadow-sm'
                          : isMarked || isDrawn
                          ? 'bg-[#dc2626] border-red-700 text-white shadow-inner'
                          : isCurrent
                          ? 'bg-amber-300 border-amber-400 text-slate-950 ring-2 ring-amber-500'
                          : 'bg-white text-slate-950 border-slate-200 hover:bg-slate-100 shadow-xs'
                      }`}
                    >
                      {isFree ? (
                        <span className="text-[#2563eb] font-black text-2xl sm:text-3xl leading-none">★</span>
                      ) : (
                        <span className={`font-black text-xl sm:text-2xl ${
                          isMarked || isDrawn ? 'text-white' : isCurrent ? 'text-slate-950 font-black' : 'text-slate-950'
                        }`}>
                          {val}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom BINGO button (Smaller) */}
            <div className="p-3 bg-slate-900 shrink-0">
              <button
                disabled={fsBlocked}
                onClick={() => { if (!fsBlocked) { handleClaimBingo(fsCard.id); setExpandCardModal(false); } }}
                className={`w-full py-3 rounded-xl font-black text-lg sm:text-xl tracking-widest italic relative flex items-center justify-center cursor-pointer shadow-lg transition-all ${
                  fsBlocked
                    ? 'bg-rose-900 text-rose-300 cursor-not-allowed'
                    : fsWin
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 animate-pulse shadow-amber-300'
                    : 'bg-[#2563eb] hover:bg-blue-700 text-white active:scale-[0.99]'
                }`}
              >
                <span>{fsBlocked ? '🚫 BLOCKED' : 'BINGO!'}</span>
                <span className="absolute right-3 bottom-2 text-[11px] sm:text-xs font-mono font-bold text-blue-200">
                  #{fsCard.cardNumber}
                </span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 75-BALL ZOOM POPUP MODAL */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 max-w-sm w-full space-y-3 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-blue-600" />
                <h3 className="font-black text-slate-900 text-xs">
                  {language === 'am' ? 'የቢንጎ 75-ኳስ ሰንጠረዥ' : '75-Ball Master Board'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
                  {drawnSet.size} / 75
                </span>
              </div>
              <button
                onClick={() => setShowTableModal(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
              {rows.map((row) => (
                <div key={row.letter} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px] shrink-0 ${row.color}`}>
                    {row.letter}
                  </div>
                  <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                    {row.range.map((num) => {
                      const isDrawn = drawnSet.has(num);
                      const isCurrent = currentGame.currentBall === num;
                      return (
                        <div
                          key={num}
                          className={`h-5 rounded-md text-[9px] font-bold flex items-center justify-center transition-all ${
                            isCurrent
                              ? 'bg-yellow-300 text-slate-950 font-black scale-125 shadow-[0_0_12px_3px_rgba(250,204,21,0.85)] ring-2 ring-yellow-400 animate-pulse z-20 brightness-110'
                              : isDrawn
                              ? `${row.color} font-black`
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowTableModal(false)}
              className="w-full py-2 rounded-xl bg-slate-950 text-white font-bold text-xs cursor-pointer"
            >
              {language === 'am' ? 'ዝጋ (Close)' : 'Close Board'}
            </button>
          </div>
        </div>
      )}

      {/* 2-STEP CARD DELETE CONFIRMATION MODAL */}
      {cardToDelete && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 max-w-xs w-full space-y-4 shadow-2xl text-slate-900 animate-in zoom-in-95 duration-150">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="font-black text-slate-900 text-base">
                {language === 'am' ? 'ካርዱን መሰረዝ ይፈልጋሉ?' : 'Remove This Card?'}
              </h3>
              <p className="text-xs text-slate-600">
                {language === 'am'
                  ? `ካርድ #${cardToDelete.cardNumber} ከጨዋታው ውስጥ ይሰረዛል። እርግጠኛ ነዎት?`
                  : `Card #${cardToDelete.cardNumber} will be removed from your active cards. Are you sure?`}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCardToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer border border-slate-300"
              >
                {language === 'am' ? 'ተመለስ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = cardToDelete.id;
                  const remaining = activeGameCards.filter((c) => c.id !== targetId);
                  removeCard(targetId);
                  if (remaining.length > 0) {
                    setSelectedCardId(remaining[0].id);
                  } else {
                    setSelectedCardId(null);
                    setExpandCardModal(false);
                  }
                  setCardToDelete(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition cursor-pointer shadow-md"
              >
                {language === 'am' ? 'አዎ ሰርዝ' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD SELECTOR MODAL */}
      <CardNumberSelector
        isOpen={isSelectorOpen && !isSpecialGame}
        onClose={() => setIsSelectorOpen(false)}
        onConfirm={handleConfirmCardNumbers}
        entryPrice={currentGame.entryPrice}
        initialCards={initialCardNumbers}
        gameId={currentGame.id}
        mode={isFetanGame ? 'FETAN' : isWeekendGame ? 'WEEKEND' : 'SPECIAL'}
      />

      {/* BLOCKED PLAYERS MODAL */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    {language === 'am' ? 'የታገዱ ተጫዋቾች / ካርዶች' : 'Disqualified & Blocked Cards'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {language === 'am' ? 'ያለ ሙሉ ካርቴላ ቢንጎ ያሉ' : 'Disqualified for false Bingo claims'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBlockedModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(currentGame.blockedCards || []).length > 0 ? (
                (currentGame.blockedCards || []).map((cardNum, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black font-mono bg-rose-200/80 px-2 py-0.5 rounded-lg text-rose-900">
                        #{cardNum}
                      </span>
                      <span className="text-xs font-bold text-rose-900">
                        {language === 'am' ? 'ተጫዋች ታግዷል' : 'Player Disqualified'}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-300">
                      {language === 'am' ? 'የታገደ' : 'BLOCKED'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs font-bold">
                  {language === 'am' ? 'በዚህ ዙር የታገደ ካርድ የለም' : 'No cards blocked in this round.'}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowBlockedModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
            >
              {language === 'am' ? 'ዝጋ (Close)' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* WINNER CELEBRATION MODAL */}
      {showWinnerModal && currentGame.winners && currentGame.winners.length > 0 && (() => {
        const latestWinner = currentGame.winners[currentGame.winners.length - 1];
        const winningCard = activeGameCards.find((c) => c.cardNumber === latestWinner.cardNumber);
        const winningNumbers: number[] = [];
        if (winningCard) {
          const drawnNums = new Set(currentGame.drawnNumbers || []);
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              const num = winningCard.numbers?.[r]?.[c] ?? 0;
              const isFree = (r === 2 && c === 2);
              if ((Boolean(winningCard.marked?.[r]?.[c]) || drawnNums.has(num)) && !isFree && num > 0) {
                winningNumbers.push(num);
              }
            }
          }
        }
        winningNumbers.sort((a, b) => a - b);
        return (
        <div 
          onClick={() => setShowWinnerModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-400 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white text-center relative overflow-hidden cursor-default"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-3xl mx-auto shadow-lg ring-4 ring-amber-400/30 animate-bounce">
              🏆
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400">
                {language === 'am' ? '🎉 ቢንጎ አሸናፊ ይፋ ሆነ! 🎉' : '🎉 BINGO WINNER ANNOUNCED! 🎉'}
              </h3>
              <p className="text-2xl font-black text-white tracking-wide">
                @{latestWinner.username}
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-3.5 border border-white/15 space-y-2.5 text-left">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'የአሸናፊ ካርድ ቁጥር:' : 'Winning Card #:'}</span>
                <span className="font-mono font-black text-amber-300 text-base">
                  #{latestWinner.cardNumber || ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'የተሸለመው ገንዘብ:' : 'Prize Won:'}</span>
                <span className="font-black text-emerald-400 text-base">
                  {formatETB(latestWinner.prizeWon)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'ያሸነፈበት ኳስ:' : 'Winning Ball:'}</span>
                <span className="font-black text-amber-400 text-sm">
                  #{latestWinner.winningBall || currentGame.currentBall || ''}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-slate-300 font-bold block mb-1.5">
                  {language === 'am' ? 'የአሸናፊ ቁጥሮች (Winning Numbers):' : 'Winning Numbers on Card:'}
                </span>
                {winningNumbers.length > 0 ? (
                  <div className="flex flex-wrap gap-1 justify-start">
                    {winningNumbers.map((n, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 rounded-md bg-red-600 font-mono font-black text-[10px] text-white ring-1 ring-red-400/50">
                        {n}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 font-mono text-[10px]">
                    {language === 'am' ? 'ሙሉ ካርቴላ — 24 ቁጥሮች ተሟልተዋል' : 'Full House — All 24 numbers daubed'}
                  </span>
                )}
              </div>
              {/* Single-Game Card Rule Notice */}
              <div className="bg-amber-400/20 border border-amber-400/40 rounded-xl p-2 text-center text-[10px] text-amber-200 font-bold leading-tight">
                ⚡ {language === 'am'
                  ? 'ካርዶችዎ ለዚህ ጨዋታ ብቻ አገልግለዋል። ድጋሚ ለመጫወት አዲስ ካርድ መግዛት አለብዎት።'
                  : 'Cards used in this game have concluded. To play again, please purchase fresh cards for the new round.'}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  resetGameRound(currentGame.id);
                  setShowWinnerModal(false);
                  if (isSpecialGame) {
                    setSpecialIsIntermission(true);
                    setSpecialSecondsLeft(300);
                    setIsAutoDrawing(false);
                    setIsSelectorOpen(true);
                  } else if (onOpenLotteryTab) {
                    onOpenLotteryTab();
                  } else {
                    setIsSelectorOpen(true);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <span>🎮 {isSpecialGame ? (language === 'am' ? `ቀጣይ ዙር (${announcementSecondsLeft}s)` : `Play Next Round (${announcementSecondsLeft}s)`) : (language === 'am' ? `ቀጣይ ዙር ይጫወቱ (${announcementSecondsLeft}s)` : `Play Next Round (${announcementSecondsLeft}s)`)}</span>
              </button>
              <div className="flex items-center gap-2">
                {onBack && (
                  <button
                    type="button"
                    onClick={() => { setShowWinnerModal(false); onBack(); }}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{language === 'am' ? 'ወደ ሎቢ' : 'Back to Lobby'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowWinnerModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer border border-white/20"
                >
                  <span>{language === 'am' ? 'ይዝጉ' : 'Close'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* PATTERN HINTS MODAL — 4 Winning Rules & Hit Info */}
      {showPatternHintModal && (
        <div 
          onClick={() => setShowPatternHintModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden cursor-default border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            {/* Header with explicit Back Button */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500 fill-amber-100" />
                <h3 className="text-sm font-black text-slate-900">
                  {currentGame.winningRule === 'ONE_LINE_OR_CORNERS' || currentGame.category === 'HYPER_FETAN'
                    ? (language === 'am' ? 'የሃይፐር ፈጣን የድል ሕጎች' : 'Hyper Fetan Winning Rules')
                    : currentGame.winningRule === 'FULL_HOUSE_ONLY' || currentGame.category === 'HYPER_WEEKEND'
                    ? (language === 'am' ? 'የሃይፐር ዊክኤንድ ሕግ (ሙሉ ቤት)' : 'Hyper Weekend Law (Full House Only)')
                    : (language === 'am' ? 'የሃይፐር ስፔሻል 15 ሕጎች' : 'Hyper Special 15 Official Laws')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPatternHintModal(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{language === 'am' ? 'ተመለስ' : 'Back'}</span>
              </button>
            </div>

            {/* Live Hit Progress / Requirement (visible when player taps Hint button) */}
            {topHitRequirement && topHitRequirement.isHit && (
              <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 flex items-center justify-between gap-1 text-[11px] font-black shadow-xs">
                <span className="truncate">🔥 {topHitRequirement.hitTitle}: {topHitRequirement.hitDetail}</span>
                {topHitRequirement.progressText && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 shrink-0 font-mono text-[10px]">
                    {topHitRequirement.progressText}
                  </span>
                )}
              </div>
            )}

            <p className="px-4 pt-3 pb-2 text-xs text-slate-600 leading-relaxed">
              {currentGame.winningRule === 'ONE_LINE_OR_CORNERS' || currentGame.category === 'HYPER_FETAN'
                ? (language === 'am'
                    ? '1 አግድም፣ 1 ቀጥታ (Vertical)፣ 1 ዲያጎናል ወይም 4 ማዕዘናት በማጠናቀቅ ያሸንፉ። (ሙሉ ቤት፣ X እና 2 አግድም ተሰርዘዋል!)'
                    : 'Complete 1 Horizontal, 1 Vertical, 1 Diagonal, or 4 Corners to win. (Full House, Letter X, and 2 horizontal lines are excluded!)')
                : currentGame.winningRule === 'FULL_HOUSE_ONLY' || currentGame.category === 'HYPER_WEEKEND'
                ? (language === 'am'
                    ? 'በዚህ ጨዋታ ለማሸነፍ ሙሉ ቤት ብቻ (ሁሉንም 24 ቁጥሮች) ምልክት ማድረግ ያስፈልጋል።'
                    : 'In Weekend Mega Draw, only Full House (all 24 numbers marked) wins the jackpot!')
                : (language === 'am'
                    ? 'በሃይፐር ስፔሻል ለእያንዳንዱ ዙር አንድ የተመረጠ ሕግ ብቻ ይሰራል፤ የዚህ ዙር ንቁ ሕግ በወርቃማ ምልክት ጎልቶ ይታያል።'
                    : 'In Hyper Special, exactly one law governs each game round until finished. The active law for this round is highlighted in gold.')}
            </p>

            {/* Winning Rule Patterns List */}
            <div className="px-4 pb-3 space-y-2.5 max-h-80 overflow-y-auto">
              {(currentGame.winningRule === 'ONE_LINE_OR_CORNERS' || currentGame.category === 'HYPER_FETAN'
                ? HYPER_FETAN_RULES
                : currentGame.winningRule === 'FULL_HOUSE_ONLY' || currentGame.category === 'HYPER_WEEKEND'
                ? [{
                    id: 'FULL_HOUSE',
                    title: 'Full House (Blackout)',
                    titleAm: 'ሙሉ ቤት (Blackout)',
                    subtitle: 'Every number on the 5x5 card must be marked (24/24)',
                    subtitleAm: 'በካርዱ ላይ ያሉትን ሁሉንም 24 ቁጥሮች ምልክት ማድረግ',
                    pattern: Array.from({ length: 5 }, () => Array(5).fill(true)),
                  }]
                : HYPER_SPECIAL_RULES.map((r, idx) => ({
                    id: r.id,
                    title: r.nameEn,
                    titleAm: r.nameAm,
                    subtitle: r.descEn,
                    subtitleAm: r.descAm,
                    pattern: r.pattern,
                    isActive: idx === (Math.abs(currentGame.activeSpecialRuleIndex || 0) % HYPER_SPECIAL_RULES.length),
                  }))
              ).map((rule: any, idx: number) => {
                const isActive = rule.isActive;
                return (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400 shadow-md'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                    }`}
                  >
                    {/* Mini Pattern Grid */}
                    <div className="shrink-0 rounded-lg overflow-hidden border border-slate-300 bg-white">
                      {rule.pattern.map((row: boolean[], rIdx: number) => (
                        <div key={rIdx} className="flex">
                          {row.map((filled: boolean, cIdx: number) => {
                            const isFree = rIdx === 2 && cIdx === 2;
                            return (
                              <div
                                key={cIdx}
                                className={`w-3.5 h-3.5 border border-slate-100 ${
                                  isFree
                                    ? 'bg-amber-300'
                                    : filled
                                    ? isActive ? 'bg-amber-500' : 'bg-indigo-600'
                                    : 'bg-white'
                                }`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {/* Rule Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-black text-xs ${isActive ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                          #{idx + 1} · {language === 'am' ? rule.titleAm : rule.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-slate-950 animate-pulse">
                            ● {language === 'am' ? 'የዚህ ዙር ንቁ ሕግ' : 'ACTIVE LAW'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">
                        {language === 'am' ? rule.subtitleAm : rule.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Back to Game Action button */}
            <div className="p-4 pt-2 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowPatternHintModal(false)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <Undo2 className="w-4 h-4" />
                <span>{language === 'am' ? '🔙 ተመለስ ወደ ጨዋታው (Back to Game)' : '🔙 Return to Game'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* One tap adds one Hyper Special card. */}
      {isSpecialGame && specialIsIntermission && (
        <div className="fixed bottom-20 right-4 z-40 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => addSpecialCards(currentGame.id, 1)}
            className="w-10 h-10 rounded-full bg-[#ef4444] hover:bg-[#dc2626] text-white text-xl font-bold flex items-center justify-center shadow-lg active:scale-95 transition cursor-pointer"
            title="Add one card"
          >
            +
          </button>
        </div>
      )}

      {/* Special Feedback Toast */}
      {specialToast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
          {specialToast}
        </div>
      )}

    </div>
  );
}
