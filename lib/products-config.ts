import {
  Send,
  Users,
  Link as LinkIcon,
  ShoppingCart,
  FileText,
  Monitor,
  RefreshCw,
  Layers,
  Clock,
  Bot,
  Globe,
  BarChart3,
  ArrowRightLeft,
  Home,
  CreditCard,
  ShoppingBag,
  PieChart,
  Store,
  Banknote,
  Wallet,
  Code,
  Settings,
  ShieldCheck,
} from "lucide-react"

export interface ProductItem {
  href: string
  title: string
  description: string
  icon: React.ElementType
  disabled?: boolean
}

// Overview
export const overviewItems: ProductItem[] = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Dashboard overview",
    icon: Home,
  },
  {
    href: "/balances",
    title: "Balances",
    description: "View wallet balances across chains",
    icon: CreditCard,
  },
  {
    href: "/vendors",
    title: "Contacts",
    description: "Manage suppliers and partners",
    icon: ShoppingBag,
  },
  {
    href: "/settings",
    title: "Settings",
    description: "API keys, webhooks, and preferences",
    icon: Settings,
  },
]

// Payments
export const paymentProducts: ProductItem[] = [
  {
    href: "/pay",
    title: "Pay",
    description: "Send crypto to any wallet address instantly",
    icon: Send,
  },
  {
    href: "/batch-payment",
    title: "Batch Payment",
    description: "Pay multiple recipients in one transaction",
    icon: Users,
  },
  {
    href: "/split-payments",
    title: "Split Payments",
    description: "Distribute revenue to multiple recipients",
    icon: PieChart,
  },
  {
    href: "/subscriptions",
    title: "Auto Pay",
    description: "Recurring payments & enterprise auto-pay",
    icon: Clock,
  },
  {
    href: "/card",
    title: "Card",
    description: "Virtual crypto debit card",
    icon: Wallet,
  },
  {
    href: "/history",
    title: "Transactions",
    description: "Payment history and activity",
    icon: ArrowRightLeft,
  },
  {
    href: "/reconciliation",
    title: "Reconciliation",
    description: "Match on-chain vs database records",
    icon: ShieldCheck,
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Payment analytics and reports",
    icon: BarChart3,
  },
]

// Receiving
export const receivingProducts: ProductItem[] = [
  {
    href: "/acquiring",
    title: "Acquiring",
    description: "Merchant SDK, orders, and payment acceptance",
    icon: Store,
  },
  {
    href: "/receive",
    title: "Payment Links",
    description: "Generate QR codes and shareable payment links",
    icon: LinkIcon,
  },
  {
    href: "/checkout",
    title: "Checkout",
    description: "Accept crypto payments on your website",
    icon: ShoppingCart,
  },
  {
    href: "/acquiring/invoices",
    title: "Invoicing",
    description: "Professional crypto invoices with tracking",
    icon: FileText,
  },
  {
    href: "/terminal",
    title: "POS Terminal",
    description: "In-person payments with QR codes",
    icon: Monitor,
  },
]

// DeFi
export const defiProducts: ProductItem[] = [
  {
    href: "/swap",
    title: "Swap",
    description: "Exchange tokens at the best rates",
    icon: RefreshCw,
  },
  {
    href: "/omnichain",
    title: "Cross-chain",
    description: "Bridge assets across multiple chains",
    icon: Layers,
  },
  {
    href: "/offramp",
    title: "Off-ramp",
    description: "Convert crypto to fiat currency",
    icon: Banknote,
  },
]

// Advanced
export const advancedProducts: ProductItem[] = [
  {
    href: "/agents",
    title: "AI Agents",
    description: "Autonomous payments with session keys",
    icon: Bot,
  },
  {
    href: "/omnichain",
    title: "Omnichain Vault",
    description: "Unified cross-chain asset management",
    icon: Globe,
  },
  {
    href: "/embed",
    title: "SDK / Embed",
    description: "Integrate payments into your app",
    icon: Code,
  },
]
