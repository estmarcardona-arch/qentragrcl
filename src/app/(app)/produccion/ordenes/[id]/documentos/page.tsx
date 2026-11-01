import type { Metadata } from "next";
import {
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  FileText,
  Factory,
  Lock,
  Package,
  PenLine,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { NoPermissionState } from "@/components/common/state-card";
import { SodNotice } from "@/components/gxp/sod-notice";
import { StatusBadge } from "@/components/gxp/status-badge";
import { ApproveOrderButton } from "@/components/production/order-actions";
import { Card, CodeChip } from "@/components/production/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getProductionAccess } from "@/lib/production/access";
import {
  ORDER_STATUS,
  STAGE_STATUS,
  type FrozenDocument,
  type Presentation,
} from "@/lib/production/labels";

export const metadata: Metadata = { title: "Orden de producción · GRUFARCOL eBR" };

type Line = {
  id: string;
  order_no: number;
  required_qty: number;
  unit: string;
  pct: number | null;
  label_text: string;
  presentation_id: string | null;
  materials: { code: string; name: string } | null;
};

const TABS = [
  ["", "Documentos generados"],
  ["dispensacion", "Solicitud de dispensación"],
  ["acondicionamiento", "Material de acondicionamiento"],
  ["codificado", "Orden de codificado"],
] as const;

// S-38 · Solicitudes y documentos de la orden (RF-38, AC-14; diseño «Orden y limpieza S-38 y S-39»): al aprobar la OP
// se generan solos los 8 documentos; quien creó la orden no la aprueba (D-12).
export default async function OrderDocumentsPage({
  params,
  searchParams,
}: PageProps<"/produccion/ordenes/[id]/documentos">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.find(([t]) => t === sp.tab)?.[0] ?? "";
  const a = await getProductionAccess();
  if (!a.read) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Producción" />
      </main>
    );
  }
  const { data: o } = await a.supabase
    .from("production_orders")
    .select("*, products(code, name), batches!batches_order_id_fkey(id, batch_code, expiry_date)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const bb = o.batches as unknown as
    { id: string; batch_code: string }[] | { id: string; batch_code: string };
  const b = Array.isArray(bb) ? bb[0] : bb;
  const [
    { data: requests },
    { data: coding },
    { data: returns },
    { data: signatures },
    { data: creator },
    { data: stages },
  ] = await Promise.all([
    a.supabase
      .from("material_requests")
      .select("*, material_request_lines(*, materials(code, name))")
      .eq("order_id", id)
      .order("type"),
    a.supabase.from("coding_orders").select("*").eq("batch_id", b.id).maybeSingle(),
    a.supabase.from("material_returns").select("*"),
    a.supabase
      .from("signatures")
      .select("signer_name, meaning, signed_at")
      .eq("record_table", "production_orders")
      .eq("record_id", id),
    a.supabase.from("profiles").select("full_name").eq("id", String(o.created_by)).maybeSingle(),
    a.supabase.from("stage_orders").select("stage, status, code").eq("batch_id", b.id),
  ]);
  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.borrador;
  const pres = (o.presentations as unknown as Presentation[]) ?? [];
  const product = o.products as unknown as { code: string; name: string };
  const docs = (o.frozen_documents as unknown as FrozenDocument[]) ?? [];
  const approval = (signatures ?? []).find((s) => s.meaning === "aprobo");
  const draft = o.status === "borrador";
  const n = o.code.slice(3);
  const reqOf = (t: string) => (requests ?? []).find((r) => r.type === t);
  const stageOf = (s: string) => (stages ?? []).find((x) => x.stage === s);
  const pdf = (doc: string) => `/produccion/ordenes/${id}/documentos/${doc}/pdf`;
  const labels = (requests ?? []).reduce(
    (s, r) => s + ((r.material_request_lines as Line[] | null)?.length ?? 0),
    0,
  );
  const stageChip = (s: string) => {
    const so = stageOf(s);
    if (!so || so.status === "pendiente") return { status: "firmada" as const, label: "Generado" };
    return STAGE_STATUS[so.status];
  };
  const generated = [
    {
      key: `SD-${n}`,
      name: "Solicitud de dispensación",
      code: `SD-${n}`,
      icon: FileText,
      chip: stageChip("dispensacion"),
    },
    { key: `SE-${n}`, name: "Solicitud de material de envase", code: `SE-${n}`, icon: Package },
    {
      key: `SA-${n}`,
      name: "Solicitud de material de acondicionamiento (etiquetas y cajas)",
      code: `SA-${n}`,
      icon: Package,
    },
    {
      key: `CO-${n}`,
      name: "Orden de codificado",
      code: `CO-${n}`,
      icon: PenLine,
      chip:
        coding?.status === "verificada"
          ? { status: "completada" as const, label: "Verificada" }
          : undefined,
    },
    {
      key: "rotulos",
      name: "Rótulos de materias primas y materiales",
      code: draft ? "—" : `${labels} rótulos`,
      icon: Tag,
    },
    {
      key: `OF-${n}`,
      name: "Registro de fabricación",
      code: `OF-${n}`,
      icon: Factory,
      chip: stageChip("fabricacion"),
    },
    {
      key: `OE-${n}`,
      name: "Registro de envase",
      code: `OE-${n}`,
      icon: Factory,
      chip: stageChip("envase"),
    },
    {
      key: `OA-${n}`,
      name: "Registro de acondicionamiento (con codificación)",
      code: `OA-${n}`,
      icon: Factory,
      chip: stageChip("acondicionamiento"),
    },
  ];
  const sd = reqOf("dispensacion");
  const sa = reqOf("acondicionamiento");
  const th = "px-4 py-3 text-label uppercase";
  return (
    <main className="grid content-start gap-5 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <header>
        <p className="text-sm text-text-secondary">
          <Link href="/produccion/lotes">Producción</Link> › Órdenes › {o.code}
        </p>
        <h1 className="text-[32px] leading-10 font-semibold">Orden {o.code}</h1>
        <p className="text-sm text-text-secondary">
          {draft
            ? `Pendiente de aprobación · creada por ${creator?.full_name ?? "—"}`
            : `Lote ${b.batch_code} · ${product.name}`}
        </p>
      </header>

      <Card>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <CodeChip size="lg">{o.code}</CodeChip>
          <div className="grid">
            <b className="text-[17px] font-semibold">{product.name}</b>
            <span className="text-sm text-text-secondary">
              Lote{" "}
              <Link href={`/produccion/lotes/${b.id}`} className="font-mono">
                {b.batch_code}
              </Link>{" "}
              · {formatNumber(Number(o.batch_size), 1)} {o.batch_unit} ·{" "}
              {pres.map((p) => p.name).join(" y ")}
            </span>
          </div>
          <StatusBadge status={st.status} label={st.label} size="lg" />
          <span
            className="flex items-center gap-1.5 text-sm font-medium text-primary"
            data-testid="approved-line"
          >
            {approval ? (
              <>
                <CircleCheck aria-hidden className="size-4" /> Aprobada el{" "}
                {formatDateTime(approval.signed_at)}
              </>
            ) : (
              <>
                <Clock aria-hidden className="size-4" /> Borrador · sin documentos generados
              </>
            )}
          </span>
          <dl className="ml-auto grid grid-cols-[auto_1fr] gap-x-2 text-sm">
            <dt className="flex items-center gap-1 font-semibold">
              <Lock aria-hidden className="size-3.5" /> Creó:
            </dt>
            <dd>
              {creator?.full_name ?? "—"} · {formatDateTime(o.created_at)}
            </dd>
            <dt className="flex items-center gap-1 font-semibold">
              {approval ? (
                <Lock aria-hidden className="size-3.5" />
              ) : (
                <Clock aria-hidden className="size-3.5" />
              )}{" "}
              Aprobó:
            </dt>
            <dd>
              {approval
                ? `${approval.signer_name} · ${formatDateTime(approval.signed_at)}`
                : "pendiente"}
            </dd>
          </dl>
        </div>
      </Card>

      <nav
        aria-label="Secciones de la orden"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map(([t, l]) => (
          <Link
            key={l}
            href={`/produccion/ordenes/${id}/documentos${t ? `?tab=${t}` : ""}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-[15px] no-underline",
              t === tab
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-text-strong",
            )}
          >
            {l}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-[1fr_380px] items-start gap-5 max-[1279px]:grid-cols-1">
        <div className="grid gap-4">
          {tab === "" ? (
            <>
              <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-border bg-surface p-4">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-md",
                    draft ? "bg-surface-sunken text-text-strong" : "bg-neutral-strong text-white",
                  )}
                >
                  <PenLine aria-hidden className="size-5" />
                </span>
                <span className="grid text-sm">
                  <b className="font-semibold">
                    {approval
                      ? `Aprobada el ${formatDateTime(approval.signed_at)}`
                      : "Aprobar la orden"}
                  </b>
                  <span className="text-text-secondary">Firma «Aprobé» del Director técnico</span>
                </span>
                <ChevronRight aria-hidden className="size-6 text-primary" />
                <span className="flex size-10 items-center justify-center rounded-md border-2 border-primary font-semibold text-primary">
                  8
                </span>
                <span className="grid text-sm">
                  <b className="font-semibold">
                    {draft ? "Se generan 8 documentos" : "8 documentos generados automáticamente"}
                  </b>
                  <span className="text-text-secondary">
                    {draft
                      ? "Hoy están bloqueados y sin número asignado"
                      : "Disponibles para descargar en PDF"}
                  </span>
                </span>
              </div>
              <section className="overflow-hidden rounded-[10px] border border-border bg-surface">
                <table className="w-full text-left text-sm" data-testid="generated-docs">
                  <caption className="sr-only">Documentos generados por la orden</caption>
                  <thead className="bg-surface-sunken">
                    <tr>
                      <th scope="col" className={th}>
                        <span className="sr-only">Tipo</span>
                      </th>
                      <th scope="col" className={th}>
                        Documento
                      </th>
                      <th scope="col" className={th}>
                        Estado
                      </th>
                      <th scope="col" className={`${th} text-right`}>
                        PDF
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {generated.map((g) => (
                      <tr key={g.key} className="border-t border-divider">
                        <td className="w-14 px-4 py-3">
                          <span className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-sunken">
                            <g.icon aria-hidden className="size-4 text-text-strong" />
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <b className="font-semibold">{g.name}</b>
                          <span className="block font-mono text-xs text-text-secondary">
                            {g.code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {draft ? (
                            <StatusBadge status="pendiente" label="Se generará al aprobar" />
                          ) : (
                            <StatusBadge
                              status={g.chip?.status ?? "firmada"}
                              label={g.chip?.label ?? "Generado"}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {draft ? (
                            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-surface-sunken px-3 text-sm whitespace-nowrap text-text-muted">
                              <Download aria-hidden className="size-4" /> Descargar PDF
                            </span>
                          ) : (
                            <a
                              href={pdf(g.key)}
                              download
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-primary px-3 text-sm font-semibold whitespace-nowrap no-underline"
                            >
                              <Download aria-hidden className="size-4" /> Descargar PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="flex flex-wrap items-center gap-3 border-t border-divider px-4 py-3 text-sm">
                  <span className="rounded border-2 border-primary px-2 font-mono text-xs font-semibold text-primary">
                    COPIA CONTROLADA
                  </span>
                  Cada PDF descargado lleva este sello en el pie y quién lo generó.
                </p>
              </section>
              <Card title="Versiones congeladas en el lote">
                <ul className="flex flex-wrap gap-2">
                  {docs.map((d) => (
                    <li key={d.version_id}>
                      <CodeChip>
                        {d.code} · v{String(d.version_no).padStart(2, "0")}
                      </CodeChip>
                    </li>
                  ))}
                </ul>
                {((o.document_warnings as unknown as { message: string }[]) ?? []).map((w) => (
                  <p key={w.message} className="text-sm text-q-warn-fg">
                    {w.message}
                  </p>
                ))}
              </Card>
            </>
          ) : null}

          {tab === "dispensacion" ? (
            sd ? (
              <Card
                title={`Solicitud de dispensación · ${sd.code}`}
                subtitle={`Cantidad = porcentaje de la fórmula × ${formatNumber(Number(o.batch_size), 1)} ${o.batch_unit}; el total cuadra con el lote.`}
              >
                <table className="w-full text-left text-sm" data-testid="dispensing-request">
                  <thead className="bg-surface-sunken">
                    <tr>
                      {["Código", "Materia prima", "% fórmula", "Cantidad", "Rótulo"].map((h) => (
                        <th key={h} scope="col" className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {((sd.material_request_lines as Line[] | null) ?? [])
                      .sort((x, y) => x.order_no - y.order_no)
                      .map((l) => (
                        <tr
                          key={l.id}
                          className="border-t border-divider"
                          data-code={l.materials?.code}
                        >
                          <td className="px-4 py-3 font-mono text-xs">{l.materials?.code}</td>
                          <td className="px-4 py-3">{l.materials?.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {formatNumber(Number(l.pct), 2)} %
                          </td>
                          <td className="px-4 py-3 font-mono text-[15px] font-semibold">
                            {formatNumber(Number(l.required_qty), 2)} {l.unit}
                          </td>
                          <td className="px-4 py-3 text-xs">{l.label_text}</td>
                        </tr>
                      ))}
                    <tr className="border-t-2 border-border bg-surface-sunken font-semibold">
                      <td className="px-4 py-3" colSpan={2}>
                        Total
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatNumber(
                          ((sd.material_request_lines as Line[] | null) ?? []).reduce(
                            (s, l) => s + Number(l.pct),
                            0,
                          ),
                          2,
                        )}{" "}
                        %
                      </td>
                      <td className="px-4 py-3 font-mono text-[15px]">
                        {formatNumber(
                          ((sd.material_request_lines as Line[] | null) ?? []).reduce(
                            (s, l) => s + Number(l.required_qty),
                            0,
                          ),
                          2,
                        )}{" "}
                        {o.batch_unit}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card title="Solicitud de dispensación">
                <p className="text-sm text-text-secondary">Se genera al aprobar la orden.</p>
              </Card>
            )
          ) : null}

          {tab === "acondicionamiento" ? (
            sa ? (
              <Card title={`Material de acondicionamiento y devolución · ${sa.code}`}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-sunken">
                    <tr>
                      {[
                        "Material",
                        "Presentación",
                        "Solicitadas",
                        "Usadas",
                        "Dañadas",
                        "Devueltas",
                        "Cuadre",
                      ].map((h) => (
                        <th key={h} scope="col" className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {((sa.material_request_lines as Line[] | null) ?? []).map((l) => {
                      const r = (returns ?? []).find((x) => x.request_line_id === l.id);
                      return (
                        <tr key={l.id} className="border-t border-divider">
                          <td className="px-4 py-3">{l.materials?.name}</td>
                          <td className="px-4 py-3 text-xs">
                            {pres.find((p) => p.presentation_id === l.presentation_id)?.name}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {formatNumber(Number(l.required_qty), 0)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {r ? formatNumber(Number(r.used), 0) : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {r ? formatNumber(Number(r.damaged), 0) : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {r ? formatNumber(Number(r.returned), 0) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {r ? (
                              <StatusBadge
                                status="vigente"
                                label={`Cuadra: ${formatNumber(Number(r.used), 0)} + ${formatNumber(Number(r.damaged), 0)} + ${formatNumber(Number(r.returned), 0)} = ${formatNumber(Number(r.delivered), 0)}`}
                              />
                            ) : (
                              <span className="text-xs text-text-secondary">
                                Se registra al cerrar el acondicionamiento
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card title="Material de acondicionamiento">
                <p className="text-sm text-text-secondary">Se genera al aprobar la orden.</p>
              </Card>
            )
          ) : null}

          {tab === "codificado" ? (
            <Card title={coding ? `Orden de codificado · ${coding.code}` : "Orden de codificado"}>
              {coding ? (
                <>
                  <div
                    className="w-fit rounded-md border-2 border-dashed border-border-control bg-white px-6 py-4 font-mono text-xl"
                    data-testid="coding-preview"
                  >
                    <div>{coding.batch_code_text}</div>
                    <div>{coding.expiry_text}</div>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Se imprime igual en {pres.map((p) => p.name).join(" y ")}.{" "}
                    {coding.status === "verificada"
                      ? "Codificación verificada en el acondicionamiento."
                      : "Se verifica en la línea de acondicionamiento."}
                  </p>
                  <a
                    href={pdf(coding.code)}
                    download
                    className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-primary px-4 text-sm font-semibold no-underline"
                  >
                    <Download aria-hidden className="size-4" /> Descargar PDF
                  </a>
                </>
              ) : (
                <p className="text-sm text-text-secondary">Se genera al aprobar la orden.</p>
              )}
            </Card>
          ) : null}
        </div>

        <aside className="grid gap-4">
          {draft ? (
            <Card title="Aprobación de la orden">
              <p className="text-sm">
                Al firmar, el sistema genera los 8 documentos y los pone a disposición de cada área.
              </p>
              {a.approveOrder && o.created_by !== a.ctx.userId ? (
                <>
                  <ApproveOrderButton
                    orderId={id}
                    code={o.code}
                    batchCode={b.batch_code}
                    signer={a.signer}
                  />
                  <p className="text-sm text-text-secondary">
                    Se abre la firma con el significado «Aprobé».
                  </p>
                </>
              ) : a.approveOrder ? (
                <SodNotice
                  title="Quien creó la orden no puede aprobarla"
                  reason={`Usted creó ${o.code}. La aprobación la hace otra persona (segregación de funciones).`}
                />
              ) : (
                <p className="text-sm text-text-secondary">
                  La aprueba el Director técnico (D-12).
                </p>
              )}
            </Card>
          ) : null}
          <Card title="Quién puede qué">
            <ul className="grid gap-3 text-sm">
              <li>
                <b className="font-semibold">Coordinación de producción</b>
                <span className="block text-text-secondary">
                  Crea la orden y descarga los documentos.
                </span>
              </li>
              <li>
                <b className="font-semibold">Director técnico</b>
                <span className="block text-text-secondary">Aprueba la orden con su firma.</span>
              </li>
              <li>
                <b className="font-semibold">Bodega</b>
                <span className="block text-text-secondary">
                  Solo lectura: consulta las solicitudes, no firma ni edita.
                </span>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </main>
  );
}
