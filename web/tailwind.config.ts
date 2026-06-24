import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Azul royal de la marca: logo + CTA principal
        brand: {
          DEFAULT: "#3D5AFE",
          hover: "#2F4BE0",
          soft: "#A9B4F5", // botón flecha del input (estado tenue)
          tint: "#F4F6FE", // fondo del bloque "Fundamento legal"
          chip: "#C7D2FE", // borde de chips de artículo
        },
        // Verde del bloque "Qué te corresponde"
        ok: {
          DEFAULT: "#16A34A",
          icon: "#22C55E",
        },
        // Tinta y grises del texto
        ink: "#13182399", // (no se usa directo; ver abajo)
      },
      textColor: {
        ink: "#121723", // títulos / wordmark
        body: "#2A303C", // cuerpo de texto de la ficha
        muted: "#6B7280", // subtítulos
        faint: "#9AA2AF", // labels en mayúscula / placeholder
      },
      borderColor: {
        hair: "#E6E8EC", // bordes de tarjetas y pills
        card: "#ECEEF2",
      },
      backgroundColor: {
        field: "#F3F4F6", // input de texto libre
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1.25rem", // 20px — tarjeta de la ficha
        pill: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.08)",
        cta: "0 8px 20px -8px rgba(61,90,254,0.55)",
      },
      maxWidth: {
        canvas: "640px", // ancho de la columna de contenido
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
