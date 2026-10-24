import type { Metadata } from "next";
import { MasterList } from "@/components/rd/master-list";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Fórmulas · GRUFARCOL eBR" };

// S-07 · Fórmulas maestras versionadas (RF-11) sobre el SGD.
export default function FormulasPage() {
  return (
    <MasterList
      type="FM"
      title="Fórmulas maestras"
      description="Fórmula cuali-cuantitativa por producto. Se aprueba solo con estabilidad preliminar completa y conforme."
      basePath="/idi/formulas"
      newLabel="Nueva fórmula"
      contentTable="formulas"
      detail={(c) => `Lote ${formatNumber(Number(c.batch_size), 0)} ${String(c.batch_unit)}`}
    />
  );
}
