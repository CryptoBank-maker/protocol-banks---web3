/**
 * Glass Card Component
 *
 * Apple-style glassmorphism card with backdrop blur effect
 * Maintains the same API as the standard Card component
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { glassCard, glassInteractive } from "@/lib/design-system/glass-styles"

const glassCardVariants = cva(
  "flex flex-col transition-all duration-300",
  {
    variants: {
      variant: {
        default: glassCard.default,
        primary: glassCard.primary,
        success: glassCard.success,
        warning: glassCard.warning,
        error: glassCard.error,
        info: glassCard.info,
        subtle: glassCard.subtle,
      },
      size: {
        sm: "gap-4 p-4 rounded-lg",
        md: "gap-6 py-6 rounded-xl",
        lg: "gap-8 p-8 rounded-2xl",
      },
      interactive: {
        true: glassInteractive.hover + " " + glassInteractive.active + " cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      interactive: false,
    },
  }
)

export interface GlassCardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof glassCardVariants> {}

function GlassCard({
  className,
  variant,
  size,
  interactive,
  ...props
}: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      className={cn(glassCardVariants({ variant, size, interactive }), className)}
      {...props}
    />
  )
}

interface GlassCardHeaderProps extends React.ComponentProps<"div"> {}

function GlassCardHeader({ className, ...props }: GlassCardHeaderProps) {
  return (
    <div
      data-slot="glass-card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=glass-card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

interface GlassCardTitleProps extends React.ComponentProps<"div"> {}

function GlassCardTitle({ className, ...props }: GlassCardTitleProps) {
  return (
    <div
      data-slot="glass-card-title"
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  )
}

interface GlassCardDescriptionProps extends React.ComponentProps<"div"> {}

function GlassCardDescription({ className, ...props }: GlassCardDescriptionProps) {
  return (
    <div
      data-slot="glass-card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

interface GlassCardActionProps extends React.ComponentProps<"div"> {}

function GlassCardAction({ className, ...props }: GlassCardActionProps) {
  return (
    <div
      data-slot="glass-card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

interface GlassCardContentProps extends React.ComponentProps<"div"> {}

function GlassCardContent({ className, ...props }: GlassCardContentProps) {
  return (
    <div
      data-slot="glass-card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

interface GlassCardFooterProps extends React.ComponentProps<"div"> {}

function GlassCardFooter({ className, ...props }: GlassCardFooterProps) {
  return (
    <div
      data-slot="glass-card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  GlassCard,
  GlassCardHeader,
  GlassCardFooter,
  GlassCardTitle,
  GlassCardAction,
  GlassCardDescription,
  GlassCardContent,
}
