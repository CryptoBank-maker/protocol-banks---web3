"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { authHeaders } from "@/lib/authenticated-fetch"
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  ExternalLink,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// ─── Types ───────────────────────────────────────────────────────────

interface ReconciliationRecord {
  id: string
  tx_hash: string
  from_address: string
  to_address: string
  amount: string
  amount_usd: number
  token: string
  chain: string
  status: "matched" | "unmatched" | "anomaly"
  matchReason?: string
  anomalyType?: "amount_mismatch" | "missing_onchain" | "duplicate" | "timeout" | "unknown_sender"
  onchainConfirmed: boolean
  dbRecorded: boolean
  timestamp: string
  notes?: string
  vendor?: { name: string }
}

interface ReconciliationSummary {
  total: number
  matched: number
  unmatched: number
  anomalies: number
  matchRate: number
  totalAmount: number
  anomalyAmount: number
}

type ReconciliationStep = "configure" | "processing" | "results"

// ─── Demo Data ───────────────────────────────────────────────────────

const DEMO_RECORDS: ReconciliationRecord[] = [
  {
    id: "rec-1",
    tx_hash: "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xAlice9a2B...7c4E",
    amount: "500.00",
    amount_usd: 500,
    token: "USDC",
    chain: "ethereum",
    status: "matched",
    onchainConfirmed: true,
    dbRecorded: true,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notes: "Monthly subscription",
    vendor: { name: "Acme Corp" },
  },
  {
    id: "rec-2",
    tx_hash: "0xdef234567890abcdef1234567890abcdef1234567890abcdef1234567890cd",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xBob3eC7...f28D",
    amount: "2500.00",
    amount_usd: 2500,
    token: "USDC",
    chain: "base",
    status: "matched",
    onchainConfirmed: true,
    dbRecorded: true,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    notes: "Payroll - February",
    vendor: { name: "Bob Smith" },
  },
  {
    id: "rec-3",
    tx_hash: "0x789234567890abcdef1234567890abcdef1234567890abcdef1234567890ef",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xCharlie5...a91C",
    amount: "1200.00",
    amount_usd: 1200,
    token: "USDT",
    chain: "arbitrum",
    status: "anomaly",
    anomalyType: "amount_mismatch",
    matchReason: "On-chain amount 1,180 USDT differs from recorded 1,200 USDT (1.7% difference)",
    onchainConfirmed: true,
    dbRecorded: true,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    notes: "Contractor payment",
    vendor: { name: "Charlie Dev" },
  },
  {
    id: "rec-4",
    tx_hash: "0x456234567890abcdef1234567890abcdef1234567890abcdef12345678901a",
    from_address: "0xUnknown...x7B3",
    to_address: "0xYourWallet...d3F8",
    amount: "3000.00",
    amount_usd: 3000,
    token: "USDC",
    chain: "ethereum",
    status: "unmatched",
    matchReason: "Transaction found on-chain but not recorded in database",
    onchainConfirmed: true,
    dbRecorded: false,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "rec-5",
    tx_hash: "0x123234567890abcdef1234567890abcdef1234567890abcdef12345678902b",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xDave2f1...c84E",
    amount: "750.00",
    amount_usd: 750,
    token: "USDC",
    chain: "base",
    status: "anomaly",
    anomalyType: "missing_onchain",
    matchReason: "Payment recorded in database but not confirmed on-chain after 30 minutes",
    onchainConfirmed: false,
    dbRecorded: true,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Office supplies",
    vendor: { name: "Dave Supplies" },
  },
  {
    id: "rec-6",
    tx_hash: "0xaaa234567890abcdef1234567890abcdef1234567890abcdef12345678903c",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xEve8b3...d72F",
    amount: "200.00",
    amount_usd: 200,
    token: "USDC",
    chain: "ethereum",
    status: "anomaly",
    anomalyType: "duplicate",
    matchReason: "Duplicate transaction detected — same recipient, amount, and time window",
    onchainConfirmed: true,
    dbRecorded: true,
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Refund",
    vendor: { name: "Eve Designs" },
  },
  ...(Array.from({ length: 12 }, (_, i) => ({
    id: `rec-${i + 7}`,
    tx_hash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`,
    from_address: "0xYourWallet...d3F8",
    to_address: `0x${Math.random().toString(16).slice(2, 8)}...${Math.random().toString(16).slice(2, 6)}`,
    amount: (Math.random() * 2000 + 100).toFixed(2),
    amount_usd: Math.random() * 2000 + 100,
    token: "USDC",
    chain: ["ethereum", "base", "arbitrum"][Math.floor(Math.random() * 3)],
    status: "matched" as const,
    onchainConfirmed: true,
    dbRecorded: true,
    timestamp: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
    vendor: { name: `Vendor ${i + 1}` },
  }))),
]

// ─── Component ───────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const { isConnected, address: wallet } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const showDemoData = isDemoMode || !isConnected

  const [step, setStep] = useState<ReconciliationStep>("configure")
  const [records, setRecords] = useState<ReconciliationRecord[]>([])
  const [loading, setLoading] = useState(false)

  // Config
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0])
  const [selectedChain, setSelectedChain] = useState("all")
  const [selectedToken, setSelectedToken] = useState("all")

  // Filter (results page)
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "unmatched" | "anomaly">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // ─── Data Loading ────────────────────────────────────────────────

  const runReconciliation = useCallback(async () => {
    setLoading(true)
    setStep("processing")

    if (showDemoData) {
      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 1500))
      setRecords(DEMO_RECORDS)
      setStep("results")
      setLoading(false)
      return
    }

    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      })
      if (selectedChain !== "all") params.set("chain", selectedChain)
      if (selectedToken !== "all") params.set("token", selectedToken)

      const response = await fetch(`/api/payments?wallet=${wallet}&type=all&${params}`, {
        headers: authHeaders(wallet),
      })

      if (!response.ok) throw new Error("Failed to fetch payments")

      const data = await response.json()
      const payments = data.payments || []

      // Build reconciliation records from payments
      const reconciled: ReconciliationRecord[] = payments.map((p: any) => {
        const isConfirmed = p.status === "completed"
        const hasHash = !!p.tx_hash
        let status: ReconciliationRecord["status"] = "matched"
        let anomalyType: ReconciliationRecord["anomalyType"]
        let matchReason: string | undefined

        if (!isConfirmed && hasHash) {
          status = "anomaly"
          anomalyType = "timeout"
          matchReason = "Transaction hash exists but status is not confirmed"
        } else if (isConfirmed && !hasHash) {
          status = "anomaly"
          anomalyType = "missing_onchain"
          matchReason = "Completed status but missing transaction hash"
        } else if (p.status === "failed") {
          status = "anomaly"
          anomalyType = "missing_onchain"
          matchReason = "Transaction failed on-chain"
        } else if (isConfirmed && hasHash) {
          status = "matched"
        } else {
          status = "unmatched"
          matchReason = "Pending — awaiting confirmation"
        }

        return {
          id: p.id,
          tx_hash: p.tx_hash || "",
          from_address: p.from_address || "",
          to_address: p.to_address || "",
          amount: p.amount?.toString() || "0",
          amount_usd: p.amount_usd || parseFloat(p.amount || "0"),
          token: p.token_symbol || p.token || "UNKNOWN",
          chain: p.chain || "ethereum",
          status,
          anomalyType,
          matchReason,
          onchainConfirmed: isConfirmed && hasHash,
          dbRecorded: true,
          timestamp: p.timestamp || p.created_at,
          notes: p.notes,
          vendor: p.vendor,
        }
      })

      setRecords(reconciled)
      setStep("results")
    } catch (error) {
      console.error("[Reconciliation] Failed:", error)
      setRecords([])
      setStep("results")
    } finally {
      setLoading(false)
    }
  }, [showDemoData, wallet, startDate, endDate, selectedChain, selectedToken])

  // ─── Computed ────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          r.tx_hash.toLowerCase().includes(q) ||
          r.to_address.toLowerCase().includes(q) ||
          r.from_address.toLowerCase().includes(q) ||
          (r.vendor?.name || "").toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [records, statusFilter, searchQuery])

  const summary: ReconciliationSummary = useMemo(() => {
    const matched = records.filter((r) => r.status === "matched").length
    const unmatched = records.filter((r) => r.status === "unmatched").length
    const anomalies = records.filter((r) => r.status === "anomaly").length
    const totalAmount = records.reduce((s, r) => s + r.amount_usd, 0)
    const anomalyAmount = records
      .filter((r) => r.status === "anomaly")
      .reduce((s, r) => s + r.amount_usd, 0)

    return {
      total: records.length,
      matched,
      unmatched,
      anomalies,
      matchRate: records.length > 0 ? (matched / records.length) * 100 : 0,
      totalAmount,
      anomalyAmount,
    }
  }, [records])

  // ─── Export ──────────────────────────────────────────────────────

  const exportAnomalies = () => {
    const anomalies = records.filter((r) => r.status === "anomaly" || r.status === "unmatched")
    if (anomalies.length === 0) return

    const headers = [
      "Date",
      "Status",
      "Type",
      "TX Hash",
      "From",
      "To",
      "Amount",
      "Token",
      "Chain",
      "Vendor",
      "On-Chain",
      "In Database",
      "Reason",
      "Notes",
    ]
    const rows = anomalies.map((r) => [
      new Date(r.timestamp).toISOString().split("T")[0],
      r.status,
      r.anomalyType || "-",
      r.tx_hash,
      r.from_address,
      r.to_address,
      r.amount,
      r.token,
      r.chain,
      r.vendor?.name || "-",
      r.onchainConfirmed ? "Yes" : "No",
      r.dbRecorded ? "Yes" : "No",
      `"${(r.matchReason || "").replace(/"/g, '""')}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ])

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `anomalies-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportFullReport = () => {
    const headers = [
      "Date",
      "Status",
      "TX Hash",
      "From",
      "To",
      "Debit",
      "Credit",
      "Token",
      "Chain",
      "Vendor",
      "Category",
      "On-Chain Confirmed",
      "DB Recorded",
      "Notes",
    ]

    const rows = filteredRecords.map((r) => {
      const isSent = r.from_address.toLowerCase().includes("your")
      return [
        new Date(r.timestamp).toISOString().split("T")[0],
        r.status,
        r.tx_hash,
        r.from_address,
        r.to_address,
        isSent ? r.amount : "0.00",
        isSent ? "0.00" : r.amount,
        r.token,
        r.chain,
        r.vendor?.name || "-",
        "-",
        r.onchainConfirmed ? "Yes" : "No",
        r.dbRecorded ? "Yes" : "No",
        `"${(r.notes || "").replace(/"/g, '""')}"`,
      ]
    })

    // Add summary
    const summaryRows = [
      [],
      ["=== Reconciliation Summary ==="],
      ["Period", `${startDate} to ${endDate}`],
      ["Total Transactions", summary.total.toString()],
      ["Matched", summary.matched.toString()],
      ["Unmatched", summary.unmatched.toString()],
      ["Anomalies", summary.anomalies.toString()],
      ["Match Rate", `${summary.matchRate.toFixed(1)}%`],
      ["Total Amount (USD)", `$${summary.totalAmount.toFixed(2)}`],
      ["Anomaly Amount (USD)", `$${summary.anomalyAmount.toFixed(2)}`],
    ]

    const csv = [headers.join(","), ...rows.map((r) => r.join(",")), ...summaryRows.map((r) => r.join(","))].join(
      "\n"
    )
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reconciliation-report-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Status Helpers ──────────────────────────────────────────────

  const statusIcon = (status: ReconciliationRecord["status"]) => {
    switch (status) {
      case "matched":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "unmatched":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "anomaly":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
    }
  }

  const statusBadge = (status: ReconciliationRecord["status"]) => {
    const styles = {
      matched: "bg-green-500/10 text-green-500 border-green-500/20",
      unmatched: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      anomaly: "bg-red-500/10 text-red-500 border-red-500/20",
    }
    const labels = {
      matched: "Matched",
      unmatched: "Unmatched",
      anomaly: "Anomaly",
    }
    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    )
  }

  const anomalyLabel = (type?: string) => {
    const labels: Record<string, string> = {
      amount_mismatch: "Amount Mismatch",
      missing_onchain: "Missing On-Chain",
      duplicate: "Duplicate",
      timeout: "Confirmation Timeout",
      unknown_sender: "Unknown Sender",
    }
    return labels[type || ""] || "-"
  }

  const formatAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Reconciliation</h1>
          <p className="text-muted-foreground">
            Match on-chain transactions with database records to verify payment integrity
          </p>
        </div>
        {step === "results" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAnomalies} className="gap-2 bg-transparent">
              <AlertTriangle className="h-4 w-4" />
              Export Anomalies
            </Button>
            <Button variant="outline" size="sm" onClick={exportFullReport} className="gap-2 bg-transparent">
              <FileSpreadsheet className="h-4 w-4" />
              Full Report
            </Button>
          </div>
        )}
      </div>

      {showDemoData && (
        <Alert className="bg-primary/5 border-primary/20 mb-6">
          <AlertDescription className="flex items-center justify-between">
            <span>
              Showing preview data. Connect your wallet to reconcile your real transactions.
            </span>
            <Badge variant="outline" className="ml-2 shrink-0 border-primary/30 text-primary">
              Preview
            </Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Guided Steps Indicator ─────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: "configure", label: "1. Configure", icon: Filter },
          { key: "processing", label: "2. Processing", icon: RefreshCw },
          { key: "results", label: "3. Results", icon: ShieldCheck },
        ].map(({ key, label, icon: Icon }, idx) => (
          <div key={key} className="flex items-center gap-2">
            {idx > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground/50" />}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                step === key
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : records.length > 0 &&
                    (key === "configure" || key === "processing")
                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                  : "bg-secondary/50 text-muted-foreground border border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Step 1: Configure ──────────────────────────────────────── */}
      {step === "configure" && (
        <GlassCard className="bg-card border-border">
          <GlassCardHeader>
            <GlassCardTitle>Configure Reconciliation</GlassCardTitle>
            <GlassCardDescription>
              Select the period and filters for transaction matching
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>

            {/* Quick Ranges */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "Last 7 Days", days: 7 },
                { label: "Last 30 Days", days: 30 },
                { label: "Last 90 Days", days: 90 },
                { label: "This Month", days: -1 },
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  onClick={() => {
                    const end = new Date()
                    const start = new Date()
                    if (days === -1) {
                      start.setDate(1)
                    } else {
                      start.setDate(start.getDate() - days)
                    }
                    setStartDate(start.toISOString().split("T")[0])
                    setEndDate(end.toISOString().split("T")[0])
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chain</Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chains</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    <SelectItem value="tron">TRON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Token</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tokens</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="DAI">DAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">Reconciliation will check:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- On-chain confirmation vs database status</li>
                <li>- Amount consistency between records and blockchain</li>
                <li>- Duplicate transaction detection</li>
                <li>- Missing / unrecorded transactions</li>
                <li>- Confirmation timeout detection (pending &gt; 30 min)</li>
              </ul>
            </div>

            <Button onClick={runReconciliation} className="w-full" size="lg">
              <ShieldCheck className="h-5 w-5 mr-2" />
              Start Reconciliation
            </Button>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* ─── Step 2: Processing ─────────────────────────────────────── */}
      {step === "processing" && (
        <GlassCard className="bg-card border-border">
          <GlassCardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-medium mb-1">Reconciling Transactions</h3>
                <p className="text-muted-foreground">
                  Matching database records with on-chain data...
                </p>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* ─── Step 3: Results ────────────────────────────────────────── */}
      {step === "results" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <GlassCard className="bg-card border-border">
              <GlassCardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Match Rate</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold">{summary.matchRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.matched} of {summary.total} matched
                </p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard className="bg-card border-border">
              <GlassCardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Anomalies</span>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-2xl font-bold text-red-500">{summary.anomalies}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${summary.anomalyAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} at risk
                </p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard className="bg-card border-border">
              <GlassCardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Verified</span>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono">
                  ${summary.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{summary.total} transactions</p>
              </GlassCardContent>
            </GlassCard>

            <GlassCard className="bg-card border-border">
              <GlassCardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Unmatched</span>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </div>
                <div className="text-2xl font-bold text-yellow-500">{summary.unmatched}</div>
                <p className="text-xs text-muted-foreground mt-1">Pending review</p>
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Filters + Table */}
          <GlassCard className="bg-card border-border">
            <GlassCardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div>
                  <GlassCardTitle>Transaction Details</GlassCardTitle>
                  <GlassCardDescription>
                    {startDate} to {endDate} — {filteredRecords.length} records
                  </GlassCardDescription>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-48 bg-secondary/50 border-border"
                    />
                  </div>
                  <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                    <TabsList className="bg-secondary/50">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="matched">Matched</TabsTrigger>
                      <TabsTrigger value="anomaly">Anomalies</TabsTrigger>
                      <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                      <TableHead className="text-foreground whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Vendor / Address</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Debit</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Credit</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Token</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Chain</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">On-Chain</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">DB</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                          No records match the current filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((r) => {
                        const isSent = !r.from_address.toLowerCase().includes("your") ? false : true
                        return (
                          <TableRow key={r.id} className="border-border">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {statusIcon(r.status)}
                                {statusBadge(r.status)}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {new Date(r.timestamp).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground text-sm">
                                  {r.vendor?.name || "Unknown"}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatAddr(isSent ? r.to_address : r.from_address)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-red-500 whitespace-nowrap">
                              {isSent ? `$${parseFloat(r.amount).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-green-500 whitespace-nowrap">
                              {!isSent ? `$${parseFloat(r.amount).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {r.token}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm capitalize">{r.chain}</TableCell>
                            <TableCell>
                              {r.onchainConfirmed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell>
                              {r.dbRecorded ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell>
                              {r.matchReason ? (
                                <span className="text-xs text-muted-foreground max-w-[200px] block truncate" title={r.matchReason}>
                                  {r.anomalyType ? `[${anomalyLabel(r.anomalyType)}] ` : ""}
                                  {r.matchReason}
                                </span>
                              ) : (
                                <span className="text-xs text-green-500">Verified</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep("configure")
                setRecords([])
                setStatusFilter("all")
                setSearchQuery("")
              }}
              className="bg-transparent"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              New Reconciliation
            </Button>
            {summary.anomalies > 0 && (
              <Button variant="outline" onClick={exportAnomalies} className="bg-transparent text-red-500 border-red-500/30 hover:bg-red-500/10">
                <Download className="h-4 w-4 mr-2" />
                Export {summary.anomalies} Anomalies
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
