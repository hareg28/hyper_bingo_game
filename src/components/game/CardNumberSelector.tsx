'use client';

import React, { useState } from 'react';
import { X, Plus, Hash, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useBingo } from '../../context/BingoContext';

interface CardNumberSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCardNumbers: string[]) => void;
  entryPrice: number;
  initialCards?: string[];
}

const ALL_PRESETS = [
  '12608', '11302', '24890', '35012', '98104', 
  '44192', '53001', '67123', '78904', '81234', 
  '19045', '27651', '63421', '89100', '95420'
];

export default function CardNumberSelector({
  isOpen,
  onClose,
  onConfirm,
  entryPrice,
  initialCards = [],
}: CardNumberSelectorProps) {
  const { t, language } = useBingo();
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>(() => {
    if (initialCards && initialCards.length >= 1) {
      return initialCards.slice(0, 3);
    }
    return [];
  });
  const [inputNumber, setInputNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showMorePresets, setShowMorePresets] = useState(false);

  const MIN_CARDS = 1;
  const MAX_CARDS = 3;

  React.useEffect(() => {
    if (isOpen) {
      if (initialCards && initialCards.length > 0) {
        setSelectedNumbers(initialCards.slice(0, 3));
      } else {
        setSelectedNumbers([]);
      }
      setInputNumber('');
      setErrorMsg('');
    }
  }, [isOpen, initialCards]);

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
    setSelectedNumbers((prev) => prev.filter((n) => n !== num));
  };

  const handleConfirm = () => {
    if (selectedNumbers.length < MIN_CARDS) {
      setErrorMsg(
        language === 'am'
          ? `እባክዎን ቢያንስ ${MIN_CARDS} ካርድ ይምረጡ (ከ1-3 ካርዶች)።`
          : `Please select at least ${MIN_CARDS} card (1-3 cards allowed).`
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

  const displayedPresets = showMorePresets ? ALL_PRESETS : ALL_PRESETS.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl relative overflow-hidden text-slate-900 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-300">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-950 text-sm">
                {language === 'am' ? 'የቢንጎ ካርዶችን ይምረጡ' : 'Choose Bingo Cards'}
              </h3>
              <p className="text-[11px] text-amber-700 font-bold">
                {language === 'am' ? '⭐ ከፍተኛው 3 ካርዶች (1-3 ካርዶች ይፈቀዳሉ)' : '⭐ Max 3 Slots / Cards (1-3 Allowed)'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-950 hover:bg-slate-200 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Card Badges Preview */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-800 font-bold flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</span>
              {t('selectedCards')} ({selectedNumbers.length}/3)
            </span>
            <span className="text-amber-800 font-mono font-black text-xs">
              {t('totalCost')}: {selectedNumbers.length * entryPrice} ETB
            </span>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[44px] items-center p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            {selectedNumbers.length > 0 ? (
              selectedNumbers.map((num) => (
                <div
                  key={num}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs flex items-center gap-1.5 shadow-xs group hover:bg-emerald-700 transition"
                >
                  <span>#{num}</span>
                  <button
                    onClick={() => handleRemoveNumber(num)}
                    className="text-emerald-100 hover:text-white transition cursor-pointer"
                    title="Remove card"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <span className="text-slate-500 text-xs italic px-2">
                {language === 'am' ? 'እስካሁን ምንም ካርድ አልተመረጠም (ከታች ምረጥ)' : 'No cards selected yet (pick below)'}
              </span>
            )}
          </div>
        </div>

        {/* Input Custom Card Number */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 block">{t('enterCardNumber')}</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomNumber()}
                placeholder="e.g. 12608"
                className="w-full bg-white border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-mono font-bold focus:outline-none focus:border-emerald-600 transition"
              />
            </div>

            <button
              onClick={handleAddCustomNumber}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {t('addCard')}
            </button>
          </div>
          {errorMsg && <p className="text-[11px] text-rose-600 font-bold">{errorMsg}</p>}
        </div>

        {/* Quick Pick Card Presets with Show More / Show Less */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">{t('quickPresets')}</span>
            <button
              onClick={() => setShowMorePresets(!showMorePresets)}
              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 cursor-pointer"
            >
              {showMorePresets ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>{language === 'am' ? 'አሳንስ (Show Less)' : 'Show Less'}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>{language === 'am' ? `ተጨማሪ (${ALL_PRESETS.length})` : `Show More (${ALL_PRESETS.length})`}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {displayedPresets.map((preset) => {
              const isAdded = selectedNumbers.includes(preset);
              const isMax = selectedNumbers.length >= MAX_CARDS;
              return (
                <button
                  key={preset}
                  onClick={() => {
                    if (isAdded) {
                      setSelectedNumbers((prev) => prev.filter((n) => n !== preset));
                    } else if (!isMax) {
                      setSelectedNumbers((prev) => [...prev, preset]);
                    }
                  }}
                  disabled={!isAdded && isMax}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                    isAdded
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : isMax
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/30'
                  }`}
                >
                  #{preset} {isAdded && '✓'}
                </button>
              );
            })}

            <button
              onClick={handleAddRandomCard}
              disabled={selectedNumbers.length >= MAX_CARDS}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 cursor-pointer ${
                selectedNumbers.length >= MAX_CARDS
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" /> {t('randomCard')}
            </button>
          </div>
        </div>

        {/* Confirm Actions */}
        <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition border border-slate-300 cursor-pointer"
          >
            {t('cancel')}
          </button>

          <button
            onClick={handleConfirm}
            className="w-2/3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:brightness-105 text-white font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" /> {t('confirmCards')} ({selectedNumbers.length})
          </button>
        </div>
      </div>
    </div>
  );
}
