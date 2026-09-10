import { CalendarioWizard } from "@/components/planificacion/CalendarioWizard";

// V30 Capa 3b: el server action de generación corre en tramos de 90s.
// Amplía el límite de la función (Vercel) para que no corte el tramo.
export const maxDuration = 120;

export default function CalendarioPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <CalendarioWizard />
      </div>
    </div>
  );
}