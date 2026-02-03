"use client"

import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

/**
 * Reown (WalletConnect) Wallet Button
 * Placeholder component for Reown wallet integration
 */
export function ReownWalletButton() {
  const handleConnect = () => {
    // TODO: Implement Reown wallet connection
    console.log("[Reown] Wallet connection initiated")
  }

  return (
    <Button
      onClick={handleConnect}
      size="sm"
      variant="outline"
      className="text-xs sm:text-sm px-2 sm:px-4"
    >
      <Wallet className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
      <span className="hidden xs:inline">WalletConnect</span>
    </Button>
  )
}
