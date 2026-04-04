import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "default" | "outline" | "ghost" | "hero" | "heroSecondary";
type Size = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90",
  outline:
    "border border-border bg-background hover:bg-secondary text-foreground",
  ghost:
    "hover:bg-secondary text-foreground",
  hero:
    "bg-foreground text-background rounded-none px-8 py-4 text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:bg-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]",
  heroSecondary:
    "silk-veil text-foreground rounded-none px-8 py-4 text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:bg-white/60",
};

const sizeClasses: Record<Size, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-xs",
  lg: "h-11 px-8 text-base",
  icon: "h-10 w-10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...props }, ref) => {
    const isHeroVariant = variant === "hero" || variant === "heroSecondary";
    const classes = [
      "inline-flex items-center justify-center font-body cursor-pointer",
      "disabled:pointer-events-none disabled:opacity-50",
      variantClasses[variant],
      isHeroVariant ? "" : sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <button className={classes} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
