import { cn } from "@/lib/utils";

/**
 * Marca Garrón: burbuja de chat azul con un check blanco.
 * `size` controla el cuadrado del isotipo; el wordmark escala con él.
 */
export function Logo({
  size = 44,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden="true"
      >
        <g fill="#3D5AFE">
          <rect x="3" y="3" width="38" height="31" rx="10" />
          <path d="M12 30 L12 41 L23 32 Z" />
        </g>
        <path
          d="M15 19 l5 5 l9 -11"
          stroke="white"
          strokeWidth="3.4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span
          className="font-bold tracking-tight text-ink"
          style={{ fontSize: size * 0.74 }}
        >
          Garrón
        </span>
      )}
    </span>
  );
}
