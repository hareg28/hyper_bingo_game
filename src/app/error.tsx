'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto text-2xl font-black">
          ⚡
        </div>
        <h2 className="text-lg font-black text-white">Hyper Bingo</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          ጨዋታውን በመጫን ላይ ትንሽ መቆራረጥ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።
          <br />
          <span className="text-[11px] text-slate-500">
            A temporary issue occurred while loading this section.
          </span>
        </p>
        {error?.message && (
          <div className="text-[10px] text-rose-400/90 bg-rose-950/40 border border-rose-800/40 rounded-xl p-2.5 font-mono text-left max-h-24 overflow-y-auto break-all">
            {error.message}
          </div>
        )}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-md"
          >
            እንደገና ሞክር (Retry)
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            ወደ መነሻ ተመለስ (Go to Lobby)
          </button>
        </div>
      </div>
    </div>
  );
}
