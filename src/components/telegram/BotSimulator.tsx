'use client';

import React, { useState } from 'react';
import { useBingo } from '../../context/BingoContext';
import { Send, Bot, User as UserIcon, Gamepad2, Wallet, History, Gift, HelpCircle, Shield, X, Globe, Sparkles } from 'lucide-react';
import { formatETB, isWeekendLotteryDay } from '../../lib/bingoUtils';
import { isAdminTelegramId } from '../../lib/authUtils';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  imageUrl?: string;
  reaction?: string;
  buttons?: { label: string; action: () => void; isPrimary?: boolean }[];
  time: string;
}

type Lang = 'en' | 'am';

export default function BotSimulator({ 
  isOpen, 
  onClose, 
  onOpenMiniApp,
  embedded = false
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onOpenMiniApp: (tab?: string) => void;
  embedded?: boolean;
}) {
  const { user, wallet, games, promotions, language, setLanguage, t } = useBingo();
  const [inputText, setInputText] = useState('');

  const isWeekend = isWeekendLotteryDay();

  // Exact broadcast matching the user's flyer & Telegram announcement screenshot
  const createWeekendBroadcastMessage = (idSuffix = 'init', customTime = '2:13 PM'): ChatMessage => {
    return {
      id: `msg_weekend_broadcast_${idSuffix}`,
      sender: 'bot',
      imageUrl: '/images/weekend_lottery_flyer.jpg',
      reaction: '❤️',
      text: `🎉 50 ሺ : በ 50 ብር 🎉

🗓️ አርብ | ቅዳሜ | እሁድ
🕒 10 ሰዓት
🎫 ካርቴላ ሳያልቅ ⌛ ቀድመው ይያዙ 🏃

❓ ማንኛውም ጥያቄ ካለ
📞 0900906969
📞 0900483848
👉 @HyperBingoSupport`,
      buttons: [
        { 
          label: 'አርብ 🕒 10 ሰዓት (አሁኑኑ ይጫወቱ)', 
          action: () => onOpenMiniApp('game'), 
          isPrimary: true 
        },
        { 
          label: '🎮 የጨዋታ አዳራሽ (Mini App)', 
          action: () => onOpenMiniApp('lobby') 
        },
        { 
          label: '💰 ኪስ ቦርሳ (Wallet)', 
          action: () => onOpenMiniApp('wallet') 
        },
      ],
      time: customTime,
    };
  };

  const initialWelcomeText = language === 'am' 
    ? `🎉 ወደ **ሃይፐር ቢንጎ ቴሌግራም ቦት (Hyper Bingo Bot)** እንኳን በደህና መጡ!
${isWeekend ? '\n🌟 **የሳምንቱ መጨረሻ ልዩ አሸናፊ ሎተሪ (አርብ፣ ቅዳሜ፣ እሁድ) አሁን በርቷል!** 50,000 ETB ጃክፖት በ 50 ብር!\n' : ''}
በቴሌግራም አማካኝነት ቢንጎን በፍጥነት እና በቀላሉ ይጫወቱ። በቴሌብር (Telebirr)፣ በሲቢኢ ብር (CBE Birr) እና በቻፓ (Chapa) ብር ገቢ ያድርጉ። የቀጥታ ጃክፖት ያሸንፉ!`
    : `🎉 Welcome to **Hyper Bingo Telegram Bot**!
${isWeekend ? '\n🌟 **Weekend Special Win Lottery (Fri, Sat, Sun) is LIVE!** 50,000 ETB Jackpot for 50 ETB!\n' : ''}
Play Bingo quickly and easily through Telegram. Deposit ETB via Telebirr, CBE Birr & Chapa. Win live jackpots!`;

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    createWeekendBroadcastMessage('initial', '2:13 PM'),
    {
      id: 'msg_welcome',
      sender: 'bot',
      text: initialWelcomeText,
      buttons: [
        { label: '🎮 Play Now / አሁኑኑ ይጫወቱ', action: () => onOpenMiniApp('lobby'), isPrimary: true },
        { label: '🌟 Weekend Lottery (Fri-Sun) / ልዩ ሎተሪ', action: () => handleCommand('/lottery'), isPrimary: true },
        { label: '💰 Wallet / ኪስ ቦርሳ', action: () => handleCommand('/wallet') },
        ...(isAdminTelegramId(user?.telegramId)
          ? [{ label: '🛡️ Admin / አስተዳዳሪ', action: () => handleCommand('/admin') }]
          : []),
        { label: '📜 History / ታሪክ', action: () => handleCommand('/history') },
        { label: '🎁 Promo / ማስተዋወቂያ', action: () => handleCommand('/promo') },
        { label: '🌐 ቋንቋ / Language', action: () => handleCommand('/language') },
        { label: '❓ Help / እርዳታ', action: () => handleCommand('/help') },
      ],
      time: '2:14 PM',
    },
  ]);

  const triggerBroadcastNow = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatHistory((prev) => [...prev, createWeekendBroadcastMessage(Date.now().toString(), time)]);
  };

  const toggleLanguage = (newLang: Lang) => {
    setLanguage(newLang);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isAm = newLang === 'am';

    const switchMsg: ChatMessage = {
      id: `bot_lang_${Date.now()}`,
      sender: 'bot',
      text: isAm 
        ? `🇪🇹 ቋንቋው ወደ **አማርኛ** ተቀይሯል።\nአሁን ቢንጎን በአማርኛ መጫወት ይችላሉ!`
        : `🇬🇧 Language switched to **English**.\nYou can now use Hyper Bingo in English!`,
      buttons: [
        { label: isAm ? '🎮 ቢንጎ ይጫወቱ (Mini App)' : '🎮 Play Bingo (Mini App)', action: () => onOpenMiniApp('lobby'), isPrimary: true },
        { label: isAm ? '💰 ኪስ ቦርሳ (Wallet)' : '💰 My Wallet', action: () => handleCommand('/wallet') },
        { label: isAm ? '❓ እርዳታ (Help)' : '❓ Help & Support', action: () => handleCommand('/help') },
      ],
      time,
    };

    setChatHistory((prev) => [...prev, switchMsg]);
  };

  const handleCommand = (cmd: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isAm = language === 'am';

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: cmd,
      time,
    };

    let botResponseText = '';
    let buttons: { label: string; action: () => void; isPrimary?: boolean }[] = [];
    let imageUrl: string | undefined = undefined;
    let reaction: string | undefined = undefined;

    const lowerCmd = cmd.toLowerCase();

    if (lowerCmd === '/admin' || lowerCmd.includes('admin') || lowerCmd.includes('አስተዳዳሪ')) {
      if (!isAdminTelegramId(user?.telegramId)) {
        botResponseText = isAm 
          ? `⛔ **ይቅርታ፣ መዳረሻ ተከልክሏል**\n\nየእርስዎ የቴሌግራም መታወቂያ (${user?.telegramId || 'ያልታወቀ'}) በአስተዳዳሪ ዝርዝር ውስጥ አልተገኘም።\nአስተዳዳሪ ለመሆን የቴሌግራም መታወቂያዎን በ .env.local ውስጥ ባለው NEXT_PUBLIC_ADMIN_TELEGRAM_IDS ያስገቡ።`
          : `⛔ **Access Denied**\n\nYour Telegram ID (${user?.telegramId || 'unknown'}) is not authorized as an administrator.\nTo grant access, add this Telegram ID to NEXT_PUBLIC_ADMIN_TELEGRAM_IDS in .env.local.`;
        buttons = [
          { label: isAm ? '🎮 ቢንጎ ይጫወቱ (Mini App)' : '🎮 Play Bingo', action: () => onOpenMiniApp('lobby'), isPrimary: true },
        ];
      } else {
        botResponseText = isAm 
          ? `🛡️ **የአስተዳዳሪ ዳሽቦርድ (Admin Panel)**\n\nሙሉውን የቢንጎ አስተዳደር ዳሽቦርድ በቴሌግራም ውስጥ በቀጥታ ማግኘት ይችላሉ።\n• የጨዋታዎችን ሁኔታ ይቆጣጠሩ\n• የማውጣት ጥያቄዎችን ያጽድቁ\n• አዳዲስ ጨዋታዎችን ይፍጠሩ`
          : `🛡️ **Admin Panel**\n\nYou can access the full Bingo Admin Dashboard directly inside Telegram.\n• Manage live game rooms\n• Approve or reject withdrawals\n• Create and launch new games`;
        buttons = [
          { label: isAm ? '🛡️ የአስተዳዳሪ ፓነልን ክፈት (Mini App)' : '🛡️ Open Admin Panel (Mini App)', action: () => onOpenMiniApp('admin'), isPrimary: true },
          { label: isAm ? '🎮 ወደ ጨዋታው ተመለስ' : '🎮 Back to Games', action: () => onOpenMiniApp('lobby') },
        ];
      }
    } else if (lowerCmd === '/language' || lowerCmd.includes('language') || lowerCmd.includes('ቋንቋ')) {
      botResponseText = isAm 
        ? `🌐 **ቋንቋ ይምረጡ / Choose Language**\n\nእባክዎን የሚፈልጉትን ቋንቋ ይምረጡ:` 
        : `🌐 **Select Your Language / ቋንቋ ይምረጡ**\n\nPlease select your preferred language below:`;
      buttons = [
        { label: '🇪🇹 አማርኛ (Amharic)', action: () => toggleLanguage('am'), isPrimary: true },
        { label: '🇬🇧 English', action: () => toggleLanguage('en'), isPrimary: true },
      ];
    } else if (lowerCmd === '/start') {
      botResponseText = isAm 
        ? `🎉 ወደ **ሃይፐር ቢንጎ** እንኳን በደህና መጡ!\nለመጀመር ከታች ካሉት አማራጮች አንዱን ይምረጡ:`
        : `🎉 Welcome to **Hyper Bingo**!\nChoose an option below to get started:`;
      buttons = [
        { label: isAm ? '🎮 ቢንጎ ይጫወቱ (Mini App)' : '🎮 Play Bingo Mini App', action: () => onOpenMiniApp('lobby'), isPrimary: true },
        { label: isAm ? '⚡ ፈጣን ቢንጎ (Quick Bingo)' : '⚡ Quick Bingo (Starts soon)', action: () => onOpenMiniApp('game') },
        { label: isAm ? '🌟 ቅዳሜና እሁድ ሎተሪ' : '🌟 Weekend Special Lottery', action: () => handleCommand('/lottery') },
        { label: isAm ? '💰 ኪስ ቦርሳ እና ገቢ (Wallet)' : '💰 Wallet & Deposits', action: () => onOpenMiniApp('wallet') },
        ...(isAdminTelegramId(user?.telegramId)
          ? [{ label: isAm ? '🛡️ አስተዳዳሪ (Admin)' : '🛡️ Admin Panel', action: () => handleCommand('/admin') }]
          : []),
        { label: isAm ? '🌐 ቋንቋ መቀየሪያ' : '🌐 Change Language', action: () => handleCommand('/language') },
      ];
    } else if (
      lowerCmd === '/lottery' || 
      lowerCmd === '/weekend' || 
      lowerCmd.includes('lottery') || 
      lowerCmd.includes('weekend') || 
      lowerCmd.includes('ሎተሪ') || 
      lowerCmd.includes('አርብ') || 
      lowerCmd.includes('ቅዳሜ') || 
      lowerCmd.includes('እሁድ')
    ) {
      imageUrl = '/images/weekend_lottery_flyer.jpg';
      reaction = '❤️';
      botResponseText = `🎉 50 ሺ : በ 50 ብር 🎉

🗓️ አርብ | ቅዳሜ | እሁድ
🕒 10 ሰዓት
🎫 ካርቴላ ሳያልቅ ⌛ ቀድመው ይያዙ 🏃

❓ ማንኛውም ጥያቄ ካለ
📞 0900906969
📞 0900483848
👉 @HyperBingoSupport`;
      buttons = [
        { 
          label: 'አርብ 🕒 10 ሰዓት (አሁኑኑ ይጫወቱ)', 
          action: () => onOpenMiniApp('game'), 
          isPrimary: true 
        },
        { 
          label: isAm ? '🎮 ሁሉም ክፍሎች (Lobby)' : '🎮 View All Rooms', 
          action: () => onOpenMiniApp('lobby') 
        },
        { 
          label: isAm ? '💰 ኪስ ቦርሳ (Wallet)' : '💰 Wallet & Balance', 
          action: () => onOpenMiniApp('wallet') 
        },
      ];
    } else if (lowerCmd === '/wallet' || lowerCmd.includes('wallet') || lowerCmd.includes('ኪስ ቦርሳ')) {
      botResponseText = isAm 
        ? `💰 **የእርስዎ ሂሳብ መጠን (Wallet)**\n\n• የሚገኝ ሂሳብ: ${formatETB(wallet.availableBalance)}\n• የድል ሂሳብ: ${formatETB(wallet.winningBalance)}\n• ቦነስ ሂሳብ: ${formatETB(wallet.bonusBalance)}\n\nበቴሌብር (Telebirr) ወይም በሲቢኢ ብር (CBE Birr) ወዲያውኑ ገቢ ያድርጉ።`
        : `💰 **Your Account Balance**\n\n• Available: ${formatETB(wallet.availableBalance)}\n• Winning Balance: ${formatETB(wallet.winningBalance)}\n• Bonus Balance: ${formatETB(wallet.bonusBalance)}\n\nDeposit funds instantly via Telebirr or CBE Birr.`;
      buttons = [
        { label: isAm ? '📥 ብር ገቢ ያድርጉ (Deposit)' : '📥 Deposit ETB', action: () => onOpenMiniApp('wallet'), isPrimary: true },
        { label: isAm ? '📤 ያሸነፉትን ያውጡ (Withdraw)' : '📤 Withdraw Winnings', action: () => onOpenMiniApp('wallet') },
      ];
    } else if (lowerCmd === '/history' || lowerCmd.includes('history') || lowerCmd.includes('ታሪክ')) {
      botResponseText = isAm 
        ? `📜 **የጨዋታ እና የክፍያ ታሪክ**\n\nጠቅላላ ገቢ የተደረገ: ${formatETB(wallet.totalDeposited)}\nጠቅላላ የወጣ: ${formatETB(wallet.totalWithdrawn)}\n\nሙሉ የግብይት ታሪክዎን ለማየት Mini App ን ይክፈቱ።`
        : `📜 **Recent Game & Transaction Summary**\n\nTotal Deposited: ${formatETB(wallet.totalDeposited)}\nTotal Withdrawn: ${formatETB(wallet.totalWithdrawn)}\n\nOpen Mini App to view your full transaction ledger.`;
      buttons = [
        { label: isAm ? '🔍 ሙሉ ታሪክ ይመልከቱ' : '🔍 View Full Ledger', action: () => onOpenMiniApp('profile') },
      ];
    } else if (lowerCmd === '/promo' || lowerCmd.includes('promo') || lowerCmd.includes('ማስተዋወቂያ')) {
      const activeCount = promotions.filter((p) => p.active).length;
      botResponseText = isAm 
        ? `🎁 **ንቁ ማስተዋወቂያዎች (${activeCount})**\n\n1. WELCOME100 - በመጀመሪያው ገቢዎ ላይ የ100% ቦነስ ስጦታ እስከ 1,000 ETB!\n2. RUSHRUSH - 20% የካሽባክ ቦነስ በፈጣን ቢንጎ ጨዋታዎች ላይ።`
        : `🎁 **Active Promotions (${activeCount})**\n\n1. WELCOME100 - 100% Match Bonus on 1st Deposit up to 1,000 ETB!\n2. RUSHRUSH - 20% Cashback on Quick Bingo games.`;
      buttons = [
        { label: isAm ? '🎁 ቦነስዎን ይውሰዱ' : 'Claim Welcome Bonus', action: () => onOpenMiniApp('wallet'), isPrimary: true },
      ];
    } else if (lowerCmd === '/profile' || lowerCmd.includes('profile') || lowerCmd.includes('መገለጫ')) {
      if (!user) {
        botResponseText = isAm 
          ? `👤 **የእንግዳ መገለጫ**\n\nእስካሁን አካውንት አልከፈቱም። ጨዋታዎችን ለመጫወት እና ገንዘብ ለማውጣት እባክዎን አካውንት ይክፈቱ።`
          : `👤 **Guest Profile**\n\nYou are browsing as a guest. Open an account to participate in live games and withdraw ETB winnings.`;
        buttons = [
          { label: isAm ? 'አካውንት ክፈት (Open Account)' : 'Open Account', action: () => onOpenMiniApp('profile'), isPrimary: true },
        ];
      } else {
        botResponseText = isAm 
          ? `👤 **የተጠቃሚ መገለጫ**\n\nስም: ${user.name}\nየተጠቃሚ ስም: @${user.username}\nቴሌግራም መታወቂያ: ${user.telegramId}\nየጋባዥ ኮድ: ${user.referralCode}`
          : `👤 **User Profile**\n\nName: ${user.name}\nUsername: @${user.username}\nTelegram ID: ${user.telegramId}\nReferral Code: ${user.referralCode}`;
        buttons = [
          { label: isAm ? 'መገለጫ በ Mini App ይክፈቱ' : 'Open Mini App Profile', action: () => onOpenMiniApp('profile') },
        ];
      }
    } else if (lowerCmd === '/help' || lowerCmd.includes('help') || lowerCmd.includes('እርዳታ')) {
      botResponseText = isAm 
        ? `❓ **እርዳታ እና ድጋፍ**\n\n• እንዴት መጫወት ይቻላል: ትኬት ይግዙ፣ የወጡ ቁጥሮችን ምልክት ያድርጉ (daub)። መስመር ወይም ሙሉ ካርድ በመሙላት ያሸንፉ!\n• የደንበኞች ድጋፍ: @HyperBingoSupport ያነጋግሩ ወይም በ support@hyperbingo.et ኢሜይል ያድርጉ`
        : `❓ **Help & Support**\n\n• How to play: Purchase a ticket, daub numbers as drawn. Form a line or full house!\n• Support: Contact @HyperBingoSupport or email support@hyperbingo.et`;
      buttons = [
        { label: isAm ? '🎮 ቢንጎ ይጫወቱ (Mini App)' : '🎮 Play Mini App', action: () => onOpenMiniApp('lobby'), isPrimary: true },
      ];
    } else {
      botResponseText = isAm 
        ? `ጥያቄዎ "${cmd}" አልተረዳሁም። እባክዎን ከታች ካሉት አማራጮች ይምረጡ:`
        : `I didn't understand "${cmd}". Type /start or click below:`;
      buttons = [
        { label: isAm ? '🎮 Mini App ይክፈቱ' : '🎮 Open Mini App', action: () => onOpenMiniApp('lobby'), isPrimary: true },
        { label: isAm ? '💰 ኪስ ቦርሳ ያካሂዱ' : '💰 Check Wallet', action: () => onOpenMiniApp('wallet') },
        { label: isAm ? '🌐 ቋንቋ ይምረጡ' : '🌐 Select Language', action: () => handleCommand('/language') },
      ];
    }

    const botMsg: ChatMessage = {
      id: `bot_${Date.now()}`,
      sender: 'bot',
      text: botResponseText,
      imageUrl,
      reaction,
      buttons,
      time,
    };

    setChatHistory((prev) => [...prev, userMsg, botMsg]);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleCommand(inputText.trim());
    setInputText('');
  };

  if (!isOpen) return null;

  const outerWrapperClass = embedded
    ? ''
    : 'fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm p-4 sm:p-6';

  const innerContainerClass = embedded
    ? 'w-full h-full bg-slate-900 flex flex-col overflow-hidden rounded-none border-0'
    : 'w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col h-[680px] max-h-[92vh] overflow-hidden';

  return (
    <div className={outerWrapperClass}>
      <div className={innerContainerClass}>
        {/* Telegram Header */}
        <div className="bg-slate-800/90 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                Hyper Bingo Bot
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </h3>
              <p className="text-[11px] text-slate-400">bot • official telegram channel</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Broadcast Announcement Button */}
            <button
              onClick={triggerBroadcastNow}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-1 shadow transition"
              title="Broadcast Weekend Lottery / ማስታወቂያ ልቀቅ"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'am' ? '📢 ማስታወቂያ' : '📢 Broadcast'}</span>
            </button>

            {/* Language toggle button */}
            <button
              onClick={() => toggleLanguage(language === 'en' ? 'am' : 'en')}
              className="px-2.5 py-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold text-xs flex items-center gap-1 border border-slate-600 transition"
              title="Switch Language / ቋንቋ ይምረጡ"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'en' ? '🇪🇹 አማ' : '🇬🇧 EN'}
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-700/60 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e1621]">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm relative ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-none'
                }`}
              >
                {/* Attached Promotional Flyer / Poster */}
                {msg.imageUrl && (
                  <div className="mb-2.5 -mx-1 -mt-1 overflow-hidden rounded-xl border border-slate-700/60 shadow-md relative group">
                    <img
                      src={msg.imageUrl}
                      alt="Hyper Bingo Promotion"
                      className="w-full h-auto object-cover max-h-80 rounded-xl group-hover:scale-[1.01] transition-transform duration-300 cursor-pointer"
                      onClick={() => onOpenMiniApp('game')}
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-amber-400 border border-amber-400/30 flex items-center gap-1 shadow-md">
                      <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                      Hyper Bingo
                    </div>
                  </div>
                )}

                <div className="whitespace-pre-line font-normal">{msg.text}</div>
                
                <div className="flex items-center justify-between mt-1 pt-0.5">
                  <div></div>
                  <div
                    className={`text-[9px] ${
                      msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>

                {/* Telegram-style reaction */}
                {msg.reaction && (
                  <div className="absolute -bottom-2 -right-1 bg-slate-900 border border-slate-700 text-xs px-1.5 py-0.5 rounded-full shadow-md flex items-center">
                    <span>{msg.reaction}</span>
                  </div>
                )}
              </div>

              {/* Bot Inline Keyboard Buttons */}
              {msg.buttons && msg.buttons.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 max-w-[88%] w-full mt-2">
                  {msg.buttons.map((btn, idx) => (
                    <button
                      key={idx}
                      onClick={btn.action}
                      className={`text-xs font-semibold py-2 px-3 rounded-lg text-center transition shadow-sm ${
                        btn.isPrimary
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold hover:brightness-110 col-span-2'
                          : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="bg-slate-800 border-t border-slate-700 p-2.5 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={language === 'am' ? "ትዕዛዝ ወይም መልእክት ይጻፉ (/start, /wallet, /language)..." : "Type command or message (/start, /wallet, /language)..."}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
