"use client"

import type * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "cn"

/**
 * Thin wrapper over Base-UI Menu. Surface follows DESIGN.md 4 (elev-overlay,
 * the only rung allowed a shadow) and 3.2 (lg radius for dropdown menus).
 */

function Menu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="menu" {...props} />
}

function MenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />
}

function MenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: MenuPrimitive.Positioner.Props["align"]
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"]
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={cn(
            "elev-overlay min-w-44 rounded-lg border border-line bg-surface-2 p-1 text-ui text-text-2 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function MenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={cn(
        "flex h-8 cursor-default items-center gap-2 rounded-md px-2 outline-none select-none data-highlighted:bg-surface-3 data-highlighted:text-text-1 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * Static header inside a menu. Deliberately a plain div, not MenuPrimitive.GroupLabel:
 * that part throws unless wrapped in <Menu.Group>, and a standalone header has no group.
 * ponytail: add a MenuGroup export the day a menu needs real labelled groups.
 */
function MenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="menu-label"
      className={cn("px-2 py-1.5 text-micro text-text-3", className)}
      {...props}
    />
  )
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={cn("-mx-1 my-1 h-px bg-line-subtle", className)}
      {...props}
    />
  )
}

export { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger }
