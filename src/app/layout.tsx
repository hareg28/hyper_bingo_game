import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { BingoProvider } from '../context/BingoContext';
import NotificationToast from '../components/telegram/NotificationToast';
import AuthModal from '../components/auth/AuthModal';

export const metadata: Metadata = {
  title: 'Hyper Bingo - Telegram + Web Real-Money Bingo Platform',
  description: 'Digital Hyper Bingo platform with Telegram Bot, Telegram Mini App, Real-Time 75-Ball Game Engine, Telebirr & CBE Birr Wallet integration.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased bg-[#070913] text-slate-100 min-h-screen">
        <BingoProvider>
          <NotificationToast />
          <AuthModal />
          {children}
        </BingoProvider>
      </body>
    </html>
  );
}

