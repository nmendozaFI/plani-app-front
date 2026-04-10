import { FrecuenciasWizard } from "@/components/planificacion/FrecuenciasWizard";
 
export default function FrecuenciasPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <FrecuenciasWizard />
      </div>
    </div>
  );
}