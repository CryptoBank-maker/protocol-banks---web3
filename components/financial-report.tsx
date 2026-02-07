"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ExternalLink } from "lucide-react"
import { categorizeTransaction, CATEGORY_COLORS } from "@/lib/business-logic"

interface Payment {
  id: string
  timestamp: string
  type?: string
  from_address?: string
  to_address: string
  amount: string
  amount_usd: number
  status: string
  notes?: string
  tx_hash?: string
  token_symbol?: string
  vendor?: {
    name: string
  }
  is_external?: boolean
}

interface FinancialReportProps {
  payments: Payment[]
  loading: boolean
}

export function FinancialReport({ payments, loading }: FinancialReportProps) {
  // Calculate running balance and totals
  const { rows, totalDebit, totalCredit } = useMemo(() => {
    let balance = 0
    let debitSum = 0
    let creditSum = 0

    const mapped = payments.map((p) => {
      const isSent = p.type === "sent"
      const usd = p.amount_usd || 0
      const debit = isSent ? usd : 0
      const credit = isSent ? 0 : usd
      balance += credit - debit
      debitSum += debit
      creditSum += credit
      return { ...p, debit, credit, balance }
    })

    return { rows: mapped, totalDebit: debitSum, totalCredit: creditSum }
  }, [payments])

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>General Ledger</CardTitle>
          <CardDescription>Loading transaction records...</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>General Ledger</CardTitle>
            <CardDescription>Double-entry transaction records (Debit / Credit)</CardDescription>
          </div>
          {rows.length > 0 && (
            <div className="flex gap-6 text-sm">
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Total Debit (Payable)</div>
                <div className="font-mono font-medium text-red-500">${totalDebit.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Total Credit (Receivable)</div>
                <div className="font-mono font-medium text-green-500">${totalCredit.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground text-xs">Net Position</div>
                <div className={`font-mono font-medium ${totalCredit - totalDebit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  ${(totalCredit - totalDebit).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Counterparty</TableHead>
                <TableHead className="text-muted-foreground">Category</TableHead>
                <TableHead className="text-muted-foreground text-right">Debit (Out)</TableHead>
                <TableHead className="text-muted-foreground text-right">Credit (In)</TableHead>
                <TableHead className="text-muted-foreground text-right">Balance</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Notes</TableHead>
                <TableHead className="text-right text-muted-foreground">Tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((payment) => {
                  const category = categorizeTransaction(payment.vendor?.name, payment.notes)
                  return (
                    <TableRow key={payment.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {format(new Date(payment.timestamp), "MMM d, yyyy")}
                          </span>
                          <span className="text-muted-foreground">
                            {format(new Date(payment.timestamp), "HH:mm:ss")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {payment.vendor?.name || (payment.is_external ? "External Transfer" : "Unknown")}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                            {payment.to_address}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-normal"
                          style={{
                            borderColor: `${CATEGORY_COLORS[category]}40`,
                            backgroundColor: `${CATEGORY_COLORS[category]}10`,
                            color: CATEGORY_COLORS[category],
                          }}
                        >
                          {category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {payment.debit > 0 ? (
                          <span className="text-red-500">${payment.debit.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {payment.credit > 0 ? (
                          <span className="text-green-500">${payment.credit.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono whitespace-nowrap ${payment.balance >= 0 ? "text-foreground" : "text-red-500"}`}>
                        ${payment.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            payment.status === "completed" || payment.status === "success"
                              ? "default"
                              : payment.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                          className={
                            payment.status === "completed" || payment.status === "success"
                              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                              : payment.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20"
                                : ""
                          }
                        >
                          {payment.status}
                        </Badge>
                        {payment.is_external && (
                          <Badge
                            variant="outline"
                            className="ml-1 text-[10px] h-5 border-muted-foreground/30 text-muted-foreground"
                          >
                            On-Chain
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground text-xs">
                        {payment.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.tx_hash && (
                          <a
                            href={`https://etherscan.io/tx/${payment.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">View on Explorer</span>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
