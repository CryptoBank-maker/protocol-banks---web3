"use client"

import { CrossChainSwap } from "@/components/cross-chain-swap"
import { useUserType } from "@/contexts/user-type-context"

export default function SwapPage() {
  const { isWeb2User, translateTerm } = useUserType()

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {isWeb2User ? translateTerm("Currency Exchange") : "Cross-Chain Swap"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {isWeb2User
              ? "Exchange your currencies across different networks instantly. We automatically find the best rate for you."
              : "Swap tokens across any blockchain with aggregated routing from 70+ chains, 100+ DEXs, and 20+ bridges."}
          </p>
        </div>

        {/* Swap Component */}
        <CrossChainSwap mode="full" />

        {/* Features Section - Web3 only */}
        {!isWeb2User && (
          <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 rounded-xl bg-card border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Best Price Routing</h3>
              <p className="text-sm text-muted-foreground">
                Aggregates 100+ DEXs and 20+ bridges to find the optimal route with lowest fees and slippage.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Non-Custodial</h3>
              <p className="text-sm text-muted-foreground">
                Your assets stay in your wallet. All swaps execute directly through audited smart contracts.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">70+ Chains Supported</h3>
              <p className="text-sm text-muted-foreground">
                From Ethereum and Bitcoin to Solana and Cosmos chains - all accessible from one interface.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
