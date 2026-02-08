"use client"

import type React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  glowColor?: "cyan" | "amber"
}

export function AuthModal({ isOpen, onClose, children, glowColor = "cyan" }: AuthModalProps) {
  if (!isOpen) return null

  const accentBackground =
    glowColor === "cyan"
      ? "radial-gradient(140% 140% at 8% 0%, rgba(165, 243, 252, 0.45) 0%, rgba(59, 130, 246, 0.08) 45%, rgba(8, 47, 73, 0) 75%)"
      : "radial-gradient(140% 140% at 8% 0%, rgba(253, 224, 71, 0.5) 0%, rgba(251, 146, 60, 0.12) 45%, rgba(88, 28, 135, 0) 75%)";

  const rimGradient =
    glowColor === "cyan"
      ? "linear-gradient(135deg, rgba(103, 232, 249, 0.38), rgba(14, 165, 233, 0.2))"
      : "linear-gradient(135deg, rgba(252, 211, 77, 0.4), rgba(248, 113, 113, 0.22))";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed left-0 right-0 bottom-0 top-14 sm:top-16 z-[90] bg-slate-950/75 backdrop-blur-lg"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              // Fixed positioning with proper centering
              "fixed z-[100]",
              // Horizontal centering
              "left-1/2 -translate-x-1/2",
              // Vertical positioning: center in available space (below header)
              // calc((100vh - 56px header - modal height ~400px) / 2 + 56px header) ≈ top 30%
              "top-[30%] sm:top-[45%]",
              // Width
              "w-[calc(100%-32px)] max-w-[420px] sm:w-[420px]",
              // Styling
              "overflow-hidden rounded-3xl border border-white/15 bg-slate-900/45 backdrop-blur-[28px]",
              "shadow-[0_32px_80px_rgba(7,15,43,0.55)] ring-1 ring-white/10",
              "max-h-[calc(100vh-120px)] overflow-y-auto",
            )}
          >
            {/* Ambient rim and light gradients */}
            <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: rimGradient }} />
            <div className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ background: accentBackground }} />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-white/40" />
            <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-white/10" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 rounded-full border border-white/20 bg-white/10 p-2 text-white/70 transition-all hover:border-white/40 hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Animated atmospheric glow */}
            <motion.div
              className="pointer-events-none absolute inset-0"
              animate={{ opacity: [0.75, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, repeatType: "mirror" }}
              style={{
                background:
                  glowColor === "cyan"
                    ? "linear-gradient(135deg, rgba(8, 145, 178, 0.18) 0%, rgba(14, 165, 233, 0.08) 40%, transparent 80%)"
                    : "linear-gradient(135deg, rgba(251, 191, 36, 0.22) 0%, rgba(249, 115, 22, 0.08) 40%, transparent 80%)",
              }}
            />

            {/* Content */}
            <div className="relative z-10 p-6 sm:p-7">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
