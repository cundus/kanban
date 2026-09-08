import { cn } from "cn"

export interface LabelBadgeProps {
  name: string
  color: string // hex string e.g. "#ef4444"
  className?: string
}

/**
 * Calculate text color (black or white) based on background luminance.
 * ponytail: relative-luminance approximation (not full WCAG contrast formula) —
 * good enough for arbitrary user-picked hex colors on a small pill; upgrade to
 * full WCAG APCA contrast calc if labels ever need AA-compliance auditing.
 */
function getContrastTextColor(hex: string): "#000000" | "#ffffff" {
  // Strip "#", parse r/g/b as 0-255 ints
  const rgb = hex.replace("#", "")
  const r = parseInt(rgb.slice(0, 2), 16)
  const g = parseInt(rgb.slice(2, 4), 16)
  const b = parseInt(rgb.slice(4, 6), 16)

  // Luminance calculation using standard weights
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return white text for dark backgrounds, black text for light backgrounds
  return luminance > 0.6 ? "#000000" : "#ffffff"
}

export function LabelBadge({ name, color, className }: LabelBadgeProps) {
  const textColor = getContrastTextColor(color)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium",
        className
      )}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  )
}
