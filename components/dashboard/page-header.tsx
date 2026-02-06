/**
 * Page Header Component
 *
 * Unified page header for dashboard pages with glass effect
 * Provides consistent layout for icon, title, description, and actions
 */

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { glassIcon } from "@/lib/design-system/glass-styles"

export interface PageHeaderProps extends React.ComponentProps<"div"> {
  /** Icon to display (Lucide icon component) */
  icon: LucideIcon
  /** Page title */
  title: string
  /** Optional description */
  description?: string
  /** Optional action buttons */
  action?: React.ReactNode
  /** Icon variant */
  iconVariant?: "default" | "success" | "warning" | "error"
  /** Icon shape */
  iconShape?: "circle" | "square"
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  (
    {
      icon: Icon,
      title,
      description,
      action,
      iconVariant = "default",
      iconShape = "circle",
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

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-start justify-between gap-4",
          "mb-6 md:mb-8",
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* Icon Container */}
          <div className={cn(iconContainerClasses, "flex-shrink-0")}>
            <Icon className={cn("size-5", iconColorClasses)} />
          </div>

          {/* Title and Description */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    )
  }
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
