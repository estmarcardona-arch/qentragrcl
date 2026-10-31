"use client";

import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReauthDialog } from "@/components/documents/reauth-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/db/client";
import {
  recordEquipmentEvent,
  setEquipmentStatus,
  verifyCleaning,
  type EqResult,
  type EventInput,
} from "@/lib/equipment/actions";
import {
  EVENT_LABELS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TYPES,
  SETTABLE_STATUS,
} from "@/lib/equipment/labels";
import { ErrorLine, Field, selectCls } from "./equipment-form";

type Equipment = { id: string; code: string; name: string; status: string };

const WITH_RESULT = ["calibracion", "verificacion", "mantenimiento", "calificacion"];
const WITH_DUE = ["calibracion", "mantenimiento", "calificacion"];
/** Exigen el certificado o informe del proveedor, como archivo o enlace (AC-44, D-64). */
const NEEDS_EVIDENCE = ["calibracion", "calificacion"];

function invalid(detail: string): Exclude<EqResult, { ok: true }> {
  return {
    ok: false,
    code: "INVALID_FIELD",
    rule: "Falta un dato obligatorio o tiene un formato no válido.",
    action: "Revise el campo indicado.",
    detail,
  };
}

/**
 * Registro de eventos de la hoja de vida con firma («Ejecuté»; la calificación, «Aprobé»). El certificado se sube
 * primero al almacenamiento de evidencias con la sesión del usuario; la huella la calcula el servidor (AC-44).
 */
