import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DisabledReason } from "@/components/common/disabled-reason";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoPermissionState,
} from "@/components/common/state-card";
import { ControlledDocumentHeader, CopyStamp } from "@/components/gxp/controlled-document-header";
import { SodNotice } from "@/components/gxp/sod-notice";
import { STATUSES, type StatusFamily, type StatusKey } from "@/components/gxp/status";
import { StatusBadge } from "@/components/gxp/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDesignPageEnabled } from "@/lib/design-page";
import { AuditTrailPanel } from "@/components/gxp/audit-trail-panel";
import { CorrectedValue } from "@/components/gxp/corrected-value";
import { LockedBanner } from "@/components/gxp/locked-banner";
import type { AuditEntry } from "@/lib/gxp/actions";
import { DemoGxp } from "./demo-gxp";
import { DemoTable } from "./demo-table";

// Ruta /_design: catálogo de componentes base para revisión visual (E0).
// Solo en desarrollo, o en pruebas si ENABLE_DESIGN_PAGE=true. Nunca en producción.

export const metadata: Metadata = {
  title: "Componentes base · GRUFARCOL eBR",
  robots: { index: false, follow: false },
};

const FAMILIES: { id: StatusFamily; title: string; rule: string }[] = [
  {
    id: "calidad",
    title: "Semáforo de calidad y vigencia",
    rule: "Solo para el estado de calidad de un material, lote o registro, y la vigencia de equipos y documentos.",
  },
  {
    id: "tramite",
    title: "Estado de trámite",
    rule: "Avance de tareas y registros. Neutro y azul; nunca verde, ámbar ni rojo.",
  },
  {
    id: "severidad",
    title: "Severidad de desviación",
    rule: "Solo desviaciones y CAPA. El violeta no existe fuera de esta familia.",
  },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-border pt-8">
      <h2 id={id} className="text-section">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Datos ficticios del Prompt 0B para los componentes GxP estáticos.
const STAMPS = [
  {
    meaning: "ejecuto" as const,
    signerName: "Diego Cárdenas",
    shortSignature: "D. Cárdenas",
    signedAt: "2026-10-05T19:32:00Z",
  },
  {
    meaning: "verifico" as const,
    signerName: "Paola Mejía",
    shortSignature: "P. Mejía",
    signedAt: "2026-10-05T20:10:00Z",
  },
];
const TRAIL: AuditEntry[] = [
  {
    id: 5,
    at: "2026-10-05T20:10:00Z",
    actorName: "Paola Mejía",
    actorShortSignature: "P. Mejía",
    action: "insert",
    tableName: "signatures",
    before: null,
    after: { meaning: "verifico" },
    reason: null,
  },
  {
    id: 4,
    at: "2026-10-05T19:32:00Z",
    actorName: "Diego Cárdenas",
    actorShortSignature: "D. Cárdenas",
    action: "insert",
    tableName: "signatures",
    before: null,
    after: { meaning: "ejecuto" },
    reason: null,
  },
  {
    id: 3,
    at: "2026-10-05T19:29:00Z",
    actorName: "Diego Cárdenas",
    actorShortSignature: "D. Cárdenas",
    action: "insert",
    tableName: "corrections",
    before: null,
    after: { field: "peso_neto", old_value: "98,2 kg", new_value: "98,8 kg" },
    reason: "Error de transcripción; la balanza imprimió 98,8 kg.",
  },
  {
    id: 1,
    at: "2026-10-05T19:12:00Z",
    actorName: "Diego Cárdenas",
    actorShortSignature: "D. Cárdenas",
    action: "insert",
    tableName: "dispensing_line_lots",
    before: null,
    after: {},
    reason: null,
  },
];

export default function DesignPage() {
  if (!isDesignPageEnabled()) notFound();

  const keys = Object.keys(STATUSES) as StatusKey[];

  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-10 px-6 py-10 max-[1279px]:px-4">
      <PageHeader
        title="Componentes base"
        description="Catálogo de la etapa E0 para revisión visual. Datos ficticios del Prompt 0B."
        breadcrumbs={[{ label: "Inicio", href: "/" }, { label: "Componentes base" }]}
        actions={
          <>
            <Button variant="outline">Ver bitácora</Button>
            <Button>Guardar registro</Button>
          </>
        }
        meta={<StatusBadge status="vigente" label="PRD-PR-001-FR-01 · v04 · Vigente" />}
      />

      <Section id="estado" title="StatusBadge · tres familias de color">
        <div className="grid gap-6">
          {FAMILIES.map((f) => (
            <div key={f.id} className="grid gap-2">
              <h3 className="text-card-title">{f.title}</h3>
              <p className="text-small text-text-secondary">{f.rule}</p>
              <div className="flex flex-wrap gap-2">
                {keys
                  .filter((k) => STATUSES[k].family === f.id)
                  .map((k) => (
                    <StatusBadge key={k} status={k} />
                  ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {keys
                  .filter((k) => STATUSES[k].family === f.id)
                  .slice(0, 3)
                  .map((k) => (
                    <StatusBadge key={k} status={k} size="lg" />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="botones" title="Botones y motivo de deshabilitado">
        <div className="flex flex-wrap items-start gap-3">
          <Button>Guardar registro</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="destructive">Rechazar lote</Button>
          <Button variant="ghost">Ver bitácora</Button>
          <div className="grid max-w-xs justify-items-start gap-1.5">
            <Button disabled aria-describedby="motivo-liberar">
              Liberar lote
            </Button>
            <DisabledReason id="motivo-liberar">
              No disponible: hay 1 ítem bloqueante y 2 pendientes en la lista de liberación.
            </DisabledReason>
          </div>
        </div>
      </Section>

      <Section id="tabla" title="DataTable (TanStack Table)">
        <DemoTable mode="datos" />
        <div className="grid grid-cols-3 gap-4 max-[1279px]:grid-cols-1">
          <DemoTable mode="cargando" />
          <DemoTable mode="vacio" />
          <DemoTable mode="error" />
        </div>
      </Section>

      <Section id="estados" title="Estados de pantalla">
        <div className="grid grid-cols-4 gap-4 max-[1279px]:grid-cols-2">
          <EmptyState
            title="Aún no hay lotes en esta etapa"
            text="Cuando se inicie una orden de producción aparecerá aquí."
            action={<Button>Crear orden de producción</Button>}
          />
          <LoadingSkeleton label="Cargando lotes…" />
          <ErrorState
            title="No se pudo guardar el registro"
            text="Sus datos siguen en pantalla; intente de nuevo."
            code="ERR-DB-0001"
            action={<Button variant="secondary">Reintentar</Button>}
          />
          <NoPermissionState
            title="No tiene acceso a Administración"
            text="Solicite el rol a Tomás Herrera, administrador del sistema."
          />
        </div>
      </Section>

      <Section id="formulario" title="FormField">
        <div className="grid grid-cols-3 gap-6 max-[1279px]:grid-cols-2">
          <FormField label="Código de material" hint="Escriba o escanee el código." required>
            <Input defaultValue="MP-2026-0198" className="font-mono" />
          </FormField>
          <FormField label="Temperatura de fase acuosa" unit="°C" range="Rango 70–75 °C">
            <Input inputMode="decimal" defaultValue="72,5" />
          </FormField>
          <FormField
            label="Temperatura de fase oleosa"
            unit="°C"
            range="Rango 70–75 °C"
            error="78,0 °C está fuera del rango 70–75 °C. Debe abrir una desviación para continuar."
          >
            <Input inputMode="decimal" defaultValue="78,0" />
          </FormField>
          <FormField
            label="Peso neto"
            unit="kg"
            locked
            hint="Firmado por D. Cárdenas · 05/10/2026 14:32"
          >
            <Input defaultValue="98,8" />
          </FormField>
          <FormField label="Fecha de vencimiento" required error="Falta fecha de vencimiento.">
            <Input placeholder="DD/MM/AAAA" />
          </FormField>
        </div>
      </Section>

      <Section id="sod" title="SodNotice · segregación de funciones">
        <div className="grid grid-cols-2 gap-4 max-[1279px]:grid-cols-1">
          <SodNotice
            title="No puede verificar este paso"
            reason="Usted ejecutó el pesaje el 05/10/2026 a las 14:32. Por segregación de funciones, la verificación debe hacerla otra persona."
            who="Pueden verificar: Coordinadora de producción, distinta de usted."
            action={<Button variant="secondary">Solicitar verificación</Button>}
          />
          <SodNotice
            title="No puede aprobar esta versión"
            reason="Usted elaboró esta versión y no puede revisarla ni aprobarla."
            who="Pueden aprobar: Directora de aseguramiento de calidad o Director técnico."
            action={<Button variant="secondary">Notificar a Aseguramiento de la calidad</Button>}
          />
        </div>
      </Section>

      <Section id="gxp" title="Componentes GxP: firma, bloqueo, corrección y bitácora">
        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6 max-[1279px]:grid-cols-1">
          <div className="grid gap-4">
            <LockedBanner
              signatures={STAMPS}
              action={<Button variant="secondary">Registrar corrección</Button>}
            />
            <div className="grid gap-1 rounded-[10px] border border-border bg-surface p-4">
              <span className="text-label text-text-secondary uppercase">Peso neto (kg)</span>
              <CorrectedValue
                value="98,2"
                corrections={[
                  {
                    oldValue: "98,2",
                    newValue: "98,8",
                    reason: "Error de transcripción; la balanza imprimió 98,8 kg",
                    shortSignature: "D. Cárdenas",
                    correctedAt: "2026-10-05T19:29:00Z",
                  },
                ]}
              />
            </div>
            <DemoGxp />
          </div>
          <AuditTrailPanel code="SD-2026-0042 · L-2610-018" entries={TRAIL} />
        </div>
      </Section>

      <Section id="documento" title="Encabezado de documento controlado">
        <ControlledDocumentHeader
          title="Formato registro de fabricación"
          code="PRD-PR-003-FR-01"
          version="03"
          issueDate="2023-05-15T12:00:00Z"
          reviewDate="2026-05-15T12:00:00Z"
          page={1}
          pageCount={3}
          status="Revisión vencida"
        />
        <div className="flex flex-wrap gap-3">
          <CopyStamp kind="controlada" />
          <CopyStamp kind="no_controlada" />
          <CopyStamp kind="obsoleto" />
        </div>
      </Section>
    </main>
  );
}
