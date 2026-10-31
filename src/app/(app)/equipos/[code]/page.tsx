import type { Metadata } from "next";
import { CircleCheck, CircleX, Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { DisabledReason } from "@/components/common/disabled-reason";
import { PageHeader } from "@/components/common/page-header";
import { NoPermissionState } from "@/components/common/state-card";
import { EquipmentForm } from "@/components/equipment/equipment-form";
import {
  EventActions,
  EvidenceLink,
  StatusForm,
  VerifyCleaningButton,
} from "@/components/equipment/event-actions";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { getEquipmentAccess, loadAlertSettings } from "@/lib/equipment/access";
import {
  AREA_LABELS,
  EQUIPMENT_STATUS,
  EVENT_LABELS,
  FITNESS,
  daysUntil,
  dueStatus,
} from "@/lib/equipment/labels";
import { loadEquipmentOptions } from "@/lib/equipment/options";

export const metadata: Metadata = { title: "Hoja de vida del equipo · GRUFARCOL eBR" };

type Person = { full_name: string } | null;

// S-25b · Hoja de vida del equipo (RF-50): por qué está o no apto, los cuatro vencimientos, la línea de tiempo de
// eventos firmados con sus certificados y los lotes en que se usó. Producción consulta la misma validez (AC-05).
export default async function EquipmentPage({
  params,
  searchParams,
}: PageProps<"/equipos/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const a = await getEquipmentAccess();
  if (!a.read) {
    return (
      <main className="mx-auto grid w-full max-w-xl px-6 py-16">
        <NoPermissionState title="No tiene acceso a Equipos" />
      </main>
    );
  }
  const { data: eq } = await a.supabase
    .from("equipment")
    .select("*, controlled_documents(code, title)")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!eq) notFound();
  const [{ data: st }, { data: events }, { data: files }, settings, options] = await Promise.all([
    a.supabase.from("v_equipment_status").select("*").eq("id", eq.id).single(),
    a.supabase
      .from("equipment_events")
      .select(
        "*, recorder:profiles!equipment_events_recorded_by_fkey(full_name), verifier:profiles!equipment_events_verified_by_fkey(full_name)",
      )
      .eq("equipment_id", eq.id)
      .order("performed_on", { ascending: false })
      .order("created_at", { ascending: false }),
    a.supabase
      .from("equipment_attachments")
      .select("event_id, path, file_name, sha256")
      .eq("equipment_id", eq.id),
    loadAlertSettings(a),
    a.create ? loadEquipmentOptions(a) : Promise.resolve({ types: [], documents: [] }),
  ]);
  const fit = FITNESS[String(st?.fitness)] ?? FITNESS.no_apto;
  const status = EQUIPMENT_STATUS[String(st?.effective_status)] ?? EQUIPMENT_STATUS.disponible;
  const reasons = (st?.reasons as string[] | null) ?? [];
  const doc = eq.controlled_documents as { code: string; title: string } | null;
  const cleaningMs = st?.cleaning_until
    ? Date.parse(st.cleaning_until) - Date.parse(settings.now)
    : null;
  const cards = [
    {
      key: "calibracion",
      title: "Calibración",
      applies: eq.requires_calibration,
      date: st?.calibration_due ?? null,
      text: st?.calibration_due ? `Vigente hasta ${formatDate(st.calibration_due)}` : null,
    },
    {
      key: "mantenimiento",
      title: "Mantenimiento",
      applies: true,
      date: st?.maintenance_due ?? null,
      text: st?.maintenance_due ? `Próximo ${formatDate(st.maintenance_due)}` : null,
    },
    {
      key: "calificacion",
      title: "Calificación",
      applies: eq.requires_qualification,
      date: st?.qualification_due ?? null,
      text: st?.qualification_due ? `Vigente hasta ${formatDate(st.qualification_due)}` : null,
    },
  ].map((c) => ({
    ...c,
    days: daysUntil(c.date, settings.today),
    st: dueStatus(daysUntil(c.date, settings.today), settings.maxAlert),
  }));
  const cleanSt = !eq.requires_cleaning
    ? null
    : cleaningMs === null
      ? { status: "sin_dato" as const, label: "Sin verificar" }
      : cleaningMs < 0
        ? { status: "vencido" as const, label: "Vencida" }
        : cleaningMs <= settings.cleaningHours * 3_600_000
          ? { status: "por_vencer" as const, label: "Por vencer" }
          : { status: "vigente" as const, label: "Vigente" };
  const upcoming = [
    ...cards
      .filter((c) => c.applies && c.date)
      .map((c) => ({ label: c.title, date: String(c.date), days: c.days ?? 0 })),
    ...(st?.cleaning_until
      ? [
          {
            label: "Limpieza",
            date: st.cleaning_until,
            days: Math.floor((cleaningMs ?? 0) / 86_400_000),
          },
        ]
      : []),
  ].sort((x, y) => x.days - y.days);
  const uses = (events ?? []).filter((e) => e.type === "uso");
  const filesOf = (id: string) => (files ?? []).filter((f) => f.event_id === id);
  const verdictIcon =
    fit.status === "vigente" ? CircleCheck : fit.status === "por_vencer" ? TriangleAlert : CircleX;
  const VerdictIcon = verdictIcon;
  return (
    <main className="grid content-start gap-4 px-8 pt-6 pb-10 max-[1279px]:px-4">
      <PageHeader
        title={`${eq.code} · ${eq.name}`}
        description={`${AREA_LABELS[eq.plant_area] ?? eq.plant_area}${eq.critical ? " · equipo crítico" : ""}${eq.capacity ? ` · ${eq.capacity}` : ""} · versión ${eq.version}${doc ? ` · rige ${doc.code}` : ""}`}
        breadcrumbs={[
          { label: "Inicio", href: "/inicio" },
          { label: "Equipos", href: "/equipos" },
          { label: eq.code },
        ]}
        meta={
          <>
            <StatusBadge status={fit.status} label={fit.label} size="lg" />
            <StatusBadge status={status.status} label={status.label} />
          </>
        }
        actions={
          <>
            <Button type="button" variant="secondary" disabled aria-describedby="dev-why">
              Abrir desviación
            </Button>
            <DisabledReason id="dev-why">
              Las desviaciones se habilitan con el módulo de Desviaciones y CAPA (F8).
            </DisabledReason>
          </>
        }
      />
      {sp.nuevo ? (
        <p
          role="status"
          className="rounded-lg border border-tram-en-curso-bd bg-tram-en-curso-bg px-3.5 py-2.5 text-sm text-tram-en-curso-fg"
        >
          Equipo {eq.code} registrado. Cargue su instalación, calibración con certificado y limpieza
          para que quede apto.
        </p>
      ) : null}

      <section
        aria-labelledby="why"
        data-testid="verdict"
        className={cn(
          "grid gap-2 rounded-[10px] border p-4",
          fit.status === "vigente" && "border-q-ok-bd bg-q-ok-bg",
          fit.status === "por_vencer" && "border-q-warn-bd bg-q-warn-bg",
          fit.status === "vencido" && "border-q-bad-bd bg-q-bad-bg",
        )}
      >
        <h2 id="why" className="flex items-center gap-2 text-card-title">
          <VerdictIcon aria-hidden className="size-5" />
          {fit.label}
        </h2>
        {reasons.length ? (
          <>
            <p className="text-sm">
              Producción no puede usar este equipo (EQUIPMENT_NOT_VALID) porque:
            </p>
            <ul className="list-disc pl-5 text-sm" data-testid="reasons">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm">
            {fit.status === "por_vencer"
              ? `Puede usarse, pero un vencimiento está a ${settings.maxAlert} días o menos (o la limpieza vence en menos de ${settings.cleaningHours} h).`
              : "Calibración, mantenimiento, calificación y limpieza vigentes."}
          </p>
        )}
      </section>

      <section
        aria-label="Vencimientos"
        className="grid grid-cols-4 gap-3 max-[1023px]:grid-cols-2"
      >
        {cards.map((c) => (
          <article
            key={c.key}
            data-testid={`card-${c.key}`}
            className="grid content-start gap-1.5 rounded-[10px] border border-border bg-surface p-4"
          >
            <h3 className="text-label uppercase">{c.title}</h3>
            {c.applies ? (
              <>
                <StatusBadge status={c.st.status} label={c.st.label} />
                <span className="text-sm">{c.text ?? "Sin registro"}</span>
                {c.days !== null ? (
                  <span className="text-xs text-text-secondary">
                    {c.days < 0 ? `Venció hace ${-c.days} días` : `Faltan ${c.days} días`}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-text-muted">No aplica</span>
            )}
          </article>
        ))}
        <article
          data-testid="card-limpieza"
          className="grid content-start gap-1.5 rounded-[10px] border border-border bg-surface p-4"
        >
          <h3 className="text-label uppercase">Limpieza</h3>
          {cleanSt ? (
            <>
              <StatusBadge status={cleanSt.status} label={cleanSt.label} />
              <span className="text-sm">
                {st?.cleaning_until
                  ? `Vigente hasta ${formatDateTime(st.cleaning_until)}`
                  : "Sin limpieza verificada"}
              </span>
            </>
          ) : (
            <span className="text-sm text-text-muted">No aplica</span>
          )}
        </article>
      </section>

      {a.sign ? (
        <section className="grid gap-2 rounded-[10px] border border-border bg-surface p-4">
          <h2 className="text-card-title">Registrar en la hoja de vida</h2>
          <EventActions
            equipment={{ id: eq.id, code: eq.code, name: eq.name, status: eq.status }}
            today={settings.today}
            signer={a.signer}
            canSign={a.sign}
            canApprove={a.approve}
          />
        </section>
      ) : null}

      <div className="grid grid-cols-[1fr_320px] gap-4 max-[1279px]:grid-cols-1">
        <section
          aria-labelledby="timeline"
          className="grid content-start gap-3 rounded-[10px] border border-border bg-surface p-5"
        >
          <h2 id="timeline" className="text-card-title">
            Hoja de vida
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Lock aria-hidden className="size-3.5" />
            Los eventos firmados no se modifican: si algo cambió, registre un evento nuevo.
          </p>
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-text-secondary">Aún no hay eventos registrados.</p>
          ) : (
            <ol className="grid gap-3" data-testid="events">
              {(events ?? []).map((e) => {
                const rec = (e.recorder as Person)?.full_name;
                const ver = (e.verifier as Person)?.full_name;
                return (
                  <li
                    key={e.id}
                    data-type={e.type}
                    className="grid gap-1 border-l-2 border-border pl-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{formatDate(e.performed_on)}</span>
                      <span className="text-sm font-semibold">{EVENT_LABELS[e.type]}</span>
                      {e.result ? (
                        <StatusBadge
                          status={e.result === "conforme" ? "aprobado" : "rechazado"}
                          label={e.result === "conforme" ? "Conforme" : "No conforme"}
                        />
                      ) : null}
                      {e.type === "limpieza" ? (
                        <StatusBadge
                          status={e.status === "verificado" ? "firmada" : "pendiente"}
                          label={e.status === "verificado" ? "Verificada" : "Por verificar"}
                        />
                      ) : null}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {e.due_on ? `Vence ${formatDate(e.due_on)}. ` : ""}
                      {e.valid_until ? `Vigente hasta ${formatDateTime(e.valid_until)}. ` : ""}
                      {e.status_from && e.status_to
                        ? `${EQUIPMENT_STATUS[e.status_from]?.label} → ${EQUIPMENT_STATUS[e.status_to]?.label}. `
                        : ""}
                      {e.batch_ref ? `Lote ${e.batch_ref}. ` : ""}
                      {e.provider ? `${e.provider}. ` : ""}
                      {e.reference ? `Ref. ${e.reference}. ` : ""}
                      {e.notes ?? ""}
                    </p>
                    <p className="text-xs text-text-secondary">
                      Registró {rec ?? "—"}
                      {ver ? ` · verificó ${ver} el ${formatDateTime(String(e.verified_at))}` : ""}
                    </p>
                    {filesOf(e.id).map((f) => (
                      <EvidenceLink
                        key={f.path}
                        path={f.path}
                        fileName={f.file_name}
                        sha256={f.sha256}
                      />
                    ))}
                    {e.type === "limpieza" &&
                    e.status !== "verificado" &&
                    a.sign &&
                    e.recorded_by !== a.ctx.userId ? (
                      <div>
                        <VerifyCleaningButton
                          eventId={e.id}
                          code={eq.code}
                          signer={a.signer}
                          summary={[
                            { label: "Equipo", value: eq.code, mono: true },
                            { label: "Limpió", value: rec ?? "—" },
                            {
                              label: "Vigente hasta",
                              value: e.valid_until ? formatDateTime(e.valid_until) : "—",
                            },
                          ]}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <aside className="grid content-start gap-4">
          <section className="grid gap-2 rounded-[10px] border border-border bg-surface p-4">
            <h2 className="text-card-title">Próximos vencimientos</h2>
            {upcoming.length ? (
              <ul className="grid gap-1.5 text-sm" data-testid="upcoming">
                {upcoming.map((u) => (
                  <li key={u.label} className="flex justify-between gap-2">
                    <span>{u.label}</span>
                    <span className="font-mono text-xs">
                      {u.label === "Limpieza" ? formatDateTime(u.date) : formatDate(u.date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">Sin vencimientos registrados.</p>
            )}
            <p className="text-xs text-text-secondary">
              Avisos a {settings.alertDays.join(", ")} días por la campana y por correo.
            </p>
          </section>
          <section className="grid gap-2 rounded-[10px] border border-border bg-surface p-4">
            <h2 className="text-card-title">Lotes en que se usó</h2>
            {uses.length ? (
              <ul className="grid gap-1 text-sm">
                {uses.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2">
                    <span className="font-mono">{u.batch_ref}</span>
                    <span className="font-mono text-xs">{formatDate(u.performed_on)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">
                Sin usos registrados. Desde Producción (F6) el uso se registra con la orden.
              </p>
            )}
          </section>
          {doc ? (
            <section className="grid gap-1 rounded-[10px] border border-border bg-surface p-4 text-sm">
              <h2 className="text-card-title">Documento que lo rige</h2>
              <Link href={`/documentos?q=${doc.code}`} className="font-mono">
                {doc.code}
              </Link>
              <span>{doc.title}</span>
            </section>
          ) : null}
        </aside>
      </div>

      {a.create ? (
        <details className="rounded-[10px] border border-border bg-surface p-4">
          <summary className="cursor-pointer text-card-title">Estado y ficha del equipo</summary>
          <div className="mt-4 grid gap-4">
            <StatusForm
              equipment={{ id: eq.id, code: eq.code, name: eq.name, status: eq.status }}
            />
            <EquipmentForm
              id={eq.id}
              initial={{
                code: eq.code,
                name: eq.name,
                equipment_type: eq.equipment_type,
                plant_area: eq.plant_area,
                critical: eq.critical,
                governing_document_id: eq.governing_document_id ?? "",
                manufacturer: eq.manufacturer ?? "",
                model: eq.model ?? "",
                serial_number: eq.serial_number ?? "",
                capacity: eq.capacity ?? "",
                installed_on: eq.installed_on ?? "",
                requires_calibration: eq.requires_calibration,
                requires_qualification: eq.requires_qualification,
                requires_cleaning: eq.requires_cleaning,
                active: eq.active,
              }}
              types={options.types}
              documents={options.documents}
              editable
            />
          </div>
        </details>
      ) : null}
    </main>
  );
}
