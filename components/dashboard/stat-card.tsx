/**
 * Stat Card Component
 *
 * Glass card for displaying key metrics and statistics
 * with optional trend indicators
 */

import * as React from "react"
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  GlassCard,
  GlassCardContent,
  type GlassCardProps,
} from "@/components/ui/glass-card"
import { glassIcon } from "@/lib/design-system/glass-styles"

export interface StatCardProps extends Omit<GlassCardProps, "children"> {
  /** Icon to display */
  icon: LucideIcon
  /** Stat label/title */
  label: string
  /** Stat value (main number) */
  value: string | number
  /** Optional description */
  description?: string
  /** Trend indicator */
  trend?: {
    /** Trend direction */
    direction: "up" | "down" | "neutral"
    /** Trend value (e.g., "+12.5%") */
    value: string
    /** Is positive change good? */
    isPositive?: boolean
  }
  /** Icon variant */
  iconVariant?: "default" | "success" | "warning" | "error"
  /** Icon shape */
  iconShape?: "circle" | "square"
  /** Display format */
  format?: "default" | "compact" | "detailed"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      icon: Icon,
      label,
      value,
      description,
      trend,
      iconVariant = "default",
      iconShape = "square",
      format = "default",
      variant,
      size = "sm",
      className,
      ...props
    },
    ref
  ) => {
    const iconContainerClasses =
      iconShape === "circle"
        ? glassIcon.circle[iconVariant]
        : glassIcon.square[iconVariant]

    const iconColorClasses = {
      default: "text-primary",
      success: "text-green-500",
      warning: "text-yellow-500",
      error: "text-red-500",
    }[iconVariant]

    const getTrendColor = () => {
      if (!trend) return ""

      const isGood = trend.isPositive !== false

      if (trend.direction === "up") {
        return isGood ? "text-green-500" : "text-red-500"
      }
      if (trend.direction === "down") {
        return isGood ? "text-red-500" : "text-green-500"
      }
      return "text-muted-foreground"
    }

    const getTrendIcon = () => {
      if (!trend) return null

      if (trend.direction === "up") return TrendingUp
      if (trend.direction === "down") return TrendingDown
      return Minus
    }

    const TrendIcon = getTrendIcon()

    return (
      <GlassCard
        ref={ref}
        variant={variant}
        size={size}
        className={cn("hover:shadow-glass-lg transition-all", className)}
        {...props}
      >
        <GlassCardContent className="space-y-3">
          {/* Icon and Label Row */}
          <div className="flex items-center justify-between">
            <div className={cn(iconContainerClasses, "flex-shrink-0")}>
              <Icon className={cn("size-4", iconColorClasses)} />
            </div>

            {trend && TrendIcon && (
              <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor())}>
                <TrendIcon className="size-3" />
                <span>{trend.value}</span>
              </div>
            )}
          </div>

          {/* Label */}
          <div className="text-sm text-muted-foreground">{label}</div>

          {/* Value */}
          <div
            className={cn(
              "font-bold tabular-nums",
              format === "compact" ? "text-xl" : "text-2xl md:text-3xl"
            )}
          >
            {value}
          </div>

          {/* Description (optional) */}
          {description && format !== "compact" && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </GlassCardContent>
      </GlassCard>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
