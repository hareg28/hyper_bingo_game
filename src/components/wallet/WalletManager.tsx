'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { PaymentProvider, LinkedPaymentAccount, LinkedAccountType } from '../../lib/types';
import { formatETB } from '../../lib/bingoUtils';
import {
  Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck,
  Smartphone, Landmark, History, Plus, Trash2,
  CheckCircle, Clock, XCircle, Star, ChevronRight, ExternalLink,
  Upload, Camera, QrCode, Copy, Check, X, Lock, Phone, Zap, AlertCircle,
} from 'lucide-react';

declare global {
  interface Window { Telegram?: { WebApp?: any }; }
}

export default function WalletManager() {
  const { wallet, transactions, depositWallet, submitPendingDeposit, requestWithdrawal, user, openAuthModal, t, language } = useBingo();
  const isAm = language === 'am';

  const [activeTab, setActiveTab] = useState<'balance' | 'deposit' | 'withdraw' | 'accounts' | 'history'>('balance');

  // ── Direct Pay (CBE / Telebirr / M-Pesa) state ─────────────────────────────
  const [showDirectPay, setShowDirectPay] = useState(false);
  const [directPayProvider, setDirectPayProvider] = useState<'Telebirr' | 'CBE Birr' | 'M-Pesa'>('Telebirr');
  const [directPayAmount, setDirectPayAmount] = useState<number | ''>(100);
  const [directPayPhone, setDirectPayPhone] = useState('');
  const [directPayStep, setDirectPayStep] = useState<1 | 2 | 3>(1); // 1=select, 2=sms/passcode, 3=success
  const [directPayOtpToken, setDirectPayOtpToken] = useState('');
  const [directPayPasscode, setDirectPayPasscode] = useState('');
  const [directPayLoading, setDirectPayLoading] = useState(false);
  const [directPayError, setDirectPayError] = useState('');
  const [directPaySuccess, setDirectPaySuccess] = useState('');
  const [directPayCountdown, setDirectPayCountdown] = useState<number>(60);
  const [depositMode, setDepositMode] = useState<'direct' | 'manual'>('direct');
  const [simulatedIncomingSms, setSimulatedIncomingSms] = useState<{
    provider: string;
    code: string;
    amount: number;
    phone: string;
    text: string;
    time: string;
  } | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>('Telebirr');
  const [amount, setAmount] = useState<number | ''>(100);
  const [phoneOrAccount, setPhoneOrAccount] = useState<string>(() => user?.phone || '');

  // Auto-detect network operator from phone number
  const isSafaricomPhone = (p: string) => {
    const clean = p.replace(/\D/g, '');
    return clean.startsWith('2517') || clean.startsWith('07') || clean.startsWith('7');
  };

  // Init directPayPhone from user phone and auto-select provider
  useEffect(() => {
    if (user?.phone && !directPayPhone) {
      setDirectPayPhone(user.phone);
      if (isSafaricomPhone(user.phone)) {
        setDirectPayProvider('M-Pesa');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.phone]);

  // Countdown timer for SMS resend
  useEffect(() => {
    if (directPayStep !== 2 || directPayCountdown <= 0) return;
    const timer = setInterval(() => {
      setDirectPayCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [directPayStep, directPayCountdown]);
  const [accountName, setAccountName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [depositStep, setDepositStep] = useState<1 | 2>(1);
  const [depositReference, setDepositReference] = useState<string>('');
  const [transactionCode, setTransactionCode] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // QR Code State — generated IMMEDIATELY when entering deposit step 2 (no manual click needed)
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [copiedPaymentText, setCopiedPaymentText] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [fullPaymentText, setFullPaymentText] = useState<string>('');
  const [destinationNumber, setDestinationNumber] = useState<string>('');

  // Auto-generate QR code + payment text the moment user enters step 2 with amount + reference set
  useEffect(() => {
    if (depositStep !== 2) return;
    if (!depositReference) return;
    if (!amount || (typeof amount === 'number' && amount <= 0)) return;

    // Resolve destination account per provider
    let dest = '';
    if (provider === 'Telebirr') dest = 'Telebirr: 0938922481 (Yohannes Tsehaye Bayleyegn)';
    else if (provider === 'CBE Birr') dest = 'CBE Birr / Phone: 0938922481 / CBE Acct: 1000540829954';
    else if (provider === 'M-Pesa') dest = 'Safaricom M-Pesa: 0710798482 (Yohannes Tsehaye)';
    else dest = 'CBE Account: 1000540829954 (Yohannes Tsehaye Bayleyegn)';

    setDestinationNumber(dest);

    // One-line exact payment text so user cannot mismatch the amount
    const payText = `Pay ${amount} ETB via ${provider}. Destination: ${dest}. Remark/Reference: ${depositReference}. Name: ${user?.name || 'Player'} (${user?.username || user?.id || '—'}).`;
    setFullPaymentText(payText);

    // Generate QR using a public QR image service (no install needed) — encodes the exact amount + provider + reference
    const qrPayload = `HYPERBINGO_DEPOSIT\nProvider: ${provider}\nAmount: ${amount} ETB\nReference: ${depositReference}\nDestination: ${dest}\nPlayer: ${user?.username || user?.id || user?.name || 'guest'}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=6&data=${encodeURIComponent(qrPayload)}`;
    setQrDataUrl(qrUrl);
  }, [depositStep, depositReference, amount, provider, user?.id, user?.username, user?.name]);

  const handleCopyRef = (textToCopy: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleCopyFullPayment = () => {
    if (!fullPaymentText) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullPaymentText);
      setCopiedPaymentText(true);
      setTimeout(() => setCopiedPaymentText(false), 2500);
    }
  };

  // Payment screenshot state (REQUIRED by owner)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setScreenshotError(null);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScreenshotError('Please upload an image file (PNG, JPG, JPEG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setScreenshotError('Image size exceeds 5MB limit. Please upload a smaller image.');
      return;
    }

    setScreenshotFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setScreenshotPreview(result);
      setScreenshotBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshotPreview(null);
    setScreenshotBase64(null);
    setScreenshotFileName(null);
    setScreenshotError(null);
  };

  // Linked Accounts state
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedPaymentAccount[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountType, setNewAccountType] = useState<LinkedAccountType>('TELEBIRR');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // Load linked accounts
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/accounts?userId=${user.id}`)
      .then(r => r.json())
      .then(res => { if (res.success) setLinkedAccounts(res.data ?? []); })
      .catch(() => {});
  }, [user?.id]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  // ── Deposit (manual: screenshot/code — goes to admin review) ───────────────
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.id === 'usr_guest') {
      openAuthModal('register');
      return;
    }
    const depositAmt = typeof amount === 'number' ? amount : Number(amount) || 0;
    if (depositAmt < 10) {
      showStatus('error', 'Minimum deposit is 10 ETB (ዝቅተኛው ተቀማጭ መጠን 10 ብር ነው).');
      return;
    }

    if (depositStep === 1) {
      setDepositStep(2);
      setDepositReference(`HBINGO_${user.id}_${Date.now()}`);
      return;
    }

    // Validation: must provide EITHER Transaction Code/SMS OR a Screenshot
    const code = transactionCode.trim();
    if (!code && !screenshotBase64) {
      setScreenshotError(
        isAm
          ? 'እባክዎ የባንክ/ቴሌብር የክፍያ መለያ ቁጥር (Transaction ID / FT) ያስገቡ ወይም ደረሰኝ ያያይዙ።'
          : 'Please enter your Transaction Reference Code / FT number or attach a payment receipt.'
      );
      showStatus(
        'error',
        isAm
          ? 'የክፍያ መለያ ቁጥር (Transaction ID) ወይም ደረሰኝ ማስገባት ግዴታ ነው!'
          : 'Please enter your Transaction ID or attach a payment receipt.'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId:          user?.id,
          amount:          depositAmt,
          mode:            'manual',
          provider,
          depositReference,
          transactionCode: code,
          screenshot:      screenshotBase64,
          senderPhone:     user.phone || phoneOrAccount,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Do NOT credit wallet locally — admin must verify first
        showStatus(
          'success',
          isAm
            ? `✅ ክፍያዎ ለአስተዳዳሪ ተልኳል! ${depositAmt} ብር ከተረጋገጠ በኋላ ወደ ሂሳብዎ ይገባል።`
            : `✅ Deposit of ${depositAmt} ETB submitted for review! Your balance will be credited once an admin verifies your payment.`
        );
        setActiveTab('balance');
        setDepositStep(1);
        setTransactionCode('');
        handleRemoveScreenshot();
      } else {
        showStatus('error', data.error ?? (isAm ? 'ክፍያ ሂደት አልተሳካም። ደጋፊ ቡድን ያሳዩ።' : 'Deposit failed. Please contact support with your receipt.'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[Deposit UI Error]:', err);
      showStatus('error', msg || (isAm ? 'የኔትወርክ ችግር አጋጥሟል። እባክዎ እንደገና ይሞክሩ።' : 'Network error. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ── ArifPay Hosted Checkout (automatic, real payment) ──────────────────────
  const handleArifPayCheckout = async (customAmt?: number) => {
    if (!user || user.id === 'usr_guest') { openAuthModal('register'); return; }
    const depositAmt = customAmt ?? (typeof amount === 'number' ? amount : Number(amount) || 0);
    if (depositAmt < 10) {
      showStatus('error', isAm ? 'ዝቅተኛው ተቀማጭ መጠን 10 ብር ነው' : 'Minimum deposit is 10 ETB.');
      return;
    }
    setIsProcessing(true);
    setDirectPayLoading(true);
    setDirectPayError('');
    try {
      const res = await fetch('/api/payments/deposit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: user.id, amount: depositAmt, mode: 'arifpay' }),
      });
      const data = await res.json();
      if (data.success && data.data?.checkoutUrl) {
        setShowDirectPay(false);
        showStatus(
          'success',
          isAm
            ? `የ ${depositAmt} ብር ክፍያ ተፈጥሯል (PENDING)። ወደ ክፍያ ገጽ በማዘዋወር ላይ...`
            : `Pending transaction created! Redirecting to secure payment for ${depositAmt} ETB...`
        );
        const url = data.data.checkoutUrl;
        const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
        if (tg && typeof tg.openLink === 'function') {
          tg.openLink(url);
        } else {
          window.location.href = url;
        }
      } else {
        const err = data.error ?? (isAm ? 'የክፍያ ሂደቱን መጀመር አልተቻለም። እባክዎ በድጋሚ ይሞክሩ።' : 'Failed to start payment. Please try again or use manual deposit.');
        setDirectPayError(err);
        showStatus('error', err);
      }
    } catch {
      const err = isAm ? 'የኔትወርክ ስህተት ተፈጥሯል' : 'Network error. Please try again.';
      setDirectPayError(err);
      showStatus('error', err);
    } finally {
      setIsProcessing(false);
      setDirectPayLoading(false);
    }
  };


  // ── Withdrawal ───────────────────────────────────────────────────────────
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('register');
      return;
    }
    const withdrawAmt = typeof amount === 'number' ? amount : Number(amount) || 0;
    if (withdrawAmt < 50) {
      showStatus('error', 'Minimum withdrawal is 50 ETB (ዝቅተኛው የማውጣት መጠን 50 ብር ነው).');
      return;
    }
    if (withdrawAmt > (wallet.availableBalance + wallet.winningBalance)) {
      showStatus('error', 'Insufficient withdrawable balance.');
      return;
    }
    if (!phoneOrAccount || !accountName) {
      showStatus('error', 'Please fill in account number and account holder name.');
      return;
    }
    setIsProcessing(true);
    try {
      const ok = await requestWithdrawal(withdrawAmt, provider, phoneOrAccount, accountName);
      if (ok) {
        showStatus(
          'success',
          isAm
            ? `✅ ${withdrawAmt} ብር የማውጣት ጥያቄ ተልኳል! ከተረጋገጠ በኋላ ወደ ${provider} (${phoneOrAccount}) ይላካል።`
            : `✅ Withdrawal of ${withdrawAmt} ETB submitted! Funds will be sent to ${provider} (${phoneOrAccount}) after admin review — usually within a few hours.`
        );
        setActiveTab('balance');
      }
    } catch {
      showStatus('error', isAm ? 'ገንዘብ ማውጣት አልተሳካም። እባክዎ እንደገና ይሞክሩ።' : 'Withdrawal failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Add Linked Account ────────────────────────────────────────────────────
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('register');
      return;
    }
    if (!newAccountNumber || !newAccountName) return;
    setAddingAccount(true);
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: newAccountType,
          accountNumber: newAccountNumber,
          accountName: newAccountName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLinkedAccounts(prev => [...prev, data.data]);
        setShowAddAccount(false);
        setNewAccountNumber('');
        setNewAccountName('');
        showStatus('success', 'Account linked! Pending verification.');
      } else {
        showStatus('error', data.error ?? 'Failed to link account');
      }
    } catch {
      showStatus('error', 'Network error. Please try again.');
    } finally {
      setAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await fetch(`/api/accounts?userId=${user?.id}&accountId=${accountId}`, { method: 'DELETE' });
      setLinkedAccounts(prev => prev.filter(a => a.id !== accountId));
      showStatus('success', 'Account removed successfully.');
    } catch {
      showStatus('error', 'Failed to remove account.');
    }
  };

  const accountTypeLabel: Record<LinkedAccountType, string> = {
    TELEBIRR: 'Telebirr',
    CBE_BIRR: 'CBE Birr',
    AWASH_BIRR: 'Awash Birr',
    BANK_TRANSFER: 'Bank Transfer',
  };

  const statusIcon = (s: string) => {
    if (s === 'VERIFIED') return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
    if (s === 'REJECTED') return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
    return <Clock className="w-3.5 h-3.5 text-amber-600" />;
  };


  // ── Direct Pay handlers ──────────────────────────────────────────────────
  const handleDirectPaySendOtp = async () => {
    if (!user || user.id === 'usr_guest') { openAuthModal('register'); return; }
    const amt = typeof directPayAmount === 'number' ? directPayAmount : Number(directPayAmount) || 0;
    if (amt < 10) { setDirectPayError(isAm ? 'ዝቅተኛ ተቀማጭ 10 ብር ነው' : 'Minimum deposit is 10 ETB'); return; }
    if (!directPayPhone || directPayPhone.replace(/\D/g,'').length < 9) {
      setDirectPayError(isAm ? 'ትክክለኛ ስልክ ቁጥር ያስገቡ' : 'Enter a valid phone number'); return;
    }

    // Network operator validation: Safaricom vs Ethio Telecom
    const cleanPhone = directPayPhone.replace(/\D/g, '');
    const isSafaricom = cleanPhone.startsWith('2517') || cleanPhone.startsWith('07') || cleanPhone.startsWith('7');
    if (directPayProvider === 'Telebirr' && isSafaricom) {
      setDirectPayError(
        isAm
          ? '⚠️ 07... የ Safaricom ቁጥር ነው። ቴሌብር የሚሰራው በ Ethio Telecom (09...) ቁጥሮች ብቻ ነው። እባክዎ M-Pesa ወይም CBE ወይም Chapa ይምረጡ!'
          : '⚠️ 07... is a Safaricom number. Telebirr requires an Ethio Telecom (09...) number. Please select M-Pesa, CBE, or Chapa!'
      );
      return;
    }
    if (directPayProvider === 'M-Pesa' && !isSafaricom) {
      setDirectPayError(
        isAm
          ? '⚠️ 09... የ Ethio Telecom ቁጥር ነው። M-Pesa የሚሰራው በ Safaricom (07...) ቁጥሮች ብቻ ነው። እባክዎ ቴሌብር ወይም CBE ይምረጡ!'
          : '⚠️ 09... is an Ethio Telecom number. M-Pesa requires a Safaricom (07...) number. Please select Telebirr or CBE!'
      );
      return;
    }

    setDirectPayLoading(true);
    setDirectPayError('');
    try {
      const res = await fetch('/api/payments/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp', userId: user.id, amount: amt, provider: directPayProvider, phone: directPayPhone }),
      });
      const data = await res.json();
      if (data.success) {
        setDirectPayOtpToken(data.data.otpToken);
        setDirectPayStep(2);
        setDirectPayError('');
        setDirectPayCountdown(60);

        const code = data.data.smsCode || String(Math.floor(100000 + Math.random() * 900000));
        const smsTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const providerTag = directPayProvider === 'Telebirr' ? 'Telebirr (127)' : directPayProvider === 'M-Pesa' ? 'M-Pesa (Safaricom)' : 'CBE (889)';
        const defaultText = `[${providerTag}] HyperBingo deposit authorization: ${amt} ETB will be deducted from your account. Your verification code is ${code}. Please enter your ${directPayProvider} secret passcode/PIN to approve.`;

        setSimulatedIncomingSms({
          provider: directPayProvider,
          code,
          amount: amt,
          phone: directPayPhone,
          text: data.data.smsMessage || defaultText,
          time: smsTime,
        });
      } else {
        setDirectPayError(data.error || (isAm ? 'ክፍያ ጀማሪ ሲሆን ስህተት ተፈጥሯል' : 'Failed to initiate payment'));
      }
    } catch {
      setDirectPayError(isAm ? 'ኔትወርክ ስህተት ተፈጥሯል' : 'Network error. Please try again.');
    } finally {
      setDirectPayLoading(false);
    }
  };

  const handleDirectPayVerify = async () => {
    if (!user || user.id === 'usr_guest') { openAuthModal('register'); return; }
    if (!directPayPasscode || directPayPasscode.trim().length < 4) {
      setDirectPayError(isAm ? 'ትክክለኛ የይለፍ ቃል ያስገቡ (ቢያንስ 4 ቁጥሮች)' : 'Enter your passcode (minimum 4 digits)'); return;
    }
    setDirectPayLoading(true);
    setDirectPayError('');
    try {
      const res = await fetch('/api/payments/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_passcode', userId: user.id, passcode: directPayPasscode, otpToken: directPayOtpToken }),
      });
      const data = await res.json();
      if (data.success) {
        const amt = data.data.amount;
        // Update local wallet immediately
        await depositWallet(amt, directPayProvider, data.data.txRef);
        setDirectPayStep(3);
        const confirmMsg = data.data.message || (
          isAm 
            ? `${amt} ብር ከ ${directPayProvider} ሂሳብዎ ተቀንሶ ወደ ቢንጎ ቦርሳዎ ገብቷል!` 
            : `${amt} ETB deducted from your ${directPayProvider} account and credited to your wallet!`
        );
        setDirectPaySuccess(confirmMsg);
        setDirectPayPasscode('');
        setSimulatedIncomingSms(null);
      } else {
        setDirectPayError(data.error || (isAm ? 'የይለፍ ቃሉ ትክክል አልሆነም' : 'Invalid passcode. Please try again.'));
      }
    } catch {
      setDirectPayError(isAm ? 'ኔትወርክ ስህተት ተፈጥሯል' : 'Network error. Please try again.');
    } finally {
      setDirectPayLoading(false);
    }
  };

  const resetDirectPay = () => {
    setDirectPayStep(1);
    setDirectPayOtpToken('');
    setDirectPayPasscode('');
    setDirectPayError('');
    setDirectPaySuccess('');
    setDirectPayAmount(100);
    setSimulatedIncomingSms(null);
    setShowDirectPay(false);
  };

  return (
    <div className="space-y-3.5 max-w-lg mx-auto pb-16">
      {/* Floating Simulated SMS Push Notification */}
      {simulatedIncomingSms && (
        <div className="fixed top-3 left-3 right-3 max-w-md mx-auto z-50 animate-in slide-in-from-top-3 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-xl border border-white/20 text-white rounded-2xl p-3.5 shadow-2xl flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs shadow-md ${
              simulatedIncomingSms.provider === 'Telebirr' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
            }`}>
              {simulatedIncomingSms.provider === 'Telebirr' ? 'TB' : 'CBE'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[11px] font-black text-white/90 truncate">
                  SMS • {simulatedIncomingSms.provider === 'Telebirr' ? 'Telebirr (127)' : 'CBE (889)'}
                </span>
                <span className="text-[10px] text-white/50">{simulatedIncomingSms.time}</span>
              </div>
              <p className="text-[11px] text-white/80 line-clamp-2 leading-tight font-medium">
                {simulatedIncomingSms.text}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDirectPayPasscode(simulatedIncomingSms.code);
                    setShowDirectPay(true);
                    setDirectPayStep(2);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] shadow-sm flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  ⚡ {isAm ? 'ኮዱን አስገባ' : 'Auto-Fill Code'} ({simulatedIncomingSms.code})
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedIncomingSms(null)}
                  className="text-[10px] text-white/40 hover:text-white/80 transition cursor-pointer px-1 py-1"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs ${
          statusMsg.type === 'success'
            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
            : 'bg-rose-100 text-rose-950 border border-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-700" /> : <XCircle className="w-4 h-4 text-rose-700" />}
          {statusMsg.text}
        </div>
      )}

      {/* Guest Mode Banner */}
      {!user && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-200 border border-amber-400 flex items-center justify-center text-amber-900 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900">Open an Account to Transact</div>
              <div className="text-[11px] text-slate-600 font-medium">Register with your Ethiopian phone to deposit & withdraw real ETB</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('register')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-xs shrink-0 cursor-pointer"
          >
            Register
          </button>
        </div>
      )}

      {/* Wallet Balance Card */}
      <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">{t('walletETB')}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
            {t('active')}
          </span>
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{t('availableBalance')}</div>
          <div className="text-3xl font-black text-amber-700 tracking-tight mt-0.5">
            {formatETB(wallet.availableBalance)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 font-bold block">{t('winningBalance')}</span>
            <div className="font-black text-emerald-700 text-sm mt-0.5">{formatETB(wallet.winningBalance)}</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 font-bold block">{t('bonusBalance')}</span>
            <div className="font-black text-purple-700 text-sm mt-0.5">{formatETB(wallet.bonusBalance)}</div>
            <div className="text-[9px] text-amber-800 font-bold mt-0.5 leading-tight">Play Only<br/>Non-withdrawable</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-600 font-bold block">{t('linkedAccts')}</span>
            <div className="font-black text-blue-700 text-sm mt-0.5">{linkedAccounts.length}</div>
          </div>
        </div>
      </div>

      {/* ── DIRECT DEPOSIT ACCOUNT INFO CARD ─────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-xl space-y-3 relative overflow-hidden border border-amber-500/30">
        <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-xl shrink-0">
            🏦
          </div>
          <div>
            <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              {isAm ? 'ቀጥታ ወደ ሂሳባችን ያስተላልፉ' : 'Send Directly to Our Accounts'}
              <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded-md">REAL</span>
            </div>
            <div className="text-[10px] text-slate-300 font-medium">
              {isAm ? 'ቴሌብር • M-Pesa • CBE Birr • ባንክ ቀጥታ' : 'Telebirr • M-Pesa • CBE Birr • Bank Transfer'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs">
          {/* Telebirr row */}
          <div className="flex items-center justify-between bg-blue-500/10 border border-blue-400/25 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📱</span>
              <div>
                <div className="font-black text-blue-200 text-[11px]">Telebirr (Ethio Telecom 09...)</div>
                <div className="font-mono font-bold text-white text-sm tracking-wide">0938922481</div>
              </div>
            </div>
            <button type="button" onClick={() => handleCopyRef('0938922481')} className="px-2 py-1 bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/40 text-blue-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          {/* M-Pesa row */}
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-400/25 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🟢</span>
              <div>
                <div className="font-black text-emerald-200 text-[11px]">M-Pesa (Safaricom 07...)</div>
                <div className="font-mono font-bold text-white text-sm tracking-wide">0710798482</div>
              </div>
            </div>
            <button type="button" onClick={() => handleCopyRef('0710798482')} className="px-2 py-1 bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-400/40 text-emerald-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          {/* CBE row */}
          <div className="flex items-center justify-between bg-purple-500/10 border border-purple-400/25 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🏦</span>
              <div>
                <div className="font-black text-purple-200 text-[11px]">CBE Birr / CBE Account</div>
                <div className="font-mono font-bold text-white text-sm tracking-wide">1000540829954</div>
              </div>
            </div>
            <button type="button" onClick={() => handleCopyRef('1000540829954')} className="px-2 py-1 bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/40 text-purple-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
        </div>
        <p className="text-[10px] text-amber-300/70 font-bold text-center leading-snug">
          👤 {isAm ? 'ባለቤት: Yohannes Tsehaye Bayleyegn' : 'Account Holder: Yohannes Tsehaye Bayleyegn'}
        </p>
      </div>

      {/* ── INSTANT PAYMENT GATEWAY BUTTONS (TELEBIRR / M-PESA / CBE) ─────────── */}
      <div className="space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-emerald-600" />
          {isAm ? 'ቀጥታ ፈጣን ክፍያ (Telebirr • CBE Birr • M-Pesa)' : 'Instant Mobile & Bank Pay (Telebirr • CBE • M-Pesa)'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Telebirr (09...) */}
          <button
            type="button"
            onClick={() => { setDirectPayProvider('Telebirr'); setDirectPayAmount(100); setShowDirectPay(true); setDirectPayError(''); }}
            className="relative overflow-hidden p-3 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 text-white shadow-md hover:brightness-110 active:scale-95 transition-all flex flex-col items-start gap-1 cursor-pointer border border-blue-400/30"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">📱</span>
              <span className="text-xs font-black">Telebirr</span>
            </div>
            <span className="text-[9px] text-blue-100 font-bold">Ethio (09...)</span>
            <span className="text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded-full mt-1">⚡ INSTANT</span>
          </button>

          {/* Safaricom M-Pesa (07...) */}
          <button
            type="button"
            onClick={() => { setDirectPayProvider('M-Pesa'); setDirectPayAmount(100); setShowDirectPay(true); setDirectPayError(''); }}
            className="relative overflow-hidden p-3 rounded-2xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 text-white shadow-md hover:brightness-110 active:scale-95 transition-all flex flex-col items-start gap-1 cursor-pointer border border-emerald-400/30"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">🟢</span>
              <span className="text-xs font-black">M-Pesa</span>
            </div>
            <span className="text-[9px] text-emerald-100 font-bold">Safari (07...)</span>
            <span className="text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded-full mt-1">⚡ INSTANT</span>
          </button>

          {/* CBE Birr */}
          <button
            type="button"
            onClick={() => { setDirectPayProvider('CBE Birr'); setDirectPayAmount(100); setShowDirectPay(true); setDirectPayError(''); }}
            className="relative overflow-hidden p-3 rounded-2xl bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-600 text-white shadow-md hover:brightness-110 active:scale-95 transition-all flex flex-col items-start gap-1 cursor-pointer border border-purple-400/30"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">🏦</span>
              <span className="text-xs font-black">CBE Birr</span>
            </div>
            <span className="text-[9px] text-purple-100 font-bold">CBE Direct</span>
            <span className="text-[8px] font-black bg-white/20 px-1.5 py-0.5 rounded-full mt-1">⚡ INSTANT</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-500 text-center font-medium px-2">
          {isAm
            ? '💡 በቴሌብር፣ በ CBE Birr፣ በ M-Pesa ወይም በባንክ በቀጥታ ይክፈሉ'
            : '💡 Pay directly with Telebirr, CBE Birr, M-Pesa or Bank Transfer'}
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAm ? 'ወይም በእጅ የባንክ ማስተላለፊያ' : 'Or manual bank transfer'}</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-4 gap-1.5">
        {([
          { id: 'deposit', label: t('depositTab'), icon: ArrowDownRight, color: 'text-emerald-600' },
          { id: 'withdraw', label: t('withdrawTab'), icon: ArrowUpRight, color: 'text-amber-600' },
          { id: 'accounts', label: t('accountsTab'), icon: Landmark, color: 'text-blue-600' },
          { id: 'history', label: t('historyTab'), icon: History, color: 'text-purple-600' },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setDepositStep(1); }}
              className={`py-3 px-1 rounded-xl text-[10px] font-bold transition flex flex-col items-center gap-1 border shadow-xs cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-950 border-slate-950 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.color}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── DEPOSIT FORM ─────────────────────────────────────────────────────── */}
      {activeTab === 'deposit' && (
        <form onSubmit={handleDepositSubmit} className="bg-white p-4 rounded-2xl space-y-4 border-2 border-emerald-300 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <ArrowDownRight className="w-4 h-4 text-emerald-600" /> {t('depositFunds')}
            </h3>
            <span className="text-[10px] font-bold text-slate-600">{t('stepOf')} {depositStep} {t('of')} 2</span>
          </div>

          {depositStep === 1 ? (
            <>
              {/* ⚡ DIRECT DEPOSIT GATEWAY (TELEBIRR & CBE) */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-green-100 p-3.5 rounded-2xl border-2 border-emerald-400 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    {isAm ? 'ቀጥታ የክፍያ በር (Telebirr & CBE)' : 'Direct Instant Gateway'}
                  </span>
                  <span className="text-[9px] font-black bg-emerald-700 text-white px-2 py-0.5 rounded-full shadow-xs uppercase">
                    ⚡ {isAm ? 'በቅጽበት የሚቀነስና የሚሞላ' : 'Instant SMS & PIN'}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 font-medium leading-snug">
                  {isAm
                    ? 'ስልክዎን ያስገቡ፤ በስልክዎ የደረሰዎትን SMS እና Passcode በማስገባት ሂሳብዎን በቅጽበት ይሙሉ!'
                    : 'Enter phone number, receive SMS, and enter your passcode/PIN to deduct Birr and credit your wallet immediately.'}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => { setDirectPayProvider('Telebirr'); setShowDirectPay(true); setDirectPayStep(1); setDirectPayError(''); }}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📱 Telebirr Direct</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDirectPayProvider('CBE Birr'); setShowDirectPay(true); setDirectPayStep(1); setDirectPayError(''); }}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-black text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>🏦 CBE Direct</span>
                  </button>
                </div>
              </div>

              {/* Payment Provider */}
              <div>
                <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-2">
                  {isAm ? 'የክፍያ ዘዴ ምረጡ (Manual Transfer)' : 'Choose Payment Method'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { name: 'Telebirr', icon: Smartphone, color: 'text-blue-600', desc: t('telecomDesc') },
                    { name: 'M-Pesa', icon: Smartphone, color: 'text-emerald-600', desc: t('mpesaDesc') },
                    { name: 'CBE Birr', icon: Landmark, color: 'text-purple-600', desc: t('cbeDesc') },
                    { name: 'Bank Transfer', icon: Landmark, color: 'text-amber-600', desc: t('bankDesc') },
                  ] as const).map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setProvider(p.name as PaymentProvider)}
                        className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition text-left cursor-pointer ${
                          provider === p.name
                            ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-400'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${p.color}`} />
                        <div>
                          <div className="text-xs font-black text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-600 font-medium">{p.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Selection & Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                    {t('amountETB')}
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    {amount !== '' && Number(amount) > 0 ? `${amount} ETB` : 'ማንኛውንም መጠን ያስገቡ'}
                  </span>
                </div>
                
                {/* Quick Presets */}
                <div className="grid grid-cols-5 gap-1.5">
                  {[50, 100, 200, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                        amount === amt
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {/* Custom Number Input */}
                <div className="relative">
                  <input
                    type="number"
                    value={amount === '' ? '' : amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAmount(val === '' ? '' : Number(val));
                    }}
                    min={10}
                    step="any"
                    className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-950 font-mono font-black focus:bg-white focus:outline-none focus:border-emerald-600 pl-3.5 pr-14"
                    placeholder="የሚፈልጉትን መጠን ያስገቡ / Enter custom amount"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    ETB
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  ዝቅተኛው ተቀማጭ መጠን 10 ብር ነው (Minimum deposit: 10 ETB)
                </p>
              </div>

              {/* ── Instant Online Checkout (recommended) ────────────────── */}
              <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <div>
                    <div className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                      {isAm ? 'ቀጥታ የሞባይልና ባንክ ክፍያ (ምርጥ አማራጭ)' : 'Instant Mobile & Bank Pay — Recommended'}
                    </div>
                    <div className="text-[10px] text-emerald-800 font-medium">
                      {isAm
                        ? 'ቴሌብር • CBE Birr • M-Pesa • ባንክ — ገንዘብ ወዲያውኑ ወደ ሂሳብዎ ይገባል'
                        : 'Telebirr • CBE Birr • M-Pesa • Bank — wallet credited automatically after payment'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleArifPayCheckout}
                  disabled={isProcessing || !amount || Number(amount) < 10}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider transition shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {isAm ? 'በሂደት ላይ...' : 'Processing...'}
                    </span>
                  ) : (
                    <>
                      <span>🔒</span>
                      {isAm ? `${amount || 0} ብር — በቴሌብር/ባንክ ክፈሉ` : `Pay ${amount || 0} ETB (Telebirr / CBE / Bank)`}
                    </>
                  )}
                </button>
              </div>

              {/* ── Or use manual transfer ───────────────────────────────── */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {isAm ? 'ወይም በእጅ ያስተላልፉ' : 'or transfer manually'}
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer">
                {t('proceedToCheckout')} ({provider.toUpperCase()}) →
              </button>

            </>
          ) : (
            <div className="space-y-3">
              {/* Deposit Details Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span>{t('gateway')}:</span>
                  <span className="font-black text-emerald-800">{provider}</span>
                </div>
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span>{t('amountETB')}:</span>
                  <span className="font-black text-slate-950">{amount} ETB</span>
                </div>
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span>{t('depositReference')}:</span>
                  <span className="font-mono font-bold text-amber-800 text-[11px] truncate max-w-[150px]">{depositReference}</span>
                </div>
              </div>

              {/* Account Destination Details for Payment + INLINE QR (generated immediately — no modal/click needed) */}
              <div className="bg-slate-50 border border-emerald-300 p-3 rounded-xl space-y-3 text-xs">
                <div className="text-[11px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Transfer Destination (ክፍያ የሚፈፀምበት)</span>
                </div>

                {provider === 'Telebirr' ? (
                  <div className="space-y-1.5 text-slate-800 font-medium">
                    <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-xl border border-emerald-300">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">{isAm ? 'የቴሌብር ነጋዴ መለያ (Merchant / Till):' : 'Telebirr Merchant / Till ID:'}</span>
                        <strong className="text-slate-950 font-mono font-black text-sm">0938922481</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyRef('0938922481')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isAm ? 'ቅዳ' : 'Copy'}</span>
                      </button>
                    </div>
                    <p>• {isAm ? 'የተቀባይ ስም:' : 'Merchant Name:'} <strong className="text-amber-800 font-black">Yohannes Tsehaye Bayleyegn</strong></p>
                    <p>• {isAm ? 'የነጋዴ ኮድ (Till):' : 'Merchant Code:'} <strong className="text-slate-900 font-mono font-black">938922 / 0938922481</strong></p>
                    <div className="flex items-center justify-between bg-amber-50 p-1.5 rounded-lg border border-amber-200 text-[10px]">
                      <span>Remark Reference: <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">{depositReference}</code></span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(depositReference)}
                        className="p-1 text-amber-800 hover:text-amber-950 font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Copy Reference"
                      >
                        {copiedRef ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ) : provider === 'CBE Birr' ? (
                  <div className="space-y-1.5 text-slate-800 font-medium">
                    <div className="flex items-center justify-between bg-purple-50 p-2 rounded-xl border border-purple-300">
                      <div>
                        <span className="text-[10px] font-bold text-purple-800 uppercase block">{isAm ? 'CBE Birr ነጋዴ / ስልክ:' : 'CBE Birr Merchant / Phone:'}</span>
                        <strong className="text-slate-950 font-mono font-black text-sm">0938922481</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyRef('0938922481')}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isAm ? 'ቅዳ' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-purple-50 p-2 rounded-xl border border-purple-300">
                      <div>
                        <span className="text-[10px] font-bold text-purple-800 uppercase block">{isAm ? 'CBE የሂሳብ ቁጥር:' : 'CBE Account Number:'}</span>
                        <strong className="text-slate-950 font-mono font-black text-sm">1000540829954</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyRef('1000540829954')}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isAm ? 'ቅዳ' : 'Copy'}</span>
                      </button>
                    </div>
                    <p>• {isAm ? 'ስም:' : 'Name:'} <strong className="text-amber-800 font-black">Yohannes Tsehaye Bayleyegn</strong></p>
                    <div className="flex items-center justify-between bg-purple-50 p-1.5 rounded-lg border border-purple-200 text-[10px]">
                      <span>Remark Reference: <code className="bg-purple-100 px-1 py-0.5 rounded text-purple-900 font-bold">{depositReference}</code></span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(depositReference)}
                        className="p-1 text-purple-800 hover:text-purple-950 font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Copy Reference"
                      >
                        {copiedRef ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ) : provider === 'M-Pesa' ? (
                  <div className="space-y-1.5 text-slate-800 font-medium">
                    <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-xl border border-emerald-300">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">{isAm ? 'M-Pesa (Safaricom 07...) ቁጥር:' : 'M-Pesa (Safaricom 07...) Number:'}</span>
                        <strong className="text-slate-950 font-mono font-black text-sm">0710798482</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyRef('0710798482')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isAm ? 'ቅዳ' : 'Copy'}</span>
                      </button>
                    </div>
                    <p>• {isAm ? 'ስም:' : 'Name:'} <strong className="text-amber-800 font-black">Yohannes Tsehaye Bayleyegn</strong></p>
                    <div className="flex items-center justify-between bg-amber-50 p-1.5 rounded-lg border border-amber-200 text-[10px]">
                      <span>Remark Reference: <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">{depositReference}</code></span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(depositReference)}
                        className="p-1 text-amber-800 hover:text-amber-950 font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Copy Reference"
                      >
                        {copiedRef ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-slate-800 font-medium">
                    <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-xl border border-emerald-300">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">CBE Account:</span>
                        <strong className="text-slate-950 font-mono font-black text-sm">1000540829954</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyRef('1000540829954')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition shadow-xs"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isAm ? 'ቅዳ' : 'Copy'}</span>
                      </button>
                    </div>
                    <p>• Account Name: <strong className="text-amber-800 font-black">Yohannes Tsehaye Bayleyegn</strong></p>
                  </div>
                )}

                {/* INLINE QR CODE — generated IMMEDIATELY when step 2 loads (not on button click) */}
                <div className="bg-white border-2 border-blue-300 rounded-2xl p-3 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-blue-700" />
                      <span className="text-[11px] font-black text-blue-900 uppercase tracking-wider">
                        {provider} Deposit QR — Ready Now
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      ✓ Auto-Generated
                    </span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-xl border border-blue-200 shadow-inner">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`${provider} Deposit QR for ${amount} ETB`}
                          width={220}
                          height={220}
                          className="w-44 h-44 object-contain rounded-lg bg-white p-2 shadow-2xs"
                        />
                      ) : (
                        <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-[10px] font-bold text-center bg-white rounded-lg p-2">
                          ⏳ QR loading...
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600 text-center font-semibold leading-snug px-1">
                    ⚠️ <strong className="text-rose-700">Pay EXACTLY:</strong> <span className="text-rose-900 font-black text-sm bg-rose-50 px-2 py-0.5 rounded">{amount} ETB</span><br />
                    {destinationNumber && (<span className="text-slate-800">To: <strong>{destinationNumber}</strong></span>)}<br />
                    <span className="text-amber-800">Ref: <strong className="font-mono">{depositReference}</strong></span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href={qrDataUrl || '#'}
                      download={`hyperbingo_deposit_${depositReference || 'qr'}.png`}
                      className="py-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 text-[10px] font-black flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                      onClick={(e) => { if (!qrDataUrl) e.preventDefault(); }}
                    >
                      💾 Save QR
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyFullPayment}
                      className={`py-1.5 rounded-lg border text-[10px] font-black flex items-center justify-center gap-1 transition cursor-pointer shadow-xs ${
                        copiedPaymentText
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                          : 'bg-indigo-100 hover:bg-indigo-200 border-indigo-300 text-indigo-900'
                      }`}
                    >
                      {copiedPaymentText ? (<>✓ Copied!</>) : (<><Copy className="w-3 h-3" /> Copy Full Info</>)}
                    </button>
                  </div>
                </div>

                {/* Exact Copyable Payment Line — so users don't type the wrong amount */}
                {fullPaymentText && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                        ✅ Paste this as your Remark/Message (Exact Amount)
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyFullPayment}
                        className="p-1 rounded text-amber-800 hover:bg-amber-200 cursor-pointer"
                        title="Copy exact payment text"
                      >
                        {copiedPaymentText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-800 font-mono font-bold leading-snug break-all bg-white rounded border border-amber-200 p-1.5 select-all">
                      {fullPaymentText}
                    </p>
                  </div>
                )}
              </div>

              {/* 🔢 TRANSACTION CODE / FT NUMBER / SMS INPUT (CBE SAFE) */}
              <div className="space-y-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 p-3.5 rounded-2xl border-2 border-emerald-400 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-emerald-950 flex items-center gap-1.5">
                    <span className="text-sm">🔑</span>
                    <span>
                      {provider === 'CBE Birr' || provider === 'Bank Transfer'
                        ? (isAm ? 'የ CBE የክፍያ መለያ / FT ቁጥር (Transaction ID)' : 'CBE Merchant Transaction ID / FT Number')
                        : (isAm ? 'የቴሌብር የክፍያ መለያ ቁጥር (Merchant Transaction ID)' : 'Telebirr Merchant Transaction ID / Reference')}
                    </span>
                    <span className="text-rose-600 font-black">*</span>
                  </label>
                  <span className="text-[9px] font-black text-white bg-emerald-700 px-2 py-0.5 rounded-full shadow-xs uppercase flex items-center gap-1">
                    ⚡ {isAm ? 'ፈጣን ራስ-ሰር ማረጋገጫ' : 'Instant Auto-Verify'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      provider === 'CBE Birr' || provider === 'Bank Transfer'
                        ? (isAm ? 'ለምሳሌ: FT260927XXXXX ወይም ከባንኩ የተላከውን SMS እዚህ ይለጥፉ' : 'e.g. FT260927XXXXX or paste bank confirmation SMS')
                        : (isAm ? 'ለምሳሌ: CI0000XXXX ወይም የቴሌብር SMS Transaction Code' : 'e.g. CI0000XXXX or Telebirr TXN Code')
                    }
                    value={transactionCode}
                    onChange={(e) => {
                      setTransactionCode(e.target.value);
                      if (screenshotError) setScreenshotError(null);
                    }}
                    className="w-full bg-white border-2 border-emerald-300 focus:border-emerald-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none shadow-inner"
                  />
                  {transactionCode && (
                    <button
                      type="button"
                      onClick={() => setTransactionCode('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Instant verification assurance banner */}
                <div className="bg-emerald-100/80 rounded-xl p-2.5 border border-emerald-300 flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">⚡</span>
                  <p className="text-[10px] text-emerald-950 font-bold leading-relaxed">
                    {isAm
                      ? 'ፈጣን ራስ-ሰር ማረጋገጫ (Instant Auto-Verification): የመለያ ቁጥሩን (Transaction ID) እንዳስገቡ ሂሳብዎ ወዲያውኑ ይሞላል። 1,000 ተጫዋቾች በአንድ ጊዜ ቢከፍሉ እንኳን ምንም የአስተዳዳሪ ጥበቃ ሳያስፈልግ በቅጽበት ይረጋገጣል!'
                      : 'Instant Auto-Verification: Enter your Transaction ID and your balance is credited immediately! Zero admin waiting time even if 1,000 players deposit at the exact same second.'}
                  </p>
                </div>
              </div>

              {/* 📸 PAYMENT SCREENSHOT UPLOAD (Optional if Transaction Code is entered) */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-900 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-700" />
                    <span>{isAm ? 'የክፍያ ደረሰኝ ስክሪንሾት (አማራጭ)' : 'Payment Screenshot (Optional)'}</span>
                  </label>
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded">
                    {transactionCode.trim() ? (isAm ? 'አማራጭ' : 'Optional') : (isAm ? 'አማራጭ / ወይም ኮድ ያስገቡ' : 'Optional / Or Code')}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {isAm
                    ? 'ስክሪንሾት ማንሳት ከቻሉ ማያያዝ ይችላሉ (ከላይ ኮድ ካስገቡ ስክሪንሾት ማስገባት ግዴታ አይደለም)።'
                    : 'Attach your transfer screenshot if available. If you already entered the transaction code above, screenshot is optional.'}
                </p>

                {screenshotPreview ? (
                  <div className="relative rounded-xl border border-emerald-300 bg-white p-2.5 flex items-center gap-3 shadow-xs">
                    <img
                      src={screenshotPreview}
                      alt="Payment Receipt"
                      className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-800 truncate flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>{isAm ? 'ደረሰኝ ተያይዟል' : 'Receipt Attached'}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{screenshotFileName || 'screenshot.png'}</p>
                      <p className="text-[10px] text-amber-800 font-bold">{isAm ? 'ለባለቤቱ በቴሌግራም ይላካል' : 'Sent to owner for verification'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveScreenshot}
                      className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                      title="Remove Screenshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-3 cursor-pointer bg-white hover:bg-slate-50 transition text-center group">
                      <Upload className="w-5 h-5 text-amber-600 group-hover:scale-110 transition mb-0.5" />
                      <span className="text-xs font-black text-slate-800">
                        {isAm ? 'ደረሰኝ ካለዎት እዚህ ይጫኑ' : 'Upload Receipt (If available)'}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        JPG, PNG
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {screenshotError && (
                  <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1 mt-1">
                    <XCircle className="w-3.5 h-3.5 shrink-0" /> {screenshotError}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDepositStep(1)}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer"
                >
                  {t('back')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || (!transactionCode.trim() && !screenshotBase64)}
                  className={`w-2/3 py-2.5 rounded-xl font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    (!transactionCode.trim() && !screenshotBase64)
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                  }`}
                >
                  {isProcessing ? (
                    <><span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span> {isAm ? 'በማረጋገጥ ላይ...' : 'Verifying...'}</>
                  ) : (
                    <><CheckCircle className="w-3.5 h-3.5" /> ⚡ {isAm ? `ወዲያውኑ አረጋግጥና ሂሳብ ሙላ (${amount} ETB)` : `Instant Verify & Credit (${amount} ETB)`}</>
                  )}
                </button>
              </div>
              {/* Helper hint — tells user what unlocks the submit button */}
              {!transactionCode.trim() && !screenshotBase64 && (
                <p className="text-[10px] text-center text-amber-800 font-bold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  ⬆️ {isAm
                    ? 'ለማስገባት: ከላይ ያለውን የ Transaction ID / FT ቁጥር ያስገቡ (ወይም ደረሰኝ ያያይዙ)'
                    : 'To submit: Enter your Transaction ID / FT number above (or attach receipt)'}
                </p>
              )}
            </div>
          )}
        </form>
      )}

      {/* ── WITHDRAWAL FORM ──────────────────────────────────────────────────── */}
      {activeTab === 'withdraw' && (
        <form onSubmit={handleWithdrawSubmit} className="bg-white p-4 rounded-2xl space-y-4 border-2 border-amber-300 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-amber-600" /> {t('withdrawWinnings')}
            </h3>
            <span className="text-[10px] font-bold text-slate-600">{t('winningBalance')}: {formatETB(wallet.winningBalance)}</span>
          </div>

          {/* Warning: Bonus balance cannot be withdrawn */}
          {wallet.availableBalance === 0 && wallet.bonusBalance > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-2.5">
              <span className="text-lg shrink-0">⚠️</span>
              <div>
                <div className="text-xs font-black text-amber-900">Welcome Bonus is Play-Only</div>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed mt-0.5">
                  Your <strong>{formatETB(wallet.bonusBalance)}</strong> welcome bonus cannot be withdrawn — it is for playing games only. 
                  To withdraw real ETB, please deposit funds first.
                </p>
              </div>
            </div>
          )}

          {/* Use linked account shortcut */}
          {linkedAccounts.filter(a => a.status === 'VERIFIED').length > 0 && (
            <div>
              <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-2">
                {t('linkedAccounts')}
              </label>
              <div className="space-y-1.5">
                {linkedAccounts.filter(a => a.status === 'VERIFIED').map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setPhoneOrAccount(acc.accountNumber);
                      setAccountName(acc.accountName);
                      setProvider(acc.type === 'TELEBIRR' ? 'Telebirr' : acc.type === 'CBE_BIRR' ? 'CBE Birr' : 'Bank Transfer');
                    }}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                      phoneOrAccount === acc.accountNumber
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {acc.isDefault && <Star className="w-3 h-3 text-amber-500" />}
                      <div>
                        <div className="text-xs font-black text-slate-900">{acc.accountName}</div>
                        <div className="text-[10px] text-slate-600 font-semibold">{accountTypeLabel[acc.type]} • {acc.accountNumber}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Direct Withdrawal Provider Selection (Telebirr & CBE) */}
          <div>
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-2">
              {isAm ? 'ገንዘብ ማውጫ ዘዴ ይምረጡ (Direct Payout)' : 'Select Direct Withdrawal Method'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('Telebirr')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-start gap-1 transition text-left cursor-pointer ${
                  provider === 'Telebirr'
                    ? 'bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">📱</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">Telebirr</div>
                    <div className="text-[10px] text-blue-700 font-bold">{isAm ? 'ቀጥታ ወደ ስልክ' : 'Direct to Phone'}</div>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-500 mt-1">+2519XXXXXXXX</span>
              </button>

              <button
                type="button"
                onClick={() => setProvider('CBE Birr')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-start gap-1 transition text-left cursor-pointer ${
                  provider === 'CBE Birr' || provider === 'Bank Transfer'
                    ? 'bg-purple-50 border-purple-500 shadow-sm ring-2 ring-purple-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏦</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">CBE / CBE Birr</div>
                    <div className="text-[10px] text-purple-700 font-bold">{isAm ? 'ቀጥታ ወደ ባንክ/ስልክ' : 'Direct Bank/Birr'}</div>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-slate-500 mt-1">1000XXXXXXXXX</span>
              </button>
            </div>
          </div>

          {/* Amount with quick chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                {t('withdrawalAmount')}
              </label>
              <span className="text-[11px] font-mono font-bold text-amber-900">
                {isAm ? 'ማውጣት የሚቻለው:' : 'Withdrawable:'} <strong>{formatETB(wallet.availableBalance + wallet.winningBalance)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[50, 100, 200, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`py-1.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                    amount === amt
                      ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 hover:bg-amber-50 text-slate-700'
                  }`}
                >
                  {amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(Math.max(50, Math.floor(wallet.availableBalance + wallet.winningBalance)))}
                className="py-1.5 rounded-xl text-[10px] font-black border bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 cursor-pointer"
              >
                {isAm ? 'ሁሉንም' : 'Max'}
              </button>
            </div>

            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                max={wallet.winningBalance + wallet.availableBalance}
                min={50}
                placeholder="50"
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-mono font-bold focus:bg-white focus:outline-none focus:border-amber-500"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">ETB</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-1">
              {provider === 'Telebirr'
                ? (isAm ? 'የቴሌብር ስልክ ቁጥር (+2519...)' : 'Telebirr Phone Number (+2519...)')
                : (isAm ? 'የ CBE የሂሳብ ቁጥር (13 አሃዝ) ወይም CBE Birr ስልክ' : 'CBE Account Number (13 digits) or CBE Birr Phone')}
            </label>
            <input
              type="text"
              value={phoneOrAccount}
              onChange={(e) => setPhoneOrAccount(e.target.value)}
              placeholder={provider === 'Telebirr' ? '+251911234567' : '1000540829954 or +2519...'}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-mono font-bold focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-1">
              {t('accountHolderName')}
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Yohannes Tsehaye Bayleyegn"
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:bg-white"
            />
          </div>

          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-950 font-medium leading-relaxed">
              <span className="font-black block text-amber-900 mb-0.5">
                {isAm ? '🔒 የማውጣት ሂደት (ደህንነቱ የተጠበቀ)' : '🔒 Secure Withdrawal Process'}
              </span>
              {isAm
                ? `ጥያቄ ሲያቀርቡ የተጠየቀው ብር ከቦርሳዎ ላይ ተይዞ ይቆያል (PENDING)። በአስተዳዳሪው ከተረጋገጠ በኋላ ገንዘቡ በአሪፍፔይ በኩል ወደ ${provider} አካውንትዎ ይላካል።`
                : `Your requested amount is reserved immediately (PENDING). After verification by the admin, funds are disbursed via ArifPay directly to your ${provider} account.`}
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || Number(amount) < 50 || Number(amount) > (wallet.availableBalance + wallet.winningBalance)}
            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer ${
              Number(amount) >= 50 && Number(amount) <= (wallet.availableBalance + wallet.winningBalance)
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-105 text-slate-950 shadow-md active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                {isAm ? 'ጥያቄው በመላክ ላይ...' : 'Submitting Request...'}
              </span>
            ) : (
              `📤 ${isAm ? 'የማውጣት ጥያቄ ላክ' : 'Submit Withdrawal Request'} (${amount || 0} ETB)`
            )}
          </button>
        </form>
      )}

      {/* ── LINKED BANK ACCOUNTS ─────────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div className="bg-white p-4 rounded-2xl space-y-4 border-2 border-blue-300 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-blue-600" /> {t('linkedAccounts')}
            </h3>
            <button
              onClick={() => setShowAddAccount(v => !v)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> {t('addAccount')}
            </button>
          </div>

          {/* Add Account Form */}
          {showAddAccount && (
            <form onSubmit={handleAddAccount} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-700 block mb-1">{t('accountType')}</label>
                <select
                  value={newAccountType}
                  onChange={e => setNewAccountType(e.target.value as LinkedAccountType)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-950 font-bold"
                >
                  <option value="TELEBIRR">Telebirr (+2519XXXXXXXX)</option>
                  <option value="CBE_BIRR">CBE Birr</option>
                  <option value="AWASH_BIRR">Awash Birr</option>
                  <option value="BANK_TRANSFER">Bank Transfer (CBE / Dashen etc)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-700 block mb-1">
                  {newAccountType === 'TELEBIRR' ? 'Telebirr Phone Number' : t('accountNumber')}
                </label>
                <input
                  type="text"
                  value={newAccountNumber}
                  onChange={e => setNewAccountNumber(e.target.value)}
                  placeholder={newAccountType === 'TELEBIRR' ? '+251911234567' : 'Account number'}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-950 font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-700 block mb-1">{t('accountHolderName')}</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={e => setNewAccountName(e.target.value)}
                  placeholder="Full legal name"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-950 font-bold"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="w-1/3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addingAccount}
                  className="w-2/3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs cursor-pointer"
                >
                  {addingAccount ? t('submitting') : t('linkAccountBtn')}
                </button>
              </div>
            </form>
          )}

          {/* Linked Accounts List */}
          <div className="space-y-2">
            {linkedAccounts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <Landmark className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                {t('noAccountsLinked')}
              </div>
            ) : (
              linkedAccounts.map(acc => (
                <div key={acc.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {statusIcon(acc.status)}
                      {acc.isDefault && <Star className="w-3 h-3 text-amber-500" />}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">{acc.accountName}</div>
                      <div className="text-[10px] text-slate-600 font-semibold">{accountTypeLabel[acc.type]} • {acc.accountNumber}</div>
                      <div className={`text-[10px] font-bold ${
                        acc.status === 'VERIFIED' ? 'text-emerald-700' :
                        acc.status === 'REJECTED' ? 'text-rose-700' : 'text-amber-700'
                      }`}>
                        {acc.status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TRANSACTION HISTORY ──────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white p-4 rounded-2xl space-y-3 border-2 border-purple-300 shadow-xs">
          <h3 className="text-xs font-black uppercase tracking-wider text-purple-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <History className="w-4 h-4 text-purple-600" /> {t('recentTransactions')}
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">{t('noTransactionsYet')}</div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-xs">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{tx.description}</span>
                      <span className={`px-1.5 text-[9px] font-black rounded ${
                        tx.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        tx.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                      <span className="font-mono font-bold text-slate-700">{tx.reference}</span> • {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black font-mono text-sm ${tx.amount > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount} ETB
                    </div>
                    <div className="text-[10px] text-slate-600 font-semibold">Bal: {formatETB(tx.balanceAfter)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── QR CODE MODAL ────────────────────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 border-2 border-blue-400 shadow-2xl relative text-center space-y-4">
            {/* Close button */}
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-3 py-1 rounded-full border border-blue-200 mb-1">
                Instant Transfer QR
              </span>
              <h3 className="text-lg font-black text-slate-900">
                {provider} Scan & Pay
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                የቴሌብር ወይም የሲቢኢ ብር አፕሊኬሽን በመጠቀም ስካን ያድርጉ
              </p>
            </div>

            {/* QR Code Container with animated scan effect */}
            <div className="relative mx-auto w-52 h-52 bg-white p-3 rounded-2xl border-2 border-dashed border-blue-300 shadow-inner flex items-center justify-center overflow-hidden">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  provider === 'Telebirr'
                    ? `telebirr://transfer?phone=251938922481&amount=${amount}&ref=${depositReference}`
                    : `cbe://transfer?account=1000540829954&amount=${amount}&ref=${depositReference}`
                )}`}
                alt="Payment QR Code"
                className="w-44 h-44 object-contain rounded-lg"
              />
              <div className="absolute inset-x-4 top-2 h-0.5 bg-blue-500/80 shadow-[0_0_8px_#3b82f6] animate-bounce pointer-events-none"></div>
            </div>

            {/* Payment Summary */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1.5 text-left">
              <div className="flex justify-between items-center text-slate-700 font-semibold">
                <span>Amount to Pay:</span>
                <span className="text-base font-black text-emerald-700">{amount} ETB</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 font-semibold">
                <span>Recipient:</span>
                <span className="font-mono font-black text-slate-900">
                  {provider === 'Telebirr' ? '0938922481' : '1000540829954'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-700 font-semibold pt-1 border-t border-slate-200">
                <span>Remark:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono font-bold text-amber-800 text-[11px] truncate max-w-[140px]">{depositReference}</span>
                  <button
                    onClick={() => handleCopyRef(depositReference)}
                    className="p-1 text-slate-500 hover:text-amber-800 cursor-pointer"
                    title="Copy Reference"
                  >
                    {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs transition cursor-pointer"
            >
              Done / ተጠናቋል
            </button>
          </div>
        </div>
      )}

      {/* ── ARIFPAY PAYMENT GATEWAY MODAL ────────────────────────────────────── */}
      {showDirectPay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl relative text-white overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/40">
            {/* Header */}
            <div className="relative px-5 pt-5 pb-4 border-b border-emerald-700/40">
              <button
                onClick={() => setShowDirectPay(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-2xl shrink-0">
                  ⚡
                </div>
                <div>
                  <h3 className="font-black text-base">{isAm ? 'ደህንነቱ የተጠበቀ ቀጥታ ክፍያ' : 'Secure Online Payment'}</h3>
                  <p className="text-[10px] font-bold text-emerald-300">
                    Telebirr • CBE Birr • M-Pesa • Bank
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="relative p-5 space-y-4">
              {/* Error message */}
              {directPayError && (
                <div className="flex items-start gap-2 bg-red-500/20 border border-red-400/40 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 font-bold leading-snug">{directPayError}</p>
                </div>
              )}

              {/* Amount Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-white/70 block mb-1.5">
                  {isAm ? 'የሚቀምጡት ብር መጠን ይምረጡ' : 'Select Deposit Amount (ETB)'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[50, 100, 200, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDirectPayAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                        Number(directPayAmount) === amt
                          ? 'bg-emerald-400 border-emerald-400 text-slate-950 font-black shadow-md'
                          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={directPayAmount === '' ? '' : directPayAmount}
                    onChange={(e) => setDirectPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    min={10}
                    placeholder="Custom amount"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-black placeholder:text-white/40 focus:outline-none focus:border-emerald-400 focus:bg-white/15"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-300">ETB</span>
                </div>
                <p className="text-[10px] text-white/50 font-medium mt-1">
                  {isAm ? 'ዝቅተኛው ተቀማጭ መጠን 10 ብር ነው' : 'Minimum deposit: 10 ETB'}
                </p>
              </div>

              {/* Verified Architecture Flow */}
              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
                  <span>🔒</span>
                  <span>{isAm ? 'የክፍያ ሂደት ቅደም ተከተል' : 'Verified Deposit Flow'}</span>
                </div>
                <div className="space-y-1.5 text-[10px] text-white/80 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[9px]">1</span>
                    <span>{isAm ? 'የ PENDING ጥያቄ በሲስተም ይፈጠራል' : 'Creates PENDING transaction'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[9px]">2</span>
                    <span>{isAm ? 'በቴሌብር ወይም በባንክ (Telebirr/CBE) ክፍያ ይፈጽማሉ' : 'Customer pays via Telebirr / CBE / Bank'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[9px]">3</span>
                    <span>{isAm ? 'ከተረጋገጠ በኋላ ወዲያውኑ ቦርሳዎ ላይ ገቢ ይሆናል (+ETB)' : 'Wallet credited ONLY after verified success'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleArifPayCheckout(Number(directPayAmount) || 100)}
                  disabled={directPayLoading || !directPayAmount || Number(directPayAmount) < 10}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-lg shadow-emerald-900/50 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  {directPayLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                      {isAm ? 'በሂደት ላይ...' : 'Connecting to payment gateway...'}
                    </span>
                  ) : (
                    <>
                      <span>🔒</span>
                      {isAm
                        ? `${directPayAmount || 100} ብር — በቴሌብር/ባንክ ክፈሉ`
                        : `Pay ${directPayAmount || 100} ETB (Telebirr / CBE / Bank)`}
                      <span>→</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowDirectPay(false)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 font-bold text-xs transition cursor-pointer"
                >
                  {isAm ? 'ይቅር / ተመለስ' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
