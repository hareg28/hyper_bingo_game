'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  X, User as UserIcon, Phone, Send, Gift, ShieldCheck, 
  ArrowRight, Sparkles, CheckCircle2, AlertCircle, LogIn 
} from 'lucide-react';

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    authModalMode, 
    closeAuthModal, 
    openAuthModal, 
    registerAccount, 
    loginAccount, 
    language, 
    t 
  } = useBingo();

  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authModalMode) {
      setActiveTab(authModalMode);
    }
  }, [authModalMode]);

  // Pre-fill from Telegram if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const tg = (window as any).Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser) {
        if (!name && (tgUser.first_name || tgUser.last_name)) {
          setName(`${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim());
        }
        if (!username && tgUser.username) {
          setUsername(tgUser.username);
        }
        if (!telegramId && tgUser.id) {
          setTelegramId(String(tgUser.id));
        }
      }
    }
  }, [isAuthModalOpen, name, username, telegramId]);

  if (!isAuthModalOpen) return null;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg(language === 'am' ? 'እባክዎ ሙሉ ስምዎን ያስገቡ' : 'Please enter your full name');
      return;
    }

    if (!phone.trim()) {
      setErrorMsg(language === 'am' ? 'እባክዎ የኢትዮጵያ ስልክ ቁጥር ያስገቡ' : 'Please enter your Ethiopian phone number');
      return;
    }

    // Clean phone number
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const ethRegex = /^(\+251[79]\d{8}|0[79]\d{8})$/;
    if (!ethRegex.test(cleanPhone)) {
      setErrorMsg(
        language === 'am'
          ? 'እባክዎ ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (ለምሳሌ 0911234567 ወይም +251911234567)'
          : 'Please enter a valid Ethiopian phone number (e.g. 0911234567 or +251911234567)'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await registerAccount({
        name: name.trim(),
        phone: cleanPhone,
        username: username.trim() || undefined,
        telegramId: telegramId.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to create account');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loginIdentifier.trim()) {
      setErrorMsg(
        language === 'am'
          ? 'እባክዎ ስልክ ቁጥርዎን ወይም የቴሌግራም መታወቂያዎን ያስገቡ'
          : 'Please enter your registered phone number or Telegram ID'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await loginAccount(loginIdentifier.trim());
      if (!res.success) {
        setErrorMsg(res.message || 'Account not found');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md glass-panel p-6 sm:p-7 rounded-3xl border-slate-700/80 shadow-2xl space-y-5 bg-[#0e1220]/95">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight">
            {activeTab === 'register' 
              ? (language === 'am' ? 'የቢንጎ አካውንት ይክፈቱ' : 'Open Your Bingo Account')
              : (language === 'am' ? 'ወደ አካውንትዎ ይግቡ' : 'Sign In to Account')}
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {activeTab === 'register'
              ? (language === 'am' 
                  ? 'እውነተኛ ገንዘብ በሚያሸልሙ 75-ኳስ ጨዋታዎች ለመሳተፍ እና አሸናፊነትዎን በቴሌብር እና ሲቢኢ ብር ለማውጣት ይመዝገቡ'
                  : 'Open an account to play live 75-Ball games and withdraw cash winnings to Telebirr & CBE Birr.')
              : (language === 'am'
                  ? 'ያስመዘገቡትን ስልክ ቁጥር ወይም ቴሌግራም መታወቂያ በማስገባት ይግቡ'
                  : 'Enter your registered Ethiopian phone number or Telegram ID to access your wallet.')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg transition text-center ${
              activeTab === 'register'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'am' ? 'አካውንት ክፈት (አዲስ)' : 'Open Account (New)'}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg transition text-center ${
              activeTab === 'login'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'am' ? 'ግባ (ያለህ)' : 'Sign In (Existing)'}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── REGISTER FORM ── */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                {language === 'am' ? 'ሙሉ ስም *' : 'Full Name *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Bikila"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 pl-9"
                />
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                {language === 'am' ? 'የኢትዮጵያ ስልክ ቁጥር (ቴሌብር / ሲቢኢ ብር) *' : 'Ethiopian Phone Number (Telebirr / CBE) *'}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="0911234567 or +251911234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 pl-9 font-mono"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {language === 'am' ? 'ገንዘብ ገቢና ወጪ ለማድረግ ይጠቅማል' : 'Used for instant Telebirr & CBE Birr deposits and cashouts'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {language === 'am' ? 'የተጠቃሚ ስም (አማራጭ)' : 'Username (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. abebe_b"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {language === 'am' ? 'የቴሌግራም መታወቂያ' : 'Telegram ID / User'}
                </label>
                <input
                  type="text"
                  placeholder="Auto or optional"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                {language === 'am' ? 'የጋባዥ ኮድ (አማራጭ)' : 'Referral Code (Optional)'}
              </label>
              <input
                type="text"
                placeholder="e.g. BINGO123"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 uppercase font-mono"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {language === 'am' 
                  ? '🎁 አዲስ ተመዝጋቢዎች 50 ብር የጀማሪ ቦነስ ያገኛሉ!' 
                  : '🎁 New accounts receive 50 ETB Starter Bonus credited to your wallet!'}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>{language === 'am' ? 'በመክፈት ላይ...' : 'Creating Account...'}</span>
              ) : (
                <>
                  <span>{language === 'am' ? 'አካውንት ክፈትና ጀምር' : 'Open Account & Start Playing'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── LOGIN FORM ── */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                {language === 'am' ? 'የተመዘገበ ስልክ ቁጥር ወይም ቴሌግራም ID' : 'Registered Phone Number or Telegram ID'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. 0911234567 or Telegram ID"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 pl-9 font-mono"
                />
                <LogIn className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {language === 'am' 
                  ? 'በምዝገባ ወቅት ያስገቡትን ስልክ ቁጥር ወይም ቴሌግራም መታወቂያ ይጠቀሙ'
                  : 'Use the phone number or Telegram ID provided during registration'}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>{language === 'am' ? 'በመግባት ላይ...' : 'Signing In...'}</span>
              ) : (
                <>
                  <span>{language === 'am' ? 'ግባ' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Security Notice */}
        <div className="pt-1 text-center">
          <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            100% Secure • Real Ethiopian Birr • Instant Telebirr / CBE
          </span>
        </div>
      </div>
    </div>
  );
}
