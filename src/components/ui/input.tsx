import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-line bg-surface-1 px-2.5 py-1 text-base text-text-1 transition-[background-color,border-color,box-shadow] [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-out)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-label file:text-text-1 placeholder:text-text-4 hover:border-line-strong focus-visible:border-accent-line focus-visible:ring-3 focus-visible:ring-accent-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-soft md:text-ui",
        className
      )}
      {...props}
    />
  )
}

export { Input }
