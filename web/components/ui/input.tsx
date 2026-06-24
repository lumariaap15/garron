import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-[60px] w-full rounded-2xl bg-field px-5 text-[17px] text-ink",
      "placeholder:text-faint",
      "border border-transparent transition-colors",
      "focus:border-brand/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
