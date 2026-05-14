import { DoblePageClient } from "@/components/planificacion/DoblePageClient";

export const dynamic = "force-dynamic";

export default function DoblePage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <DoblePageClient />
      </div>
    </div>
  );
}
