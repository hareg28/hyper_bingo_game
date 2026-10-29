'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { PaymentProvider, LinkedPaymentAccount, LinkedAccountType } from '../../lib/types';
import { formatETB } from '../../lib/bingoUtils';
import { type OwnerPaymentAccount } from '../../lib/ownerPaymentAccounts';
import {
  Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck,
  Smartphone, Landmark, History, Plus, Trash2,
  CheckCircle, Clock, XCircle, Star, ChevronRight,
  Copy, Check,
} from 'lucide-react';

declare global {
  interface Window { Telegram?: { WebApp?: any }; }
}

export default function WalletManager() {
  const { wallet, transactions, depositWallet, submitPendingDeposit, requestWithdrawal, refreshWallet, user, openAuthModal, t, language } = useBingo();
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
  const [depositError, setDepositError] = useState<string | null>(null);

  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerPaymentAccount[]>([]);
  const telebirrMerchant = ownerAccounts.find((account) => account.method === 'TELEBIRR');

  useEffect(() => {
    fetch('/api/payments/owner-accounts')
      .then((r) => r.json())
      .then((res) => { if (res.success && Array.isArray(res.data)) setOwnerAccounts(res.data); })
      .catch(() => {});
  }, []);

  const handleCopyRef = (textToCopy: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('payment');
    if (!result) return;
    setActiveTab('history');
    if (result === 'success') {
      showStatus('success', isAm ? 'የቴሌብር ክፍያ ተረጋግጧል።' : 'Telebirr payment confirmed. Your wallet has been credited.');
    } else if (result === 'pending') {
      showStatus('success', isAm ? 'ክፍያው እየተረጋገጠ ነው፤ ትንሽ ቆይተው ታሪክን ያድሱ።' : 'Payment is still being confirmed. Refresh history in a moment.');
    } else {
      showStatus('error', isAm ? 'ክፍያው አልተረጋገጠም።' : 'Telebirr could not confirm this payment.');
    }
    params.delete('payment');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  // Read the one-time return status when this component first mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deposit: submit transaction reference for Bonno or admin review ─────────
  const handleDepositSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    setDepositError(null);

    if (!user || user.id === 'usr_guest') {
      openAuthModal('register');
      return;
    }
    const depositAmt = typeof amount === 'number' ? amount : Number(amount) || 0;
    if (depositAmt < 10) {
      const err = isAm ? 'ዝቅተኛው ተቀማጭ መጠን 10 ብር ነው (Minimum deposit is 10 ETB)' : 'Minimum deposit is 10 ETB.';
      setDepositError(err);
      showStatus('error', err);
      return;
    }

    if (depositStep === 1) {
      setDepositStep(2);
      setDepositReference(`HBINGO_${user.id}_${Date.now()}`);
      return;
    }

    // Helper: intelligently extract code if user pasted bank/Telebirr SMS
    const extractCleanCode = (input: string): string => {
      const trimmed = input.trim();
      // Look for FT reference anywhere in the input
      const ftMatch = trimmed.match(/FT[0-9A-Za-z]{6,16}/i);
      if (ftMatch) return ftMatch[0].toUpperCase();
      // Look for 10-char alphanumeric word (Telebirr style)
      const tbMatch = trimmed.match(/\b([A-Za-z0-9]{8,14})\b/);
      if (trimmed.includes(' ') || trimmed.includes('\n')) {
        return tbMatch ? tbMatch[1].toUpperCase() : trimmed.toUpperCase().replace(/[\s-_]/g, '');
      }
      return trimmed.toUpperCase().replace(/[\s-_]/g, '');
    };

    const cleanCode = extractCleanCode(transactionCode);
    if (!cleanCode) {
      const err = isAm
        ? 'እባክዎ የግብይት መለያ ቁጥር ያስገቡ።'
        : 'Enter the transaction ID to verify your deposit.';
      setDepositError(err);
      showStatus('error', err);
      return;
    }

    if (cleanCode) {
      if (/^(.)\1+$/.test(cleanCode) || cleanCode === '1234567890' || cleanCode === '0123456789') {
        const err = isAm
          ? 'ትክክለኛ ያልሆነ የመለያ ቁጥር። እባክዎ ከባንኩ ወይም ቴሌብር የተላከውን ትክክለኛ ቁጥር ያስገቡ።'
          : 'Invalid transaction code. Please enter the real transaction code from Telebirr or CBE.';
        setDepositError(err);
        showStatus('error', err);
        return;
      }
      if (provider === 'Telebirr' && cleanCode.length < 6) {
        const err = isAm
          ? 'የቴሌብር መለያ ቁጥር ቢያንስ 6 ፊደላት/ቁጥሮች መሆን አለበት (ለምሳሌ፡ DJ74JCZJNJ)።'
          : 'Telebirr transaction codes must be at least 6 characters (e.g. DJ74JCZJNJ).';
        setDepositError(err);
        showStatus('error', err);
        return;
      }
      if ((provider === 'CBE Birr' || provider === 'Bank Transfer') && !cleanCode.startsWith('FT') && !/^\d{6,}$/.test(cleanCode)) {
        const err = isAm
          ? 'የCBE ማስተላለፊያ ቁጥር በ FT መጀመር ወይም የCBE Birr ቁጥር መሆን አለበት (ለምሳሌ፡ FT24281XXXXX)።'
          : 'CBE transfer reference must start with FT (e.g. FT24281XXXXX) or be a CBE Birr reference.';
        setDepositError(err);
        showStatus('error', err);
        return;
      }
    }

    setIsProcessing(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(window.Telegram?.WebApp?.initData
            ? { 'X-Telegram-Init-Data': window.Telegram.WebApp.initData }
            : {}),
        },
        body: JSON.stringify({
          userId:          user?.id,
          amount:          depositAmt,
          mode:            'manual',
          provider,
          depositReference,
          transactionCode: cleanCode,
          senderPhone:     user.phone || phoneOrAccount,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();

      if (data.success) {
        // The backend may have credited a Bonno-verified transfer; always reload the authoritative balance.
        await refreshWallet();
        showStatus('success', data.message || (isAm
          ? `የ ${depositAmt} ETB ተቀማጭ ጥያቄዎ ለአስተዳዳሪ ተልኳል! ክፍያው ሲረጋገጥ ሂሳብዎ ይሞላል።`
          : `Deposit of ${depositAmt} ETB submitted for admin review! Your balance will be credited once verified.`));
        setActiveTab('history');
        setDepositStep(1);
        setTransactionCode('');
        setDepositError(null);
      } else {
        const errMsg = data.error ?? (isAm ? 'ተቀማጩ አልተሳካም። እባክዎ ደጋፊ ያነጋግሩ።' : 'Deposit failed. Please contact support with your receipt.');
        setDepositError(errMsg);
        showStatus('error', errMsg);
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = isAbort
        ? (isAm ? 'ጥያቄው ጊዜ አልፏል። እባክዎ እንደገና ይሞክሩ።' : 'Request timed out. Please try again.')
        : (err instanceof Error ? err.message : (isAm ? 'የኔትወርክ ስህተት። እባክዎ እንደገና ይሞክሩ።' : 'Network error. Please try again.'));
      console.error('[Deposit UI Error]:', err);
      setDepositError(msg);
      showStatus('error', msg);
    } finally {
      setIsProcessing(false);
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

      {/* ── TELEBIRR MERCHANT ACCOUNT ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-xl space-y-3 border border-blue-500/30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl">📱</div>
          <div>
            <div className="text-xs font-black text-blue-200">{isAm ? 'የቴሌብር ነጋዴ መለያ' : 'Telebirr Merchant ID'}</div>
            <div className="text-[10px] text-slate-300">{isAm ? 'በቴሌብር ብቻ ይክፈሉ' : 'Pay to this merchant account using Telebirr'}</div>
          </div>
        </div>
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-400/25 rounded-xl px-3 py-2">
          <div>
            <div className="font-mono font-bold text-white text-sm tracking-wide">{telebirrMerchant?.accountNumber || 'Loading merchant ID…'}</div>
            <div className="text-[10px] text-slate-300">{telebirrMerchant?.accountName || ''}</div>
          </div>
          <button type="button" disabled={!telebirrMerchant?.accountNumber} onClick={() => telebirrMerchant && handleCopyRef(telebirrMerchant.accountNumber)} className="px-2 py-1 bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/40 text-blue-200 rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition">
            <Copy className="w-3 h-3" /> {isAm ? 'ቅዳ' : 'Copy'}
          </button>
        </div>
        <p className="text-[10px] text-amber-300/80 font-bold text-center">{isAm ? 'ክፍያው በቦኖ ወይም በአስተዳዳሪ ከተረጋገጠ በኋላ ሂሳብዎ ይሞላል።' : 'Your wallet is credited after Bonno or an administrator verifies the transfer.'}</p>
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
              {/* Payment Provider */}
              <div>
                <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-2">
                  {isAm ? 'የክፍያ ዘዴ ምረጡ (Manual Transfer)' : 'Choose Payment Method'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { name: 'Telebirr', icon: Smartphone, color: 'text-blue-600', desc: t('telecomDesc') },
                    { name: 'CBE Birr', icon: Landmark, color: 'text-indigo-600', desc: t('cbeDesc') },
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

              <p className="text-[11px] text-slate-600 font-medium bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {isAm
                  ? 'ገንዘቡን ካስተላለፉ በኋላ የግብይት መለያ ቁጥሩን ያስገቡ። ቦኖ ከማረጋገጡ በኋላ ቦርሳዎ ይሞላል።'
                  : 'Enter the transaction ID after you transfer. Bonno may verify it automatically; otherwise an admin will review it before your wallet is credited.'}
              </p>

              {depositError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{depositError}</span>
                </div>
              )}

              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer">
                {isAm ? 'የማስተላለፊያ ዝርዝር ቀጥል' : 'Continue to transfer details'} →
              </button>

            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Amount</span><strong>{amount} ETB</strong></div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-600">Send via {provider} to</div>
                    <strong className="block break-all font-mono text-slate-950">
                      {provider === 'Telebirr'
                        ? (ownerAccounts.find((account) => account.method === 'TELEBIRR')?.accountNumber || 'Loading account…')
                        : (ownerAccounts.find((account) => account.method === 'CBE')?.accountNumber || 'Loading account…')}
                    </strong>
                    <span className="text-xs text-slate-600">
                      {provider === 'Telebirr'
                        ? ownerAccounts.find((account) => account.method === 'TELEBIRR')?.accountName
                        : ownerAccounts.find((account) => account.method === 'CBE')?.accountName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const account = provider === 'Telebirr'
                        ? ownerAccounts.find((item) => item.method === 'TELEBIRR')
                        : ownerAccounts.find((item) => item.method === 'CBE');
                      if (account) handleCopyRef(account.accountNumber);
                    }}
                    className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    <Copy className="mr-1 inline h-3 w-3" />{copiedRef ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-600">Pay {amount} ETB in your {provider} app, then enter the transaction ID.</p>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>
                      {provider === 'CBE Birr' || provider === 'Bank Transfer'
                        ? (isAm ? 'የCBE ግብይት መለያ ቁጥር' : 'CBE transaction ID')
                        : (isAm ? 'የቴሌብር ግብይት መለያ ቁጥር' : 'Telebirr transaction ID')}
                    </span>
                    <span className="text-rose-600 font-black">*</span>
                  </label>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      provider === 'CBE Birr' || provider === 'Bank Transfer'
                        ? 'e.g. FT260927XXXXX'
                        : 'e.g. CI0000XXXX'
                    }
                    value={transactionCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/\s/g, '');
                      setTransactionCode(val);
                      if (depositError) setDepositError(null);
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

                <p className="text-xs text-slate-600">Bonno may verify the payment automatically. If it cannot, an admin will review your transaction before your wallet is credited.</p>
                {depositError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{depositError}</p>}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setDepositStep(1); setDepositError(null); }}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer"
                >
                  {t('back')}
                </button>
                <button
                  type="button"
                  onClick={handleDepositSubmit}
                  disabled={isProcessing || !transactionCode.trim()}
                  className={`w-2/3 py-2.5 rounded-xl font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                    !transactionCode.trim()
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                  }`}
                >
                  {isProcessing ? (
                    <><span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span> {isAm ? 'በመላክ ላይ...' : 'Submitting...'}</>
                  ) : (
                    <><CheckCircle className="w-3.5 h-3.5" /> {isAm ? `ለማረጋገጥ ላክ (${amount} ETB)` : `Submit Deposit (${amount} ETB)`}</>
                  )}
                </button>
              </div>
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

    </div>
  );
}
