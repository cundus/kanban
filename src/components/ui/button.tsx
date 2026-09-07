import { forwardRef } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  // Variant/state contract: DESIGN.md 5.1
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-ui whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,box-shadow,transform] [transition-duration:var(--dur-fast)] [transition-timing-function:var(--ease-out)] focus-visible:border-accent-line focus-visible:ring-3 focus-visible:ring-accent-soft active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-soft [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-accent-solid text-accent-fg hover:bg-accent-hover active:bg-accent-solid",
        outline:
          "border-line bg-surface-2 text-text-2 hover:border-line-strong hover:bg-surface-3 hover:text-text-1 aria-expanded:bg-surface-3 aria-expanded:text-text-1",
        secondary:
          "bg-surface-3 text-text-2 hover:bg-surface-4 hover:text-text-1 aria-expanded:bg-surface-4 aria-expanded:text-text-1",
        ghost:
          "text-text-2 hover:bg-surface-2 hover:text-text-1 aria-expanded:bg-surface-2 aria-expanded:text-text-1",
        destructive:
          "bg-danger-soft text-danger hover:bg-danger hover:text-accent-fg focus-visible:border-danger focus-visible:ring-danger-soft",
        link: "text-accent-solid underline-offset-4 hover:text-accent-hover hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-sm px-2 text-micro has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-sm px-2.5 text-label has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-sm",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// forwardRef is required: Base-UI `render={<Button />}` triggers (Menu, Dialog)
// pass a ref through to anchor and focus the element. React 18 drops it otherwise.
const Button = forwardRef<
  HTMLButtonElement,
  ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(function Button({ className, variant = "default", size = "default", ...props }, ref) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

export { Button, buttonVariants }
