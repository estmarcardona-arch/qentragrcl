import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// Variantes del Prompt 0: primario, secundario, peligro y fantasma. El deshabilitado no usa
// transparencia: fondo #E6EBF1 y texto secundario, y debe mostrar su motivo (DisabledReason).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover disabled:border-divider disabled:bg-divider disabled:text-text-secondary",
        outline:
          "border-primary bg-surface text-primary hover:bg-primary-tint hover:text-primary-hover disabled:border-border disabled:bg-surface-sunken disabled:text-text-secondary",
        secondary:
          "border-primary bg-surface text-primary hover:bg-primary-tint hover:text-primary-hover disabled:border-border disabled:bg-surface-sunken disabled:text-text-secondary",
        destructive:
          "border-destructive bg-destructive text-white hover:border-destructive-hover hover:bg-destructive-hover disabled:border-divider disabled:bg-divider disabled:text-text-secondary",
        ghost:
          "border-transparent bg-transparent text-primary hover:bg-primary-tint hover:text-primary-hover disabled:text-text-muted",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 max-[1279px]:h-11",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-[13px] max-[1279px]:h-11",
        lg: "h-11 px-4",
        icon: "size-9 max-[1279px]:size-11",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 max-[1279px]:size-11",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
