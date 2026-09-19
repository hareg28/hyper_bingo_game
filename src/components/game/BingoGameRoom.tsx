'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Trophy, Volume2, VolumeX, Sparkles, Zap, 
  Plus, Star, Hash, Lightbulb, X, Grid, ChevronLeft, Pause, Play
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

  const currentGame = games.find((g) => g.id === gameId) || games[0];
  const activeGameCards = userCards.filter((c) => c.gameId === currentGame.id);
  
  // Active card
  const activeUserCard = 
    activeGameCards.find((c) => c.id === selectedCardId) || 
    activeGameCards[0] || 
    userCards[0];

  const isUserAdmin = Boolean(
    user && (user.role === 'admin' || isAdminTelegramId(user.telegramId) || isAdminTelegramId(user.username))
  );

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

  // 💡 LIGHT SYMBOL GAME HIT
  const handleLightGameHit = (targetCard?: typeof activeGameCards[0]) => {
    const card = targetCard || activeUserCard || activeGameCards[0];
    if (!card) {
      setGameHitFeedback(language === 'am' ? 'እባክዎ መጀመሪያ የቢንጎ ካርድ ይምረጡ!' : 'Please pick or select a bingo card first!');
      setTimeout(() => setGameHitFeedback(null), 3000);
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

    if (targetCard && !checkFullHouseWin(targetCard.marked)) {
      const rem = countRemainingNumbers(targetCard.marked);
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? `ሙሉ ካርቴላ ያስፈልጋል! በካርድ #${targetCard.cardNumber} ላይ ${rem} ቁጥሮች ቀርተዎታል።`
          : `Full House needed! You have ${rem} number${rem > 1 ? 's' : ''} left on #${targetCard.cardNumber}.`
      });
      return;
    }

    playBingoVictoryFanfare();
    const result = claimBingo(targetCard.id);
    setClaimStatus(result);

    if (result.success) {
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#2563eb', '#dc2626', '#f59e0b', '#16a34a', '#9333ea'],
      });
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
              {currentGame.name ? currentGame.name.replace(/^[^\w\s]+/, '').trim() : currentGame.gameType}
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
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">
              {language === 'am' ? 'የቅርብ ጊዜ' : 'Last Calls'}
            </span>
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
            <button
              onClick={() => handleClaimBingo(activeUserCard.id)}
              className={`w-full py-2.5 sm:py-3 px-3 flex items-center justify-between transition-all duration-200 cursor-pointer select-none shrink-0 shadow-md ${
                isFullHouseWin
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 animate-bounce ring-4 ring-amber-300 shadow-xl'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:brightness-95 text-white'
              }`}
              title="Shout BINGO!"
            >
              <span className={`text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-lg shrink-0 ${
                isFullHouseWin ? 'bg-amber-600/30 text-slate-950' : 'bg-white/20 text-white'
              }`}>
                #{activeUserCard.cardNumber}
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black italic tracking-widest drop-shadow-md">
                  ⚡ BINGO! ⚡
                </span>
              </div>

              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                isFullHouseWin ? 'bg-amber-600/30 text-slate-950' : 'bg-white/20 text-white'
              }`}>
                {isFullHouseWin ? 'CLAIM!' : 'WIN'}
              </span>
            </button>
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

      {/* ── ROW 5: RECENT CALLED BALLS STRIP ──────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-xl p-2 shadow-2xs space-y-1 shrink-0">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1 font-bold text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="uppercase tracking-wider font-black text-slate-700">
              {language === 'am' ? 'የተጠሩ ቁጥሮች' : 'Recent Calls'}
            </span>
            <span className="font-mono text-slate-500">({drawnSet.size}/75)</span>
          </div>

          <button
            onClick={() => setShowTableModal(true)}
            className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
          >
            <Grid className="w-3 h-3 text-blue-600" />
            <span>{language === 'am' ? 'ሙሉ ሰሌዳ' : 'View Board'}</span>
          </button>
        </div>

        {/* Horizontal Ticker */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {currentGame.drawnNumbers.length > 0 ? (
            currentGame.drawnNumbers.slice(-8).reverse().map((num, idx) => {
              const letter = getBallLetter(num);
              const letterColor = 
                letter === 'B' ? 'text-blue-600 bg-blue-50 border-blue-200' :
                letter === 'I' ? 'text-red-600 bg-red-50 border-red-200' :
                letter === 'N' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                letter === 'G' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                'text-purple-600 bg-purple-50 border-purple-200';

              return (
                <div
                  key={`${num}-${idx}`}
                  className={`px-2 py-0.5 rounded-lg flex items-center gap-1 font-black text-xs shrink-0 border transition-all ${
                    idx === 0
                      ? 'bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 scale-105 shadow-xs'
                      : `${letterColor} text-slate-800 shadow-2xs`
                  }`}
                >
                  <span className={`text-[8px] font-black italic ${idx === 0 ? 'text-slate-950' : ''}`}>
                    {letter}
                  </span>
                  <span className="font-mono">{num}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[10px] text-slate-400 italic py-0.5">
              {language === 'am' ? 'ጨዋታው ሲጀመር የተጠሩ ኳሶች እዚህ ይመጣሉ...' : 'Balls will appear here as they are drawn...'}
            </div>
          )}
        </div>
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
    </div>
  );
}
