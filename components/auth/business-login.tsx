"use client"

import { motion } from "framer-motion"
import { Mail, Wallet, Key, Lock, Fingerprint, ArrowRight } from "lucide-react"

export type BusinessConnectType = "hardware" | "email" | "wallet"

interface BusinessLoginProps {
  onConnect: (type: BusinessConnectType) => void
  isLoading?: boolean
}

export function BusinessLogin({ onConnect, isLoading = false }: BusinessLoginProps) {
  return (
    <motion.div
      key="business"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Enterprise Access</h2>
        <p className="text-white/60 text-sm">Infrastructure for global teams</p>
      </div>

      {/* Business Options */}
      <div className="space-y-3">
        {/* Hardware Wallet - Primary */}
        <button
          className="group relative w-full overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-transparent to-amber-500/5 p-5 text-left shadow-[0_20px_48px_rgba(120,66,18,0.28)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-amber-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:opacity-50"
          onClick={() => onConnect("hardware")}
          disabled={isLoading}
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-amber-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-70" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/25 shadow-[0_0_32px_rgba(251,191,36,0.35)]">
              <Key className="h-7 w-7 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-white">Hardware Wallet</p>
              <p className="text-sm text-white/70">Ledger, Trezor, GridPlus</p>
            </div>
            <ArrowRight className="h-6 w-6 text-amber-400/50 group-hover:text-amber-400 transition-colors flex-shrink-0" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-amber-400/70 text-xs">
            <Lock className="h-3 w-3" />
            <span>Maximum security for treasury</span>
          </div>
        </button>

        {/* Secondary Options Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Business Email */}
          <button
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4 text-center shadow-[0_16px_32px_rgba(8,12,31,0.3)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
            onClick={() => onConnect("email")}
            disabled={isLoading}
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/20 shadow-[0_0_24px_rgba(59,130,246,0.35)]">
                <Mail className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Business Email</p>
                <p className="text-xs text-white/50">Work account</p>
              </div>
            </div>
          </button>

          {/* Software Wallet */}
          <button
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4 text-center shadow-[0_16px_32px_rgba(8,12,31,0.3)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
            onClick={() => onConnect("wallet")}
            disabled={isLoading}
          >
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/10 opacity-0 transition-opacity duration-300 group-hover:opacity-80" />
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-400/35 bg-purple-500/20 shadow-[0_0_24px_rgba(168,85,247,0.35)]">
                <Wallet className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-white text-sm">EVM Wallet</p>
                <p className="text-xs text-white/50">MetaMask, etc.</p>
              </div>
            </div>
          </button>
        </div>

        {/* Tron Wallet Option */}
        <button
          className="group relative mt-3 w-full overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-left shadow-[0_16px_36px_rgba(127,29,29,0.35)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-red-400/50 hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 disabled:opacity-50"
          onClick={() => onConnect("tron" as BusinessConnectType)}
          disabled={isLoading}
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-red-500/15 opacity-0 transition-opacity duration-300 group-hover:opacity-80" />
          <div className="relative z-10 flex items-center gap-3">
             <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/25">
               <span className="text-xs font-bold text-red-400">TRX</span>
             </div>
             <div>
                <p className="font-medium text-white text-sm">Tron Network</p>
                <p className="text-xs text-white/50">Connect via TronLink</p>
             </div>
          </div>
        </button>
      </div>

      {/* Security Note */}
      <div className="mt-5 flex items-center gap-2 justify-center text-white/40 text-xs">
        <Fingerprint className="h-3 w-3" />
        <span>Multi-signature support available</span>
      </div>
    </motion.div>
  )
}
