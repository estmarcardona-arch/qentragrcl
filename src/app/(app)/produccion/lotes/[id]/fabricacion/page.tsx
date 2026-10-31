import type { Metadata } from "next";
import { StageRecord } from "@/components/production/stage-record";

export const metadata: Metadata = { title: "Registro de fabricación · GRUFARCOL eBR" };

// Registro de fabricación del lote (PRD F6; ver StageRecord).
export default async function Page({
  params,
  searchParams,
}: PageProps<"/produccion/lotes/[id]/fabricacion">) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <StageRecord
      id={id}
      stageCode="fabricacion"
      presParam={typeof sp.pres === "string" ? sp.pres : undefined}
    />
  );
}
