import type { Metadata } from "next";
import { MasterList } from "@/components/rd/master-list";
import { SPEC_SCOPE_LABELS } from "@/lib/rd/labels";

export const metadata: Metadata = { title: "Especificaciones · GRUFARCOL eBR" };

// S-08 · Especificaciones de materia prima, envase, granel y producto terminado (RF-12).
export default function SpecificationsPage() {
  return (
    <MasterList
      type="EP"
      title="Especificaciones"
      description="Parámetros, métodos y límites por materia prima, envase, granel o producto terminado."
      basePath="/idi/especificaciones"
      newLabel="Nueva especificación"
      contentTable="specifications"
      detail={(c) => SPEC_SCOPE_LABELS[String(c.scope)] ?? String(c.scope)}
    />
  );
}
