import { CalendarioWizard } from "@/components/planificacion/CalendarioWizard";
 
export default function CalendarioPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <CalendarioWizard />
      </div>
    </div>
  );
}