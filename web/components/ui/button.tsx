import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "soft" | "ghost" | "chip";

const variants: Record<Variant, string> = {
  // CTA principal — "Iniciar reclamo en Ventanilla Única"
  primary:
    "bg-brand text-white shadow-cta hover:bg-brand-hover active:translate-y-px",
  // Botón flecha del input de texto libre — azul tenue
  soft: "bg-brand-soft text-white hover:bg-brand",
  // Pills de "¿Qué te pasó?"
  ghost:
    "border border-hair bg-white text-ink hover:border-brand/40 hover:bg-brand-tint",
  // Chips de artículo en "Fundamento legal"
  chip: "border border-brand-chip bg-white text-brand hover:bg-brand-tint",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
