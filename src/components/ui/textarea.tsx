import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-line bg-surface-1 px-2.5 py-2 text-base text-text-1 transition-[background-color,border-color,box-shadow] [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-out)] outline-none placeholder:text-text-4 hover:border-line-strong focus-visible:border-accent-line focus-visible:ring-3 focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-soft md:text-ui",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
