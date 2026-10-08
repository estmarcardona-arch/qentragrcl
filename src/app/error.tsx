"use client"; // Los límites de error son componentes cliente.

import Link from "next/link";
import { ErrorState } from "@/components/common/state-card";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-center px-6 py-16">
      <ErrorState
        title="Ocurrió un error inesperado"
        text="Sus datos guardados no se perdieron. Intente de nuevo; si continúa, informe el código de referencia a Administración."
        code={error.digest ? `500 · ${error.digest}` : "500"}
        action={
          <div className="flex gap-2">
            <Button onClick={() => retry()}>Intentar de nuevo</Button>
            <Button variant="secondary" asChild>
              <Link href="/">Volver al inicio</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
