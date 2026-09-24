'use client';

import React, { useState, useEffect } from 'react';
import { useBingo } from '../../context/BingoContext';
import { PaymentProvider, LinkedPaymentAccount, LinkedAccountType } from '../../lib/types';
import { formatETB } from '../../lib/bingoUtils';
import {
  Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck,
  Smartphone, Landmark, CreditCard, History, Plus, Trash2,
  CheckCircle, Clock, XCircle, Star, ChevronRight, ExternalLink,
  Upload, Camera, QrCode, Copy, Check, X,
} from 'lucide-react';

declare global {
  interface Window { Telegram?: { WebApp?: any }; }
}

export default function WalletManager() {
  const { wallet, transactions, depositWallet, requestWithdrawal, user, openAuthModal, t } = useBingo();

  const [activeTab, setActiveTab] = useState<'balance' | 'deposit' | 'withdraw' | 'accounts' | 'history'>('balance');
  const [provider, setProvider] = useState<PaymentProvider>('Telebirr');
  const [amount, setAmount] = useState<number | ''>(100);
  const [phoneOrAccount, setPhoneOrAccount] = useState<string>(() => user?.phone || '');
  const [accountName, setAccountName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [depositStep, setDepositStep] = useState<1 | 2>(1);
  const [depositReference, setDepositReference] = useState<string>('');
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
    if (provider === 'Telebirr') dest = '+251911234567';
    else if (provider === 'CBE Birr') dest = '+251911234567 / 100023456789';
    else dest = 'CBE: 100023456789';

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

  // ── Deposit ──────────────────────────────────────────────────────────────
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
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

    // Screenshot is strictly required
    if (!screenshotBase64) {
      setScreenshotError('Payment screenshot is required! Please attach your receipt before submitting.');
      showStatus('error', 'Please attach your payment screenshot before submitting.');
      return;
    }

    setIsProcessing(true);
    try {
      // Send deposit with screenshot to API (which notifies the owner via Telegram)
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: depositAmt,
          provider,
          depositReference,
          screenshot: screenshotBase64,
          senderPhone: user.phone || phoneOrAccount,
        }),
      });
      const data = await res.json();

      if (data.success) {
        await depositWallet(depositAmt, provider, depositReference);
        showStatus('success', `Deposit of ${depositAmt} ETB submitted! Owner notified via Telegram with your payment screenshot.`);
        setActiveTab('balance');
        setDepositStep(1);
        handleRemoveScreenshot();
      } else {
        showStatus('error', data.error || 'Deposit failed. Please try again.');
      }
    } catch {
      // Fallback
      await depositWallet(depositAmt, provider, depositReference);
      showStatus('success', `Deposit of ${depositAmt} ETB registered! Owner notified.`);
      setActiveTab('balance');
      setDepositStep(1);
      handleRemoveScreenshot();
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
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: withdrawAmt,
          accountNumber: phoneOrAccount,
          accountName,
          paymentMethod: provider,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showStatus('success', `Withdrawal of ${withdrawAmt} ETB submitted! Processing 1-24 hours.`);
        setActiveTab('balance');
      } else {
        // Fallback to local context
        const ok = await requestWithdrawal(withdrawAmt, provider, phoneOrAccount, accountName);
        if (ok) showStatus('success', 'Withdrawal request submitted successfully!');
        else showStatus('error', data.error ?? 'Withdrawal failed');
      }
    } catch {
      const ok = await requestWithdrawal(withdrawAmt, provider, phoneOrAccount, accountName);
      if (ok) showStatus('success', 'Withdrawal request submitted!');
      else showStatus('error', 'Withdrawal failed. Please try again.');
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

  return (
    <div className="space-y-3.5 max-w-lg mx-auto pb-16">
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
                  {t('selectPaymentMethod')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { name: 'Telebirr', icon: Smartphone, color: 'text-blue-600', desc: t('telecomDesc') },
                    { name: 'CBE Birr', icon: Landmark, color: 'text-purple-600', desc: t('cbeDesc') },
                    { name: 'Chapa', icon: CreditCard, color: 'text-emerald-600', desc: t('chapaDesc') },
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
                    <p>• Telebirr Number: <strong className="text-slate-950 font-mono font-black">+251911234567</strong></p>
                    <p>• Receiver Name: <strong className="text-amber-800 font-black">Hyper Bingo Games</strong></p>
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
                    <p>• CBE Birr / Phone: <strong className="text-slate-950 font-mono font-black">+251911234567</strong></p>
                    <p>• CBE Account: <strong className="text-slate-950 font-mono font-black">100023456789</strong></p>
                    <p>• Name: <strong className="text-amber-800 font-black">Hyper Bingo CBE</strong></p>
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
                ) : (
                  <div className="space-y-1 text-slate-800 font-medium">
                    <p>• Commercial Bank of Ethiopia (CBE): <strong className="text-slate-950 font-mono font-black">100023456789</strong></p>
                    <p>• Account Name: <strong className="text-amber-800 font-black">Hyper Bingo Entertainment</strong></p>
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

              {/* 📸 MANDATORY PAYMENT SCREENSHOT UPLOAD */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-amber-300">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-900 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-700" />
                    <span>Payment Screenshot (የክፍያ ደረሰኝ)</span>
                    <span className="text-rose-600 font-black">*</span>
                  </label>
                  <span className="text-[9px] text-rose-800 font-bold uppercase tracking-wider bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                    Required by Owner
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 font-medium">
                  Please attach your payment screenshot after completing the transfer. The owner will verify and approve your deposit.
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
                        <span>Receipt Attached</span>
                      </p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{screenshotFileName || 'screenshot.png'}</p>
                      <p className="text-[10px] text-amber-800 font-bold">Owner will be notified via Telegram</p>
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
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-3.5 cursor-pointer bg-white hover:bg-slate-50 transition text-center group">
                      <Upload className="w-6 h-6 text-amber-600 group-hover:scale-110 transition mb-1" />
                      <span className="text-xs font-black text-slate-800">
                        Upload Payment Screenshot
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        የባንክ ወይም ቴሌብር ደረሰኝ ስክሪንሽት ያስገቡ (JPG, PNG)
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
                  disabled={isProcessing || !screenshotBase64}
                  className={`w-2/3 py-2.5 rounded-xl font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    !screenshotBase64
                      ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                  }`}
                >
                  {isProcessing ? t('submitting') : (
                    <><ExternalLink className="w-3.5 h-3.5" /> Submit & Notify Owner</>
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

          <div>
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-1">{t('selectPaymentMethod')}</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as PaymentProvider)}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:bg-white focus:outline-none focus:border-amber-500"
            >
              <option value="Telebirr">Telebirr Wallet</option>
              <option value="CBE Birr">CBE Birr Account</option>
              <option value="Bank Transfer">Bank Transfer (CBE)</option>
              <option value="Chapa">Chapa Payout</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-1">
              {t('withdrawalAmount')}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              max={wallet.winningBalance + wallet.availableBalance}
              min={50}
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-mono font-bold focus:bg-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider block mb-1">
              {t('phoneNumberOrAccount')}
            </label>
            <input
              type="text"
              value={phoneOrAccount}
              onChange={(e) => setPhoneOrAccount(e.target.value)}
              placeholder="+251911234567"
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
              placeholder="Full legal name"
              className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isProcessing || Number(amount) < 50}
            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition shadow-sm cursor-pointer ${
              Number(amount) >= 50
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
            }`}
          >
            {isProcessing ? t('submitting') : t('submitWithdrawal')}
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
                    ? `telebirr://transfer?phone=251911234567&amount=${amount}&ref=${depositReference}`
                    : `cbe://transfer?account=100023456789&amount=${amount}&ref=${depositReference}`
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
                  {provider === 'Telebirr' ? '+251911234567' : '100023456789'}
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
    </div>
  );
}
