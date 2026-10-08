import Link from "next/link";
import { EmptyState } from "@/components/common/state-card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-xl flex-1 content-center px-6 py-16">
      <EmptyState
        title="No encontramos esta página"
        text="La dirección no existe o fue movida. Verifique el enlace o vuelva al inicio."
        code="404"
        action={
          <Button asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        }
      />
    </main>
  );
}
