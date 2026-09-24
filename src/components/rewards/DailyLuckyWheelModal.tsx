'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { X, Sparkles, Gift, Clock, CheckCircle2, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatETB } from '../../lib/bingoUtils';

interface DailyLuckyWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WheelSegment {
  label: string;
  labelAm: string;
  amount: number;
  type: 'bonus' | 'ticket' | 'none';
  color: string;
  textColor: string;
}

const SEGMENTS: WheelSegment[] = [
  { label: '2 ETB', labelAm: '2 ብር', amount: 2, type: 'bonus', color: '#10b981', textColor: '#ffffff' },
  { label: '5 ETB', labelAm: '5 ብር', amount: 5, type: 'bonus', color: '#f59e0b', textColor: '#0f172a' },
  { label: 'Try Again', labelAm: 'ነገ ይሞክሩ', amount: 0, type: 'none', color: '#64748b', textColor: '#ffffff' },
  { label: '10 ETB', labelAm: '10 ብር', amount: 10, type: 'bonus', color: '#8b5cf6', textColor: '#ffffff' },
  { label: '1 Free Card', labelAm: '1 ነፃ ካርድ', amount: 10, type: 'ticket', color: '#3b82f6', textColor: '#ffffff' },
  { label: '3 ETB', labelAm: '3 ብር', amount: 3, type: 'bonus', color: '#ec4899', textColor: '#ffffff' },
  { label: '1 ETB', labelAm: '1 ብር', amount: 1, type: 'bonus', color: '#06b6d4', textColor: '#ffffff' },
  { label: '15 ETB ⭐', labelAm: '15 ብር ⭐', amount: 15, type: 'bonus', color: '#e11d48', textColor: '#ffffff' },
];

