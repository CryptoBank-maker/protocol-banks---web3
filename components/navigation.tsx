import { Home, Wallet, ArrowLeftRight, Users, Package, Settings, HelpCircle } from "lucide-react"

// 主导航 - 5个核心入口
const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/balances", label: "Balances", icon: Wallet },
  { href: "/history", label: "Transactions", icon: ArrowLeftRight },
  { href: "/vendors", label: "Contacts", icon: Users },
  { href: "/products", label: "Products", icon: Package },
]

const secondaryNavItems = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: HelpCircle },
]
