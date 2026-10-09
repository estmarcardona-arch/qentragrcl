import type { Metadata } from "next";
import {
  CircleCheck,
  CircleX,
  Download,
  Eye,
  FileText,
  PenLine,
  Plus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/state-card";
import { MasterList, type MasterRow } from "@/components/documents/master-list";
import { Button } from "@/components/ui/button";
import { getDocAccess } from "@/lib/documents/access";
import { CODE_EXAMPLE } from "@/lib/documents/labels";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Listado maestro · GRUFARCOL eBR" };

// S-44 · Listado maestro de documentos (RF-92, RF-98, RF-103). Vista completa para Aseguramiento de la
// calidad y aprobadores; los demás ven los documentos vigentes con su estado de capacitación.
export default async function MasterListPage() {
  const a = await getDocAccess();
  const { supabase } = a;
  const [
    { data: rows, error },
    { data: overdue },
    { data: open },
    { data: requests },
    { data: changes },
    { data: annulments },
  ] = await Promise.all([
    supabase.from("v_master_list").select("*").order("code"),
    supabase.from("v_documents_overdue_by_process").select("*").order("process_code"),
    supabase
      .from("document_versions")
      .select("id, status, document_id")
      .not("status", "in", "(vigente,obsoleto)"),
    supabase.from("document_requests").select("id, kind").in("status", ["abierta", "en_curso"]),
    supabase.from("document_change_requests").select("id").neq("status", "cerrada"),
    supabase.from("document_annulments").select("id").in("status", ["solicitada", "aprobada"]),
  ]);

  if (error) {
    return (
      <main className="px-8 py-6 max-[1279px]:px-4">
        <ErrorState
          title="No se pudo cargar el listado maestro"
          text="Intente de nuevo en unos segundos."
          code={error.code}
        />
      </main>
    );
  }

  let list = (rows ?? []) as unknown as MasterRow[];
  if (!a.fullView) {
    // Vista de planta: solo vigentes, con su estado de capacitación (Prompt 2C, S-44b).
    const [{ data: assigned }, { data: attempts }] = await Promise.all([
      supabase
        .from("training_assignments")
        .select("training_id, document_trainings(version_id)")
        .eq("user_id", a.ctx.userId),
      supabase
        .from("training_attempts")
        .select("training_id, passed")
        .eq("user_id", a.ctx.userId)
        .eq("passed", true),
    ]);
    const passed = new Set((attempts ?? []).map((t) => t.training_id));
    const byVersion = new Map<string, boolean>();
    for (const t of assigned ?? []) {
      const vid = (t.document_trainings as unknown as { version_id: string } | null)?.version_id;
      if (vid) byVersion.set(vid, byVersion.get(vid) === true || passed.has(t.training_id));
    }
    list = list
      .filter((r) => r.document_status === "vigente")
      .map((r) => {
        const vid = (r as unknown as { version_id: string | null }).version_id;
        const st = vid ? byVersion.get(vid) : undefined;
        return { ...r, training: st === undefined ? null : st ? "capacitado" : "pendiente" };
      });
  }

  const internal = list.filter((r) => r.origin === "interno");
  const cards: { label: string; n: number; icon: LucideIcon; tone: string }[] = a.fullView
    ? [
        {
          label: "Vigentes",
          n: list.filter((r) => r.document_status === "vigente").length,
          icon: CircleCheck,
          tone: "text-q-ok-fg border-q-ok-bd",
        },
        {
          label: "En revisión",
          n: (open ?? []).filter((v) => ["en_revision", "en_aprobacion"].includes(v.status)).length,
          icon: Eye,
          tone: "text-tram-en-curso-fg border-tram-en-curso-bd",
        },
        {
          label: "Revisiones vencidas",
          n: internal.filter((r) => r.validity === "vencido").length,
          icon: CircleX,
          tone: "text-q-bad-fg border-q-bad-bd",
        },
        {
          label: "Por estandarizar",
          n: (open ?? []).filter((v) =>
            ["solicitado", "preliminar", "en_estandarizacion"].includes(v.status),
          ).length,
          icon: PenLine,
          tone: "text-tram-revision-fg border-tram-revision-bd",
        },
        {
          label: "Solicitudes abiertas",
          n:
            (requests ?? []).filter((r) => r.kind === "creacion").length +
            (changes?.length ?? 0) +
            (annulments?.length ?? 0),
          icon: FileText,
          tone: "text-tram-en-curso-fg border-border",
        },
      ]
    : [
        {
          label: "Vigentes de mi área",
          n: list.length,
          icon: CircleCheck,
          tone: "text-q-ok-fg border-q-ok-bd",
        },
        {
          label: "Pendientes de capacitación",
          n: list.filter((r) => r.training === "pendiente").length,
          icon: FileText,
          tone: "text-tram-pendiente-fg border-tram-pendiente-bd",
        },
      ];
  const pending = list.filter((r) => r.training === "pendiente");

  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={a.fullView ? "Listado maestro de documentos" : "Documentos vigentes"}
        description={
          a.fullView
            ? `Sistema de gestión documental · ${internal.length} documentos internos y ${list.length - internal.length} externo${list.length - internal.length === 1 ? "" : "s"}`
            : `${list.length} documentos vigentes`
        }
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Documentos" },
          { label: "Listado maestro" },
        ]}
        actions={
          a.fullView ? (
            <>
              <Button variant="secondary" asChild>
                <a href="/documentos/exportar" download>
                  <Download aria-hidden />
                  Exportar a Excel
                </a>
              </Button>
              {a.isAqDoc || a.canAuthor ? (
                <Button asChild>
                  <Link href="/documentos/nuevo">
                    <Plus aria-hidden />
                    {a.isAqDoc ? "Nuevo documento" : "Solicitar documento"}
                  </Link>
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      {pending.length > 0 ? (
        <p
          role="note"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          Debe aprobar la capacitación de{" "}
          {pending.map((p) => `${p.code} v${p.version_label}`).join(", ")} antes de ejecutar los
          pasos que rige. El cuestionario aprueba con 80 %.{" "}
          <Link href="/documentos/capacitacion">Ir a mis capacitaciones</Link>
        </p>
      ) : null}

      <ul className="grid grid-cols-5 gap-3 max-[1279px]:grid-cols-3" aria-label="Resumen">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <li
              key={c.label}
              className={`grid gap-1 rounded-[10px] border bg-surface p-3.5 ${c.tone}`}
            >
              <span className="flex items-center gap-1.5 text-small font-medium">
                <Icon aria-hidden className="size-4" />
                {c.label}
              </span>
              <b className="font-mono text-2xl text-foreground">{c.n}</b>
            </li>
          );
        })}
      </ul>

      {a.fullView && (overdue?.length ?? 0) > 0 ? (
        <section
          aria-labelledby="indicador"
          className="grid gap-2 rounded-[10px] border border-border bg-surface p-4"
        >
          <h2 id="indicador" className="text-card-title">
            % de documentos vencidos por proceso
          </h2>
          <p className="text-small text-text-secondary">
            Documentos con la revisión vencida ÷ total de documentos del proceso × 100 (PRD 2.5.8).
          </p>
          <ul className="flex flex-wrap gap-2" data-testid="overdue-indicator">
            {(overdue ?? []).map((o) => {
              const bad = Number(o.overdue) > 0;
              return (
                <li
                  key={o.process_code}
                  data-process={o.process_code}
                  className={`grid min-w-[130px] gap-0.5 rounded-lg border px-3 py-2 ${bad ? "border-q-bad-bd bg-q-bad-bg" : "border-border bg-surface"}`}
                >
                  <span className="font-mono text-xs font-semibold">{o.process_code}</span>
                  <b className="text-lg">
                    {formatNumber(Number(o.overdue_pct ?? 0), Number(o.overdue_pct) % 1 ? 1 : 0)} %
                  </b>
                  <span
                    className={`flex items-center gap-1 text-xs ${bad ? "text-q-bad-fg" : "text-q-ok-fg"}`}
                  >
                    {bad ? (
                      <CircleX aria-hidden className="size-3.5" />
                    ) : (
                      <CircleCheck aria-hidden className="size-3.5" />
                    )}
                    {o.overdue} de {o.total} · {bad ? "Con vencidos" : "Al día"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          title="No hay documentos para mostrar"
          text={
            a.fullView
              ? "Aún no se ha codificado ningún documento."
              : "No tiene documentos vigentes asignados a su área."
          }
        />
      ) : (
        <MasterList rows={list} showTraining={!a.fullView} />
      )}
      {a.fullView ? (
        <p className="text-small text-text-secondary">Estructura del código: {CODE_EXAMPLE}</p>
      ) : null}
    </main>
  );
}
