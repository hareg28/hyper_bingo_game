'use client';

import React, { useState } from 'react';
import { X, Plus, Hash, Sparkles, Check } from 'lucide-react';
import { useBingo } from '../../context/BingoContext';

interface CardNumberSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCardNumbers: string[]) => void;
  entryPrice: number;
  initialCards?: string[];
}

export default function CardNumberSelector({
  isOpen,
  onClose,
  onConfirm,
  entryPrice,
  initialCards = ['12608', '11302'],
}: CardNumberSelectorProps) {
  const { t, language } = useBingo();
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>(() => {
    if (initialCards && initialCards.length >= 1) {
      return initialCards.slice(0, 3);
    }
    return ['12608', '11302'];
  });
  const [inputNumber, setInputNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const MIN_CARDS = 1;
  const MAX_CARDS = 3;

  if (!isOpen) return null;

  const generateRandomCardNumber = (): string => {
    return Math.floor(10000 + Math.random() * 89999).toString();
  };

  const handleAddCustomNumber = () => {
    setErrorMsg('');
    const trimmed = inputNumber.trim();
    if (!trimmed) return;

    if (selectedNumbers.length >= MAX_CARDS) {
      setErrorMsg(
        language === 'am'
          ? `ከፍተኛው የተፈቀደው የካርድ ብዛት ${MAX_CARDS} ነው። ተጨማሪ ካርድ ለማስገባት አንዱን ያስወግዱ።`
          : `Maximum ${MAX_CARDS} cards allowed per player. Remove one first.`
      );
      return;
    }

    if (!/^\d{3,6}$/.test(trimmed)) {
      setErrorMsg(
        language === 'am'
          ? 'የካርድ ቁጥር ከ3-6 አሃዞች መሆን አለበት (ለምሳሌ 12608)'
          : 'Card number must be 3-6 digits (e.g. 12608)'
      );
      return;
    }

    if (selectedNumbers.includes(trimmed)) {
      setErrorMsg(
        language === 'am'
          ? `የካርድ ቁጥር ${trimmed} አስቀድሞ ተመርጧል።`
          : `Card number ${trimmed} is already selected.`
      );
      return;
    }

    setSelectedNumbers((prev) => [...prev, trimmed]);
    setInputNumber('');
  };

  const handleAddRandomCard = () => {
    setErrorMsg('');
    if (selectedNumbers.length >= MAX_CARDS) {
      setErrorMsg(
        language === 'am'
          ? `ከፍተኛው ${MAX_CARDS} ካርዶች ብቻ ነው የሚፈቀደው።`
          : `Maximum ${MAX_CARDS} cards allowed.`
      );
      return;
    }
    let rand = generateRandomCardNumber();
    while (selectedNumbers.includes(rand)) {
      rand = generateRandomCardNumber();
    }
    setSelectedNumbers((prev) => [...prev, rand]);
  };

  const handleRemoveNumber = (num: string) => {
    setErrorMsg('');
    if (selectedNumbers.length <= MIN_CARDS) {
      setErrorMsg(
        language === 'am'
          ? `አነስተኛው የካርድ ብዛት ${MIN_CARDS} መሆን አለበት።`
          : `Minimum ${MIN_CARDS} cards required to play.`
      );
      return;
    }
    setSelectedNumbers((prev) => prev.filter((n) => n !== num));
  };

  const handleConfirm = () => {
    if (selectedNumbers.length < MIN_CARDS) {
      setErrorMsg(
        language === 'am'
          ? `እባክዎን ቢያንስ ${MIN_CARDS} ካርዶችን ይምረጡ (አነስተኛ ${MIN_CARDS}፣ ከፍተኛ ${MAX_CARDS})።`
          : `Please select at least ${MIN_CARDS} cards (Min ${MIN_CARDS}, Max ${MAX_CARDS}).`
      );
      return;
    }
    if (selectedNumbers.length > MAX_CARDS) {
      setErrorMsg(
        language === 'am'
          ? `ከፍተኛው የተፈቀደው ${MAX_CARDS} ካርዶች ብቻ ነው።`
          : `Maximum ${MAX_CARDS} cards allowed.`
      );
      return;
    }
    onConfirm(selectedNumbers);
    onClose();
  };

  const quickPresets = ['12608', '11302', '24890', '35012', '98104'];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-100 text-sm">
                {language === 'am' ? 'የቢንጎ ካርዶችን ይምረጡ' : 'Choose Bingo Cards'}
              </h3>
              <p className="text-[11px] text-amber-400 font-bold">
                {language === 'am' ? '⭐ ከፍተኛው 3 ካርዶች (1-3 ካርዶች ይፈቀዳሉ)' : '⭐ Max 3 Slots / Cards (1-3 Allowed)'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Card Badges Preview (matching 10:20 Bingo green chips) */}
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">✓</span>
              {t('selectedCards')} ({selectedNumbers.length}/3)
            </span>
            <span className="text-amber-400 font-mono font-bold text-[11px]">
              {t('totalCost')}: {selectedNumbers.length * entryPrice} ETB
            </span>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[44px] items-center p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            {selectedNumbers.length > 0 ? (
              selectedNumbers.map((num) => (
                <div
                  key={num}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs flex items-center gap-1.5 shadow-md group hover:bg-emerald-500 transition"
                >
                  <span>#{num}</span>
                  {selectedNumbers.length > MIN_CARDS && (
                    <button
                      onClick={() => handleRemoveNumber(num)}
                      className="text-emerald-200 hover:text-white transition"
                      title="Remove card"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <span className="text-slate-500 text-xs italic px-2">No cards selected yet</span>
            )}
          </div>
        </div>

        {/* Input Custom Card Number */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">{t('enterCardNumber')}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomNumber()}
                placeholder="e.g. 12608"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <button
              onClick={handleAddCustomNumber}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1 shadow"
            >
              <Plus className="w-4 h-4" /> {t('addCard')}
            </button>
          </div>
          {errorMsg && <p className="text-[11px] text-rose-400 font-semibold">{errorMsg}</p>}
        </div>

        {/* Quick Pick Card Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">{t('quickPresets')}</span>
          <div className="flex flex-wrap gap-2">
            {quickPresets.map((preset) => {
              const isAdded = selectedNumbers.includes(preset);
              const isMax = selectedNumbers.length >= MAX_CARDS;
              return (
                <button
                  key={preset}
                  onClick={() => {
                    if (!isAdded && !isMax) setSelectedNumbers((prev) => [...prev, preset]);
                  }}
                  disabled={isAdded || isMax}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition ${
                    isAdded || isMax
                      ? 'bg-slate-800/60 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400'
                  }`}
                >
                  #{preset} {isAdded && '✓'}
                </button>
              );
            })}

            <button
              onClick={handleAddRandomCard}
              disabled={selectedNumbers.length >= MAX_CARDS}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                selectedNumbers.length >= MAX_CARDS
                  ? 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed'
                  : 'bg-purple-900/40 text-purple-300 border border-purple-500/40 hover:bg-purple-900/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> {t('randomCard')}
            </button>
          </div>
        </div>

        {/* Confirm Actions */}
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
          >
            {t('cancel')}
          </button>

          <button
            onClick={handleConfirm}
            className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> {t('confirmCards')} ({selectedNumbers.length})
          </button>
        </div>
      </div>
    </div>
  );
}
