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
    <div className="h-full w-full max-w-sm sm:max-w-md mx-auto flex flex-col justify-between select-none overflow-hidden p-1 sm:p-2 space-y-1">
      {/* ── ROW 1: HEADER WITH ZERO OVERLAP ───────────────────────────── */}
      <div className="bg-white border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs flex items-center justify-between gap-1.5 shrink-0">
        {/* Left: Back button & Game Name */}
        <div className="flex items-center gap-1 min-w-0 shrink">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer shrink-0"
              title="Back to Lobby"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 truncate max-w-[90px] sm:max-w-[130px]">
            {currentGame.name || currentGame.gameType.replace('_', ' ')}
          </span>
          <span className="text-[11px] font-black text-amber-700 shrink-0">
            {formatETB(currentGame.prizePool)}
          </span>
        </div>

        {/* Right: Sound, Auto, Light Hit */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleLightGameHit()}
            className="px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] border border-amber-500 transition shadow-2xs flex items-center gap-0.5 cursor-pointer animate-pulse"
            title="Game Hit / ፍንጭ"
          >
            <Lightbulb className="w-3 h-3 fill-slate-950" />
            <span className="hidden sm:inline">Hit</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          <button
            onClick={toggleAutoDaub}
            className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-0.5 ${
              autoDaubEnabled
                ? 'bg-purple-100 border-purple-300 text-purple-900'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>{autoDaubEnabled ? 'Auto' : 'Off'}</span>
          </button>
        </div>
      </div>

      {/* ── ROW 2: CALLER, PLAYERS & TIMER (NEAT & SPACED) ─────────────── */}
      <div className="bg-white border border-slate-200 px-2 py-1 rounded-xl shadow-2xs flex items-center justify-between gap-1.5 shrink-0">
        {/* Active Ball & Recent Balls */}
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          {currentGame.currentBall ? (
            <div
              className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getLetterColor(
                getBallLetter(currentGame.currentBall)
              )} flex flex-col items-center justify-center shadow-md ring-2 ring-amber-400/50 shrink-0 leading-none`}
            >
              <span className="text-[8px] font-black italic">{getBallLetter(currentGame.currentBall)}</span>
              <span className="text-sm font-black leading-tight">{currentGame.currentBall}</span>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-500 text-[9px] font-black shrink-0">
              {t('ready')}
            </div>
          )}

          {/* Recent Balls */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[100px] sm:max-w-[130px]">
            {currentGame.drawnNumbers.slice(-3).reverse().map((num, idx) => (
              <div
                key={num}
                className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[9px] shrink-0 border ${
                  idx === 0
                    ? 'bg-amber-400 text-slate-950 border-amber-500 scale-105'
                    : 'bg-slate-800 text-white border-slate-700'
                }`}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        {/* Players & Countdown Timer */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-950 font-bold text-[10px]">
            👥 {currentGame.currentPlayers}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-900 font-mono font-black text-[10px]">
            ⏱️ {formatTimeRemaining(secondsRemaining)}
          </span>
        </div>

        {/* Draw & 75# Table Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => drawNextBall(currentGame.id)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-1 rounded-lg transition flex items-center gap-0.5 shadow-2xs cursor-pointer"
          >
            <Zap className="w-3 h-3" />
            <span>Draw</span>
          </button>

          <button
            onClick={() => setIsAutoDrawing(!isAutoDrawing)}
            className={`text-[10px] font-bold p-1 rounded-lg transition border cursor-pointer ${
              isAutoDrawing
                ? 'bg-rose-600 border-rose-600 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
            title="Auto draw"
          >
            {isAutoDrawing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          <button
            onClick={() => setShowTableModal(true)}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer"
            title="75 Board"
          >
            <Grid className="w-3 h-3 text-blue-600" />
            <span className="text-[9px] font-mono">{drawnSet.size}</span>
          </button>
        </div>
      </div>

      {/* ── ROW 3: CARD TABS & DIRECT NUMBER PICKER (ONE SCREEN) ───────── */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {activeGameCards.length > 0 ? (
            activeGameCards.map((c) => {
              const isActive = activeUserCard?.id === c.id;
              const isWin = checkFullHouseWin(c.marked);
              const rem = countRemainingNumbers(c.marked);

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCardId(c.id)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black transition flex items-center gap-1 shadow-2xs cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : isWin
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>#{c.cardNumber}</span>
                  <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
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

        {/* ➕ Direct Pick Number Button — Always visible without scrolling */}
        <button
          onClick={() => {
            if (!user) {
              openAuthModal('register');
            } else {
              setIsSelectorOpen(true);
            }
          }}
          className="px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{language === 'am' ? 'ካርድ ምረጥ' : '+ Pick Number'}</span>
        </button>
      </div>

      {/* ── TOAST ALERTS OVERLAY (AUTO-DISMISS) ─────────────────────────── */}
      {claimStatus && (
        <div className={`px-2.5 py-1 rounded-lg border text-center text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0 animate-in fade-in ${
          claimStatus.success ? 'bg-emerald-100 border-emerald-400 text-emerald-950' : 'bg-amber-100 border-amber-400 text-amber-950'
        }`}>
          <span className="truncate">{claimStatus.message}</span>
          <button onClick={() => setClaimStatus(null)} className="p-0.5 text-slate-700 hover:text-slate-950">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {gameHitFeedback && (
        <div className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-400 text-amber-950 text-xs font-bold shadow-md flex items-center justify-between gap-1.5 shrink-0 animate-bounce">
          <div className="flex items-center gap-1 truncate">
            <Lightbulb className="w-3.5 h-3.5 fill-amber-500 text-amber-900 shrink-0" />
            <span className="truncate">{gameHitFeedback}</span>
          </div>
          <button onClick={() => setGameHitFeedback(null)} className="p-0.5 text-amber-900 shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── ROW 4: PHOTO-ACCURATE BINGO CARD WITH THE BLUE BINGO BUTTON ── */}
      <div className="flex-1 flex flex-col justify-between min-h-0 bg-white rounded-2xl sm:rounded-3xl border-2 border-slate-200/90 shadow-md overflow-hidden relative">
        {activeUserCard ? (
          <>
            {/* CARD TOP: 5 COLORED ROUNDED HEADERS B - I - N - G - O */}
            <div className="p-2 pb-0.5 shrink-0">
              <div className="grid grid-cols-5 gap-1 text-center">
                {[
                  { letter: 'B', bg: 'bg-[#2563eb]' },
                  { letter: 'I', bg: 'bg-[#dc2626]' },
                  { letter: 'N', bg: 'bg-[#f59e0b]' },
                  { letter: 'G', bg: 'bg-[#16a34a]' },
                  { letter: 'O', bg: 'bg-[#9333ea]' },
                ].map((col) => (
                  <div
                    key={col.letter}
                    className={`${col.bg} py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-white font-black italic text-base sm:text-lg shadow-2xs leading-none flex items-center justify-center`}
                  >
                    {col.letter}
                  </div>
                ))}
              </div>
            </div>

            {/* CARD BODY: 5x5 NUMBER TILES (COMPACT SIZED TO NEVER EXCEED SCREEN) */}
            <div className="px-2 py-1 flex-1 flex flex-col justify-around min-h-0">
              <div className="grid grid-cols-5 gap-1 h-full">
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
                        className={`h-full min-h-[34px] sm:min-h-[44px] rounded-lg sm:rounded-xl font-extrabold flex flex-col items-center justify-center text-sm sm:text-lg transition-all duration-100 relative border shadow-2xs cursor-pointer ${
                          isFree
                            ? 'bg-[#10b981] border-[#059669] text-white' // Bright green with blue star exactly like photo!
                            : isMarked
                            ? 'bg-purple-600 text-white border-purple-500 scale-[0.97] font-black'
                            : isHint
                            ? 'bg-amber-100 text-slate-950 border-2 border-amber-400 ring-1 ring-amber-300 animate-pulse'
                            : isJustDrawn
                            ? 'bg-amber-100 text-slate-950 border-2 border-amber-500 animate-pulse'
                            : 'bg-[#f8fafc] text-slate-900 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        {isFree ? (
                          /* Center Blue Star ★ on Green tile */
                          <Star className="w-4 h-4 sm:w-5 sm:h-5 text-[#2563eb] fill-[#2563eb] drop-shadow-2xs" />
                        ) : (
                          <>
                            <span>{val}</span>
                            {isHint && (
                              <span className="absolute top-0.5 right-0.5 text-[7px] leading-none">💡</span>
                            )}
                            {isMarked && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-4 h-4 rounded-full bg-white/20 border border-white/60 animate-ping"></div>
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* CARD BOTTOM: BINGO! BUTTON EXACTLY LIKE THE PICTURE */}
            {/* The card number is in safe inset pill on both corners so it is NEVER cut off */}
            <button
              onClick={() => handleClaimBingo(activeUserCard.id)}
              className={`w-full py-2.5 sm:py-3.5 px-3 flex items-center justify-between transition-all duration-200 cursor-pointer shadow-md select-none shrink-0 ${
                isFullHouseWin
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 animate-bounce ring-4 ring-amber-300'
                  : 'bg-[#2563eb] hover:bg-[#1d4ed8] active:brightness-95 text-white'
              }`}
              title="Shout BINGO!"
            >
              <span className={`text-[11px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-md shrink-0 ${
                isFullHouseWin ? 'bg-amber-600/30 text-slate-950' : 'bg-blue-700/60 text-blue-100'
              }`}>
                #{activeUserCard.cardNumber}
              </span>

              <span className="text-xl sm:text-2xl font-black italic tracking-widest drop-shadow-sm">
                BINGO!
              </span>

              <span className={`text-[11px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-md shrink-0 ${
                isFullHouseWin ? 'bg-amber-600/30 text-slate-950' : 'bg-blue-700/60 text-blue-100'
              }`}>
                #{activeUserCard.cardNumber}
              </span>
            </button>
          </>
        ) : (
          /* When player hasn't picked any card yet: Immediate one-screen pick prompt */
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
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
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-black text-xs uppercase tracking-wider transition shadow-md flex items-center gap-1.5 cursor-pointer"
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
    </div>
  );
}
