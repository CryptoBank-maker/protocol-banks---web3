"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  overviewItems,
  paymentProducts,
  receivingProducts,
  defiProducts,
  advancedProducts,
  ProductItem
} from "@/lib/products-config"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

function SidebarSection({ title, items }: { title: string, items: ProductItem[] }) {
  const pathname = usePathname()

  return (
    <div className="mb-4">
      <h3 className="mb-2 px-4 text-[11px] font-semibold uppercase text-muted-foreground/60 tracking-[0.1em]">
        {title}
      </h3>
      <div className="space-y-0.5 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/')
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start h-9",
                isActive
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/70 hover:text-foreground",
                item.disabled && "opacity-50 pointer-events-none"
              )}
              asChild
            >
              <Link href={item.disabled ? "#" : item.href}>
                <item.icon
                  className={cn(
                    "mr-2.5 h-4 w-4 stroke-[1.8]",
                    isActive
                      ? "text-foreground"
                      : "text-foreground/50"
                  )}
                />
                <span className="flex-1 text-left text-[13px]">{item.title}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export function ProductsSidebar() {
  return (
    <aside className="w-64 border-r hidden md:block shrink-0">
      <div className="sticky top-16 h-[calc(100vh-4rem)]">
        <ScrollArea className="h-full py-4">
          <SidebarSection title="Overview" items={overviewItems} />
          <Separator className="mx-4 mb-4 w-auto" />
          <SidebarSection title="Payments" items={paymentProducts} />
          <SidebarSection title="Receiving" items={receivingProducts} />
          <Separator className="mx-4 mb-4 w-auto" />
          <SidebarSection title="DeFi" items={defiProducts} />
          <SidebarSection title="Advanced" items={advancedProducts} />
        </ScrollArea>
      </div>
    </aside>
  )
}
