'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  Trophy, Volume2, VolumeX, Sparkles, CheckCircle2, Play, Pause, Zap, 
  Plus, Ban, Star, Hash, User as UserIcon, Flame, Layers 
} from 'lucide-react';
import { 
  formatETB, 
  countCompletedLines, 
  checkLineWin, 
  checkFullHouseWin, 
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
  const [viewMode, setViewMode] = useState<'ALL' | 'SINGLE'>('SINGLE');
  const [showFullBoard, setShowFullBoard] = useState(false);

  const currentGame = games.find((g) => g.id === gameId) || games[0];
  const activeGameCards = userCards.filter((c) => c.gameId === currentGame.id);
  
  // Set default active card if not set
  const activeUserCard = 
    activeGameCards.find((c) => c.id === selectedCardId) || 
    activeGameCards[0] || 
    userCards[0];

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
      case 'B': return 'from-blue-600 to-blue-400 text-white';
      case 'I': return 'from-purple-600 to-purple-400 text-white';
      case 'N': return 'from-amber-500 to-amber-300 text-slate-950';
      case 'G': return 'from-emerald-600 to-emerald-400 text-white';
      case 'O': return 'from-rose-600 to-rose-400 text-white';
      default: return 'from-slate-600 to-slate-400 text-white';
    }
  };

  // Win evaluation across ALL active cards of player (min 2, max 3)
  const cardsWinData = activeGameCards.map((c) => {
    const lines = countCompletedLines(c.marked);
    const hasLine = checkLineWin(c.marked);
    const hasFullHouse = checkFullHouseWin(c.marked);
    return {
      card: c,
      lines,
      hasLine,
      hasFullHouse,
      isWinner: hasLine || hasFullHouse,
    };
  });

  const bestWinningItem = 
    cardsWinData.find((cw) => cw.hasFullHouse) || 
    cardsWinData.find((cw) => cw.hasLine);
  const isAnyWinning = Boolean(bestWinningItem);

  const handleClaimBingo = (cardId?: string) => {
    const targetCardId = cardId || bestWinningItem?.card.id || activeUserCard?.id;
    if (!targetCardId) return;

    playBingoVictoryFanfare();
    const result = claimBingo(targetCardId);
    setClaimStatus(result);

    if (result.success) {
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#fbbf24', '#8b5cf6', '#10b981', '#ffffff', '#ec4899'],
      });
    }
  };

  const lineCount = activeUserCard ? countCompletedLines(activeUserCard.marked) : 0;
  const isLineWin = activeUserCard ? checkLineWin(activeUserCard.marked) : false;
  const isFullHouseWin = activeUserCard ? checkFullHouseWin(activeUserCard.marked) : false;

  const handleConfirmCardNumbers = (selectedCardNumbers: string[]) => {
    if (!user) {
      openAuthModal('register');
      return;
    }
    if (activeGameCards.length === 0) {
      // Join game with selected card numbers
      joinGame(currentGame.id, selectedCardNumbers);
    } else {
      // Add missing cards
      const existingNums = activeGameCards.map((c) => c.cardNumber);
      const newNums = selectedCardNumbers.filter((n) => !existingNums.includes(n));
      newNums.forEach((num) => addCardToGame(currentGame.id, num));
    }
  };

  // Build 75-Ball Board Data
  const drawnSet = new Set(currentGame.drawnNumbers);
  const rows = [
    { letter: 'B', range: Array.from({ length: 15 }, (_, i) => i + 1), color: 'bg-blue-600 text-white', border: 'border-blue-500 text-blue-400 bg-blue-950/40' },
    { letter: 'I', range: Array.from({ length: 15 }, (_, i) => i + 16), color: 'bg-rose-600 text-white', border: 'border-rose-500 text-rose-400 bg-rose-950/40' },
    { letter: 'N', range: Array.from({ length: 15 }, (_, i) => i + 31), color: 'bg-emerald-600 text-white', border: 'border-emerald-500 text-emerald-400 bg-emerald-950/40' },
    { letter: 'G', range: Array.from({ length: 15 }, (_, i) => i + 46), color: 'bg-purple-600 text-white', border: 'border-purple-500 text-purple-400 bg-purple-950/40' },
    { letter: 'O', range: Array.from({ length: 15 }, (_, i) => i + 61), color: 'bg-orange-600 text-white', border: 'border-orange-500 text-orange-400 bg-orange-950/40' },
  ];

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Top Game Room Header */}
      <div className="glass-panel p-3.5 rounded-2xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {currentGame.gameType.replace('_', ' ')}
            </span>
            {(currentGame.gameType === 'WEEKEND_LOTTERY' || currentGame.isWeekendSpecial) && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow">
                🌟 Weekend Mega Lottery
              </span>
            )}
            <span className="text-xs text-slate-400">{t('prizePool')}</span>
          </div>
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <h2 className="text-lg font-black text-amber-400">{formatETB(currentGame.prizePool)}</h2>
            {currentGame.minPlayers && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300">
                👥 {currentGame.currentPlayers}/{currentGame.minPlayers} {language === 'am' ? 'ተጫዋቾች' : 'min players'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700 transition"
            title="Toggle Ball Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Auto daub toggle */}
          <button
            onClick={toggleAutoDaub}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
              autoDaubEnabled
                ? 'bg-purple-900/60 border-purple-500/50 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {autoDaubEnabled ? t('autoDaubOn') : t('autoDaubOff')}
          </button>
        </div>
      </div>

      {/* Relaxed, Modern Number Tray */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 shadow-xl relative overflow-hidden space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-slate-300">
            {t('ball')} #{currentGame.drawnNumbers.length} / 75
          </span>
          <span className="text-[10px] text-slate-400">
            {currentGame.drawInterval}s draw interval
          </span>
        </div>

        {/* Center: Glowing Current Ball & Recent 4 Balls Stream */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5">
            {/* Active Big Ball */}
            {currentGame.currentBall ? (
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${getLetterColor(
                  getBallLetter(currentGame.currentBall)
                )} flex flex-col items-center justify-center shadow-xl ball-active-anim border-2 border-white/20 shrink-0`}
              >
                <span className="text-[9px] font-black tracking-widest opacity-90 leading-none">
                  {getBallLetter(currentGame.currentBall)}
                </span>
                <span className="text-xl font-black leading-tight">{currentGame.currentBall}</span>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                {t('ready')}
              </div>
            )}

            {/* Stream of Recent Balls */}
            <div className="space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recent Balls</span>
              <div className="flex items-center gap-1.5">
                {currentGame.drawnNumbers.slice(-4).reverse().map((b, idx) => (
                  <div
                    key={idx}
                    className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 flex flex-col items-center justify-center text-[10px] font-bold text-slate-200 shadow-sm"
                  >
                    <span className="text-[7px] font-bold text-amber-400 leading-none">{getBallLetter(b)}</span>
                    <span className="leading-tight">{b}</span>
                  </div>
                ))}
                {currentGame.drawnNumbers.length === 0 && (
                  <span className="text-[10px] text-slate-500 italic">Waiting to draw...</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => drawNextBall(currentGame.id)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] px-3 py-1 rounded-xl transition flex items-center justify-center gap-1 shadow"
            >
              <Zap className="w-3 h-3" /> Draw
            </button>
            <button
              onClick={() => setIsAutoDrawing(!isAutoDrawing)}
              className={`text-[11px] font-bold px-3 py-1 rounded-xl transition flex items-center justify-center gap-1 border ${
                isAutoDrawing
                  ? 'bg-rose-900/80 border-rose-500/60 text-rose-200 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isAutoDrawing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isAutoDrawing ? 'Pause' : 'Auto'}
            </button>
          </div>
        </div>

        {/* Board Toggle Button */}
        <div className="pt-1.5 border-t border-slate-800/70 flex items-center justify-between">
          <button
            onClick={() => setShowFullBoard(!showFullBoard)}
            className="text-[11px] font-bold text-slate-400 hover:text-amber-300 flex items-center gap-1 transition"
          >
            <span>{showFullBoard ? '▲ Hide 75-Ball Board' : `▼ 📊 Show All 75 Balls (${currentGame.drawnNumbers.length}/75)`}</span>
          </button>
          <span className="text-[10px] text-slate-500">Tap cells to mark</span>
        </div>

        {/* Collapsible 75-BALL GRID BOARD */}
        {showFullBoard && (
          <div className="space-y-1 bg-slate-950/90 p-2 rounded-xl border border-slate-800/90 mt-1 transition-all">
            {rows.map((row) => (
              <div key={row.letter} className="flex items-center gap-1">
                <div className={`w-5 h-5 rounded flex items-center justify-center font-black text-[9px] shrink-0 border ${row.border}`}>
                  {row.letter}
                </div>
                <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 flex-1">
                  {row.range.map((num) => {
                    const isDrawn = drawnSet.has(num);
                    const isCurrent = currentGame.currentBall === num;
                    return (
                      <div
                        key={num}
                        className={`h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-amber-400 text-slate-950 font-black scale-105 shadow ring-1 ring-amber-300 z-10'
                            : isDrawn
                            ? `${row.color} shadow-sm`
                            : 'bg-slate-800/60 text-slate-500 border border-slate-800'
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
        )}
      </div>

      {/* Sleek Game Info & Cards Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {t('bingoCards')} ({activeGameCards.length}):
          </span>

          {activeGameCards.length > 0 ? (
            activeGameCards.map((card) => {
              const isActive = activeUserCard?.id === card.id;
              const lines = countCompletedLines(card.marked);
              const isWin = checkLineWin(card.marked) || checkFullHouseWin(card.marked);

              return (
                <button
                  key={card.id}
                  onClick={() => {
                    setSelectedCardId(card.id);
                    setViewMode('SINGLE');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold shrink-0 transition flex items-center gap-1 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-black shadow'
                      : isWin
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  #{card.cardNumber}
                  {isWin ? ' 🏆' : lines > 0 ? ` (${lines}L)` : ''}
                </button>
              );
            })
          ) : (
            <span className="text-xs text-slate-500 italic">{t('noCardsChosen')}</span>
          )}
        </div>

        <button
          onClick={() => {
            if (!user) {
              openAuthModal('register');
            } else {
              setIsSelectorOpen(true);
            }
          }}
          className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs border border-emerald-500/30 transition flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> {t('pickCards')}
        </button>
      </div>

      {/* 🚨 PROMINENT FIRST BINGO CALLER BUTTON 🚨 */}
      {isAnyWinning && (
        <div className="p-1 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-2xl shadow-amber-500/50 animate-pulse">
          <button
            onClick={() => handleClaimBingo(bestWinningItem?.card.id)}
            className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl transform active:scale-95 transition cursor-pointer"
          >
            <Flame className="w-6 h-6 text-red-600 animate-bounce" />
            <span>
              {language === 'am' 
                ? `🎉 ቢንጎ በል! አሸናፊነትህን ይፋ አድርግ (ካርድ #${bestWinningItem?.card.cardNumber})`
                : `🎉 SHOUT BINGO! CALL WIN FIRST (Card #${bestWinningItem?.card.cardNumber})`}
            </span>
            <Trophy className="w-6 h-6 text-amber-950 animate-bounce" />
          </button>
        </div>
      )}

      {/* Card Display View Mode Switcher (when player has 2 or 3 cards) */}
      {activeGameCards.length > 1 && (
        <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-300">
              {language === 'am' ? `የእርስዎ ${activeGameCards.length} ካርዶች` : `Your ${activeGameCards.length} Cards (Min 2, Max 3)`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('ALL')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                viewMode === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'am' ? `ሁሉንም (${activeGameCards.length})` : `Show All (${activeGameCards.length})`}
            </button>
            <button
              onClick={() => setViewMode('SINGLE')}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                viewMode === 'SINGLE'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'am' ? 'አንድ' : 'Single Card'}
            </button>
          </div>
        </div>
      )}

      {/* Bingo Cards Display (Multi-Card or Single View) */}
      {viewMode === 'ALL' && activeGameCards.length > 1 ? (
        <div className="space-y-4">
          {activeGameCards.map((card, cardIndex) => {
            const lines = countCompletedLines(card.marked);
            const lineWin = checkLineWin(card.marked);
            const fullHouseWin = checkFullHouseWin(card.marked);
            const isCardWin = lineWin || fullHouseWin;

            return (
              <div 
                key={card.id} 
                className={`glass-panel p-4 rounded-2xl shadow-2xl space-y-3 transition-all ${
                  isCardWin 
                    ? 'border-2 border-amber-400 ring-2 ring-amber-400/30 bg-amber-950/20' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs">
                      {t('card')} #{card.cardNumber}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Card {cardIndex + 1} of {activeGameCards.length}
                    </span>
                    {lines > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                        {lines} {lines === 1 ? t('lineCompleted') : t('linesCompleted')}
                      </span>
                    )}
                  </div>

                  {isCardWin ? (
                    <button
                      onClick={() => handleClaimBingo(card.id)}
                      className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-1 animate-pulse"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>{fullHouseWin ? 'FULL HOUSE BINGO!' : 'LINE BINGO!'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-500">{t('tapToDaub')}</span>
                  )}
                </div>

                {/* B-I-N-G-O Headers */}
                <div className="grid grid-cols-5 gap-1.5 text-center font-black text-xs sm:text-sm">
                  {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
                    <div
                      key={l}
                      className={`py-1 rounded-lg bg-gradient-to-b ${
                        i === 0
                          ? 'from-blue-600 to-blue-800 text-white'
                          : i === 1
                          ? 'from-purple-600 to-purple-800 text-white'
                          : i === 2
                          ? 'from-amber-500 to-amber-700 text-slate-950'
                          : i === 3
                          ? 'from-emerald-600 to-emerald-800 text-white'
                          : 'from-rose-600 to-rose-800 text-white'
                      }`}
                    >
                      {l}
                    </div>
                  ))}
                </div>

                {/* 5x5 Matrix */}
                <div className="grid grid-cols-5 gap-1.5">
                  {card.numbers.map((row, rIdx) =>
                    row.map((val, cIdx) => {
                      const isFree = rIdx === 2 && cIdx === 2;
                      const isMarked = card.marked[rIdx][cIdx];
                      const isJustDrawn = currentGame.currentBall === val;

                      return (
                        <button
                          key={`${rIdx}-${cIdx}`}
                          onClick={() => !isFree && daubCell(card.id, rIdx, cIdx)}
                          className={`aspect-square rounded-xl font-bold flex flex-col items-center justify-center text-xs sm:text-sm transition-all duration-200 relative overflow-hidden border shadow-sm ${
                            isFree
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 border-amber-300 font-black'
                              : isMarked
                              ? 'bg-purple-600 text-white border-purple-400 shadow-purple-900/50 scale-[0.98]'
                              : isJustDrawn
                              ? 'bg-amber-900/40 text-amber-200 border-amber-400 animate-pulse'
                              : 'bg-slate-800/90 text-slate-100 hover:bg-slate-700 border-slate-700'
                          }`}
                        >
                          {isFree ? (
                            <div className="flex flex-col items-center">
                              <Star className="w-3 h-3 text-slate-950 fill-slate-950 mb-0.5" />
                              <span className="text-[8px] uppercase tracking-tighter">{t('free')}</span>
                            </div>
                          ) : (
                            <>
                              <span>{val}</span>
                              {isMarked && (
                                <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                  <div className="w-5 h-5 rounded-full bg-purple-400/30 border border-purple-200/60 animate-ping"></div>
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
        <div className="glass-panel p-3.5 rounded-2xl border-amber-500/20 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs">
                {t('card')} #{activeUserCard.cardNumber}
              </span>
              {lineCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  {lineCount} {lineCount === 1 ? t('lineCompleted') : t('linesCompleted')}
                </span>
              )}
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
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    #{c.cardNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* B-I-N-G-O Headers */}
          <div className="grid grid-cols-5 gap-1.5 text-center font-black text-sm">
            {['B', 'I', 'N', 'G', 'O'].map((l, i) => (
              <div
                key={l}
                className={`py-1.5 rounded-lg bg-gradient-to-b ${
                  i === 0
                    ? 'from-blue-600 to-blue-800 text-white'
                    : i === 1
                    ? 'from-purple-600 to-purple-800 text-white'
                    : i === 2
                    ? 'from-amber-500 to-amber-700 text-slate-950'
                    : i === 3
                    ? 'from-emerald-600 to-emerald-800 text-white'
                    : 'from-rose-600 to-rose-800 text-white'
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

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onClick={() => !isFree && daubCell(activeUserCard.id, rIdx, cIdx)}
                    className={`aspect-square rounded-xl font-bold flex flex-col items-center justify-center text-xs sm:text-sm transition-all duration-200 relative overflow-hidden border shadow-sm ${
                      isFree
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 border-amber-300 font-black'
                        : isMarked
                        ? 'bg-purple-600 text-white border-purple-400 shadow-purple-900/50 scale-[0.98]'
                        : isJustDrawn
                        ? 'bg-amber-900/40 text-amber-200 border-amber-400 animate-pulse'
                        : 'bg-slate-800/90 text-slate-100 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    {isFree ? (
                      <div className="flex flex-col items-center">
                        <Star className="w-3.5 h-3.5 text-slate-950 fill-slate-950 mb-0.5" />
                        <span className="text-[9px] uppercase tracking-tighter">{t('free')}</span>
                      </div>
                    ) : (
                      <>
                        <span>{val}</span>
                        {isMarked && (
                          <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-purple-400/30 border border-purple-200/60 animate-ping"></div>
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* CLAIM BINGO BUTTON */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={() => handleClaimBingo(activeUserCard.id)}
              disabled={!isLineWin && !isFullHouseWin}
              className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-xl ${
                isFullHouseWin
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-purple-600 text-slate-950 hover:brightness-110 animate-bounce cursor-pointer'
                  : isLineWin
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:brightness-110 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Trophy className="w-5 h-5" />
              {isFullHouseWin ? t('claimFullHouse') : isLineWin ? t('claimLineBingo') : t('daubToClaim')}
            </button>
          </div>
        </div>
      ) : !user ? (
        /* Guest Open Account Prompt Card */
        <div className="glass-panel p-6 rounded-2xl text-center space-y-4 border-amber-500/30 bg-slate-900/60">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-100">
              {language === 'am' ? 'የቢንጎ ካርድ ለመምረጥ አካውንት ይክፈቱ' : 'Open an Account to Choose Cards & Play'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {language === 'am'
                ? 'በ75-ኳስ የቢንጎ ውድድር ለመሳተፍ እና ያሸነፉትን በቴሌብር እና ሲቢኢ ለማውጣት በስልክ ቁጥርዎ ይመዝገቡ።'
                : 'Register your Ethiopian phone number to pick cards, enter live draws, and withdraw real ETB cash prizes.'}
            </p>
          </div>

          <button
            onClick={() => openAuthModal('register')}
            className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{language === 'am' ? 'አካውንት ክፈት (50 ብር ቦነስ)' : 'Open Account (50 ETB Bonus)'}</span>
          </button>
        </div>
      ) : (
        /* Purchase Ticket Card */
        <div className="glass-panel p-6 rounded-2xl text-center space-y-4 border-amber-500/30">
          <Hash className="w-12 h-12 text-amber-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-100">{t('chooseCardNumbersAndJoin')}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {t('chooseCardNumbersDesc')}
            </p>
          </div>

          {!user ? (
            <button
              onClick={() => openAuthModal('register')}
              className="w-full py-3 rounded-xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserIcon className="w-4 h-4" />
              <span>{language === 'am' ? 'አካውንት ይክፈቱ እና ይጫወቱ' : 'Open Account to Choose Cards & Play'}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsSelectorOpen(true)}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Hash className="w-4 h-4" /> {t('chooseCardNumbersBtn')}
            </button>
          )}
        </div>
      )}

      {/* Claim Result Alert Modal / Banner */}
      {claimStatus && claimStatus.success && (
        <div className="bg-gradient-to-r from-amber-900/90 to-purple-900/90 border border-amber-400 p-4 rounded-2xl text-center space-y-2 animate-fade-in shadow-2xl">
          <Sparkles className="w-8 h-8 text-amber-300 mx-auto animate-spin" />
          <h4 className="text-lg font-black text-amber-200">{t('winnerConfirmed')}</h4>
          <p className="text-sm text-slate-100">{claimStatus.message}</p>
          <p className="text-xs text-amber-300 font-mono font-bold">
            +{claimStatus.prize} {t('creditedToWallet')}
          </p>
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
