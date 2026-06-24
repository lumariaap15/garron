"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { SourceBadge } from "@/components/source-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORIAS } from "@/lib/demo-data";

// Revelado escalonado en la carga: cada bloque entra apenas después del anterior.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function Home() {
  const router = useRouter();

  // Sin funcionalidad real todavía: cualquier camino lleva a la ficha de ejemplo.
  const irAResultado = () => router.push("/resultado");

  return (
    <div className="flex min-h-screen flex-col items-center px-6">
      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full max-w-canvas flex-1 pt-24 sm:pt-28"
      >
        <motion.div variants={item}>
          <Logo size={44} />
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-9 max-w-[480px] text-[30px] font-bold leading-[1.18] tracking-tight text-ink"
        >
          La guía clara cuando compraste, salió mal y toca reclamar.
        </motion.h1>

        <motion.p variants={item} className="mt-3 text-[17px] text-muted">
          Cada respuesta cita la Ley 24.240.
        </motion.p>

        {/* ¿Qué te pasó? — inicio guiado por categorías, no una caja de chat vacía */}
        <motion.section variants={item} className="mt-14">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.13em] text-faint">
            ¿Qué te pasó?
          </h2>
          <div className="mt-5 flex flex-col items-start gap-3">
            {CATEGORIAS.map((c) => (
              <Button
                key={c.id}
                variant="ghost"
                disabled={!c.disponible}
                onClick={irAResultado}
                className="rounded-pill px-6 py-3.5 text-[16px]"
              >
                {c.label}
              </Button>
            ))}
          </div>
        </motion.section>

        {/* O contanos con tus palabras — entrada de texto libre */}
        <motion.section variants={item} className="mt-12">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.13em] text-faint">
            O contanos con tus palabras
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              irAResultado();
            }}
            className="mt-5 flex items-center gap-3"
          >
            <Input placeholder="Ej: compré una heladera y vino fallada…" />
            <Button
              type="submit"
              variant="soft"
              aria-label="Enviar consulta"
              className="h-[60px] w-[60px] shrink-0 rounded-2xl"
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
            </Button>
          </form>
        </motion.section>
      </motion.main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="w-full max-w-canvas py-10"
      >
        <SourceBadge>Ley 24.240 · fuente oficial argentina.gob.ar</SourceBadge>
      </motion.footer>
    </div>
  );
}