export function EventActions({
  equipment,
  today,
  signer,
  canSign,
  canApprove,
}: {
  equipment: Equipment;
  today: string;
  signer: string;
  canSign: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<string | null>(null);
  const blank = {
    performed_on: today,
    result: "conforme",
    due_on: "",
    valid_until: "",
    provider: "",
    reference: "",
    notes: "",
    batch_ref: "",
  };
  const [d, setD] = useState(blank);
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState({ url: "", label: "" });
  const set = (k: keyof typeof blank, v: string) => setD((p) => ({ ...p, [k]: v }));
  const open = (t: string) => {
    setD(blank);
    setFiles([]);
    setLink({ url: "", label: "" });
    setType(t);
  };
  if (!canSign) return null;

  async function confirm(pw: string): Promise<EqResult> {
    if (!type) return invalid("tipo de evento");
    if (NEEDS_EVIDENCE.includes(type) && files.length === 0 && !link.url.trim()) {
      return invalid("adjunte el certificado o el enlace del proveedor");
    }
    if (link.url.trim() && !/^https?:\/\/\S+$/.test(link.url.trim())) {
      return invalid("el enlace debe empezar por http:// o https://");
    }
    for (const f of files) {
      if (!EVIDENCE_TYPES.includes(f.type) || f.size > EVIDENCE_MAX_BYTES) {
        return invalid(`${f.name}: solo PDF, PNG o JPG de hasta 10 MB`);
      }
    }
    const supabase = createClient();
    const uploaded: EventInput["files"] = [];
    for (const f of files) {
      const safe = f.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const path = `equipos/${equipment.code}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage
        .from("evidencias")
        .upload(path, f, { contentType: f.type, upsert: false });
      if (error) return invalid(`no se pudo subir ${f.name}: ${error.message}`);
      uploaded.push({ path, file_name: f.name });
    }
    return recordEquipmentEvent(
      {
        equipmentId: equipment.id,
        code: equipment.code,
        type,
        ...d,
        // La vigencia de la limpieza se digita en hora de Bogotá.
        valid_until: d.valid_until ? `${d.valid_until}:00-05:00` : "",
        files: uploaded,
        links: link.url.trim() ? [link] : [],
      },
      pw,
    );
  }

  const others = [
    "instalacion",
    "verificacion",
    "mantenimiento",
    ...(canApprove ? ["calificacion"] : []),
    "uso",
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" onClick={() => open("calibracion")}>
        Registrar calibración
      </Button>
      <Button type="button" variant="secondary" onClick={() => open("limpieza")}>
        Registrar limpieza
      </Button>
      <select
        aria-label="Registrar otro evento"
        value=""
        onChange={(e) => e.target.value && open(e.target.value)}
        className={`${selectCls} w-auto`}
      >
        <option value="">Otro evento…</option>
        {others.map((t) => (
          <option key={t} value={t}>
            {EVENT_LABELS[t]}
          </option>
        ))}
      </select>
      {type ? (
        <ReauthDialog
          open
          onOpenChange={(o) => !o && setType(null)}
          title={`Registrar ${EVENT_LABELS[type].toLowerCase()} · ${equipment.code}`}
          meaning={type === "calificacion" ? "Aprobé" : "Ejecuté"}
          summary={[
            { label: "Equipo", value: `${equipment.code} · ${equipment.name}`, mono: true },
            { label: "Evento", value: EVENT_LABELS[type] },
          ]}
          signer={signer}
          confirmLabel="Firmar y registrar"
          onConfirm={(pw) => confirm(pw)}
          onDone={() => {
            setType(null);
            router.refresh();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field id="ev-on" label="Fecha de realización *">
              <Input
                id="ev-on"
                type="date"
                value={d.performed_on}
                max={today}
                onChange={(e) => set("performed_on", e.target.value)}
              />
            </Field>
            {WITH_RESULT.includes(type) ? (
              <Field id="ev-result" label="Resultado *">
                <select
                  id="ev-result"
                  value={d.result}
                  onChange={(e) => set("result", e.target.value)}
                  className={selectCls}
                >
                  <option value="conforme">Conforme</option>
                  <option value="no_conforme">No conforme</option>
                </select>
              </Field>
            ) : null}
            {WITH_DUE.includes(type) ? (
              <Field
                id="ev-due"
                label={`Próximo vencimiento${d.result === "conforme" ? " *" : ""}`}
              >
                <Input
                  id="ev-due"
                  type="date"
                  value={d.due_on}
                  onChange={(e) => set("due_on", e.target.value)}
                />
              </Field>
            ) : null}
            {type === "limpieza" ? (
              <Field id="ev-until" label="Vigente hasta *" hint="Hora de Bogotá">
                <Input
                  id="ev-until"
                  type="datetime-local"
                  value={d.valid_until}
                  onChange={(e) => set("valid_until", e.target.value)}
                />
              </Field>
            ) : null}
            {type === "uso" ? (
              <Field id="ev-batch" label="Lote u orden *">
                <Input
                  id="ev-batch"
                  value={d.batch_ref}
                  onChange={(e) => set("batch_ref", e.target.value)}
                  className="font-mono"
                />
              </Field>
            ) : null}
            {WITH_DUE.includes(type) || type === "verificacion" ? (
              <>
                <Field id="ev-provider" label="Proveedor o ejecutor">
                  <Input
                    id="ev-provider"
                    value={d.provider}
                    onChange={(e) => set("provider", e.target.value)}
                  />
                </Field>
                <Field id="ev-ref" label="N.º de certificado o informe">
                  <Input
                    id="ev-ref"
                    value={d.reference}
                    onChange={(e) => set("reference", e.target.value)}
                    className="font-mono"
                  />
                </Field>
              </>
            ) : null}
          </div>
          {type !== "uso" ? (
            <fieldset className="grid gap-3 rounded-md border border-border p-3">
              <legend className="px-1 text-label uppercase">
                {NEEDS_EVIDENCE.includes(type)
                  ? "Certificado o informe del proveedor *"
                  : "Evidencia (opcional)"}
              </legend>
              <p className="text-xs text-text-secondary">
                {NEEDS_EVIDENCE.includes(type)
                  ? "Adjunte el archivo, el enlace del proveedor para verificarlo, o ambos."
                  : "Puede adjuntar un archivo, un enlace o ambos."}
              </p>
              <Field
                id="ev-file"
                label="Archivo"
                hint="PDF, PNG o JPG de hasta 10 MB. Se guarda con su huella SHA-256 y no se puede reemplazar."
              >
                <Input
                  id="ev-file"
                  type="file"
                  accept={EVIDENCE_TYPES.join(",")}
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="ev-link" label="Enlace del proveedor" hint="https://…">
                  <Input
                    id="ev-link"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={link.url}
                    onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
                  />
                </Field>
                <Field id="ev-link-label" label="Descripción del enlace">
                  <Input
                    id="ev-link-label"
                    placeholder="p. ej. Certificado en el portal del proveedor"
                    value={link.label}
                    onChange={(e) => setLink((l) => ({ ...l, label: e.target.value }))}
                  />
                </Field>
              </div>
            </fieldset>
          ) : null}
          <Field id="ev-notes" label="Observaciones">
            <Textarea
              id="ev-notes"
              rows={2}
              value={d.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </ReauthDialog>
      ) : null}
    </div>
  );
}

/** Verificación de una limpieza por otra persona (AC-47): «Verifiqué». */
export function VerifyCleaningButton({
  eventId,
  code,
  signer,
  summary,
}: {
  eventId: string;
  code: string;
  signer: string;
  summary: { label: string; value: string; mono?: boolean }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Verificar limpieza
      </Button>
      {open ? (
        <ReauthDialog
          open
          onOpenChange={setOpen}
          title={`Verificar limpieza · ${code}`}
          meaning="Verifiqué"
          summary={summary}
          signer={signer}
          confirmLabel="Firmar verificación"
          onConfirm={(pw) => verifyCleaning({ eventId, code, password: pw })}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        >
          <p className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm">
            Quien registró la limpieza no puede verificarla (segregación de funciones).
          </p>
        </ReauthDialog>
      ) : null}
    </>
  );
}

/** Cambio de estado operativo con motivo. Sacar de servicio o devolverlo lo aprueba Aseguramiento de la calidad. */
export function StatusForm({ equipment }: { equipment: Equipment }) {
  const router = useRouter();
  const [status, setStatus] = useState(equipment.status);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<Exclude<EqResult, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      aria-label="Cambiar estado"
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setEquipmentStatus({
            equipmentId: equipment.id,
            code: equipment.code,
            status,
            reason,
          });
          if (!res.ok) return setError(res);
          setError(null);
          setReason("");
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-[200px_1fr] gap-3 max-[1023px]:grid-cols-1">
        <Field id="st-status" label="Nuevo estado">
          <select
            id="st-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectCls}
          >
            {SETTABLE_STATUS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="st-reason" label="Motivo *">
          <Input id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <ErrorLine error={error} />
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          disabled={pending || status === equipment.status || !reason.trim()}
        >
          Cambiar estado
        </Button>
      </div>
    </form>
  );
}

/**
 * Abre el certificado (enlace temporal desde el servidor) o el enlace del proveedor en otra pestaña. Del archivo muestra la
 * huella SHA-256 para cotejarla; del enlace, el sitio al que lleva.
 */
export function EvidenceLink({
  id,
  url,
  fileName,
  sha256,
}: {
  id: string;
  url: string | null;
  fileName: string;
  sha256: string | null;
}) {
  const Icon = url ? ExternalLink : fileName.toLowerCase().endsWith(".pdf") ? FileText : Paperclip;
  let host = "";
  try {
    host = url ? new URL(url).host : "";
  } catch {
    host = "";
  }
  return (
    <span className="inline-grid gap-0.5">
      <a
        href={`/equipos/evidencia/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary underline"
      >
        <Icon aria-hidden className="size-3.5" />
        {fileName}
        <span className="sr-only"> (se abre en otra pestaña)</span>
      </a>
      {url ? (
        <span className="text-[11px] text-text-secondary" title={url}>
          Enlace del proveedor · {host}
        </span>
      ) : sha256 ? (
        <span className="font-mono text-[11px] text-text-secondary" title={sha256}>
          SHA-256 {sha256.slice(0, 16)}…
        </span>
      ) : null}
    </span>
  );
}
