'use client';

import React, { useState } from 'react';
import { X, Plus, Hash, Sparkles, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { useBingo } from '../../context/BingoContext';

interface CardNumberSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedCardNumbers: string[]) => void;
  entryPrice: number;
  initialCards?: string[];
  gameId?: string;
  mode?: 'FETAN' | 'SPECIAL' | 'WEEKEND';
}

const ALL_PRESETS = [
  '12608', '11302', '24890', '35012', '98104',
  '44192', '53001', '67123', '78904', '81234',
  '19045', '27651', '63421', '89100', '95420'
];

const MIN_CARDS = 1;
const MAX_CARDS = 5;

export default function CardNumberSelector({
  isOpen,
  onClose,
  onConfirm,
  entryPrice,
  initialCards = [],
  gameId,
  mode = 'SPECIAL',
}: CardNumberSelectorProps) {
  const { t, language, purchaseLotteryNumbers, getLotterySoldNumbers, wallet } = useBingo();
  const isAm = language === 'am';

  const TOTAL_NUMBERS = mode === 'FETAN' ? 500 : mode === 'SPECIAL' ? 75 : 1500;

  const [purchasedNumbers, setPurchasedNumbers] = useState<string[]>(() => {
    if (initialCards && initialCards.length >= 1) {
      return initialCards.slice(0, MAX_CARDS);
    }
    return [];
  });
  const [inputNumber, setInputNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null);
  const [showMorePresets, setShowMorePresets] = useState(false);

  const prevIsOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (initialCards && initialCards.length > 0) {
        setPurchasedNumbers(initialCards.slice(0, MAX_CARDS));
      } else {
        setPurchasedNumbers([]);
      }
      setInputNumber('');
      setErrorMsg('');
      setPurchaseMsg(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isOpen) return null;

  const soldSet = React.useMemo(() => {
    if (!gameId) return new Set<number>();
    return getLotterySoldNumbers(gameId);
  }, [gameId, getLotterySoldNumbers, purchaseMsg, purchasedNumbers]);

  const purchasedSet = new Set(purchasedNumbers.map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n)));
  const purchasedCount = purchasedNumbers.length;
  const totalSpent = purchasedCount * entryPrice;
  const playableBalance = wallet.availableBalance + wallet.bonusBalance;

  const showMessage = (msg: string) => {
    setPurchaseMsg(msg);
    setTimeout(() => setPurchaseMsg(null), 2800);
  };

  const attemptPurchaseByNumber = (num: number): boolean => {
    setErrorMsg('');

    if (!Number.isInteger(num) || num < 1 || num > TOTAL_NUMBERS) {
      setErrorMsg(
        isAm
          ? `ካርድ ቁጥር በ1-${TOTAL_NUMBERS} መካከል መሆን አለበት።`
          : `Card number must be between 1 and ${TOTAL_NUMBERS}.`
      );
      return false;
    }

    if (purchasedCount >= MAX_CARDS) {
      setErrorMsg(
        isAm
          ? `ከፍተኛው ${MAX_CARDS} ካርዶች ተሞልተዋል! (Max ${MAX_CARDS} cards reached)`
          : `Maximum ${MAX_CARDS} cards reached for this round!`
      );
      setTimeout(() => setErrorMsg(''), 3000);
      return false;
    }

    if (purchasedSet.has(num)) {
      showMessage(
        isAm
          ? `ካርድ #${String(num).padStart(4, '0')} አስቀድሞ ተገዝቷል!`
          : `Card #${String(num).padStart(4, '0')} already purchased!`
      );
      return false;
    }

    if (soldSet.has(num)) {
      showMessage(
        isAm
          ? `ካርድ #${String(num).padStart(4, '0')} ሌላ ሰው ተወስዷል።`
          : `Card #${String(num).padStart(4, '0')} is already sold.`
      );
      return false;
    }

    if (playableBalance < entryPrice) {
      setErrorMsg(
        isAm
          ? `በቂ ሒሳብ የለዎትም! (${entryPrice} ETB ያስፈልጋል፣ ያለዎት ${Math.floor(playableBalance)} ETB)`
          : `Insufficient balance! (Need ${entryPrice} ETB, have ${Math.floor(playableBalance)} ETB)`
      );
      setTimeout(() => setErrorMsg(''), 3500);
      return false;
    }

    if (!gameId) {
      const label = String(num).padStart(4, '0');
      setPurchasedNumbers((prev) => (prev.length >= MAX_CARDS ? prev : [...prev, label]));
      showMessage(isAm ? `ካርድ #${label} ተመርጧል` : `Card #${label} added`);
      return true;
    }

    const result = purchaseLotteryNumbers(gameId, [num]);
    if (result.success && result.purchased && result.purchased.length > 0) {
      setPurchasedNumbers((prev) => (prev.length >= MAX_CARDS ? prev : [...prev, result.purchased![0]]));
      showMessage(result.message);
      return true;
    }
    if (!result.success) {
      setErrorMsg(result.message);
      setTimeout(() => setErrorMsg(''), 3500);
    }
    return false;
  };

  const handleAddCustomNumber = () => {
    setErrorMsg('');
    const trimmed = inputNumber.trim();
    if (!trimmed) return;
    const num = parseInt(trimmed, 10);
    attemptPurchaseByNumber(num);
    setInputNumber('');
  };

  const handleAddRandomCard = () => {
    setErrorMsg('');
    if (purchasedCount >= MAX_CARDS) {
      setErrorMsg(
        isAm
          ? `ከፍተኛው ${MAX_CARDS} ካርዶች ብቻ ነው የሚፈቀደው።`
          : `Maximum ${MAX_CARDS} cards allowed.`
      );
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    for (let attempt = 0; attempt < 200; attempt++) {
      const n = Math.floor(1 + Math.random() * TOTAL_NUMBERS);
      if (!purchasedSet.has(n) && !soldSet.has(n)) {
        attemptPurchaseByNumber(n);
        return;
      }
    }
    showMessage(isAm ? 'ዕቃዎች የሉም።' : 'No available numbers found.');
  };

  const handleFillMaxCards = () => {
    setErrorMsg('');
    for (let i = 0; i < MAX_CARDS - purchasedCount; i++) {
      handleAddRandomCard();
    }
  };

  const handleClose = () => {
    if (purchasedNumbers.length > 0) {
      onConfirm(purchasedNumbers);
    }
    onClose();
  };

  const displayedPresets = showMorePresets ? ALL_PRESETS : ALL_PRESETS.slice(0, 8);
  const presetsForMode = displayedPresets
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_NUMBERS);

  const colClass =
    TOTAL_NUMBERS <= 75 ? 'grid-cols-10' : TOTAL_NUMBERS <= 500 ? 'grid-cols-10 sm:grid-cols-12' : 'grid-cols-10 sm:grid-cols-15';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-4 sm:p-5 max-w-lg w-full max-h-[92vh] flex flex-col space-y-3 shadow-2xl relative overflow-hidden text-slate-900 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-300 shrink-0">
              <Hash className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-slate-950 text-sm leading-tight truncate">
                {isAm ? `ካርዶችን በቀጥታ ይግዙ (1–${TOTAL_NUMBERS})` : `Tap Cards to Buy (1–${TOTAL_NUMBERS})`}
              </h3>
              <p className="text-[10px] text-emerald-700 font-bold truncate">
                {isAm
                  ? `⭐ ከ${MIN_CARDS}–${MAX_CARDS} ካርዶች · ካርድ ቁጥር ሲጫኑ በቀጥታ ይገዛል`
                  : `⭐ Min ${MIN_CARDS} / Max ${MAX_CARDS} · Tap any number → instant purchase`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-950 hover:bg-slate-200 transition cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Price / Balance / Bought status row */}
        <div className="flex items-center gap-2 rounded-2xl overflow-hidden bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 text-slate-900 shadow-xs border border-amber-200 p-2 shrink-0">
          <div className="flex-1 flex flex-col items-center justify-center px-1 border-r border-amber-200">
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 leading-none">
              {isAm ? 'የተገዙ' : 'Bought'}
            </span>
            <span className="text-sm font-black leading-tight mt-0.5 tabular-nums text-rose-700">{purchasedCount}/{MAX_CARDS}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-1 border-r border-amber-200">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 leading-none">
              {isAm ? 'ነፃዎች' : 'Left'}
            </span>
            <span className="text-sm font-black leading-tight mt-0.5 tabular-nums text-emerald-800">{TOTAL_NUMBERS - soldSet.size}</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-1 border-r border-amber-200">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">
              {isAm ? 'ዋጋ' : 'Stake'}
            </span>
            <span className="text-sm font-black leading-tight mt-0.5 tabular-nums text-slate-950">{entryPrice} ETB</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none flex items-center gap-0.5">
              <Wallet className="w-2.5 h-2.5 text-emerald-600" /> {isAm ? 'ሒሳብ' : 'Balance'}
            </span>
            <span className="text-xs font-black leading-tight mt-0.5 tabular-nums text-emerald-800">{Math.floor(playableBalance)}</span>
          </div>
        </div>

        {/* Bought / Purchased slots */}
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-800 font-bold flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</span>
              {t('selectedCards')} ({purchasedCount}/{MAX_CARDS})
            </span>
            <span className="text-emerald-800 font-mono font-black text-[11px] bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
              {purchasedCount > 0 ? `${totalSpent} ETB` : ''}
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin snap-x snap-mandatory">
            {Array.from({ length: MAX_CARDS }, (_, i) => {
              const num = purchasedNumbers[i];
              const filled = num !== undefined;
              return (
                <div
                  key={i}
                  className={`w-[calc(50%-0.375rem)] min-w-[calc(50%-0.375rem)] shrink-0 snap-start h-10 rounded-xl border-2 flex items-center justify-between px-2 relative transition-all ${
                    filled
                      ? 'border-amber-400 bg-amber-50 text-slate-950 shadow-2xs'
                      : 'border-dashed border-slate-300 bg-slate-50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      filled ? 'text-amber-800 bg-amber-200/80' : 'text-slate-400 bg-slate-200/60'
                    }`}>
                      S{i + 1}
                    </span>
                    {filled ? (
                      <span className="text-xs font-black font-mono tabular-nums text-slate-950 truncate">#{num}</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">{isAm ? 'ባዶ' : 'Empty'}</span>
                    )}
                  </div>
                  {filled ? (
                    <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">
                      ✓ {isAm ? 'ተገዝቷል' : 'Paid'}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs font-black shrink-0">+</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={handleFillMaxCards}
              disabled={purchasedCount >= MAX_CARDS}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1 cursor-pointer border ${
                purchasedCount >= MAX_CARDS
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
              }`}
            >
              <span>⚡ {isAm ? `${MAX_CARDS} ካርዶች ሙላ` : `Fill ${MAX_CARDS} Cards (Max)`}</span>
            </button>
            <button
              type="button"
              onClick={handleAddRandomCard}
              disabled={purchasedCount >= MAX_CARDS}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1 cursor-pointer border ${
                purchasedCount >= MAX_CARDS
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300 shadow-2xs'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>{isAm ? '+1 የነሲብ' : '+1 Random'}</span>
            </button>
          </div>
        </div>

        {/* Input + Presets row */}
        <div className="space-y-2 shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomNumber()}
                placeholder={`1–${TOTAL_NUMBERS}`}
                className="w-full bg-white border-2 border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-950 font-mono font-bold focus:outline-none focus:border-emerald-600 transition"
              />
            </div>
            <button
              onClick={handleAddCustomNumber}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={purchasedCount >= MAX_CARDS}
            >
              <Plus className="w-3.5 h-3.5" /> {t('addCard')}
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">{t('quickPresets')}</span>
              <button
                onClick={() => setShowMorePresets(!showMorePresets)}
                className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 cursor-pointer"
              >
                {showMorePresets ? (
                  <><ChevronUp className="w-3 h-3" /><span>{isAm ? 'አሳንስ' : 'Show Less'}</span></>
                ) : (
                  <><ChevronDown className="w-3 h-3" /><span>{isAm ? `ተጨማሪ (${ALL_PRESETS.length})` : `Show More (${ALL_PRESETS.length})`}</span></>
                )}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presetsForMode.map((n) => {
                const label = String(n).padStart(4, '0');
                const isBought = purchasedSet.has(n);
                const isSold = soldSet.has(n);
                const isMax = purchasedCount >= MAX_CARDS;
                return (
                  <button
                    key={n}
                    onClick={() => attemptPurchaseByNumber(n)}
                    disabled={(isSold && !isBought) || (isMax && !isBought)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold border transition cursor-pointer ${
                      isBought
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : isSold
                        ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed line-through'
                        : isMax
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-800 hover:border-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/30'
                    }`}
                  >
                    #{label} {isBought && '✓'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Master Lottery Board Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5 px-1 shrink-0">
            <div>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">
                {isAm ? `የቁጥሮች ሰንጠረዥ (1–${TOTAL_NUMBERS})` : `Master Lottery Board (1–${TOTAL_NUMBERS})`}
              </span>
              <span className="text-[9px] text-amber-600 font-bold block">
                {isAm ? '⚡ ካርድ ቁጥር ሲጫኑ በቀጥታ ይገዛል' : '⚡ Tap any card → instant purchase (no Buy button)'}
              </span>
            </div>
          </div>
          <div className={`grid ${colClass} gap-0.5 sm:gap-1 overflow-y-auto pr-0.5`}>
            {Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1).map((num) => {
              const bought = purchasedSet.has(num);
              const sold = soldSet.has(num);
              const isMax = purchasedCount >= MAX_CARDS;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => attemptPurchaseByNumber(num)}
                  disabled={(sold && !bought) || (isMax && !bought)}
                  className={`h-7 sm:h-8 rounded-md text-[10px] sm:text-xs font-black tabular-nums transition-all border select-none flex items-center justify-center shrink-0 ${
                    bought
                      ? 'bg-amber-400 border-amber-500 text-slate-950 shadow shadow-amber-300 scale-105 ring-2 ring-amber-500 z-10'
                      : sold
                      ? 'bg-slate-200 border-slate-300 text-slate-500 cursor-not-allowed line-through decoration-slate-400/80 font-bold'
                      : isMax
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border-slate-300 text-slate-950 hover:bg-amber-50 hover:border-amber-400 active:scale-95 cursor-pointer shadow-2xs'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        {(purchaseMsg || errorMsg) && (
          <div className={`mx-0.5 px-3 py-2 rounded-xl text-xs font-black text-center shadow-lg animate-in fade-in slide-in-from-bottom-2 shrink-0 ${
            errorMsg ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
          }`}>
            {errorMsg || purchaseMsg}
          </div>
        )}

        {/* Close button (replaces previous Cancel + Confirm Buy / two-button layout) */}
        <div className="pt-1 border-t border-slate-200 shrink-0">
          <button
            onClick={handleClose}
            className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              purchasedCount === 0
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white hover:brightness-105 shadow-emerald-300/50 active:scale-[0.99]'
            }`}
          >
            {purchasedCount === 0
              ? isAm
                ? 'ዝጋ (Close)'
                : 'Close'
              : isAm
              ? `✅ ጨርስ / ወደ ጨዋታው ይግቡ (${purchasedCount})`
              : `✅ Done — Enter Game (${purchasedCount} card${purchasedCount > 1 ? 's' : ''})`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
