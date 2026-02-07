"use client"

import { useState, useCallback, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useToast } from "@/hooks/use-toast"
import { authHeaders } from "@/lib/authenticated-fetch"

export interface PricingTier {
  id: string
  name: string
  price: number // USDC per 1000 calls
  rateLimit: number // calls per minute
  features: string[]
}

export interface APIKey {
  id: string
  key: string
  name: string
  tier: string
  status: "active" | "revoked"
  calls_used: number
  calls_limit: number
  created_at: string
  last_used_at: string | null
}

export interface UsageData {
  date: string
  calls: number
  revenue: number
}

export interface MonetizeConfig {
  enabled: boolean
  tiers: PricingTier[]
  defaultTier: string
  webhookUrl: string | null
  rateLimitEnabled: boolean
}

export interface UseMonetizeConfigReturn {
  config: MonetizeConfig
  apiKeys: APIKey[]
  usage: UsageData[]
  totalRevenue: number
  totalCalls: number
  loading: boolean
  error: string | null
  updateConfig: (updates: Partial<MonetizeConfig>) => Promise<void>
  createAPIKey: (name: string, tier: string) => Promise<APIKey | null>
  revokeAPIKey: (keyId: string) => Promise<void>
  addTier: (tier: Omit<PricingTier, "id">) => Promise<void>
  updateTier: (tierId: string, updates: Partial<PricingTier>) => Promise<void>
  deleteTier: (tierId: string) => Promise<void>
  refresh: () => Promise<void>
}

const DEFAULT_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    rateLimit: 10,
    features: ["100 calls/month", "Basic support"],
  },
  {
    id: "starter",
    name: "Starter",
    price: 0.5,
    rateLimit: 60,
    features: ["10,000 calls/month", "Email support", "Basic analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 0.3,
    rateLimit: 300,
    features: ["100,000 calls/month", "Priority support", "Advanced analytics", "Webhooks"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0.1,
    rateLimit: 1000,
    features: ["Unlimited calls", "Dedicated support", "Custom SLA", "White-label"],
  },
]

const DEFAULT_CONFIG: MonetizeConfig = {
  enabled: false,
  tiers: DEFAULT_TIERS,
  defaultTier: "free",
  webhookUrl: null,
  rateLimitEnabled: true,
}

export function useMonetizeConfig(): UseMonetizeConfigReturn {
  const { address } = useUnifiedWallet()
  const { toast } = useToast()
  const [config, setConfig] = useState<MonetizeConfig>(DEFAULT_CONFIG)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [usage, setUsage] = useState<UsageData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!address) {
      setConfig(DEFAULT_CONFIG)
      setApiKeys([])
      setUsage([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/monetize", {
        headers: authHeaders(address),
      })

      if (!res.ok) {
        throw new Error("Failed to fetch monetize data")
      }

      const { config: configData, apiKeys: keysData } = await res.json()

      if (configData) {
        setConfig({
          enabled: configData.enabled,
          tiers: configData.tiers || DEFAULT_TIERS,
          defaultTier: configData.default_tier || "free",
          webhookUrl: configData.webhook_url,
          rateLimitEnabled: configData.require_auth ?? true,
        })
      }

      setApiKeys(keysData || [])

      // Generate mock usage data for last 30 days
      const mockUsage: UsageData[] = []
      const now = new Date()
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        mockUsage.push({
          date: date.toISOString().split("T")[0],
          calls: Math.floor(Math.random() * 5000) + 500,
          revenue: Math.random() * 50 + 10,
        })
      }
      setUsage(mockUsage)
    } catch (err: any) {
      console.error("[Monetize] Failed to fetch data:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateConfig = useCallback(
    async (updates: Partial<MonetizeConfig>) => {
      if (!address) return

      try {
        const newConfig = { ...config, ...updates }

        const res = await fetch("/api/monetize", {
          method: "PUT",
          headers: { ...authHeaders(address), "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: newConfig.enabled,
            tiers: newConfig.tiers,
            defaultTier: newConfig.defaultTier,
            webhookUrl: newConfig.webhookUrl,
            rateLimitEnabled: newConfig.rateLimitEnabled,
          }),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.error || "Failed to update config")
        }

        setConfig(newConfig)
        toast({
          title: "Config Updated",
          description: "Monetization settings saved successfully",
        })
      } catch (err: any) {
        console.error("[Monetize] Update config error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to update config",
          variant: "destructive",
        })
      }
    },
    [address, config, toast],
  )

  const createAPIKey = useCallback(
    async (name: string, tier: string): Promise<APIKey | null> => {
      if (!address) return null

      try {
        const key = `pb_${crypto.randomUUID().replace(/-/g, "")}`
        const tierConfig = config.tiers.find((t) => t.id === tier)

        const res = await fetch("/api/monetize", {
          method: "POST",
          headers: { ...authHeaders(address), "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            name,
            tier,
            status: "active",
            calls_used: 0,
            calls_limit: tier === "enterprise" ? -1 : tierConfig?.rateLimit ? tierConfig.rateLimit * 30 * 24 * 60 : 1000,
          }),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.error || "Failed to create API key")
        }

        const data = await res.json()

        setApiKeys((prev) => [data, ...prev])
        toast({
          title: "API Key Created",
          description: `Key "${name}" created successfully`,
        })
        return data
      } catch (err: any) {
        console.error("[Monetize] Create key error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to create API key",
          variant: "destructive",
        })
        return null
      }
    },
    [address, config.tiers, toast],
  )

  const revokeAPIKey = useCallback(
    async (keyId: string) => {
      try {
        const res = await fetch("/api/monetize", {
          method: "PATCH",
          headers: { ...authHeaders(address), "Content-Type": "application/json" },
          body: JSON.stringify({ keyId }),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.error || "Failed to revoke API key")
        }

        setApiKeys((prev) => prev.map((key) => (key.id === keyId ? { ...key, status: "revoked" } : key)))
        toast({
          title: "API Key Revoked",
          description: "The API key has been revoked",
        })
      } catch (err: any) {
        console.error("[Monetize] Revoke key error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to revoke API key",
          variant: "destructive",
        })
      }
    },
    [address, toast],
  )

  const addTier = useCallback(
    async (tier: Omit<PricingTier, "id">) => {
      const newTier: PricingTier = {
        ...tier,
        id: `tier_${Date.now()}`,
      }
      await updateConfig({ tiers: [...config.tiers, newTier] })
    },
    [config.tiers, updateConfig],
  )

  const updateTier = useCallback(
    async (tierId: string, updates: Partial<PricingTier>) => {
      const newTiers = config.tiers.map((t) => (t.id === tierId ? { ...t, ...updates } : t))
      await updateConfig({ tiers: newTiers })
    },
    [config.tiers, updateConfig],
  )

  const deleteTier = useCallback(
    async (tierId: string) => {
      const newTiers = config.tiers.filter((t) => t.id !== tierId)
      await updateConfig({ tiers: newTiers })
    },
    [config.tiers, updateConfig],
  )

  const totalRevenue = usage.reduce((sum, d) => sum + d.revenue, 0)
  const totalCalls = usage.reduce((sum, d) => sum + d.calls, 0)

  return {
    config,
    apiKeys,
    usage,
    totalRevenue,
    totalCalls,
    loading,
    error,
    updateConfig,
    createAPIKey,
    revokeAPIKey,
    addTier,
    updateTier,
    deleteTier,
    refresh: fetchData,
  }
}
