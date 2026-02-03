"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Wallet, ArrowLeftRight, Users, Package } from "lucide-react"

// 底部导航 - 5个核心入口
const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/balances", label: "Balances", icon: Wallet },
  { href: "/history", label: "Transactions", icon: ArrowLeftRight },
  { href: "/vendors", label: "Contacts", icon: Users },
  { href: "/products", label: "Products", icon: Package },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
