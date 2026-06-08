"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

function Logo() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lx-grad" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="38" height="38" rx="11" fill="url(#lx-grad)" />
      <line x1="19" y1="9" x2="19" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="14" x2="28" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 21 A5 5 0 0 0 17 21" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M21 19 A5 5 0 0 1 31 19" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="15" y1="30" x2="23" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.07] bg-[#030a0f]/90 backdrop-blur-2xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-extrabold text-white leading-none text-lg tracking-tight">
              Lend
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                X
              </span>
            </p>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5 tracking-wide uppercase">
              Lending Protocol
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm">
          <span className="text-emerald-400 font-semibold cursor-pointer">Markets</span>
          <span className="text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer">
            Positions
          </span>
          <span className="text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer">
            Docs
          </span>
        </div>

        <ConnectButton />
      </div>
    </nav>
  );
}
