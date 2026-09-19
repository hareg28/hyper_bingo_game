'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Trophy, Volume2, VolumeX, Sparkles, CheckCircle2, Play, Pause, Zap, 
  Plus, Ban, Star, Hash, User as UserIcon, Flame, Layers, Lightbulb, AlertTriangle, X 
} from 'lucide-react';
import { 
  formatETB, 
  countCompletedLines, 
  checkLineWin, 
  checkFullHouseWin, 
  countRemainingNumbers,
  playBingoVictoryFanfare 
} from '../../lib/bingoUtils';
import confetti from 'canvas-confetti';
import CardNumberSelector from './CardNumberSelector';

export default function BingoGameRoom({ gameId }: { gameId: string }) {
  const { 
    games, 
    userCards, 
    activeGameId, 
    daubCell, 
    claimBingo, 
    drawNextBall, 
    autoDaubEnabled, 
    toggleAutoDaub,
    joinGame,
    addCardToGame,
    wallet,
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
  const [viewMode, setViewMode] = useState<'ALL' | 'SINGLE'>('ALL');
  const [hintCardId, setHintCardId] = useState<string | null>(null);
  const [patternHint, setPatternHint] = useState<boolean[][]| null>(null); // 5x5 hint overlay
  const [gameHitFeedback, setGameHitFeedback] = useState<string | null>(null);

  const currentGame = games.find((g) => g.id === gameId) || games[0];
  const activeGameCards = userCards.filter((c) => c.gameId === currentGame.id);
  
  // Set default active card if not set
  const activeUserCard = 
    activeGameCards.find((c) => c.id === selectedCardId) || 
    activeGameCards[0] || 
    userCards[0];

  // ── Live Countdown Timer for Time Left to Finish the Game ──
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

  // Auto-dismiss claim alerts after 6 seconds
  useEffect(() => {
    if (claimStatus) {
      const timer = setTimeout(() => {
        setClaimStatus(null);
      }, 6000);
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
      case 'I': return 'from-rose-600 to-rose-500 text-white';
      case 'N': return 'from-amber-500 to-amber-400 text-slate-950';
      case 'G': return 'from-emerald-600 to-emerald-500 text-white';
      case 'O': return 'from-purple-600 to-purple-500 text-white';
      default: return 'from-slate-700 to-slate-600 text-white';
    }
  };

  // Win evaluation across ALL active cards of player (min 2, max 3) - FULL HOUSE ONLY
  const cardsWinData = activeGameCards.map((c) => {
    const hasFullHouse = checkFullHouseWin(c.marked);
    const remaining = countRemainingNumbers(c.marked);
    return {
      card: c,
      remaining,
      hasFullHouse,
      isWinner: hasFullHouse,
    };
  });

  // Pattern Hint Logic: find the row/col/diag with most marks
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

  // 💡 LIGHT SYMBOL GAME HIT:
  // When player presses 💡, it checks if any drawn balls match their card and automatically daubs them!
  // If all drawn balls are already marked, it illuminates the closest winning line/pattern to BINGO!
  const handleLightGameHit = (targetCard?: typeof activeGameCards[0]) => {
    const card = targetCard || activeUserCard || activeGameCards[0];
    if (!card) {
      setGameHitFeedback(language === 'am' ? 'እባክዎ መጀመሪያ የቢንጎ ካርድ ይምረጡ!' : 'Please pick or select a bingo card first!');
      setTimeout(() => setGameHitFeedback(null), 4000);
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

    // Illuminate the pattern hint overlay
    setHintCardId(card.id);
    const hint = computePatternHint(card);
    setPatternHint(hint);

    if (hitCount > 0) {
      playBingoVictoryFanfare();
      setGameHitFeedback(
        language === 'am'
          ? `💡 ፍንጭ (GAME HIT)! ${hitNumbers.length} የወጡ ቁጥሮች (${hitNumbers.join(', ')}) በካርድ #${card.cardNumber} ላይ ተሞልተዋል!`
          : `💡 GAME HIT! ${hitNumbers.length} drawn ball${hitNumbers.length > 1 ? 's' : ''} (${hitNumbers.join(', ')}) hit & daubed on Card #${card.cardNumber}!`
      );
    } else {
      const remaining = countRemainingNumbers(card.marked);
      setGameHitFeedback(
        language === 'am'
          ? `💡 ፍንጭ በርቷል! የወጡ ኳሶች በሙሉ ተሞልተዋል። ለሙሉ ካርቴላ ${remaining} ቁጥሮች ብቻ ቀርተዎታል።`
          : `💡 GAME HIT: All drawn balls daubed! You are only ${remaining} number${remaining > 1 ? 's' : ''} away from BINGO on Card #${card.cardNumber}!`
      );
    }

    setTimeout(() => {
      setGameHitFeedback(null);
    }, 5000);
  };

  const bestWinningItem = cardsWinData.find((cw) => cw.hasFullHouse);
  const isAnyWinning = Boolean(bestWinningItem);

  const handleClaimBingo = (cardId?: string) => {
    if (activeGameCards.length === 0) {
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? 'እባክዎ መጀመሪያ የቢንጎ ካርድ ይምረጡ!'
          : 'Please choose or pick bingo cards first to play and shout Bingo!'
      });
      return;
    }

    const targetCardId = cardId || bestWinningItem?.card.id || activeUserCard?.id;
    const targetCard = activeGameCards.find(c => c.id === targetCardId) || activeGameCards[0];

    if (targetCard && !checkFullHouseWin(targetCard.marked)) {
      const rem = countRemainingNumbers(targetCard.marked);
      setClaimStatus({
        success: false,
        message: language === 'am'
          ? `ቢንጎ ለማለት ሙሉ ካርቴላ ያስፈልጋል! በካርድ #${targetCard.cardNumber} ላይ ${rem} ቁጥሮች ቀርተዎታል።`
          : `Full House required to shout BINGO! You have ${rem} number${rem > 1 ? 's' : ''} left on Card #${targetCard.cardNumber}. Keep marking drawn numbers!`
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
        colors: ['#fbbf24', '#8b5cf6', '#10b981', '#ffffff', '#ec4899'],
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

  // Build 75-Ball Board Data
  const drawnSet = new Set(currentGame.drawnNumbers);
  const rows = [
    { letter: 'B', range: Array.from({ length: 15 }, (_, i) => i + 1), color: 'bg-blue-600 text-white', border: 'border-blue-500' },
    { letter: 'I', range: Array.from({ length: 15 }, (_, i) => i + 16), color: 'bg-rose-600 text-white', border: 'border-rose-500' },
    { letter: 'N', range: Array.from({ length: 15 }, (_, i) => i + 31), color: 'bg-amber-500 text-slate-950', border: 'border-amber-500' },
    { letter: 'G', range: Array.from({ length: 15 }, (_, i) => i + 46), color: 'bg-emerald-600 text-white', border: 'border-emerald-500' },
    { letter: 'O', range: Array.from({ length: 15 }, (_, i) => i + 61), color: 'bg-purple-600 text-white', border: 'border-purple-500' },
  ];

  return (
    <div className="space-y-3 max-w-lg mx-auto pb-16">
      {/* ── TOP GAME ROOM HEADER WITH PLAYERS COUNT & TIME LEFT ─────────── */}
      <div className="bg-white border-2 border-slate-200 p-3.5 rounded-2xl shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                {currentGame.gameType.replace('_', ' ')}
              </span>
              {(currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.isWeekendSpecial) && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-xs">
                  🌟 Weekend Mega
                </span>
              )}
              <span className="text-xs font-bold text-slate-600">{t('prizePool')}:</span>
              <h2 className="text-lg font-black text-amber-700">{formatETB(currentGame.prizePool)}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 💡 Prominent Light Symbol Game Hit Button */}
            <button
              onClick={() => handleLightGameHit()}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs border border-amber-500 shadow-xs transition flex items-center gap-1.5 cursor-pointer animate-pulse"
              title="Light Symbol: Press for Game Hit / የጨዋታ ፍንጭ"
            >
              <Lightbulb className="w-4 h-4 fill-slate-950 text-slate-950" />
              <span>{language === 'am' ? '💡 ፍንጭ' : '💡 Game Hit'}</span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
              title="Toggle Ball Sound"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Auto daub toggle */}
            <button
              onClick={toggleAutoDaub}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition cursor-pointer ${
                autoDaubEnabled
                  ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              {autoDaubEnabled ? 'Auto' : 'Off'}
            </button>
          </div>
        </div>

        {/* 👥 LIVE PLAYERS COUNT & ⏱️ TIME LEFT TO FINISH THE GAME */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          {/* Number of Players */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>👥 <strong>{currentGame.currentPlayers}</strong> {language === 'am' ? 'ተጫዋቾች' : 'Players'}</span>
              {currentGame.minPlayers && (
                <span className="text-[10px] text-blue-600 font-medium">(min {currentGame.minPlayers})</span>
              )}
            </span>
          </div>

          {/* Time Left to Finish the Game */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 font-mono font-black shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>⏱️ {secondsRemaining > 0 ? `${formatTimeRemaining(secondsRemaining)} Left` : 'FINISHING'}</span>
              <span className="text-[10px] text-rose-700 font-bold hidden sm:inline">({language === 'am' ? 'የቀረ ጊዜ' : 'Time Left'})</span>
            </span>
          </div>
        </div>
      </div>

      {/* 💡 GAME HIT FEEDBACK ALERT NOTIFICATION ────────────────────────── */}
      {gameHitFeedback && (
        <div className="p-3 rounded-2xl bg-amber-100 border-2 border-amber-400 text-amber-950 text-xs font-black shadow-md flex items-center justify-between gap-2 animate-bounce">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 fill-amber-500 text-amber-900 shrink-0" />
            <span>{gameHitFeedback}</span>
          </div>
          <button onClick={() => setGameHitFeedback(null)} className="p-1 text-amber-800 hover:text-amber-950 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 75-BALL BOARD & MASTER TABLE (ALWAYS VISIBLE & OPEN) ─────────── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 text-center shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 font-black font-mono">
              {drawnSet.size} / 75 {t('drawn')}
            </span>
            <span className="font-bold text-slate-900">
              {language === 'am' ? 'የቢንጎ ሰንጠረዥ (75 ኳሶች)' : '75-Ball Master Table'}
            </span>
          </div>
          <span className="text-slate-900 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
            {t('ball')} #{currentGame.drawnNumbers.length} / 75
          </span>
        </div>

        {/* Big Active Ball & Recent Drawn Row */}
        <div className="flex items-center justify-center gap-4 my-1">
          {currentGame.currentBall ? (
            <div className="relative">
              <div
                className={`w-16 h-16 rounded-full bg-gradient-to-tr ${getLetterColor(
                  getBallLetter(currentGame.currentBall)
                )} flex flex-col items-center justify-center shadow-lg ball-active-anim ring-4 ring-amber-400/40`}
              >
                <span className="text-[11px] font-black tracking-widest opacity-90 leading-none">
                  {getBallLetter(currentGame.currentBall)}
                </span>
                <span className="text-2xl font-black leading-tight">{currentGame.currentBall}</span>
              </div>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-600 text-xs font-bold">
              {t('ready')}
            </div>
          )}

          {/* Quick Recent Balls Trail */}
          {currentGame.drawnNumbers.length > 0 && (
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                {language === 'am' ? 'የቅርብ ኳሶች:' : 'Recent Balls:'}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] no-scrollbar">
                {currentGame.drawnNumbers.slice(-5).reverse().map((num, idx) => (
                  <div
                    key={num}
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 border shadow-xs ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300 scale-105'
                        : 'bg-slate-800 text-white border-slate-700'
                    }`}
                  >
                    {num}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* THE COMPLETE 75-BALL TABLE (B, I, N, G, O) */}
        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          {rows.map((row) => (
            <div key={row.letter} className="flex items-center gap-1">
              {/* Column Letter Badge */}
              <div className={`w-7 h-6 rounded-md flex items-center justify-center font-black text-xs shrink-0 ${row.color} shadow-xs`}>
                {row.letter}
              </div>

              {/* 15 Numbers in Column */}
              <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                {row.range.map((num) => {
                  const isDrawn = drawnSet.has(num);
                  const isCurrent = currentGame.currentBall === num;

                  return (
                    <div
                      key={num}
                      className={`h-6 rounded text-[10px] font-bold flex items-center justify-center transition-all ${
                        isCurrent
                          ? 'bg-amber-400 text-slate-950 font-black scale-110 shadow-md ring-2 ring-amber-400 z-10'
                          : isDrawn
                          ? `${row.color} shadow-xs font-black`
                          : 'bg-white text-slate-800 border border-slate-200 font-semibold'
                      }`}
                      title={`Ball ${num} ${isDrawn ? '(Drawn)' : ''}`}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Draw & Auto Draw Controls */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-center gap-2">
          <button
            onClick={() => drawNextBall(currentGame.id)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" /> {t('drawBall')}
          </button>

          <button
            onClick={() => setIsAutoDrawing(!isAutoDrawing)}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 border cursor-pointer ${
              isAutoDrawing
                ? 'bg-rose-600 border-rose-600 text-white animate-pulse shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            {isAutoDrawing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isAutoDrawing ? t('pauseAuto') : t('autoDraw')}
          </button>
        </div>
      </div>

      {/* ── BINGO CARD NUMBERS STATUS BAR (Cards, Blocked, Winners) ──────── */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
        {/* Row 1: Bingo Cards */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t('bingoCards')}:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {activeGameCards.length > 0 ? (
              activeGameCards.map((card) => {
                const isActive = activeUserCard?.id === card.id;
                const isFull = checkFullHouseWin(card.marked);
                const rem = countRemainingNumbers(card.marked);

                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setViewMode('SINGLE');
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-black transition flex items-center gap-1 shadow-xs cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 scale-105'
                        : isFull
                        ? 'bg-amber-400 text-slate-950 font-black animate-pulse'
                        : 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    #{card.cardNumber}
                    {isFull ? ' 🏆' : rem <= 2 ? ` (${rem})` : ''}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>}
                  </button>
                );
              })
            ) : (
              <span className="text-xs text-slate-500 italic">{t('noCardsChosen')}</span>
            )}

            {/* Button to Choose Card Numbers */}
            <button
              onClick={() => {
                if (!user) {
                  openAuthModal('register');
                } else {
                  setIsSelectorOpen(true);
                }
              }}
              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {t('pickCards')}
            </button>
          </div>
        </div>

        {/* Row 2: Blocked */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Ban className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{t('blocked')}:</span>
          </div>

          <div className="flex items-center gap-1.5">
            {(currentGame.blockedCards || ['200']).map((blkNum) => (
              <span
                key={blkNum}
                className="px-2.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-mono font-bold text-xs"
              >
                {blkNum}
              </span>
            ))}
          </div>
        </div>

        {/* Row 3: Winners */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{t('winners')}:</span>
          </div>

          <div className="flex items-center gap-1.5">
            {activeGameCards.some((c) => checkFullHouseWin(c.marked)) ? (
              activeGameCards.filter((c) => checkFullHouseWin(c.marked)).map((c) => (
                <span
                  key={c.id}
                  className="px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-mono font-black text-xs flex items-center gap-1 shadow-xs animate-pulse"
                >
                  <Star className="w-3 h-3 fill-slate-950" />
                  #{c.cardNumber} (FULL HOUSE)
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">{t('noneYet')} (Full House to Win)</span>
            )}
          </div>
        </div>
      </div>

      {/* ── 🚨 ALWAYS-VISIBLE PROMINENT BINGO CALLER BUTTON 🚨 ──────────── */}
      {/* Any player can press this when they finish first to register their win */}
      <div className={`p-1 rounded-2xl shadow-md transition-all duration-300 ${
        isAnyWinning || isFullHouseWin
          ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 ring-4 ring-amber-400/50 animate-pulse'
          : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500'
      }`}>
        <button
          onClick={() => handleClaimBingo()}
          className={`w-full py-4 px-4 rounded-xl font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-sm transform active:scale-95 transition cursor-pointer ${
            isAnyWinning || isFullHouseWin
              ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 animate-bounce'
              : 'bg-slate-950 hover:bg-slate-900 text-amber-300 border border-amber-400/40'
          }`}
        >
          <Flame className={`w-6 h-6 ${isAnyWinning || isFullHouseWin ? 'text-red-600 animate-bounce' : 'text-amber-400'}`} />
          <span>
            {isAnyWinning || isFullHouseWin
              ? (language === 'am' ? '🎉 ቢንጎ በል! ሙሉ ካርቴላ ሞልቷል (BINGO!)' : '🎉 SHOUT BINGO! FULL HOUSE READY!')
              : (language === 'am' ? '🏆 ቢንጎ በል! (ቀድመው ከጨረሱ ይጫኑ)' : '🏆 SHOUT BINGO! (PRESS IF YOU FINISH FIRST)')}
          </span>
          <Trophy className={`w-6 h-6 ${isAnyWinning || isFullHouseWin ? 'text-amber-950 animate-bounce' : 'text-amber-400'}`} />
        </button>
      </div>

      {/* ── CLAIM RESULT / FEEDBACK ALERT (BOTH SUCCESS & INCOMPLETE) ───── */}
      {claimStatus && (
        <div className={`p-3.5 rounded-2xl border text-center space-y-1.5 animate-fade-in shadow-md relative ${
          claimStatus.success
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <button
            onClick={() => setClaimStatus(null)}
            className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-center gap-1.5 font-black text-sm">
            {claimStatus.success ? (
              <>
                <Sparkles className="w-5 h-5 text-emerald-600 animate-spin" />
                <span className="text-emerald-900">{t('winnerConfirmed')}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="text-amber-900">{language === 'am' ? 'ቢንጎ ገና አልሞላም!' : 'Bingo Not Completed Yet!'}</span>
              </>
            )}
          </div>
          <p className="text-xs font-semibold">{claimStatus.message}</p>
          {claimStatus.prize && (
            <p className="text-xs text-emerald-800 font-mono font-black">
              +{claimStatus.prize} {t('creditedToWallet')}
            </p>
          )}
        </div>
      )}

      {/* ── VIEW MODE SWITCHER (MULTI-CARD VS SINGLE CARD) ─────────────── */}
      {activeGameCards.length > 1 && (
        <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-slate-900">
              {language === 'am' ? `የእርስዎ ${activeGameCards.length} ካርዶች` : `Multiple Cards (${activeGameCards.length})`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                viewMode === 'ALL'
                  ? 'bg-slate-950 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {language === 'am' ? `ሁሉንም አሳይ (${activeGameCards.length})` : `All ${activeGameCards.length} Cards`}
            </button>
            <button
              onClick={() => setViewMode('SINGLE')}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                viewMode === 'SINGLE'
                  ? 'bg-slate-950 text-white font-black shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {language === 'am' ? 'አንድ ካርድ' : 'Single Card'}
            </button>
          </div>
        </div>
      )}

      {/* ── BINGO CARDS DISPLAY ─────────────────────────────────────────── */}
      {viewMode === 'ALL' && activeGameCards.length > 1 ? (
        <div className="space-y-4">
          {activeGameCards.map((card, cardIndex) => {
            const fullHouseWin = checkFullHouseWin(card.marked);
            const rem = countRemainingNumbers(card.marked);

            return (
              <div 
                key={card.id} 
                className={`bg-white p-4 rounded-2xl shadow-xs space-y-3 transition-all border-2 ${
                  fullHouseWin 
                    ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/20' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs">
                      {t('card')} #{card.cardNumber}
                    </span>
                    <span className="text-[11px] text-slate-600 font-semibold">
                      Card {cardIndex + 1} of {activeGameCards.length}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      fullHouseWin
                        ? 'bg-amber-400 text-slate-950 border-amber-500 font-black animate-pulse'
                        : rem <= 2
                        ? 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse'
                        : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                    }`}>
                      {fullHouseWin ? '🏆 FULL HOUSE!' : rem === 1 ? '🔥 1 TO GO!' : `${rem} TO FULL HOUSE`}
                    </span>

                    {/* 💡 Light Symbol Game Hit Button on Card */}
                    <button
                      type="button"
                      onClick={() => handleLightGameHit(card)}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border border-amber-500 shadow-xs hover:brightness-105 active:scale-95"
                      title="Light Symbol: Press for Game Hit"
                    >
                      <Lightbulb className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                      <span>{language === 'am' ? '💡 ፍንጭ' : '💡 Hit'}</span>
                    </button>
                  </div>

                  {/* Individual Card BINGO Button */}
                  <button
                    onClick={() => handleClaimBingo(card.id)}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      fullHouseWin
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 animate-bounce ring-2 ring-amber-300'
                        : 'bg-slate-950 hover:bg-slate-800 text-amber-300 border border-amber-400/40'
                    }`}
                    title={fullHouseWin ? 'Claim Bingo Win!' : `Shout Bingo (${rem} to go)`}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>{fullHouseWin ? '🎉 BINGO!' : (language === 'am' ? 'ቢንጎ በል!' : 'SHOUT BINGO!')}</span>
                  </button>
                </div>

                {/* B-I-N-G-O Headers */}
                <div className="grid grid-cols-5 gap-1.5 text-center font-black text-xs sm:text-sm">
                  {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
                    <div
                      key={l}
                      className={`py-1 rounded-lg text-white font-black shadow-xs ${
                        i === 0
                          ? 'bg-blue-600'
                          : i === 1
                          ? 'bg-rose-600'
                          : i === 2
                          ? 'bg-amber-500 text-slate-950'
                          : i === 3
                          ? 'bg-emerald-600'
                          : 'bg-purple-600'
                      }`}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* 5x5 Matrix Grid */}
                <div className="grid grid-cols-5 gap-1.5">
                  {card.numbers.map((row, rIdx) =>
                    row.map((val, cIdx) => {
                      const isFree = rIdx === 2 && cIdx === 2;
                      const isMarked = card.marked[rIdx][cIdx];
                      const isJustDrawn = currentGame.currentBall === val;
                      const isHint = hintCardId === card.id && patternHint && patternHint[rIdx][cIdx] && !isMarked && !isFree;

                      return (
                        <button
                          key={`${rIdx}-${cIdx}`}
                          onClick={() => !isFree && daubCell(card.id, rIdx, cIdx)}
                          className={`aspect-square rounded-xl font-black flex flex-col items-center justify-center text-xs sm:text-sm transition-all duration-200 relative overflow-hidden border-2 shadow-xs ${
                            isFree
                              ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 border-amber-500'
                              : isMarked
                              ? 'bg-purple-600 text-white border-purple-500 shadow-purple-900/30 scale-[0.98]'
                              : isHint
                              ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 ring-2 ring-amber-300 animate-pulse'
                              : isJustDrawn
                              ? 'bg-amber-100 text-amber-950 border-2 border-amber-500 animate-pulse'
                              : 'bg-white text-slate-950 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          {isFree ? (
                            <div className="flex flex-col items-center">
                              <Star className="w-3.5 h-3.5 text-slate-950 fill-slate-950 mb-0.5" />
                              <span className="text-[9px] uppercase tracking-tighter font-black">{t('free')}</span>
                            </div>
                          ) : (
                            <>
                              <span>{val}</span>
                              {isHint && (
                                <span className="absolute top-0.5 right-0.5 text-[8px] leading-none">💡</span>
                              )}
                              {isMarked && (
                                <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                                  <div className="w-5 h-5 rounded-full bg-white/20 border border-white/60 animate-ping"></div>
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
            );
          })}
        </div>
      ) : activeUserCard ? (
        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs">
                {t('card')} #{activeUserCard.cardNumber}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isFullHouseWin
                  ? 'bg-amber-400 text-slate-950 border-amber-500 font-black animate-pulse'
                  : remainingCount <= 2
                  ? 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse'
                  : 'bg-emerald-100 border-emerald-300 text-emerald-900'
              }`}>
                {isFullHouseWin ? '🏆 FULL HOUSE!' : remainingCount === 1 ? '🔥 1 TO GO!' : `${remainingCount} TO FULL HOUSE`}
              </span>

              {/* 💡 Light Symbol Game Hit Button on Card */}
              <button
                type="button"
                onClick={() => handleLightGameHit(activeUserCard)}
                className="px-2.5 py-0.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border border-amber-500 shadow-xs hover:brightness-105 active:scale-95"
                title="Light Symbol: Press for Game Hit"
              >
                <Lightbulb className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                <span>{language === 'am' ? '💡 ፍንጭ' : '💡 Hit'}</span>
              </button>
            </div>

            {/* Quick Card Pill Switcher */}
            {activeGameCards.length > 1 && (
              <div className="flex items-center gap-1">
                {activeGameCards.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCardId(c.id)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition ${
                      activeUserCard.id === c.id
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    #{c.cardNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* B-I-N-G-O Headers */}
          <div className="grid grid-cols-5 gap-1.5 text-center font-black text-xs sm:text-sm">
            {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
              <div
                key={l}
                className={`py-1.5 rounded-lg text-white font-black shadow-xs ${
                  i === 0
                    ? 'bg-blue-600'
                    : i === 1
                    ? 'bg-rose-600'
                    : i === 2
                    ? 'bg-amber-500 text-slate-950'
                    : i === 3
                    ? 'bg-emerald-600'
                    : 'bg-purple-600'
                }`}
              >
                {l}
              </div>
            ))}
          </div>

          {/* 5x5 Matrix */}
          <div className="grid grid-cols-5 gap-1.5">
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
                    className={`aspect-square rounded-xl font-black flex flex-col items-center justify-center text-xs sm:text-sm transition-all duration-200 relative overflow-hidden border-2 shadow-xs ${
                      isFree
                        ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 border-amber-500'
                        : isMarked
                        ? 'bg-purple-600 text-white border-purple-500 shadow-purple-900/30 scale-[0.98]'
                        : isHint
                        ? 'bg-amber-100 text-amber-950 border-2 border-amber-400 ring-2 ring-amber-300 animate-pulse'
                        : isJustDrawn
                        ? 'bg-amber-100 text-amber-950 border-2 border-amber-500 animate-pulse'
                        : 'bg-white text-slate-950 hover:bg-slate-100 border-slate-300'
                    }`}
                  >
                    {isFree ? (
                      <div className="flex flex-col items-center">
                        <Star className="w-3.5 h-3.5 text-slate-950 fill-slate-950 mb-0.5" />
                        <span className="text-[9px] uppercase tracking-tighter font-black">{t('free')}</span>
                      </div>
                    ) : (
                      <>
                        <span>{val}</span>
                        {isHint && (
                          <span className="absolute top-0.5 right-0.5 text-[8px] leading-none">💡</span>
                        )}
                        {isMarked && (
                          <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-white/20 border border-white/60 animate-ping"></div>
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Direct BINGO Button at bottom of card */}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <button
              onClick={() => handleClaimBingo(activeUserCard.id)}
              className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                isFullHouseWin
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-110 animate-bounce ring-2 ring-amber-300'
                  : 'bg-slate-950 hover:bg-slate-900 text-amber-300 border border-amber-400/40'
              }`}
            >
              <Trophy className={`w-5 h-5 ${isFullHouseWin ? 'text-slate-950' : 'text-amber-400'}`} />
              {isFullHouseWin 
                ? (language === 'am' ? '🎉 ቢንጎ በል! ሙሉ ካርቴላ ሞልቷል' : '🎉 SHOUT BINGO! FULL HOUSE') 
                : (language === 'am' ? `🎉 ቢንጎ በል! (${remainingCount} ቁጥሮች ቀርተዋል)` : `🎉 SHOUT BINGO! (${remainingCount} to Full House)`)}
            </button>
          </div>
        </div>
      ) : !user ? (
        /* Guest Open Account Prompt Card */
        <div className="bg-white border-2 border-amber-300 p-6 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-700">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900">
              {language === 'am' ? 'የቢንጎ ካርድ ለመምረጥ አካውንት ይክፈቱ' : 'Open an Account to Choose Cards & Play'}
            </h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              {language === 'am'
                ? 'በ75-ኳስ የቢንጎ ውድድር ለመሳተፍ እና ያሸነፉትን በቴሌብር እና ሲቢኢ ለማውጣት በስልክ ቁጥርዎ ይመዝገቡ።'
                : 'Register your Ethiopian phone number to pick cards, enter live draws, and withdraw real ETB cash prizes.'}
            </p>
          </div>

          <button
            onClick={() => openAuthModal('register')}
            className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:brightness-105 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{language === 'am' ? 'አካውንት ክፈት (20 ብር ቦነስ)' : 'Open Account (20 ETB Bonus)'}</span>
          </button>
        </div>
      ) : (
        /* Choose Cards Prompt */
        <div className="bg-white border-2 border-slate-200 p-6 rounded-2xl text-center space-y-4 shadow-xs">
          <Hash className="w-12 h-12 text-amber-600 mx-auto" />
          <div>
            <h3 className="text-base font-black text-slate-900">{t('chooseCardNumbersAndJoin')}</h3>
            <p className="text-xs text-slate-600 mt-1">
              {t('chooseCardNumbersDesc')}
            </p>
          </div>

          <button
            onClick={() => setIsSelectorOpen(true)}
            className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:brightness-105 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Hash className="w-4 h-4" /> {t('chooseCardNumbersBtn')}
          </button>
        </div>
      )}

      {/* Card Selector Modal */}
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
