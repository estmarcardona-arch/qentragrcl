import type { Metadata } from "next";
import { MasterList } from "@/components/rd/master-list";
import { STAGE_LABELS } from "@/lib/rd/labels";

export const metadata: Metadata = { title: "Instructivos · GRUFARCOL eBR" };

// S-09 · Instructivos de fabricación, envase y acondicionamiento (RF-13).
export default function InstructionsPage() {
  return (
    <MasterList
      type="IN"
      title="Instructivos"
      description="Pasos de manufactura con equipos, parámetros y verificaciones; alimentan el batch record."
      basePath="/idi/instructivos"
      newLabel="Nuevo instructivo"
      contentTable="instructions"
      detail={(c) => STAGE_LABELS[String(c.stage)] ?? String(c.stage)}
    />
  );
}
