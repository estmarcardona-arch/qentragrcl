// Etapa E0 (cimientos): página mínima. Las pantallas S-01… se construyen desde E1.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="text-label text-text-secondary uppercase">GRUFARCOL eBR · nombre de trabajo</p>
      <h1 className="text-page-title">Registro electrónico de lote</h1>
      <p className="max-w-prose text-text-secondary">
        Los registros de esta plataforma tienen validez de evidencia.
      </p>
      <p className="text-small text-text-muted">
        Versión <span className="font-mono">0.1.0</span> · etapa E0
      </p>
    </main>
  );
}
