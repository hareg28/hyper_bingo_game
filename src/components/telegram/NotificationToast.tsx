'use client';

import React from 'react';
import { useBingo } from '../../context/BingoContext';
import { Bell, CheckCircle, AlertTriangle, Trophy, Info, X } from 'lucide-react';

export default function NotificationToast() {
  const { notifications, dismissNotification } = useBingo();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-14 left-4 right-4 z-40 flex flex-col gap-2 max-w-xs mx-auto pointer-events-none">
      {notifications.slice(0, 2).map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 text-xs ${
            n.type === 'win'
              ? 'bg-gradient-to-r from-amber-900/90 to-purple-900/90 border-amber-400/50 text-amber-200'
              : n.type === 'success'
              ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300'
              : n.type === 'warning'
              ? 'bg-slate-900/95 border-amber-500/40 text-amber-300'
              : 'bg-slate-900/95 border-blue-500/40 text-blue-300'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {n.type === 'win' ? (
              <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
            ) : n.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : n.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <Info className="w-5 h-5 text-blue-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                {n.title}
              </h4>
              <span className="text-[10px] text-slate-400" suppressHydrationWarning>{n.timestamp}</span>
            </div>
            <p className="text-xs text-slate-200 mt-1 leading-snug">{n.body}</p>
          </div>

          <button
            onClick={() => dismissNotification(n.id)}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
