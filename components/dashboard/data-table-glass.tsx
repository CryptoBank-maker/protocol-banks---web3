/**
 * Data Table Glass Component
 *
 * Glass-styled table wrapper for dashboard data
 * Provides a glassmorphism effect on the table container and header
 */

"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { glassCard } from "@/lib/design-system/glass-styles"

export interface DataTableGlassProps extends React.ComponentProps<"div"> {
  /** Whether to show in a card container */
  inCard?: boolean
  /** Card variant */
  cardVariant?: "default" | "primary" | "subtle"
}

const DataTableGlass = React.forwardRef<HTMLDivElement, DataTableGlassProps>(
  ({ children, inCard = true, cardVariant = "default", className, ...props }, ref) => {
    if (inCard) {
      return (
        <GlassCard ref={ref} variant={cardVariant} size="sm" className={className} {...props}>
          <GlassCardContent className="p-0">
            <div className="relative w-full overflow-x-auto">
              {children}
            </div>
          </GlassCardContent>
        </GlassCard>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full overflow-x-auto",
          glassCard.default,
          "p-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DataTableGlass.displayName = "DataTableGlass"

/**
 * Glass-styled table header
 */
const TableHeaderGlass = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentProps<"thead">
>(({ className, ...props }, ref) => {
  return (
    <TableHeader
      ref={ref}
      className={cn(
        // Glass effect on header
        "sticky top-0 z-10",
        "backdrop-blur-[12px] backdrop-saturate-[1.2]",
        "bg-white/60 dark:bg-slate-900/60",
        "border-b border-white/20 dark:border-white/10",
        className
      )}
      {...props}
    />
  )
})
TableHeaderGlass.displayName = "TableHeaderGlass"

/**
 * Glass-styled table row with enhanced hover
 */
const TableRowGlass = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<"tr">
>(({ className, ...props }, ref) => {
  return (
    <TableRow
      ref={ref}
      className={cn(
        "hover:bg-primary/5 dark:hover:bg-primary/10",
        "transition-all duration-200",
        className
      )}
      {...props}
    />
  )
})
TableRowGlass.displayName = "TableRowGlass"

// Re-export standard table components for convenience
export {
  DataTableGlass,
  TableHeaderGlass,
  TableRowGlass,
  Table,
  TableBody,
  TableFooter,
  TableHead,
  TableCell,
  TableCaption,
}
