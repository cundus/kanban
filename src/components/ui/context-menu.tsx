"use client"

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"
import {
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
} from "./menu"

/**
 * Right-click context menu. Shares visual shell (elev-overlay, lg radius) with
 * dropdown Menu, but ContextMenu owns its own Positioner (anchored to cursor
 * coords on right-click), so we can't reuse MenuContent — its Positioner is
 * from the @base-ui/react/menu family and would ignore the cursor anchor.
 *
 * ponytail: item primitives (MenuItem/MenuLabel/MenuSeparator/MenuSubmenu*)
 * are reused directly — Base-UI aliases them from the same source in both
 * families, so styling stays in one place. Upgrade path: fork if either
 * family adds primitive-specific props MenuItem doesn't expose.
 */

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger

function ContextMenuContent({
  className,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="z-50">
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "elev-overlay min-w-44 rounded-lg border border-line bg-surface-2 p-1 text-ui text-text-2 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

const ContextMenuItem = MenuItem
const ContextMenuLabel = MenuLabel
const ContextMenuSeparator = MenuSeparator
const ContextMenuSubmenu = MenuSubmenu
const ContextMenuSubmenuTrigger = MenuSubmenuTrigger

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  ContextMenuSubmenuTrigger,
  ContextMenuTrigger,
}
