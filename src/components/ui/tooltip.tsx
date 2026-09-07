"use client"

import type * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "cn"

/**
 * Label-only tooltip for icon buttons. Surface follows DESIGN.md 4 (elev-overlay,
 * the only rung allowed a shadow) and 2.2 (text-micro for metadata-sized text).
 * The trigger keeps its own aria-label, so this is visual affordance, not the
 * accessible name.
 */
function Tooltip({
  label,
  children,
  side = "top",
  className,
  ...props
}: TooltipPrimitive.Root.Props & {
  label: React.ReactNode
  children: React.ReactElement
  side?: TooltipPrimitive.Positioner.Props["side"]
  className?: string
}) {
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipPrimitive.Trigger data-slot="tooltip-trigger" render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup
            data-slot="tooltip"
            className={cn(
              "elev-overlay max-w-56 rounded-md border border-line bg-surface-2 px-2 py-1 text-micro text-text-2 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className
            )}
          >
            {label}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export { Tooltip }
