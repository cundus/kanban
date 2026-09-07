import * as React from "react"
import { cn } from "cn"

type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-text-3">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h2 className="text-heading text-text-1">{title}</h2>
        {description ? (
          <p className="max-w-[46ch] text-label text-text-3">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export { EmptyState }
