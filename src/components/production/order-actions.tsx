"use client";

import { approveOrder } from "@/lib/production/actions";
import { SignedAction } from "./signed-action";

/** Aprobar la OP con firma («Aprobé») y generar los documentos (RF-38, D-12). */
export function ApproveOrderButton({
  orderId,
  code,
  batchCode,
  signer,
}: {
  orderId: string;
  code: string;
  batchCode: string;
  signer: string;
}) {
  return (
    <SignedAction
      label="Aprobar orden y generar documentos"
      title={`Aprobar ${code}`}
      meaning="Aprobé"
      summary={[
        { label: "Orden", value: code, mono: true },
        { label: "Lote", value: batchCode, mono: true },
        {
          label: "Genera",
          value: "Órdenes de etapa, solicitudes SD/SE/SA, codificado, rótulos y registros",
        },
      ]}
      signer={signer}
      confirmLabel="Firmar aprobación"
      run={(pw) => approveOrder(orderId, pw)}
      testId="approve-order"
    />
  );
}
