import type { ReactNode } from "react"
import { XIcon } from "lucide-react"

interface SelectionOption {
  id: string
  name: string
  content: ReactNode
}

export function TaskSelection({
  id,
  options,
  selectedIds,
  placeholder,
  emptyMessage,
  loading = false,
  disabled = false,
  onToggle,
}: {
  id: string
  options: SelectionOption[]
  selectedIds: Set<string>
  placeholder: string
  emptyMessage: string
  loading?: boolean
  disabled?: boolean
  onToggle: (id: string) => void
}) {
  const available = options.filter((option) => !selectedIds.has(option.id))
  const selected = options.filter((option) => selectedIds.has(option.id))

  return (
    <>
      <select
        id={id}
        value=""
        disabled={loading || disabled || available.length === 0}
        onChange={(event) => {
          if (event.target.value) onToggle(event.target.value)
        }}
        className="h-8 w-full min-w-0 rounded-md border border-line bg-surface-1 px-2.5 text-base text-text-1 outline-none hover:border-line-strong focus-visible:border-accent-line focus-visible:ring-3 focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-40 md:text-ui"
      >
        <option value="" disabled>
          {loading
            ? "Loading…"
            : options.length === 0
              ? emptyMessage
              : available.length === 0
                ? "All selected"
                : placeholder}
        </option>
        {available.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={`Remove ${option.name}`}
              disabled={loading || disabled}
              onClick={() => onToggle(option.id)}
              className="flex max-w-full items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft py-1 pl-1 pr-2 text-micro text-accent-solid outline-none transition-colors hover:border-line-strong focus-visible:ring-3 focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {option.content}
              <XIcon className="size-3 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </>
  )
}
