"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  MessageSquare,
  CheckCircle2,
  Gavel,
  ListChecks,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { SourceBadge } from "@/components/source-badge";
import { Card } from "@/components/ui/card";
import { FICHA_DEMO } from "@/lib/demo-data";

/** Renderiza texto con **negritas** marcadas por dobles asteriscos. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Encabezado de sección: ícono + etiqueta en mayúsculas. */
function SectionLabel({
  icon: Icon,
  color,
  children,
}: {
  icon: typeof CheckCircle2;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span className="text-[13px] font-semibold uppercase tracking-[0.11em]">
        {children}
      </span>
    </div>
  );
}

export default function Resultado() {
  const ficha = FICHA_DEMO;

  return (
    <div className="flex min-h-screen flex-col items-center px-6">
      <div className="w-full max-w-canvas flex-1 pt-7">
        {/* Topbar: volver al inicio + marca */}
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1 text-[15px] text-muted transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Inicio
          </Link>
          <Logo size={26} />
        </header>

        {/* Eco de la consulta del usuario */}
        <div className="mt-8 flex items-center gap-2.5 text-muted">
          <MessageSquare className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          <p className="text-[17px]">“{ficha.consulta}”</p>
        </div>

        {/* La ficha: tres bandas (qué te corresponde / fundamento / cómo reclamar) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="mt-5 overflow-hidden">
            {/* 1 — Qué te corresponde */}
            <div className="px-7 pb-7 pt-7">
              <SectionLabel icon={CheckCircle2} color="text-ok">
                Qué te corresponde
              </SectionLabel>
              <p className="mt-4 text-[17px] leading-[1.62] text-body">
                <RichText text={ficha.queTeCorresponde} />
              </p>
            </div>

            {/* 2 — Fundamento legal (banda azul, full-bleed dentro de la tarjeta) */}
            <div className="border-t border-card bg-brand-tint px-7 py-6">
              <SectionLabel icon={Gavel} color="text-brand">
                Fundamento legal
              </SectionLabel>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
                Artículos que respaldan tu derecho — tocá para leer el texto oficial.
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {ficha.articulos.map((a) => (
                  <a
                    key={a.etiqueta}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-pill border border-brand-chip bg-white px-4 py-2 text-[14.5px] font-semibold text-brand transition-colors hover:bg-brand-tint"
                  >
                    {a.etiqueta}
                    <ExternalLink className="h-[15px] w-[15px]" strokeWidth={2} />
                  </a>
                ))}
              </div>
            </div>

            {/* 3 — Cómo reclamar */}
            <div className="border-t border-card px-7 pb-7 pt-6">
              <SectionLabel icon={ListChecks} color="text-faint">
                Cómo reclamar
              </SectionLabel>
              <ol className="mt-5 space-y-5">
                {ficha.pasos.map((paso, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-hair text-[13px] font-medium text-faint">
                      {i + 1}
                    </span>
                    <p className="text-[16px] leading-[1.55] text-body">{paso}</p>
                  </li>
                ))}
              </ol>

              <a
                href={ficha.cta.url}
                target="_blank"
                rel="noreferrer"
                className="mt-7 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-hover"
              >
                <FileText className="h-[18px] w-[18px]" strokeWidth={2} />
                {ficha.cta.label}
              </a>
            </div>
          </Card>
        </motion.div>
      </div>

      <footer className="w-full max-w-canvas py-10">
        <SourceBadge className="justify-start text-left">{ficha.nota}</SourceBadge>
      </footer>
    </div>
  );
}
