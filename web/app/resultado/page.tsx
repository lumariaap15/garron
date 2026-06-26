"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  MessageSquare,
  CheckCircle2,
  Gavel,
  ListChecks,
  ExternalLink,
  FileText,
  Loader2,
  Compass,
  HelpCircle,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { SourceBadge } from "@/components/source-badge";
import { Card } from "@/components/ui/card";
import type { Ficha } from "@/lib/demo-data";
import type { RespuestaConsulta } from "@/lib/consulta";

/** Renderiza texto con **negritas** marcadas por dobles asteriscos. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">{p}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function SectionLabel({
  icon: Icon, color, children,
}: { icon: typeof CheckCircle2; color: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      <span className="text-[13px] font-semibold uppercase tracking-[0.11em]">{children}</span>
    </div>
  );
}

function Topbar() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-1 text-[15px] text-muted transition-colors hover:text-ink">
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
        Inicio
      </Link>
      <Logo size={26} />
    </header>
  );
}

/** La ficha completa (caso con respuesta). Reusa el diseño de tres bandas. */
function FichaView({ ficha }: { ficha: Ficha }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="mt-5 overflow-hidden">
        <div className="px-7 pb-7 pt-7">
          <SectionLabel icon={CheckCircle2} color="text-ok">Qué te corresponde</SectionLabel>
          <p className="mt-4 text-[17px] leading-[1.62] text-body">
            <RichText text={ficha.queTeCorresponde} />
          </p>
        </div>

        {ficha.articulos.length > 0 && (
          <div className="border-t border-card bg-brand-tint px-7 py-6">
            <SectionLabel icon={Gavel} color="text-brand">Fundamento legal</SectionLabel>
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
        )}

        {ficha.pasos.length > 0 && (
          <div className="border-t border-card px-7 pb-7 pt-6">
            <SectionLabel icon={ListChecks} color="text-faint">Cómo reclamar</SectionLabel>
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
        )}
      </Card>
    </motion.div>
  );
}

/** Tarjeta simple para derivación / sin evidencia / error. */
function AvisoView({
  icon: Icon, titulo, mensaje, accion,
}: {
  icon: typeof Compass;
  titulo: string;
  mensaje: string;
  accion?: { label: string; url: string };
}) {
  return (
    <Card className="mt-5 px-7 py-8">
      <SectionLabel icon={Icon} color="text-brand">{titulo}</SectionLabel>
      <p className="mt-4 text-[17px] leading-[1.6] text-body">{mensaje}</p>
      {accion && (
        <a
          href={accion.url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-[16px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-hover"
        >
          <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2} />
          {accion.label}
        </a>
      )}
    </Card>
  );
}

function ResultadoInner() {
  const consulta = useSearchParams().get("c") ?? "";
  const [data, setData] = useState<RespuestaConsulta | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!consulta) { setCargando(false); return; }
    let vivo = true;
    setCargando(true);
    fetch("/api/consulta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consulta }),
    })
      .then((r) => r.json())
      .then((d: RespuestaConsulta) => { if (vivo) setData(d); })
      .catch(() => { if (vivo) setData({ tipo: "error", mensaje: "No pudimos conectar. Probá de nuevo." }); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [consulta]);

  const nota =
    data?.tipo === "respuesta"
      ? data.ficha.nota
      : "Garrón orienta con base en fuentes oficiales · no es asesoramiento legal";

  return (
    <div className="flex min-h-screen flex-col items-center px-6">
      <div className="w-full max-w-canvas flex-1 pt-7">
        <Topbar />

        <div className="mt-8 flex items-center gap-2.5 text-muted">
          <MessageSquare className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          <p className="text-[17px]">“{consulta}”</p>
        </div>

        {cargando && (
          <div className="mt-10 flex items-center gap-3 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
            <span className="text-[16px]">Buscando en las fuentes oficiales…</span>
          </div>
        )}

        {!cargando && data?.tipo === "respuesta" && <FichaView ficha={data.ficha} />}

        {!cargando && data?.tipo === "derivacion" && (
          <AvisoView
            icon={Compass}
            titulo="Esto lo maneja otro organismo"
            mensaje={data.mensaje}
            accion={data.url ? { label: data.organismo ? `Ir a ${data.organismo}` : "Ver más", url: data.url } : undefined}
          />
        )}

        {!cargando && data?.tipo === "sin_evidencia" && (
          <AvisoView
            icon={HelpCircle}
            titulo="No tengo info oficial suficiente"
            mensaje={data.mensaje}
            accion={{ label: "Iniciar reclamo en Ventanilla Única", url: data.url }}
          />
        )}

        {!cargando && (data?.tipo === "error" || !consulta) && (
          <AvisoView
            icon={HelpCircle}
            titulo="Algo salió mal"
            mensaje={consulta ? (data as any)?.mensaje ?? "Probá de nuevo." : "No recibimos ninguna consulta. Volvé al inicio y contanos qué te pasó."}
          />
        )}
      </div>

      <footer className="w-full max-w-canvas py-10">
        <SourceBadge className="justify-start text-left">{nota}</SourceBadge>
      </footer>
    </div>
  );
}

export default function Resultado() {
  return (
    <Suspense fallback={null}>
      <ResultadoInner />
    </Suspense>
  );
}
