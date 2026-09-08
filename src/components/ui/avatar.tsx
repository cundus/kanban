import { cn } from "cn";

// ponytail: fixed 6-color palette for deterministic per-user hashing. This uses raw
// Tailwind color utilities (not semantic tokens) because the design system has no
// multi-hue "identity color" token set — semantic tokens (accent/danger/etc) are
// reserved for UI state, not decorative per-user differentiation. Upgrade path: if
// a design token set for avatar colors is added later, swap this array for tokens.
const AVATAR_PALETTE = [
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400",
];

const SIZE_CLASSES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-micro",
};

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: AvatarProps): React.ReactElement {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        SIZE_CLASSES[size],
        !src && hashColor(name),
        className
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}
