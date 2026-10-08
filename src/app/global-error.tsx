"use client"; // Reemplaza el layout raíz cuando este falla: define su propio <html> y <body>.

import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es-CO">
      <body className="flex min-h-screen items-center justify-center bg-background p-6 font-sans text-foreground">
        <main
          role="alert"
          className="grid max-w-md gap-3 rounded-[10px] border border-border bg-surface p-6 text-center"
        >
          <p className="text-label text-text-muted uppercase">Error</p>
          <h1 className="text-section">La plataforma no pudo cargar</h1>
          <p className="text-small text-text-secondary">
            Intente de nuevo. Si continúa, informe el código de referencia a Administración.
          </p>
          <code className="justify-self-center rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-xs">
            {error.digest ? `500 · ${error.digest}` : "500"}
          </code>
          <button
            type="button"
            onClick={() => retry()}
            className="h-9 justify-self-center rounded-md bg-primary px-3.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
