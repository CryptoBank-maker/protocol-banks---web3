"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { LandingPage } from "@/components/landing-page"

export default function HomePage() {
  const router = useRouter()
  const { isConnected, connectWallet } = useWeb3()
  const { toggleDemoMode } = useDemo()
  const connectingRef = useRef(false)

  // Redirect to dashboard after wallet connects from the landing page
  useEffect(() => {
    if (isConnected && connectingRef.current) {
      connectingRef.current = false
      router.push("/dashboard")
    }
  }, [isConnected, router])

  return (
    <LandingPage
      onConnectWallet={() => {
        connectingRef.current = true
        connectWallet()
      }}
      onTryDemo={() => {
        toggleDemoMode()
        router.push("/dashboard")
      }}
    />
  )
}
