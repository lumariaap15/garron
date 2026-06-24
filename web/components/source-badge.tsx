import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sello de fuente oficial — refuerza que cada respuesta cita la ley real. */
export function SourceBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start justify-center gap-2 text-[13.5px] leading-relaxed text-faint",
        className,
      )}
    >
      <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-brand/70" />
      <span>{children}</span>
    </p>
  );
}
