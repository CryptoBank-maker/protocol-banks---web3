"use client"

import { motion } from "framer-motion"
import { User, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type AuthMode = "personal" | "business"

interface AuthModeSwitcherProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

export function AuthModeSwitcher({ mode, onModeChange }: AuthModeSwitcherProps) {
  const handleModeChange = (newMode: AuthMode) => {
    if (newMode === mode) return

    onModeChange(newMode)
  }

  return (
    <div className="flex justify-center mb-7">
      <div className="relative flex overflow-hidden rounded-full border border-white/15 bg-white/5 px-1 py-1 backdrop-blur-md shadow-[0_18px_40px_rgba(8,12,31,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-70" />
        <motion.div
          className={cn(
            "absolute top-1 bottom-1 rounded-full shadow-[0_12px_32px_rgba(14,165,233,0.35)]",
            mode === "personal" ? "bg-cyan-400/30" : "bg-amber-400/30",
          )}
          animate={{
            left: mode === "personal" ? 4 : "50%",
            right: mode === "personal" ? "50%" : 4,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        />

        <button
          onClick={() => handleModeChange("personal")}
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all",
            mode === "personal"
              ? "text-cyan-100 drop-shadow-[0_0_12px_rgba(6,182,212,0.45)]"
              : "text-white/60 hover:text-white/80",
          )}
        >
          <User className="h-4 w-4" />
          Personal
        </button>

        <button
          onClick={() => handleModeChange("business")}
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all",
            mode === "business"
              ? "text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]"
              : "text-white/60 hover:text-white/80",
          )}
        >
          <Building2 className="h-4 w-4" />
          Business
        </button>
      </div>
    </div>
  )
}
