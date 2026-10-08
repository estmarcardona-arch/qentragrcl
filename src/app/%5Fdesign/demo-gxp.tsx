"use client";

import { useEffect, useState } from "react";
import { CorrectionDialog } from "@/components/gxp/correction-dialog";
import { SignatureModal } from "@/components/gxp/signature-modal";
import { Button } from "@/components/ui/button";
import { getSigner, type Signer } from "@/lib/gxp/actions";

// Prueba en vivo para /_design: usa las acciones reales contra la base. El registro de prueba NO
// existe, así que nunca se firma ni se corrige nada: sirve para ver la reautenticación (contraseña
// errónea, intentos restantes) y las respuestas de la base en el modal.
const DEMO_RECORD = {
  table: "demo_inexistente",
  id: "00000000-0000-4000-8000-000000000000",
  label: "Dispensación de glicerina · 60,00 kg",
  code: "SD-2026-0042 · L-2610-018",
};

export function DemoGxp() {
  const [signer, setSigner] = useState<Signer>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);

  useEffect(() => {
    void getSigner().then(setSigner);
  }, []);

  return (
    <div className="grid gap-3">
      <p className="max-w-prose text-small text-text-secondary">
        {signer
          ? `Sesión iniciada como ${signer.fullName}. La prueba usa la contraseña real y cuenta los intentos fallidos, pero el registro de ejemplo no existe: nada se firma.`
          : "Inicie sesión para probar la reautenticación real. Sin sesión, el modal muestra la respuesta de la base."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setSignOpen(true)}>Probar firma (en vivo)</Button>
        <Button variant="secondary" onClick={() => setFixOpen(true)}>
          Probar corrección (en vivo)
        </Button>
      </div>
      <SignatureModal
        open={signOpen}
        onOpenChange={setSignOpen}
        record={DEMO_RECORD}
        meaning="verifico"
        precheck={false}
        signer={signer}
        summary={[
          { label: "Glicerina requerida", value: "60,00 kg" },
          { label: "MP-2026-0187 · GLI-2509-A", value: "40,00 kg", mono: true },
          { label: "MP-2026-0204 · GLI-2511-B", value: "20,00 kg", mono: true },
        ]}
      />
      <CorrectionDialog
        open={fixOpen}
        onOpenChange={setFixOpen}
        record={{ table: DEMO_RECORD.table, id: DEMO_RECORD.id, code: DEMO_RECORD.code }}
        field={{ name: "value", label: "Peso neto", currentValue: "98,2", unit: "kg" }}
      />
    </div>
  );
}
