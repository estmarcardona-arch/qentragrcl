"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { qualifyParty, saveParty } from "@/lib/warehouse/actions";
import { PARTY_KINDS } from "@/lib/warehouse/labels";

const selectCls = "h-10 rounded-md border border-border-control bg-white px-2.5 text-sm";

/** Registrar un tercero (proveedor, maquilador o almacenamiento externo). */
export function NewParty() {
  const router = useRouter();
  const [d, setD] = useState({ name: "", kind: "proveedor", tax_id: "", contact: "", address: "" });
  return (
    <ReasonDialog
      trigger={
        <Button>
          <Plus aria-hidden /> Nuevo tercero
        </Button>
      }
      title="Nuevo tercero"
      description="La calificación la registra Aseguramiento de la calidad (D-17)."
      confirmLabel="Registrar"
      onConfirm={(reason) => saveParty({ id: null, data: d, reason })}
      onDone={() => {
        setD({ name: "", kind: "proveedor", tax_id: "", contact: "", address: "" });
        router.refresh();
      }}
    >
      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-label uppercase">Nombre</span>
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-label uppercase">Tipo</span>
          <select
            className={selectCls}
            value={d.kind}
            onChange={(e) => setD({ ...d, kind: e.target.value })}
          >
            {Object.entries(PARTY_KINDS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-label uppercase">NIT</span>
          <Input value={d.tax_id} onChange={(e) => setD({ ...d, tax_id: e.target.value })} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-label uppercase">Contacto</span>
          <Input value={d.contact} onChange={(e) => setD({ ...d, contact: e.target.value })} />
        </label>
      </div>
    </ReasonDialog>
  );
}

/** D-17 · Calificación del tercero con vencimiento y referencia (auditoría, acta), con motivo. */
export function QualifyParty({
  id,
  name,
  qualified,
  expires,
  reference,
}: {
  id: string;
  name: string;
  qualified: boolean;
  expires: string | null;
  reference: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState(qualified);
  const [date, setDate] = useState(expires ?? "");
  const [ref, setRef] = useState(reference ?? "");
  return (
    <ReasonDialog
      trigger={
        <Button variant="secondary" size="sm">
          Calificación
        </Button>
      }
      title={`Calificación de ${name}`}
      description="Un tercero sin calificación vigente no recibe envíos (AC-24)."
      confirmLabel="Guardar calificación"
      onConfirm={(reason) =>
        qualifyParty({ id, qualified: q, expires: date, reference: ref, reason })
      }
      onDone={() => router.refresh()}
    >
      <div className="grid gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={q}
            onChange={(e) => setQ(e.target.checked)}
          />
          Calificado
        </label>
        <label className="grid gap-1.5">
          <span className="text-label uppercase">Vigente hasta</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-label uppercase">Referencia (auditoría o acta)</span>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
      </div>
    </ReasonDialog>
  );
}
