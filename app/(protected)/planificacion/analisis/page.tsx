import { AnalisisPageClient } from "@/components/planificacion/AnalisisPageClient";

export const dynamic = "force-dynamic";

export default function AnalisisPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <AnalisisPageClient />
      </div>
    </div>
  );
}
