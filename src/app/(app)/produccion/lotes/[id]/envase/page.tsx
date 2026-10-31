import type { Metadata } from "next";
import { StageRecord } from "@/components/production/stage-record";

export const metadata: Metadata = { title: "Registro de envase · GRUFARCOL eBR" };

// Registro de envase del lote (PRD F6; ver StageRecord).
export default async function Page({
  params,
  searchParams,
}: PageProps<"/produccion/lotes/[id]/envase">) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <StageRecord
      id={id}
      stageCode="envase"
      presParam={typeof sp.pres === "string" ? sp.pres : undefined}
    />
  );
}
