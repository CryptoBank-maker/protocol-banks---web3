/**
 * Glass Section Component
 *
 * Apple-style glassmorphism section for larger content areas
 * Used for grouping related content with a glass effect
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { glassSection } from "@/lib/design-system/glass-styles"

const glassSectionVariants = cva(
  "transition-all duration-300",
  {
    variants: {
      variant: {
        default: glassSection.default,
        gradient: glassSection.gradient,
      },
      spacing: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
      rounded: {
        none: "rounded-none",
        sm: "rounded-lg",
        md: "rounded-xl",
        lg: "rounded-2xl",
        full: "rounded-3xl",
      },
    },
    defaultVariants: {
      variant: "default",
      spacing: "md",
      rounded: "lg",
    },
  }
)

export interface GlassSectionProps
  extends React.ComponentProps<"section">,
    VariantProps<typeof glassSectionVariants> {}

const GlassSection = React.forwardRef<HTMLElement, GlassSectionProps>(
  ({ className, variant, spacing, rounded, ...props }, ref) => {
    return (
      <section
        ref={ref}
        data-slot="glass-section"
        className={cn(glassSectionVariants({ variant, spacing, rounded }), className)}
        {...props}
      />
    )
  }
)
GlassSection.displayName = "GlassSection"

export { GlassSection }
