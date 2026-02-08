"use client"

import { motion } from "framer-motion"
import { Mail, Shield, ArrowRight } from "lucide-react"

export type PersonalLoginMethod = "email" | "google"

interface PersonalLoginProps {
  onLogin: (method: PersonalLoginMethod) => void
  isLoading?: boolean
}

export function PersonalLogin({ onLogin, isLoading = false }: PersonalLoginProps) {
  return (
    <motion.div
      key="personal"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome Back</h2>
        <p className="text-white/60 text-sm">Banking for your daily life</p>
      </div>

      {/* Login Options */}
      <div className="space-y-3">
        {/* Email */}
        <button
          className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-[0_18px_34px_rgba(6,11,30,0.35)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:opacity-50"
          onClick={() => onLogin("email")}
          disabled={isLoading}
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/40" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/20 text-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.35)]">
              <Mail className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">Email Login / Sign up</p>
              <p className="text-sm text-white/60">Continue with your email</p>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-white/40 transition-colors group-hover:text-cyan-300" />
          </div>
        </button>

        {/* Google - Using proper Google logo SVG */}
        <button
          className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-[0_18px_34px_rgba(6,11,30,0.35)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
          onClick={() => onLogin("google")}
          disabled={isLoading}
        >
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/30" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10">
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">Continue with Google</p>
              <p className="text-sm text-white/50">Quick and secure</p>
            </div>
            <ArrowRight className="h-5 w-5 flex-shrink-0 text-white/40 transition-colors group-hover:text-white" />
          </div>
        </button>
      </div>

      {/* Security Note */}
      <div className="mt-5 flex items-center gap-2 justify-center text-white/40 text-xs">
        <Shield className="h-3 w-3" />
        <span>No crypto experience needed</span>
      </div>
    </motion.div>
  )
}
