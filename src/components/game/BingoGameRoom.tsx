'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Volume2, VolumeX, Sparkles, Zap, 
  Plus, Star, Hash, Lightbulb, X, Grid, ChevronLeft,
  Undo2, Redo2, Settings, Menu, ShieldAlert, Trophy
} from 'lucide-react';
import { 
  formatETB, 
  checkFullHouseWin, 
  countRemainingNumbers,
  playBingoVictoryFanfare 
} from '../../lib/bingoUtils';
import confetti from 'canvas-confetti';
import CardNumberSelector from './CardNumberSelector';
import { isAdminTelegramId } from '../../lib/authUtils';

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
  const [hintCardId, setHintCardId] = useState<string | null>(null);
  const [patternHint, setPatternHint] = useState<boolean[][] | null>(null);
  const [gameHitFeedback, setGameHitFeedback] = useState<string | null>(null);
  const [showMoreNumbers, setShowMoreNumbers] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showPatternHintModal, setShowPatternHintModal] = useState(false);

  const currentGame = games.find((g) => g.id === gameId) || games[0];
  const activeGameCards = userCards.filter((c) => c.gameId === currentGame.id);
  const isWeekendGame = currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.isWeekendSpecial;
  
  // Active card
  const activeUserCard = 
    activeGameCards.find((c) => c.id === selectedCardId) || 
    activeGameCards[0] || 
    userCards[0];

  const isUserAdmin = Boolean(
    user && (user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

  // Live clock for weekend header
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

    // Check pattern completeness - FULL HOUSE ONLY
    const isFullHouse = checkFullHouseWin(targetCard.marked);

    if (!isFullHouse) {
      // FALSE BINGO -> BLOCK THE PLAYER & CARD
      playErrorBuzzer();
      const rem = countRemainingNumbers(targetCard.marked);
      const result = claimBingo(targetCard.id); // This adds card to blockedCards in context
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? `🚫 ታግደዋል! ካርድ #${targetCard.cardNumber} ሳያጠናቅቁ ቢንጎ ስላሉ ታግደዋል። (${rem} ቁጥሮች ቀርተዋል)`
          : `🚫 BLOCKED! Card #${targetCard.cardNumber} disqualified for false Bingo claim without completing full card (${rem} numbers left).`
      });
      return;
    }

    // VALID FULL HOUSE BINGO WIN!
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
  const remainingCount = activeUserCard ? countRemainingNumbers(activeUserCard.marked) : 24;

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
  };

  // 75-Ball rows for popup board
  const drawnSet = new Set(currentGame.drawnNumbers);
  const rows = [
    { letter: 'B', range: Array.from({ length: 15 }, (_, i) => i + 1), color: 'bg-blue-600 text-white' },
    { letter: 'I', range: Array.from({ length: 15 }, (_, i) => i + 16), color: 'bg-red-600 text-white' },
    { letter: 'N', range: Array.from({ length: 15 }, (_, i) => i + 31), color: 'bg-amber-400 text-slate-950' },
    { letter: 'G', range: Array.from({ length: 15 }, (_, i) => i + 46), color: 'bg-emerald-600 text-white' },
    { letter: 'O', range: Array.from({ length: 15 }, (_, i) => i + 61), color: 'bg-purple-600 text-white' },
  ];

  // ─────────────────────────────────────────────────────────────
  // WEEKEND GAME LAYOUT
  // ─────────────────────────────────────────────────────────────
  if (isWeekendGame) {
    return (
      <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col select-none overflow-hidden" style={{ minHeight: '100%' }}>

        {/* ── WEEKEND HEADER: Simple bar — time + BINGO + icons ── */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 px-3 py-2.5 flex items-center justify-between shrink-0 shadow-md">
          {/* Left: Back + time + BINGO */}
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-lg leading-none tracking-tight">
                {currentTime}
              </span>
              <span className="text-white font-black text-xl leading-none tracking-widest italic ml-1">
                BINGO
              </span>
            </div>
          </div>

          {/* Right: icon actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleLightGameHit()}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Hint / Auto-daub"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={toggleAutoDaub}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer ${
                autoDaubEnabled ? 'bg-amber-400 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Auto Daub"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Sound"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowTableModal(true)}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="75-Ball Board"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              title="Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── WEEKEND DRAWN NUMBERS RIBBON ── */}
        <div className="bg-white border-b border-slate-200 px-3 py-2 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Drawn:</span>
                <span className="text-[10px] font-black text-slate-900">{currentGame.drawnNumbers.length}/75</span>
              </div>
              {/* Blocked Players Counter */}
              <button
                onClick={() => setShowBlockedModal(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 text-[10px] font-black transition cursor-pointer"
                title="Disqualified & Blocked Players"
              >
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                <span>{(currentGame.blockedCards || []).length} {language === 'am' ? 'የታገዱ' : 'Blocked'}</span>
              </button>
            </div>

            {/* Current ball badge */}
            {currentGame.currentBall && (
              <div className={`px-2.5 py-0.5 rounded-full font-black text-xs bg-gradient-to-r ${getLetterColor(getBallLetter(currentGame.currentBall))} shadow-xs ring-2 ring-amber-400/80 flex items-center gap-1`}>
                <span className="text-[9px] italic">{getBallLetter(currentGame.currentBall)}</span>
                <span>{currentGame.currentBall}</span>
              </div>
            )}

            {/* Admin draw button */}
            {isUserAdmin && (
              <button
                onClick={() => drawNextBall(currentGame.id)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] px-2 py-1 rounded-xl transition flex items-center gap-0.5 shadow-xs cursor-pointer"
              >
                <Zap className="w-3 h-3 fill-slate-950" />
                <span>Draw</span>
              </button>
            )}
          </div>

          {/* 75-ball mini grid — B I N G O rows */}
          <div className="space-y-0.5">
            {rows.map((row) => (
              <div key={row.letter} className="flex items-center gap-0.5">
                <div className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center shrink-0 ${row.color}`}>
                  {row.letter}
                </div>
                <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                  {row.range.map((num) => {
                    const isDrawn = drawnSet.has(num);
                    const isCurrent = currentGame.currentBall === num;
                    return (
                      <div
                        key={num}
                        className={`h-4 rounded text-[8px] font-bold flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-950 font-black scale-110 shadow-xs ring-1 ring-amber-400'
                            : isDrawn
                            ? `${row.color} font-black`
                            : 'bg-slate-100 text-slate-500'
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

        {/* ── WINNER ANNOUNCEMENT BANNER ── */}
        {currentGame.winners && currentGame.winners.length > 0 && (
          <div className="mx-2 mt-2 p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-md border-2 border-yellow-200 flex items-center justify-between gap-2 shrink-0 animate-in slide-in-from-top-2 duration-300">
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
                <div className="text-[9px] font-bold text-slate-800 leading-tight mt-0.5">
                  {language === 'am'
                    ? `ያሸነፈበት ኳስ: #${currentGame.winners[currentGame.winners.length - 1].winningBall || currentGame.currentBall || 75}`
                    : `Winning Ball: #${currentGame.winners[currentGame.winners.length - 1].winningBall || currentGame.currentBall || 75}`}
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

        {/* ── TOAST ALERTS ── */}
        {claimStatus && (
          <div className={`mx-2 mt-2 px-2.5 py-1 rounded-xl border text-center text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0 animate-in fade-in ${
            claimStatus.success ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-amber-100 border-amber-400 text-amber-950'
          }`}>
            <span className="truncate">{claimStatus.message}</span>
            <button onClick={() => setClaimStatus(null)} className="p-0.5 text-slate-700 hover:text-slate-950">
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
            <button onClick={() => setGameHitFeedback(null)} className="p-0.5 text-amber-900 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── WEEKEND BINGO CARDS — all shown simultaneously ── */}
        <div className="flex-1 overflow-y-auto p-2 pb-20">
          {activeGameCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {activeGameCards.map((card) => {
                const cardIsWin = checkFullHouseWin(card.marked);
                const cardIsBlocked = currentGame.blockedCards?.includes(card.cardNumber);
                const cardDrawnSet = new Set(currentGame.drawnNumbers);

                return (
                  <div
                    key={card.id}
                    className={`bg-white rounded-2xl overflow-hidden shadow-md border-2 transition-all ${
                      cardIsBlocked
                        ? 'border-rose-400 ring-2 ring-rose-200'
                        : cardIsWin
                        ? 'border-amber-400 ring-2 ring-amber-300 shadow-amber-200'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* "Bingo" button header above card */}
                    <button
                      disabled={cardIsBlocked}
                      onClick={() => !cardIsBlocked && handleClaimBingo(card.id)}
                      className={`w-full py-1.5 font-black text-sm tracking-widest italic transition ${
                        cardIsBlocked
                          ? 'bg-rose-950 text-rose-300 cursor-not-allowed opacity-90'
                          : cardIsWin
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 animate-pulse cursor-pointer'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 cursor-pointer'
                      }`}
                    >
                      {cardIsBlocked ? '🚫 BLOCKED' : cardIsWin ? '🏆 BINGO!' : 'Bingo'}
                    </button>

                    {/* B I N G O header row */}
                    <div className="grid grid-cols-5 gap-0">
                      {[
                        { letter: 'B', bg: 'bg-blue-600' },
                        { letter: 'I', bg: 'bg-red-600' },
                        { letter: 'N', bg: 'bg-amber-400' },
                        { letter: 'G', bg: 'bg-emerald-600' },
                        { letter: 'O', bg: 'bg-orange-500' },
                      ].map((col) => (
                        <div
                          key={col.letter}
                          className={`${col.bg} h-6 flex items-center justify-center font-black text-white text-xs italic leading-none`}
                        >
                          {col.letter}
                        </div>
                      ))}
                    </div>

                    {/* 5x5 Number grid */}
                    <div className="grid grid-cols-5 gap-0 bg-white">
                      {card.numbers.map((row, rIdx) =>
                        row.map((val, cIdx) => {
                          const isFree = rIdx === 2 && cIdx === 2;
                          const isDrawn = !isFree && cardDrawnSet.has(val);
                          const isMarked = card.marked[rIdx][cIdx];
                          const isCurrent = currentGame.currentBall === val && !isFree;

                          return (
                            <button
                              key={`${rIdx}-${cIdx}`}
                              onClick={() => !isFree && daubCell(card.id, rIdx, cIdx)}
                              className={`h-9 flex items-center justify-center font-bold text-xs border border-slate-100 transition-all cursor-pointer relative ${
                                isFree
                                  ? 'bg-emerald-500'
                                  : isMarked || isDrawn
                                  ? 'bg-red-600'
                                  : isCurrent
                                  ? 'bg-amber-300'
                                  : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              {isFree ? (
                                <span className="text-white font-black text-[10px] italic">F</span>
                              ) : (
                                <span className={`font-black text-xs ${
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

                    {/* Card number footer bar */}
                    <div className={`${cardIsBlocked ? 'bg-rose-800' : 'bg-blue-600'} flex items-center justify-between px-2 py-1`}>
                      <div className="flex items-center gap-1">
                        <span className="text-white text-[10px]">📋</span>
                        <span className="text-white font-black font-mono text-xs">{card.cardNumber}</span>
                        {cardIsBlocked && (
                          <span className="ml-1 text-[9px] font-black bg-white text-rose-700 px-1 rounded uppercase">
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <button
                        className="text-white/70 hover:text-white transition cursor-pointer"
                        title="Remove card"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add card placeholder slot (if < 3 cards) */}
              {activeGameCards.length < 3 && (
                <button
                  onClick={() => {
                    if (!user) {
                      openAuthModal('register');
                    } else {
                      setIsSelectorOpen(true);
                    }
                  }}
                  className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 py-8 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition cursor-pointer min-h-[200px]"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-bold text-center px-3">
                    {language === 'am' ? 'ካርድ ቁጥር ምረጥ' : 'Add Card'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            /* No cards yet — empty state */
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                <Hash className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  {language === 'am' ? 'የቢንጎ ካርድ ይምረጡ' : 'Pick Your Bingo Cards'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs">
                  {language === 'am'
                    ? 'ለዊክኤንድ ጨዋታ ቁጥር ይምረጡ (ከ1-3 ካርዶች)'
                    : 'Choose your card numbers to join the Weekend Lottery (1–3 cards)'}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!user) {
                    openAuthModal('register');
                  } else {
                    setIsSelectorOpen(true);
                  }
                }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'am' ? 'ካርድ ቁጥር ይምረጡ' : 'Pick Card Numbers'}</span>
              </button>
            </div>
          )}
        </div>

        {/* ── WEEKEND BOTTOM ACTION BAR ── */}
        {activeGameCards.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 max-w-sm sm:max-w-md mx-auto bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2 z-30 shadow-lg">
            <button
              onClick={() => {
                if (!user) {
                  openAuthModal('register');
                } else {
                  setIsSelectorOpen(true);
                }
              }}
              disabled={activeGameCards.length >= 3}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeGameCards.length >= 3
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-sm'
              }`}
            >
              <Plus className="w-4 h-4" />
              {language === 'am' ? 'ካርድ ምረጥ' : '+ Pick Card'}
              {activeGameCards.length >= 3 && <span className="text-[10px]">(Max)</span>}
            </button>

            <button
              onClick={() => handleLightGameHit()}
              className="px-3 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-xs border border-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 fill-amber-500" />
              Hint
            </button>

            <button
              onClick={() => setShowTableModal(true)}
              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs border border-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5 text-blue-600" />
              Board
            </button>
          </div>
        )}

        {/* ── 75-BALL POPUP MODAL ── */}
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
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${row.color}`}>
                      {row.letter}
                    </div>
                    <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                      {row.range.map((num) => {
                        const isDrawn = drawnSet.has(num);
                        const isCurrent = currentGame.currentBall === num;
                        return (
                          <div
                            key={num}
                            className={`h-4 rounded text-[8px] font-bold flex items-center justify-center transition-all ${
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

        {/* ── CARD SELECTOR MODAL ── */}
        <CardNumberSelector
          isOpen={isSelectorOpen}
          onClose={() => setIsSelectorOpen(false)}
          onConfirm={handleConfirmCardNumbers}
          entryPrice={currentGame.entryPrice}
          initialCards={activeGameCards.map((c) => c.cardNumber)}
        />

        {/* ── PATTERN HINTS MODAL ── */}
        {showPatternHintModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <Lightbulb className="w-5 h-5 text-blue-500 fill-blue-100" />
                <h3 className="text-base font-black text-slate-900">Pattern hints</h3>
              </div>

              {/* Description */}
              <p className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">
                Correct (green) and wrong (red) bingo patterns for the game &ldquo;{currentGame.name || `⚡ Hyper ${currentGame.entryPrice}`}&rdquo;.
              </p>

              {/* 3 Pattern Grids */}
              <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                {/* Grid 1: Correct (full diagonal top-left to bottom-right) */}
                {[
                  { label: 'Correct', isCorrect: true, pattern: [
                    [true, false, false, false, false],
                    [false, true, false, false, false],
                    [false, false, true, false, false],
                    [false, false, false, true, false],
                    [false, false, false, false, true],
                  ]},
                  { label: 'Correct', isCorrect: true, pattern: [
                    [true, true, true, true, true],
                    [false, false, false, false, false],
                    [false, false, true, false, false],
                    [false, false, false, false, false],
                    [false, false, false, false, false],
                  ]},
                  { label: 'Wrong', isCorrect: false, pattern: [
                    [false, false, true, true, false],
                    [false, true, false, false, true],
                    [false, false, true, false, false],
                    [false, true, false, false, true],
                    [false, false, true, true, false],
                  ]},
                ].map((grid, gIdx) => (
                  <div key={gIdx} className="flex flex-col items-center gap-1">
                    <span className={`text-[11px] font-black ${grid.isCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {grid.label}
                    </span>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      {grid.pattern.map((row, rIdx) => (
                        <div key={rIdx} className="flex">
                          {row.map((filled, cIdx) => {
                            const isFreeCell = rIdx === 2 && cIdx === 2;
                            return (
                              <div
                                key={cIdx}
                                className={`w-7 h-7 border border-slate-100 flex items-center justify-center text-[8px] font-black ${
                                  isFreeCell
                                    ? grid.isCorrect
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-rose-100 text-rose-400'
                                    : filled
                                    ? grid.isCorrect
                                      ? 'bg-emerald-400'
                                      : 'bg-rose-300'
                                    : 'bg-white'
                                }`}
                              >
                                {isFreeCell ? 'FREE' : ''}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Close button */}
              <div className="flex justify-end px-5 pb-5">
                <button
                  onClick={() => setShowPatternHintModal(false)}
                  className="text-blue-600 font-black text-sm hover:text-blue-800 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // REGULAR (NON-WEEKEND) GAME LAYOUT — unchanged
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col justify-start select-none overflow-hidden p-1 space-y-1.5">
      {/* ── ROW 1: SLEEK UNIFIED TOP BAR ──────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-2.5 py-1.5 rounded-2xl shadow-xs flex items-center justify-between gap-1.5 shrink-0">
        {/* Left: Back Arrow + Game Name + Jackpot Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              title="Back to Lobby"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-black text-slate-900 truncate">
              {currentGame.name || `⚡ Hyper ${currentGame.entryPrice}`}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[10px] shadow-2xs whitespace-nowrap">
              🏆 {formatETB(currentGame.prizePool)}
            </span>
          </div>
        </div>

        {/* Right: Hint, Auto, Sound */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleLightGameHit()}
            className="px-2 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-[10px] border border-amber-300 transition flex items-center gap-1 cursor-pointer"
            title="Hint / ፍንጭ"
          >
            <Lightbulb className="w-3 h-3 fill-amber-500 text-amber-600" />
            <span>Hint</span>
          </button>

          <button
            onClick={toggleAutoDaub}
            className={`px-2 py-1 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 ${
              autoDaubEnabled
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Auto Daub"
          >
            <Sparkles className="w-3 h-3" />
            <span>{autoDaubEnabled ? 'Auto' : 'Off'}</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* ── ROW 2: 3D CASINO CALLER RIBBON ────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 rounded-2xl p-2 text-white shadow-md flex items-center justify-between gap-2 shrink-0 border border-slate-800">
        {/* Left: 3D Glowing Bingo Ball + Recent Balls */}
        <div className="flex items-center gap-2 min-w-0">
          {currentGame.currentBall ? (
            <div className="relative shrink-0">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getLetterColor(
                  getBallLetter(currentGame.currentBall)
                )} flex flex-col items-center justify-center shadow-lg ring-2 ring-amber-400/90 leading-none`}
              >
                <span className="text-[8px] font-black italic tracking-widest leading-none">
                  {getBallLetter(currentGame.currentBall)}
                </span>
                <span className="text-sm font-black leading-tight">
                  {currentGame.currentBall}
                </span>
              </div>
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-[8px] font-black text-center leading-tight shrink-0">
              READY
            </div>
          )}

          {/* Last calls strip */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 leading-none mb-1">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'am' ? 'የቅርብ ጊዜ' : 'Last Calls'}
              </span>
              {currentGame.drawnNumbers.length > 3 && (
                <button
                  onClick={() => setShowMoreNumbers(!showMoreNumbers)}
                  className="text-[8px] font-black text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  {showMoreNumbers ? (language === 'am' ? 'አሳንስ ▲' : 'Show Less ▲') : (language === 'am' ? `ተጨማሪ (+${currentGame.drawnNumbers.length - 3}) ▼` : `+${currentGame.drawnNumbers.length - 3} More ▼`)}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-hidden">
              {currentGame.drawnNumbers.length > 0 ? (
                currentGame.drawnNumbers.slice(-3).reverse().map((num, idx) => (
                  <span
                    key={num}
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black shrink-0 ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {getBallLetter(num)}-{num}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-500 italic">Waiting for draw...</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Live stats + Optional Admin Draw tool */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-end leading-none">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {currentGame.currentPlayers}
              </span>
              <button
                onClick={() => setShowBlockedModal(true)}
                className="flex items-center gap-0.5 text-[10px] text-rose-300 font-bold bg-rose-950/70 border border-rose-800/80 px-1.5 py-0.5 rounded-md hover:bg-rose-900/80 transition cursor-pointer"
                title="Disqualified & Blocked Players"
              >
                <ShieldAlert className="w-2.5 h-2.5 text-rose-400" />
                <span>{(currentGame.blockedCards || []).length} {language === 'am' ? 'የታገዱ' : 'Blocked'}</span>
              </button>
              <span className="text-[10px] text-rose-300 font-mono font-black bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded-md">
                ⏱️ {formatTimeRemaining(secondsRemaining)}
              </span>
            </div>
            <button
              onClick={() => setShowTableModal(true)}
              className="text-[9px] text-amber-300 hover:text-amber-200 font-bold flex items-center gap-0.5 mt-1 cursor-pointer"
            >
              <Grid className="w-2.5 h-2.5 text-amber-400" />
              <span>{drawnSet.size}/75 Board</span>
            </button>
          </div>

          {/* Draw Button only visible to Administrators */}
          {isUserAdmin && (
            <button
              onClick={() => drawNextBall(currentGame.id)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] px-2 py-1 rounded-xl transition flex items-center gap-0.5 shadow-xs cursor-pointer ml-1"
              title="Admin Host Draw"
            >
              <Zap className="w-3 h-3 fill-slate-950" />
              <span>Draw</span>
            </button>
          )}
        </div>
      </div>

      {/* ── EXPANDED NUMBER DISPLAY (SHOW MORE / SHOW LESS TRAY) ───────── */}
      {showMoreNumbers && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 text-white shadow-xl space-y-1.5 shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              {language === 'am' ? 'ሁሉም የተጠሩ ቁጥሮች' : 'All Drawn Numbers'} ({currentGame.drawnNumbers.length}/75)
            </span>
            <button
              onClick={() => setShowMoreNumbers(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded-md bg-slate-800 cursor-pointer"
            >
              {language === 'am' ? 'አሳንስ (Show Less) ▲' : 'Show Less ▲'}
            </button>
          </div>

          {/* All called numbers tape */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {currentGame.drawnNumbers.slice().reverse().map((num, idx) => {
              const letter = getBallLetter(num);
              const letterColor = 
                letter === 'B' ? 'text-blue-400 border-blue-800/80 bg-blue-950/60' :
                letter === 'I' ? 'text-red-400 border-red-800/80 bg-red-950/60' :
                letter === 'N' ? 'text-amber-400 border-amber-800/80 bg-amber-950/60' :
                letter === 'G' ? 'text-emerald-400 border-emerald-800/80 bg-emerald-950/60' :
                'text-purple-400 border-purple-800/80 bg-purple-950/60';

              return (
                <div
                  key={`${num}-${idx}`}
                  className={`px-2 py-1 rounded-xl flex items-center gap-1 font-mono font-black text-xs shrink-0 border shadow-xs ${
                    idx === 0
                      ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300/80 scale-105'
                      : `${letterColor}`
                  }`}
                >
                  <span className={`text-[8px] italic font-black ${idx === 0 ? 'text-slate-950' : ''}`}>
                    {letter}
                  </span>
                  <span>{num}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ROW 3: POLISHED CARD TABS ─────────────────────────────────── */}
      <div className="flex items-center justify-between px-0.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {activeGameCards.length > 0 ? (
            activeGameCards.map((c) => {
              const isActive = activeUserCard?.id === c.id;
              const isWin = checkFullHouseWin(c.marked);
              const rem = countRemainingNumbers(c.marked);

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCardId(c.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black transition-all flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm ring-2 ring-blue-400/70 scale-105'
                      : isWin
                      ? 'bg-amber-400 text-slate-950 animate-bounce'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>#{c.cardNumber}</span>
                  <span className={`text-[10px] px-1 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isWin ? '🏆' : `(${rem})`}
                  </span>
                </button>
              );
            })
          ) : (
            <span className="text-xs text-slate-600 font-bold italic">
              {language === 'am' ? 'ካርድ ይምረጡ:' : 'Pick a card:'}
            </span>
          )}
        </div>

        {/* Pick Card Button */}
        <button
          onClick={() => {
            if (!user) {
              openAuthModal('register');
            } else {
              setIsSelectorOpen(true);
            }
          }}
          className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{language === 'am' ? 'ካርድ ምረጥ' : '+ Pick Card'}</span>
        </button>
      </div>

      {/* ── TOAST ALERTS OVERLAY (AUTO-DISMISS) ─────────────────────────── */}
      {claimStatus && (
        <div className={`px-2.5 py-1 rounded-xl border text-center text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0 animate-in fade-in ${
          claimStatus.success ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-amber-100 border-amber-400 text-amber-950'
        }`}>
          <span className="truncate">{claimStatus.message}</span>
          <button onClick={() => setClaimStatus(null)} className="p-0.5 text-slate-700 hover:text-slate-950">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {gameHitFeedback && (
        <div className="px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0 animate-bounce">
          <div className="flex items-center gap-1 truncate">
            <Lightbulb className="w-3.5 h-3.5 fill-amber-500 text-amber-900 shrink-0" />
            <span className="truncate">{gameHitFeedback}</span>
          </div>
          <button onClick={() => setGameHitFeedback(null)} className="p-0.5 text-amber-900 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── ROW 4: ATTRACTIVE CASINO-STYLE BINGO CARD ──────────────────── */}
      <div className="w-full bg-white rounded-2xl border-2 border-indigo-100/80 shadow-md overflow-hidden shrink-0 flex flex-col">
        {activeUserCard ? (
          <>
            {/* CARD TOP: 5 GLOSSY CAPSULE HEADERS B - I - N - G - O */}
            <div className="px-1.5 pt-1.5 pb-1 shrink-0 bg-slate-50/60">
              <div className="grid grid-cols-5 gap-1 text-center">
                {[
                  { letter: 'B', bg: 'bg-gradient-to-b from-blue-500 to-blue-700' },
                  { letter: 'I', bg: 'bg-gradient-to-b from-rose-500 to-red-700' },
                  { letter: 'N', bg: 'bg-gradient-to-b from-amber-400 to-amber-600' },
                  { letter: 'G', bg: 'bg-gradient-to-b from-emerald-500 to-emerald-700' },
                  { letter: 'O', bg: 'bg-gradient-to-b from-purple-500 to-purple-700' },
                ].map((col) => (
                  <div
                    key={col.letter}
                    className={`${col.bg} h-7 sm:h-8 rounded-xl text-white font-black italic text-xs sm:text-sm shadow-xs leading-none flex items-center justify-center`}
                  >
                    {col.letter}
                  </div>
                ))}
              </div>
            </div>

            {/* CARD BODY: 5x5 NUMBER TILES (VIBRANT CASINO STAMPS) */}
            <div className="px-1.5 pb-1.5 shrink-0">
              <div className="grid grid-cols-5 gap-1">
                {activeUserCard.numbers.map((row, rIdx) =>
                  row.map((val, cIdx) => {
                    const isFree = rIdx === 2 && cIdx === 2;
                    const isMarked = activeUserCard.marked[rIdx][cIdx];
                    const isJustDrawn = currentGame.currentBall === val;
                    const isHint = hintCardId === activeUserCard.id && patternHint && patternHint[rIdx][cIdx] && !isMarked && !isFree;

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => !isFree && daubCell(activeUserCard.id, rIdx, cIdx)}
                        className={`h-9 sm:h-10 rounded-xl font-black flex flex-col items-center justify-center text-sm sm:text-base transition-all duration-150 relative border cursor-pointer select-none ${
                          isFree
                            ? 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 border-emerald-500 text-white shadow-xs'
                            : isMarked
                            ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white border-purple-400/60 shadow-inner ring-2 ring-purple-300/80 scale-[0.98]'
                            : isHint
                            ? 'bg-gradient-to-br from-amber-200 to-yellow-300 text-slate-950 border-2 border-amber-500 ring-2 ring-amber-300 animate-pulse shadow-xs'
                            : isJustDrawn
                            ? 'bg-gradient-to-br from-amber-300 to-yellow-400 text-slate-950 border-2 border-amber-500 ring-2 ring-amber-300 animate-pulse shadow-xs'
                            : 'bg-gradient-to-b from-white to-slate-50 text-slate-800 hover:bg-white hover:border-slate-300 border-slate-200/90 shadow-2xs'
                        }`}
                      >
                        {isFree ? (
                          /* Center Lucky Star */
                          <div className="flex flex-col items-center justify-center leading-none">
                            <Star className="w-4 h-4 text-amber-300 fill-amber-300 drop-shadow-xs" />
                            <span className="text-[7px] font-black uppercase tracking-wider text-emerald-100 mt-0.5">FREE</span>
                          </div>
                        ) : (
                          <>
                            <span className={isMarked ? 'drop-shadow-xs' : ''}>{val}</span>
                            {isHint && (
                              <span className="absolute top-0.5 right-0.5 text-[7px] leading-none">💡</span>
                            )}
                            {isMarked && (
                              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-xs"></div>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* CARD BOTTOM: JUICY CASINO JACKPOT BINGO BUTTON */}
            {(() => {
              const cardIsBlocked = activeUserCard ? currentGame.blockedCards?.includes(activeUserCard.cardNumber) : false;

              return (
                <button
                  disabled={cardIsBlocked}
                  onClick={() => !cardIsBlocked && handleClaimBingo(activeUserCard.id)}
                  className={`w-full py-2.5 sm:py-3 px-3 flex items-center justify-between transition-all duration-200 select-none shrink-0 shadow-md ${
                    cardIsBlocked
                      ? 'bg-rose-950 text-rose-300 cursor-not-allowed opacity-90'
                      : isFullHouseWin
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 animate-bounce ring-4 ring-amber-300 shadow-xl cursor-pointer'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:brightness-95 text-white cursor-pointer'
                  }`}
                  title={cardIsBlocked ? 'Card is Blocked' : 'Shout BINGO!'}
                >
                  <span className={`text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-lg shrink-0 ${
                    cardIsBlocked ? 'bg-rose-900 text-rose-200' : isFullHouseWin ? 'bg-amber-600/30 text-slate-950' : 'bg-white/20 text-white'
                  }`}>
                    #{activeUserCard.cardNumber}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xl sm:text-2xl font-black italic tracking-widest drop-shadow-md">
                      {cardIsBlocked ? '🚫 BLOCKED' : '⚡ BINGO! ⚡'}
                    </span>
                  </div>

                  <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                    cardIsBlocked ? 'bg-rose-900 text-rose-200' : isFullHouseWin ? 'bg-amber-600/30 text-slate-950' : 'bg-white/20 text-white'
                  }`}>
                    {cardIsBlocked ? (language === 'am' ? 'የታገደ' : 'BLOCKED') : isFullHouseWin ? 'CLAIM!' : 'WIN'}
                  </span>
                </button>
              );
            })()}
          </>
        ) : (
          /* When player hasn't picked any card yet */
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Hash className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">
                {language === 'am' ? 'የቢንጎ ካርድ ይምረጡ' : 'Select Your Bingo Card'}
              </h3>
              <p className="text-xs text-slate-600 max-w-xs">
                {language === 'am'
                  ? 'ለመጫወት የካርድ ቁጥር ይምረጡ (ከ1-3 ካርዶች ይፈቀዳሉ)'
                  : 'Choose card numbers to enter the game (1-3 cards allowed)'}
              </p>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  openAuthModal('register');
                } else {
                  setIsSelectorOpen(true);
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'am' ? 'ካርድ ቁጥር ይምረጡ' : '+ Pick Bingo Cards'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 75-BALL MASTER TABLE POPUP MODAL (OPTIONAL TOGGLE) ──────────── */}
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

            {/* 75-Ball Board Grid */}
            <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
              {rows.map((row) => (
                <div key={row.letter} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${row.color}`}>
                    {row.letter}
                  </div>
                  <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                    {row.range.map((num) => {
                      const isDrawn = drawnSet.has(num);
                      const isCurrent = currentGame.currentBall === num;

                      return (
                        <div
                          key={num}
                          className={`h-4 rounded text-[8px] font-bold flex items-center justify-center transition-all ${
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

      {/* ── CARD SELECTOR MODAL ────────────────────────────────────────── */}
      <CardNumberSelector
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        onConfirm={handleConfirmCardNumbers}
        entryPrice={currentGame.entryPrice}
        initialCards={activeGameCards.map((c) => c.cardNumber)}
      />

      {/* ── BLOCKED PLAYERS MODAL ──────────────────────────────────────── */}
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
                    {language === 'am' ? 'የታገዱ ተጫዋቾች' : 'Disqualified & Blocked Players'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {language === 'am' ? 'ያለ ሙሉ ካርቴላ ቢንጎ ያሉ ተጫዋቾች' : 'Disqualified for false Bingo claims'}
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
                  {language === 'am' ? 'በዚህ ዙር የታገደ ተጫዋች የለም' : 'No players blocked in this round.'}
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

      {/* ── WINNER CELEBRATION MODAL ───────────────────────────────────── */}
      {showWinnerModal && currentGame.winners && currentGame.winners.length > 0 && (
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
                @{currentGame.winners[currentGame.winners.length - 1].username}
              </p>
            </div>

            <div className="bg-white/10 rounded-2xl p-3 border border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'የአሸናፊ ካርድ ቁጥር:' : 'Winning Card #:'}</span>
                <span className="font-mono font-black text-amber-300 text-base">
                  #{currentGame.winners[currentGame.winners.length - 1].cardNumber || '108'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'የተሸለመው ገንዘብ:' : 'Prize Won:'}</span>
                <span className="font-black text-emerald-400 text-base">
                  {formatETB(currentGame.winners[currentGame.winners.length - 1].prizeWon)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-bold">{language === 'am' ? 'ያሸነፈበት ኳስ:' : 'Winning Ball:'}</span>
                <span className="font-black text-amber-400 text-sm">
                  #{currentGame.winners[currentGame.winners.length - 1].winningBall || currentGame.currentBall || 75}
                </span>
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
      )}

      {/* ── PATTERN HINTS MODAL ────────────────────────────────────────── */}
      {showPatternHintModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <Lightbulb className="w-5 h-5 text-blue-500 fill-blue-100" />
              <h3 className="text-base font-black text-slate-900">Pattern hints</h3>
            </div>

            {/* Description */}
            <p className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">
              Correct (green) and wrong (red) bingo patterns for the game &ldquo;{currentGame.name || `⚡ Hyper ${currentGame.entryPrice}`}&rdquo;.
            </p>

            {/* 3 Pattern Grids */}
            <div className="px-4 pb-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Correct', isCorrect: true, pattern: [
                  [true, false, false, false, false],
                  [false, true, false, false, false],
                  [false, false, true, false, false],
                  [false, false, false, true, false],
                  [false, false, false, false, true],
                ]},
                { label: 'Correct', isCorrect: true, pattern: [
                  [true, true, true, true, true],
                  [false, false, false, false, false],
                  [false, false, true, false, false],
                  [false, false, false, false, false],
                  [false, false, false, false, false],
                ]},
                { label: 'Wrong', isCorrect: false, pattern: [
                  [false, false, true, true, false],
                  [false, true, false, false, true],
                  [false, false, true, false, false],
                  [false, true, false, false, true],
                  [false, false, true, true, false],
                ]},
              ].map((grid, gIdx) => (
                <div key={gIdx} className="flex flex-col items-center gap-1">
                  <span className={`text-[11px] font-black ${grid.isCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {grid.label}
                  </span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {grid.pattern.map((row, rIdx) => (
                      <div key={rIdx} className="flex">
                        {row.map((filled, cIdx) => {
                          const isFreeCell = rIdx === 2 && cIdx === 2;
                          return (
                            <div
                              key={cIdx}
                              className={`w-7 h-7 border border-slate-100 flex items-center justify-center text-[8px] font-black ${
                                isFreeCell
                                  ? grid.isCorrect
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-400'
                                  : filled
                                  ? grid.isCorrect
                                    ? 'bg-emerald-400'
                                    : 'bg-rose-300'
                                  : 'bg-white'
                              }`}
                            >
                              {isFreeCell ? 'FREE' : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Close button */}
            <div className="flex justify-end px-5 pb-5">
              <button
                onClick={() => setShowPatternHintModal(false)}
                className="text-blue-600 font-black text-sm hover:text-blue-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
