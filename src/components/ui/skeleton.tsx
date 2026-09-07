import * as React from "react"
import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-[skeleton-pulse_1.4s_var(--ease-in-out)_infinite] rounded-lg bg-surface-3",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
