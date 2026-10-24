import { Lock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, NoPermissionState } from "@/components/common/state-card";
import { StatusBadge } from "@/components/gxp/status-badge";
import { NewMasterButton } from "@/components/rd/new-master-button";
import { formatDate } from "@/lib/format";
import { VERSION_BADGE, type VersionStatus } from "@/lib/documents/labels";
import { getRdAccess } from "@/lib/rd/access";
import { loadMasterVersions, sgdHref, type MasterType, type MasterVersion } from "@/lib/rd/masters";

/** Listado de un tipo de documento maestro (S-07, S-08, S-09) con su contenido estructurado. */
export async function MasterList({
  type,
  title,
  description,
  basePath,
  newLabel,
  contentTable,
  detail,
}: {
  type: MasterType;
  title: string;
  description: string;
  basePath: string;
  newLabel: string;
  contentTable: "formulas" | "specifications" | "instructions";
  detail: (row: Record<string, unknown>) => string;
}) {
  const a = await getRdAccess();
  if (!a.masterRead) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState
          title="No tiene acceso a los documentos maestros"
          text="Su rol no tiene permiso en «Fórmula / Especificación / Instructivo» (PRD 2.2)."
        />
      </main>
    );
  }
  const versions = await loadMasterVersions(a, type);
  const { data: content } = versions.length
    ? await a.supabase
        .from(contentTable)
        .select("*, products(code, name)")
        .in(
          "document_version_id",
          versions.map((v) => v.versionId),
        )
    : { data: [] };
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: "Inicio", href: "/inicio" }, { label: "I+D" }, { label: title }]}
        actions={
          a.masterCreate ? (
            <NewMasterButton typeCode={type} label={newLabel} basePath={basePath} />
          ) : null
        }
      />
      {versions.length === 0 ? (
        <EmptyState
          title={`No hay ${title.toLowerCase()}`}
          text={a.masterCreate ? `Cree el primero con «${newLabel}».` : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full text-left text-sm" data-testid="masters">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {[
                  "Código",
                  "Versión",
                  "Título",
                  "Producto",
                  "Contenido",
                  "Actualizado",
                  "Estado",
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-3 py-2.5 text-label uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const c = (content ?? []).find(
                  (x) => (x as { document_version_id: string }).document_version_id === v.versionId,
                ) as Record<string, unknown> | undefined;
                const p = c?.products as { code: string; name: string } | undefined;
                const st = VERSION_BADGE[v.status as VersionStatus];
                return (
                  <tr
                    key={v.versionId}
                    data-code={v.code}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="px-3 py-2.5 font-mono text-[13px] font-semibold">
                      <Link href={`${basePath}/${v.versionId}`}>{v.code}</Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      v{String(v.versionNo).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2.5">{v.title}</td>
                    <td className="px-3 py-2.5">
                      {p ? (
                        <>
                          <span className="font-mono text-xs">{p.code}</span> {p.name}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {c ? detail(c) : <span className="text-text-secondary">Sin contenido</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatDate(v.updatedAt)}</td>
                    <td className="px-3 py-2.5">
                      {st ? <StatusBadge status={st.status} label={st.label} /> : v.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

/** Encabezado del editor de un documento maestro: versión, estado y enlace al trámite del SGD. */
export function MasterHeader({
  v,
  section,
  basePath,
  notice,
}: {
  v: MasterVersion & { editable: boolean };
  section: string;
  basePath: string;
  notice?: string | null;
}) {
  const st = VERSION_BADGE[v.status as VersionStatus];
  return (
    <>
      <PageHeader
        title={`${v.code} · ${v.title}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: section, href: basePath },
          { label: v.code },
        ]}
        meta={
          <>
            <span className="font-mono text-xs">v{String(v.versionNo).padStart(2, "0")}</span>
            {st ? <StatusBadge status={st.status} label={st.label} /> : null}
            <Link href={sgdHref(v)} className="text-small">
              Abrir el trámite en el SGD
            </Link>
          </>
        }
      />
      {!v.editable ? (
        <p
          role="note"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-strong bg-surface-sunken px-3.5 py-2.5 text-sm"
        >
          <Lock aria-hidden className="size-3.5" />
          {v.lockedAt || !["solicitado", "preliminar"].includes(v.status)
            ? "El contenido está bloqueado: la versión ya salió de borrador. Para cambiarlo cree una versión nueva en el SGD."
            : "Solo el autor de la versión edita su contenido (Master prepara los borradores)."}
        </p>
      ) : null}
      {notice ? (
        <p
          role="note"
          className="rounded-lg border border-tram-revision-bd bg-tram-revision-bg px-3.5 py-2.5 text-sm text-tram-revision-fg"
        >
          {notice}
        </p>
      ) : null}
    </>
  );
}