export default function DailyLuckyWheelModal({ isOpen, onClose }: DailyLuckyWheelModalProps) {
  const { user, wallet, setWallet, addNotification, language } = useBingo();
  const isAm = language === 'am';

  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonSegment, setWonSegment] = useState<WheelSegment | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const [timeUntilNextSpin, setTimeUntilNextSpin] = useState('');

  // Check 24h spin status
  useEffect(() => {
    const checkSpinAvailability = () => {
      if (typeof window === 'undefined') return;
      const lastSpinTime = localStorage.getItem('hyper_bingo_last_spin');
      if (!lastSpinTime) {
        setCanSpin(true);
        return;
      }

      const elapsed = Date.now() - parseInt(lastSpinTime, 10);
      const cooldown = 24 * 60 * 60 * 1000; // 24 hours

      if (elapsed < cooldown) {
        setCanSpin(false);
        const rem = cooldown - elapsed;
        const h = Math.floor(rem / (1000 * 60 * 60));
        const m = Math.floor((rem % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((rem % (1000 * 60)) / 1000);
        setTimeUntilNextSpin(`${h}h : ${m}m : ${s}s`);
      } else {
        setCanSpin(true);
      }
    };

    checkSpinAvailability();
    const interval = setInterval(checkSpinAvailability, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (isSpinning || !canSpin) return;

    setIsSpinning(true);
    setWonSegment(null);

    // Pick weighted winner (mostly 2, 3, 5, or 1 ETB)
    const winningIdx = Math.floor(Math.random() * SEGMENTS.length);
    const winningSegment = SEGMENTS[winningIdx];

    const segmentAngle = 360 / SEGMENTS.length;
    // Calculate rotation: 5 full turns (1800 deg) + offset to point to winning segment
    // Pointer is at the top (270 deg or 0 deg depending on orientation)
    const targetDeg = 360 * 5 + (SEGMENTS.length - winningIdx) * segmentAngle - segmentAngle / 2;
    
    setRotation(targetDeg);

    setTimeout(() => {
      setIsSpinning(false);
      setWonSegment(winningSegment);
      localStorage.setItem('hyper_bingo_last_spin', Date.now().toString());
      setCanSpin(false);

      if (winningSegment.amount > 0) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });

        // Credit bonus balance to user wallet
        setWallet((prev) => ({
          ...prev,
          bonusBalance: prev.bonusBalance + winningSegment.amount,
        }));

        addNotification(
          isAm ? '🎁 ዕለታዊ ሽልማት አሸንፈዋል!' : '🎁 Daily Reward Won!',
          isAm
            ? `${winningSegment.labelAm} በቦነስ ሂሳብዎ ላይ ተጨምሯል!`
            : `${winningSegment.label} added to your bonus playable balance!`,
          'success'
        );
      }
    }, 4500);
  };

  const segmentAngle = 360 / SEGMENTS.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200 select-none">
      <div className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-amber-400 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-white text-center relative overflow-hidden">
        {/* Glow accents */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5">
            <Gift className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-amber-300 uppercase tracking-wider">
              {isAm ? 'ዕለታዊ እድለኛ መንኰራኵር' : 'Daily Lucky Wheel'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-slate-300">
          {isAm
            ? 'በየ24 ሰዓቱ 1 ነፃ እድል ይሽከረከሩ እና የቦነስ ሽልማት ያሸንፉ!'
            : 'Spin once every 24 hours to win free playable bonus balance!'}
        </p>

        {/* WHEEL CONTAINER */}
        <div className="relative w-64 h-64 mx-auto my-2 flex items-center justify-center">
          {/* Outer Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-amber-400 shadow-xl shadow-amber-400/20 bg-slate-950"></div>

          {/* Top Pointer */}
          <div className="absolute -top-2 z-20 w-0 h-0 border-x-8 border-x-transparent border-t-16 border-t-amber-400 drop-shadow-md"></div>

          {/* Rotating Wheel */}
          <div
            className="w-56 h-56 rounded-full overflow-hidden relative shadow-inner transition-transform duration-[4500ms] cubic-bezier(0.15, 0.9, 0.25, 1)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {/* SVG Wheel Segments */}
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {SEGMENTS.map((seg, idx) => {
                const startAngle = (idx * segmentAngle * Math.PI) / 180;
                const endAngle = (((idx + 1) * segmentAngle) * Math.PI) / 180;
                const x1 = 50 + 50 * Math.cos(startAngle);
                const y1 = 50 + 50 * Math.sin(startAngle);
                const x2 = 50 + 50 * Math.cos(endAngle);
                const y2 = 50 + 50 * Math.sin(endAngle);
                const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;

                const midAngle = ((idx + 0.5) * segmentAngle * Math.PI) / 180;
                const textX = 50 + 32 * Math.cos(midAngle);
                const textY = 50 + 32 * Math.sin(midAngle);

                return (
                  <g key={idx}>
                    <path d={pathData} fill={seg.color} stroke="#0f172a" strokeWidth="0.5" />
                    <text
                      x={textX}
                      y={textY}
                      fill={seg.textColor}
                      fontSize="5"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${(idx + 0.5) * segmentAngle + 90}, ${textX}, ${textY})`}
                    >
                      {isAm ? seg.labelAm : seg.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Center Hub */}
          <div className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-slate-950 flex items-center justify-center text-slate-950 font-black shadow-lg text-sm z-10">
            ⭐
          </div>
        </div>

        {/* Won Announcement */}
        {wonSegment && (
          <div className="p-2.5 rounded-2xl bg-amber-400/20 border border-amber-400/50 animate-in zoom-in-90 duration-300 text-center space-y-0.5">
            <span className="text-[10px] font-black uppercase text-amber-300">
              {isAm ? '🎉 እንኳን ደስ አለዎት!' : '🎉 Congratulations!'}
            </span>
            <p className="text-base font-black text-white">
              {wonSegment.amount > 0
                ? `${isAm ? wonSegment.labelAm : wonSegment.label} ${isAm ? 'አሸንፈዋል!' : 'Won!'}`
                : isAm ? 'ነገ እንደገና ይሞክሩ!' : 'Try again tomorrow!'}
            </p>
          </div>
        )}

        {/* Action Button or Cooldown */}
        {canSpin ? (
          <button
            type="button"
            disabled={isSpinning}
            onClick={handleSpin}
            className={`w-full py-3 rounded-2xl font-black text-sm tracking-wider uppercase shadow-lg transition cursor-pointer flex items-center justify-center gap-2 ${
              isSpinning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 hover:brightness-110 active:scale-98 shadow-amber-400/30 ring-2 ring-amber-300'
            }`}
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>{isSpinning ? (isAm ? 'በማሽከርከር ላይ...' : 'Spinning...') : (isAm ? 'አሁን ያሽከርክሩ (SPIN)' : 'SPIN NOW (FREE)')}</span>
          </button>
        ) : (
          <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-bold">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{isAm ? 'ቀጣይ ነፃ እድል በ:' : 'Next Free Spin In:'}</span>
            </div>
            <div className="text-base font-black font-mono text-amber-300 tracking-wider">
              {timeUntilNextSpin}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
