"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#030a0f]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-emerald-500/25">
            L
          </div>
          <div>
            <p className="font-bold text-white leading-none">
              Lend<span className="text-emerald-400">X</span>
            </p>
            <p className="text-xs text-slate-500">Lending Protocol · Base Sepolia</p>
          </div>
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <span className="text-emerald-400 font-medium cursor-pointer">Markets</span>
          <span className="hover:text-white transition cursor-pointer">Liquidations</span>
          <span className="hover:text-white transition cursor-pointer">Docs</span>
        </div>

        {/* Wallet */}
        <ConnectButton />
      </div>
    </nav>
  );
}
