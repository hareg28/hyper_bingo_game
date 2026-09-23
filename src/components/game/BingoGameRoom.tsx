'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Volume2, VolumeX, Sparkles, Zap, 
  Plus, Star, Hash, Lightbulb, X, Grid, ChevronLeft,
  Undo2, Redo2, Settings, Menu, ShieldAlert, Trophy,
  Trash2, Maximize2
} from 'lucide-react';
import { 
  formatETB, 
  checkFullHouseWin, 
  countRemainingNumbers,
  playBingoVictoryFanfare,
  WINNING_RULES_PATTERNS,
  getBestWinningRule,
  WinningRuleMatch,
} from '../../lib/bingoUtils';
import confetti from 'canvas-confetti';
import CardNumberSelector from './CardNumberSelector';
import { isAdminTelegramId } from '../../lib/authUtils';
import { getGameLivePrizePool } from '../../lib/store';

interface BingoGameRoomProps {
  gameId: string;
  onBack?: () => void;
}

export default function BingoGameRoom({ gameId, onBack }: BingoGameRoomProps) {
  const { 
    games, 
    userCards, 
    daubCell, 
    claimBingo, 
    drawNextBall, 
    autoDaubEnabled, 
    toggleAutoDaub,
    joinGame,
    addCardToGame,
    removeCard,
    user,
    openAuthModal,
    language,
    t
  } = useBingo();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);
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
  const [showGameInfo, setShowGameInfo] = useState(true);
  const [cardToDelete, setCardToDelete] = useState<{ id: string; cardNumber: string } | null>(null);

  const currentGame = games.find((g) => g.id === gameId) || games[0];
  const activeGameCards = userCards.filter((c) => c.gameId === currentGame.id);
  const initialCardNumbers = React.useMemo(
    () => activeGameCards.map((c) => c.cardNumber),
    [activeGameCards.map((c) => c.cardNumber).join(',')]
  );
  const isWeekendGame = currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.isWeekendSpecial;
  
  // Active card (kept for handlers, but UI now shows ALL cards)
  const activeUserCard = 
    activeGameCards.find((c) => c.id === selectedCardId) || 
    activeGameCards[0] || 
    userCards[0];

  const isUserAdmin = Boolean(
    user && (user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  // Live clock for header
  useEffect(() => {
    const updateTime = () => {
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
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // ignore
    }
  };

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
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeRemaining = (totalSec: number): string => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Auto Draw interval timer simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoDrawing && currentGame) {
      interval = setInterval(() => {
        const next = drawNextBall(currentGame.id);
        if (!next) {
          setIsAutoDrawing(false);
        }
      }, currentGame.drawInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [isAutoDrawing, currentGame, drawNextBall]);

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

  // Pattern Hint Logic
  const computePatternHint = (card: typeof activeGameCards[0]): boolean[][] => {
    const hint = Array.from({ length: 5 }, () => Array(5).fill(false));
    let bestScore = -1;
    let bestCells: [number, number][] = [];

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

    // Check pattern completeness using 4 winning rules: 1 Line, 2 Lines, Letter X, Full House
    const bestRule: WinningRuleMatch | null = getBestWinningRule(targetCard.marked);

    if (!bestRule) {
      // FALSE BINGO -> BLOCK THE PLAYER & CARD
      playErrorBuzzer();
      const rem = countRemainingNumbers(targetCard.marked);
      const result = claimBingo(targetCard.id); // This adds card to blockedCards in context
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? `🚫 ታግደዋል! ካርድ #${targetCard.cardNumber} የአሸናፊ አሳይ ሳያሳይ ቢንጎ ስላሉ ታግደዋል። (${rem} ቁጥሮች ቀርተዋል)`
          : `🚫 BLOCKED! Card #${targetCard.cardNumber} disqualified for false Bingo claim — no winning pattern matched (${rem} numbers left).`
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
    if (!user) {
      openAuthModal('register');
      return;
    }
    if (activeGameCards.length === 0) {
      joinGame(currentGame.id, selectedCardNumbers);
    } else {
      const existingNums = activeGameCards.map((c) => c.cardNumber);
      const newNums = selectedCardNumbers.filter((n) => !existingNums.includes(n));
      newNums.forEach((num) => addCardToGame(currentGame.id, num));
    }
    setIsSelectorOpen(false);
  };

  // 75-Ball rows for master board (always visible inline, not a modal)
  const drawnSet = new Set(currentGame.drawnNumbers);
  const rows = [
    { letter: 'B', range: Array.from({ length: 15 }, (_, i) => i + 1), color: 'bg-blue-600 text-white' },
    { letter: 'I', range: Array.from({ length: 15 }, (_, i) => i + 16), color: 'bg-red-600 text-white' },
    { letter: 'N', range: Array.from({ length: 15 }, (_, i) => i + 31), color: 'bg-green-600 text-white' },
    { letter: 'G', range: Array.from({ length: 15 }, (_, i) => i + 46), color: 'bg-purple-600 text-white' },
    { letter: 'O', range: Array.from({ length: 15 }, (_, i) => i + 61), color: 'bg-orange-500 text-white' },
  ];

  const gameStatus = ((): string => {
    if ((currentGame.winners && currentGame.winners.length > 0) || (currentGame.blockedCards && currentGame.blockedCards.length > 0)) {
      return language === 'am' ? 'የተጠናቀቀ' : 'Checking';
    }
    if (currentGame.drawnNumbers.length > 0) return language === 'am' ? 'በመጫወት ላይ' : 'Playing';
    return language === 'am' ? 'የሚጠበቅ' : 'Waiting';
  })();

  const gameShortId = (currentGame.id || 'game').slice(0, 8);
  const gamePrizeDisplay = getGameLivePrizePool(currentGame);

  // =========================================================================
  // 🔽 SINGLE UNIFIED RENDER (used for both weekend & regular games)
  // =========================================================================
  return (
    <div className="w-full h-full min-h-0 max-w-sm sm:max-w-md mx-auto flex flex-col select-none overflow-hidden">

      {/* Clean White Top Bar (Dark purple header removed per user request) */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              title="Back"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-blue-700 shrink-0" title="Game">
            <Grid className="w-4 h-4" />
          </span>
          <span className="text-sm font-black text-slate-900 truncate">
            {currentGame.name || (
              isWeekendGame
                ? (language === 'am' ? '🌟 የሳምንት መጨረሻ Hyper ' + currentGame.entryPrice : '🌟 Weekend Hyper ' + currentGame.entryPrice)
                : ('⚡ Hyper ' + currentGame.entryPrice)
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-black text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
            {currentTime}
          </span>
          <button
            onClick={() => setShowPatternHintModal(true)}
            className="w-6 h-6 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 flex items-center justify-center transition cursor-pointer border border-amber-200"
            title={language === 'am' ? 'የማሸነፊያ ደንቦች (4 ደንቦች)' : 'Winning Rules & Patterns'}
          >
            <Lightbulb className="w-3.5 h-3.5 fill-amber-500 text-amber-900" />
          </button>
        </div>
      </div>

      {/* ================================================================
          SCROLLABLE BODY — Everything below header scrolls as one page
          ================================================================ */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-36 bg-slate-100">

      {/* ================================================================
          2. SHOW LESS / SHOW MORE + GAME INFO ROWS
          ================================================================ */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 space-y-1.5 relative">
        {/* Show Less / Show More toggle (top-right red text) */}
        <button
          onClick={() => setShowGameInfo((prev) => !prev)}
          className="absolute top-2 right-3 text-red-700 font-black text-[11px] flex items-center gap-0.5 hover:text-red-800 transition cursor-pointer shrink-0"
        >
          {showGameInfo ? (
            <>
              <span className="text-base leading-none">^</span>
              {language === 'am' ? 'አሳንስ' : 'Show Less'}
            </>
          ) : (
            <>
              <span className="text-base leading-none">v</span>
              {language === 'am' ? 'ተጨማሪ አሳይ' : 'Show More'}
            </>
          )}
        </button>

        {showGameInfo && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Row 1: Pattern hints description */}
            <div className="flex items-center justify-between pr-24">
              <span className="block text-[11px] text-slate-600 leading-tight">
                {isWeekendGame
                  ? (language === 'am' ? 'የሚኒሱ መስመር ያለው 2 ፍሪ የማይነኩ መስመሮች' : '2 free pattern lines in weekend draw')
                  : 'Full House pattern - all 24 numbers'
                }
              </span>
              <button
                onClick={() => setShowPatternHintModal(true)}
                className="shrink-0 w-7 h-7 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center text-amber-600 border border-amber-300 transition cursor-pointer shadow-xs"
                title="Pattern Hints"
              >
                <Lightbulb className="w-3.5 h-3.5 fill-amber-400" />
              </button>
            </div>

            {/* Row 2: ID | Time | Status */}
            <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
              <div className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-500">ID:</span>
                <span className="font-mono font-black text-slate-800">{gameShortId}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">🕒</span>
                <span className="font-bold text-slate-500">{language === 'am' ? 'ሰዓት:' : 'Time:'}</span>
                <span className="font-mono font-black text-slate-800">{currentTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">ⓘ</span>
                <span className="font-bold text-slate-500">{language === 'am' ? 'ሁኔታ:' : 'Status:'}</span>
                <span className={`font-black ${gameStatus === 'Playing' || gameStatus === 'በመጫወት ላይ' ? 'text-emerald-700' : gameStatus === 'Checking' || gameStatus === 'የተጠናቀቀ' ? 'text-green-700' : 'text-amber-700'}`}>
                  {gameStatus}
                </span>
              </div>
            </div>

            {/* Row 3: Price | Games (user's # of cards) | Prize */}
            <div className="flex items-center gap-3 text-[12px] flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-emerald-700">$</span>
                <span className="font-bold text-slate-500">{language === 'am' ? 'ዋጋ:' : 'Price:'}</span>
                <span className="font-black text-slate-900">${currentGame.entryPrice || 10}</span>
              </div>
              <div className="flex items-center gap-1">
                <Grid className="w-3.5 h-3.5 text-blue-700" />
                <span className="font-bold text-slate-500">{language === 'am' ? 'ጨዋታዎች:' : 'Games:'}</span>
                <span className="font-black text-slate-900">{activeGameCards.length || 1}</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-600 fill-amber-500/30" />
                <span className="font-bold text-slate-500">{language === 'am' ? 'ሽልማት:' : 'Prize:'}</span>
                <span className="font-black text-amber-700">${gamePrizeDisplay.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          3. DRAWN NUMBERS (MASTER 75-BALL BOARD - ALWAYS VISIBLE)
             with B-I-N-G-O colored letters and 15 numbers per column
             (matches screenshot 2)
          ================================================================ */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{language === 'am' ? 'የተጠሩ:' : 'Drawn:'}</span>
              <span className="text-[11px] font-black text-slate-900">{currentGame.drawnNumbers.length}</span>
            </div>
            {/* Admin draw button */}
            {isUserAdmin && (
              <button
                onClick={() => drawNextBall(currentGame.id)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-lg transition flex items-center gap-0.5 shadow-xs cursor-pointer"
              >
                <Zap className="w-3 h-3 fill-slate-950" />
                <span>Draw</span>
              </button>
            )}
          </div>
          {currentGame.currentBall && (
            <div className={`px-2.5 py-0.5 rounded-full font-black text-[11px] bg-gradient-to-r ${getLetterColor(getBallLetter(currentGame.currentBall))} shadow-xs ring-2 ring-amber-400/80 flex items-center gap-1`}>
              <span className="text-[9px] italic">{getBallLetter(currentGame.currentBall)}</span>
              <span>{currentGame.currentBall}</span>
            </div>
          )}
        </div>

        {/* B-I-N-G-O 75-Ball grid always inline */}
        <div className="space-y-0.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          {rows.map((row) => (
            <div key={row.letter} className="flex items-center gap-0.5">
              <div className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${row.color} shadow-xs`}>
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
                          ? 'bg-amber-400 text-slate-950 font-black scale-110 shadow-xs ring-1 ring-amber-400'
                          : isDrawn
                          ? `${row.color} font-black shadow-xs`
                          : 'bg-white text-slate-600 border border-slate-200'
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

      {/* ================================================================
          4. BLOCKED CARDS PILL
          ================================================================ */}
      <div className="bg-white border-b border-slate-200 px-3 py-2">
        <button
          onClick={() => setShowBlockedModal(true)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-black transition cursor-pointer w-fit"
          title="Disqualified & Blocked Cards"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>{language === 'am' ? 'የታገዱ ካርዶች:' : 'Blocked:'}</span>
          <span className="px-2.5 py-0.5 rounded-full bg-white border border-rose-300 font-mono text-rose-700 text-sm shadow-xs">
            {(currentGame.blockedCards || []).length || '10'}
          </span>
        </button>
      </div>

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
                  ? `ካርድ #${currentGame.winners[currentGame.winners.length - 1].cardNumber || '108'} (${currentGame.winners[currentGame.winners.length - 1].username}) ${formatETB(currentGame.winners[currentGame.winners.length - 1].prizeWon)} አሸንፏል!`
                  : `Card #${currentGame.winners[currentGame.winners.length - 1].cardNumber || '108'} (${currentGame.winners[currentGame.winners.length - 1].username}) WON ${formatETB(currentGame.winners[currentGame.winners.length - 1].prizeWon)}!`}
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
            <X className="w-3 h-3" />
          </button>
        </div>
      )}


      {/* ================================================================
          6. BINGO CARDS — single full-width card, tabs to switch
          ================================================================ */}
      <div className="p-2 pb-4 bg-slate-100 flex flex-col gap-2">
        {activeGameCards.length > 0 ? (() => {
          // Resolve which card is currently visible
          const visibleCard =
            activeGameCards.find((c) => c.id === selectedCardId) ||
            activeGameCards[0];
          const cardIsWin = checkFullHouseWin(visibleCard.marked);
          const cardIsBlocked = currentGame.blockedCards?.includes(visibleCard.cardNumber);
          const cardDrawnSet = new Set(currentGame.drawnNumbers);
          const cardIsHint = hintCardId === visibleCard.id;

          return (
            <>
              {/* ── Card Tabs (shown only when >1 card) ── */}
              {activeGameCards.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {activeGameCards.map((c) => {
                    const isActive = c.id === visibleCard.id;
                    const isBlk = currentGame.blockedCards?.includes(c.cardNumber);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCardId(c.id)}
                        className={`shrink-0 px-3 py-1 rounded-xl font-black text-[11px] border transition cursor-pointer ${
                          isActive
                            ? isBlk
                              ? 'bg-rose-700 border-rose-500 text-white'
                              : 'bg-blue-600 border-blue-500 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        #{c.cardNumber}
                        {isBlk && <span className="ml-1 text-[9px]">🚫</span>}
                      </button>
                    );
                  })}
                  {activeGameCards.length < 3 && (
                    <button
                      onClick={() => (!user ? openAuthModal('register') : setIsSelectorOpen(true))}
                      className="shrink-0 px-2 py-1 rounded-xl font-black text-[11px] border border-dashed border-emerald-400 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      + Add
                    </button>
                  )}
                </div>
              )}

              {/* ── Full-Width Card ── */}
              <div
                className={`bg-white rounded-2xl overflow-hidden shadow-md border-2 transition-all ${
                  cardIsBlocked
                    ? 'border-rose-400 ring-2 ring-rose-200'
                    : cardIsWin
                    ? 'border-amber-400 ring-2 ring-amber-300 shadow-amber-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Card header: number + full-screen + delete (no bulky dark blue bar) */}
                <div className={`${cardIsBlocked ? 'bg-rose-800 text-white' : 'bg-slate-900 text-white'} flex items-center justify-between px-3 py-1.5`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] opacity-80">📋</span>
                    <span className="font-black font-mono text-base">#{visibleCard.cardNumber}</span>
                    {cardIsBlocked && (
                      <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase">
                        BLOCKED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setExpandCardModal(true)}
                      className="text-white hover:bg-white/20 transition cursor-pointer px-2 py-1 rounded-lg bg-white/10 text-xs font-bold flex items-center gap-1"
                      title="View fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{language === 'am' ? 'ሙሉ ሰሌዳ' : 'Fullscreen'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setCardToDelete({ id: visibleCard.id, cardNumber: visibleCard.cardNumber });
                      }}
                      className="text-rose-300 hover:text-white hover:bg-rose-600 rounded-lg px-2 py-1 transition cursor-pointer text-xs font-bold flex items-center gap-1 bg-rose-500/20"
                      title="Remove this card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{language === 'am' ? 'ሰርዝ' : 'Delete'}</span>
                    </button>
                  </div>
                </div>

                {/* 5x5 NUMBER GRID (no B-I-N-G-O header row — removed to save space) */}
                <div className="grid grid-cols-5 gap-0 bg-slate-50">
                  {visibleCard.numbers.map((row, rIdx) =>
                    row.map((val, cIdx) => {
                      const isFree = rIdx === 2 && cIdx === 2;
                      const isDrawn = !isFree && cardDrawnSet.has(val);
                      const isMarked = visibleCard.marked[rIdx][cIdx];
                      const isCurrent = currentGame.currentBall === val && !isFree;
                      const isHintCell = cardIsHint && patternHint && patternHint[rIdx][cIdx] && !isMarked && !isFree;

                      return (
                        <button
                          key={`${rIdx}-${cIdx}`}
                          onClick={() => !isFree && daubCell(visibleCard.id, rIdx, cIdx)}
                          className={`h-14 sm:h-16 flex items-center justify-center font-bold border border-slate-100 transition-all relative cursor-pointer ${
                            isFree
                              ? 'bg-green-500'
                              : isMarked || isDrawn
                              ? 'bg-red-600 shadow-inner'
                              : isCurrent
                              ? 'bg-amber-300 ring-1 ring-amber-500'
                              : isHintCell
                              ? 'bg-amber-100 ring-1 ring-amber-400 animate-pulse'
                              : 'bg-white hover:bg-slate-100'
                          }`}
                        >
                          {isFree ? (
                            <span className="text-white font-black text-base italic">★</span>
                          ) : (
                            <span className={`font-black text-lg sm:text-xl ${
                              isMarked || isDrawn ? 'text-white' : isCurrent ? 'text-slate-950' : 'text-slate-800'
                            }`}>
                              {val}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* BOTTOM BINGO BUTTON */}
                <button
                  disabled={cardIsBlocked}
                  onClick={() => !cardIsBlocked && handleClaimBingo(visibleCard.id)}
                  className={`w-full py-3 font-black text-base tracking-widest italic transition cursor-pointer ${
                    cardIsBlocked
                      ? 'bg-rose-900 text-rose-300 cursor-not-allowed'
                      : cardIsWin
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 animate-pulse border-t-2 border-amber-300'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500 border-t-2 border-green-700/30'
                  }`}
                >
                  {cardIsBlocked ? '🚫 BLOCKED' : '🎯 BINGO!'}
                </button>
              </div>

              {/* Bottom action bar: Hint | Board | + Card */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLightGameHit(visibleCard)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-xs border border-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 fill-amber-500" />
                  {language === 'am' ? 'ፍንጭ' : 'Hint'}
                </button>
                <button
                  onClick={() => setShowTableModal(true)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs border border-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Grid className="w-3.5 h-3.5 text-blue-600" />
                  {language === 'am' ? 'ሰሌዳ' : 'Board'}
                </button>
                <button
                  onClick={() => (!user ? openAuthModal('register') : setIsSelectorOpen(true))}
                  disabled={activeGameCards.length >= 3}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                    activeGameCards.length >= 3
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-sm'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {language === 'am' ? 'ካርድ' : 'Card'}
                  {activeGameCards.length >= 3 && <span className="text-[10px]">(Max)</span>}
                </button>
              </div>
            </>
          );
        })() : (
          /* No cards yet — empty state */
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 bg-white rounded-2xl border border-slate-200 mx-1 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Hash className="w-8 h-8" />
            </div>
            <div className="space-y-1 px-4">
              <h3 className="text-base font-black text-slate-900">
                {language === 'am' ? 'የቢንጎ ካርድ ይምረጡ' : 'Pick Your Bingo Cards'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {language === 'am'
                  ? 'ለመጫወት ቁጥር ይምረጡ (ከ1-3 ካርዶች) ወይም ፈጣን ቻይን ይጫወቱ'
                  : 'Choose your card numbers (1–3 cards) or play instantly with random cards'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 px-4 w-full max-w-xs mx-auto">
              <button
                onClick={() => (!user ? openAuthModal('register') : setIsSelectorOpen(true))}
                className="flex-1 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'am' ? 'ካርድ ቁጥር ይምረጡ' : 'Pick Card Numbers'}</span>
              </button>
              <button
                onClick={() => (!user ? openAuthModal('register') : joinGame(currentGame.id))}
                className="flex-1 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>{language === 'am' ? 'ፈጣን ጨዋታ' : 'Quick Play'}</span>
              </button>
            </div>
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
        const fsWin = checkFullHouseWin(fsCard.marked);
        const fsDrawnSet = new Set(currentGame.drawnNumbers);
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

            {/* Full-screen 5x5 grid */}
            <div className="flex-1 grid grid-cols-5 gap-0.5 p-1 bg-slate-950">
              {fsCard.numbers.map((row, rIdx) =>
                row.map((val, cIdx) => {
                  const isFree = rIdx === 2 && cIdx === 2;
                  const isDrawn = !isFree && fsDrawnSet.has(val);
                  const isMarked = fsCard.marked[rIdx][cIdx];
                  const isCurrent = currentGame.currentBall === val && !isFree;
                  return (
                    <button
                      key={`fs-${rIdx}-${cIdx}`}
                      onClick={() => !isFree && daubCell(fsCard.id, rIdx, cIdx)}
                      className={`flex items-center justify-center font-bold border border-slate-800/80 transition-all cursor-pointer ${
                        isFree
                          ? 'bg-green-500'
                          : isMarked || isDrawn
                          ? 'bg-red-600'
                          : isCurrent
                          ? 'bg-amber-300'
                          : 'bg-slate-900 hover:bg-slate-850'
                      }`}
                    >
                      {isFree ? (
                        <span className="text-white font-black text-2xl italic">★</span>
                      ) : (
                        <span className={`font-black text-2xl sm:text-3xl ${
                          isMarked || isDrawn ? 'text-white' : isCurrent ? 'text-slate-950' : 'text-slate-100'
                        }`}>
                          {val}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom BINGO button */}
            <button
              disabled={fsBlocked}
              onClick={() => { if (!fsBlocked) { handleClaimBingo(fsCard.id); setExpandCardModal(false); } }}
              className={`w-full py-4 font-black text-xl tracking-widest italic shrink-0 cursor-pointer ${
                fsBlocked
                  ? 'bg-rose-900 text-rose-300 cursor-not-allowed'
                  : fsWin
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 animate-pulse'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-400 hover:to-emerald-500'
              }`}
            >
              {fsBlocked ? '🚫 BLOCKED' : '🎯 BINGO!'}
            </button>
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
                              ? 'bg-amber-400 text-slate-950 font-black scale-110 shadow-xs ring-1 ring-amber-400'
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
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onConfirm={handleConfirmCardNumbers}
        entryPrice={currentGame.entryPrice}
        initialCards={initialCardNumbers}
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
          const drawnNums = new Set(currentGame.drawnNumbers);
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              const num = winningCard.numbers[r][c];
              const isFree = (r === 2 && c === 2);
              if ((winningCard.marked[r][c] || drawnNums.has(num)) && !isFree && num > 0) {
                winningNumbers.push(num);
              }
            }
          }
        }
        winningNumbers.sort((a, b) => a - b);
        return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 border-2 border-amber-400 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white text-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center text-3xl mx-auto shadow-lg ring-4 ring-amber-400/30 animate-bounce">
              🏆
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-black tracking-widest uppercase text-amber-400">
                {language === 'am' ? '🎉 ቢንጎ አሸናፊ ይፋ ሆነ! 🎉' : '🎉 BINGO WINNER ANNOUNCED! 🎉'}
              </h3>
              <p className="text-xl font-black text-white">
                @{latestWinner.username}
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-3 border border-white/15 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'የአሸናፊ ካርድ ቁጥር:' : 'Winning Card #:'}</span>
                <span className="font-mono font-black text-amber-300 text-base">
                  #{latestWinner.cardNumber || '108'}
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
                  #{latestWinner.winningBall || currentGame.currentBall || 75}
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
            </div>

            <button
              onClick={() => setShowWinnerModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs transition cursor-pointer shadow-md"
            >
              {language === 'am' ? 'ተቀበል (Continue)' : 'Awesome! Continue'}
            </button>
          </div>
        </div>
        );
      })()}

      {/* PATTERN HINTS MODAL — 4 Winning Rules */}
      {showPatternHintModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500 fill-amber-100" />
                <h3 className="text-base font-black text-slate-900">
                  {language === 'am' ? 'የአሸናፊ ደንቦች' : 'Winning Rules'}
                </h3>
              </div>
              <button
                onClick={() => setShowPatternHintModal(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="px-4 pb-3 text-xs text-slate-600 leading-relaxed">
              {language === 'am'
                ? 'በዚህ ጨዋታ ውስጥ ለማሸነፍ 4 ደንቦች አሉ። ከእነዚህ መካከል አንዱን ማሳየት ብቻዎ ይኖርዎታል።'
                : 'There are 4 ways to win this round. Match any one pattern to claim Bingo!'}
            </p>

            {/* 4 Winning Rule Patterns */}
            <div className="px-4 pb-4 space-y-3">
              {WINNING_RULES_PATTERNS.map((rule, idx) => (
                <div
                  key={rule.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                    idx === 0 ? 'border-emerald-200 bg-emerald-50'
                    : idx === 1 ? 'border-blue-200 bg-blue-50'
                    : idx === 2 ? 'border-purple-200 bg-purple-50'
                    : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  {/* Mini Pattern Grid */}
                  <div className="shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                    {rule.pattern.map((row, rIdx) => (
                      <div key={rIdx} className="flex">
                        {row.map((filled, cIdx) => {
                          const isFree = rIdx === 2 && cIdx === 2;
                          const gridColor =
                            idx === 0 ? (filled ? 'bg-emerald-400' : 'bg-white')
                            : idx === 1 ? (filled ? 'bg-blue-400' : 'bg-white')
                            : idx === 2 ? (filled ? 'bg-purple-400' : 'bg-white')
                            : (filled ? 'bg-amber-400' : 'bg-white');
                          return (
                            <div
                              key={cIdx}
                              className={`w-4 h-4 border border-slate-100 ${
                                isFree
                                  ? idx === 0 ? 'bg-emerald-200'
                                  : idx === 1 ? 'bg-blue-200'
                                  : idx === 2 ? 'bg-purple-200'
                                  : 'bg-amber-200'
                                  : gridColor
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {/* Rule Text */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-black text-sm ${
                      idx === 0 ? 'text-emerald-800'
                      : idx === 1 ? 'text-blue-800'
                      : idx === 2 ? 'text-purple-800'
                      : 'text-amber-800'
                    }`}>
                      #{idx + 1} · {language === 'am' ? rule.titleAm : rule.title}
                    </div>
                    <div className="text-[10px] font-medium text-slate-600 mt-0.5 leading-snug">
                      {language === 'am' ? rule.subtitleAm : rule.subtitle}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Close button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowPatternHintModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs transition cursor-pointer"
              >
                {language === 'am' ? 'እሺ ተረድቻለሁ' : 'Got it — Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
