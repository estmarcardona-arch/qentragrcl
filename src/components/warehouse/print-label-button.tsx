"use client";

import { Printer } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { logLabelPrint } from "@/lib/warehouse/actions";

/** Registra quién imprime el rótulo y abre la impresión del navegador (D-10). */
export function PrintLabelButton({ lotId }: { lotId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await logLabelPrint({ lotId });
          window.print();
        })
      }
    >
      <Printer aria-hidden /> Imprimir rótulo
    </Button>
  );
}
