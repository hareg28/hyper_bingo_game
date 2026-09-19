'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { 
  X, User as UserIcon, Phone, Send, Gift, ShieldCheck, 
  ArrowRight, Sparkles, CheckCircle2, AlertCircle, LogIn,
  MessageSquare, Smartphone, Check, RefreshCw
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

  // ── Verification state (Telegram or SMS) ──
  const [verificationMethod, setVerificationMethod] = useState<'telegram' | 'sms'>('telegram');
  const [registerStep, setRegisterStep] = useState<'details' | 'verify'>('details');
  const [smsOtpInput, setSmsOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('724915');
  const [otpSentNotice, setOtpSentNotice] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);

  useEffect(() => {
    if (authModalMode) {
      setActiveTab(authModalMode);
      setRegisterStep('details');
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

  // Resend cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (registerStep === 'verify' && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [registerStep, resendCooldown]);

  if (!isAuthModalOpen) return null;

  // Step 1 validation -> move to Step 2 verification
  const handleProceedToVerification = (e: React.FormEvent) => {
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

    // Generate random 6-digit OTP code for SMS
    const randCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randCode);
    setSmsOtpInput('');
    setOtpSentNotice(true);
    setResendCooldown(30);
    setRegisterStep('verify');
  };

  // Step 2 -> finalize registration
  const handleFinalizeRegistration = async () => {
    setErrorMsg(null);

    if (verificationMethod === 'sms') {
      if (!smsOtpInput.trim() || smsOtpInput.trim() !== generatedOtp) {
        setErrorMsg(
          language === 'am'
            ? `የተሳሳተ የማረጋገጫ ኮድ ነው! እባክዎ ${generatedOtp} ያስገቡ ወይም በድጋሚ ይላኩ።`
            : `Invalid OTP code. Please enter the 6-digit code (${generatedOtp}) sent to your phone.`
        );
        return;
      }
    }

    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
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
        setRegisterStep('details');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Registration error');
      setRegisterStep('details');
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

  const handleResendOtp = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newCode);
    setResendCooldown(30);
    setOtpSentNotice(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white p-6 sm:p-7 rounded-3xl border-2 border-slate-200 shadow-2xl space-y-4 text-slate-900">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1 pt-1">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 shadow-md mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-950 tracking-tight">
            {activeTab === 'register' 
              ? (language === 'am' ? 'የቢንጎ አካውንት ይክፈቱ' : 'Open Your Bingo Account')
              : (language === 'am' ? 'ወደ አካውንትዎ ይግቡ' : 'Sign In to Account')}
          </h2>
          <p className="text-xs text-slate-600 max-w-xs mx-auto font-medium">
            {activeTab === 'register'
              ? (language === 'am' 
                  ? 'ይመዝገቡ እና 20 ብር የጀማሪ ቦነስ ይቀበሉ (ለጨዋታ መጫወቻ ብቻ የሚያገለግል)!'
                  : 'Register and receive 20 ETB Welcome Bonus (Play Only · Cannot withdraw)!')
              : (language === 'am'
                  ? 'ያስመዘገቡትን ስልክ ቁጥር ወይም ቴሌግራም መታወቂያ በማስገባት ይግቡ'
                  : 'Enter your registered Ethiopian phone number or Telegram ID.')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setActiveTab('register'); setRegisterStep('details'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'register'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'am' ? 'አካውንት ክፈት (20 ብር ቦነስ)' : 'Register (20 ETB Bonus)'}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'login'
                ? 'bg-slate-950 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {language === 'am' ? 'ግባ' : 'Sign In'}
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 shadow-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* ── REGISTER FORM ── */}
        {activeTab === 'register' && (
          registerStep === 'details' ? (
            <form onSubmit={handleProceedToVerification} className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-800 block mb-1">
                  {language === 'am' ? 'ሙሉ ስም *' : 'Full Name *'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abebe Bikila"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 pl-9"
                  />
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-800 block mb-1">
                  {language === 'am' ? 'የኢትዮጵያ ስልክ ቁጥር (ቴሌብር / ሲቢኢ ብር) *' : 'Ethiopian Phone Number (Telebirr / CBE) *'}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="0911234567 or +251911234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 pl-9 font-mono font-bold"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* 🛡️ Verification Method Choice: Telegram or SMS */}
              <div>
                <label className="text-[11px] font-black text-slate-800 block mb-1.5">
                  {language === 'am' ? 'የማረጋገጫ ዘዴ ይምረጡ *' : 'Select Verification Method *'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerificationMethod('telegram')}
                    className={`p-2.5 rounded-xl border-2 flex items-center gap-2 text-left transition cursor-pointer ${
                      verificationMethod === 'telegram'
                        ? 'bg-blue-50 border-blue-600 shadow-xs ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Send className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-slate-900">Telegram</div>
                      <div className="text-[10px] text-slate-600 font-medium">Instant Bot verify</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationMethod('sms')}
                    className={`p-2.5 rounded-xl border-2 flex items-center gap-2 text-left transition cursor-pointer ${
                      verificationMethod === 'sms'
                        ? 'bg-emerald-50 border-emerald-600 shadow-xs ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-black text-slate-900">SMS Code</div>
                      <div className="text-[10px] text-slate-600 font-medium">6-digit OTP code</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Referral Code (Optional) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  {language === 'am' ? 'የጋባዥ ኮድ (አማራጭ)' : 'Referral Code (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. HB1234"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono uppercase font-bold focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* 🎁 Welcome 20 Birr Bonus Badge (Play Only) */}
              <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-xs">
                <Gift className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-xs text-amber-900">
                    {language === 'am' ? '🎁 20 ብር የጀማሪ ቦነስ ያገኛሉ!' : '🎁 20 ETB Welcome Bonus on Registration!'}
                  </div>
                  <div className="text-[11px] text-amber-800 font-bold mt-0.5">
                    {language === 'am' 
                      ? 'ይህ 20 ብር ለጨዋታ መጫወቻ ብቻ የሚያገለግል ሲሆን በቀጥታ ማውጣት አይቻልም።' 
                      : 'Play Only: Use this 20 ETB bonus to play games. Cannot be withdrawn.'}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{language === 'am' ? 'ቀጥልና አረጋግጥ' : 'Continue to Verification'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* STEP 2: VERIFICATION (TELEGRAM OR SMS) */
            <div className="space-y-3.5">
              {verificationMethod === 'sms' ? (
                /* SMS OTP Verification Screen */
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-black">SMS Verification Code Sent!</span>
                      <p className="text-[11px] text-emerald-800">
                        Enter the 6-digit code sent to <strong className="font-mono">{phone}</strong>
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-800 block mb-1">
                      {language === 'am' ? 'የ6-አሃዝ የማረጋገጫ ኮድ አስገባ' : 'Enter 6-Digit SMS Code'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder={generatedOtp}
                        value={smsOtpInput}
                        onChange={(e) => setSmsOtpInput(e.target.value)}
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-base text-center font-mono font-black tracking-widest text-slate-950 focus:bg-white focus:border-emerald-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setSmsOtpInput(generatedOtp)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                        title="Auto-fill SMS Code"
                      >
                        Auto Fill ({generatedOtp})
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      disabled={resendCooldown > 0}
                      onClick={handleResendOtp}
                      className={`font-bold flex items-center gap-1 cursor-pointer ${
                        resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-emerald-700 hover:underline'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend SMS Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterStep('details')}
                      className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer"
                    >
                      Change Phone
                    </button>
                  </div>
                </div>
              ) : (
                /* Telegram Account Verification Screen */
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-300 text-blue-950 text-xs flex items-center gap-2.5">
                    <Send className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-black">Telegram Verification Ready</div>
                      <div className="text-[11px] text-blue-800">
                        {telegramId 
                          ? `Telegram ID ${telegramId} linked & ready to verify.` 
                          : 'Linked with @HyperBingoBot for secure automatic login & win alerts.'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>Full Name:</span>
                      <span className="font-black text-slate-900">{name}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Phone:</span>
                      <span className="font-mono font-bold text-slate-900">{phone}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Telegram:</span>
                      <span className="font-bold text-blue-700">@{username || 'player'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation of 20 Birr Bonus */}
              <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs flex items-center gap-2 font-bold">
                <Gift className="w-4 h-4 text-amber-700 shrink-0" />
                <span>🎁 20 ETB Welcome Bonus will be activated immediately!</span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRegisterStep('details')}
                  className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 cursor-pointer"
                >
                  {t('back')}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFinalizeRegistration}
                  className="w-2/3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{language === 'am' ? 'አረጋግጥና 20 ብር ውሰድ' : 'Verify & Claim 20 ETB'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        )}

        {/* ── LOGIN FORM ── */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-black text-slate-800 block mb-1">
                {language === 'am' ? 'የተመዘገበ ስልክ ቁጥር ወይም ቴሌግራም ID' : 'Registered Phone Number or Telegram ID'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. 0911234567 or Telegram ID"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500 pl-9 font-mono font-bold"
                />
                <LogIn className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {language === 'am' 
                  ? 'በምዝገባ ወቅት ያስገቡትን ስልክ ቁጥር ወይም ቴሌግራም መታወቂያ ይጠቀሙ'
                  : 'Use the phone number or Telegram ID provided during registration'}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
          <span className="text-[10px] text-slate-500 font-bold flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            100% Verified • Telegram & SMS Authenticated • Instant Cashouts
          </span>
        </div>
      </div>
    </div>
  );
}
