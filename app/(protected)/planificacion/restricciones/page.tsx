import { RestriccionesPageClient } from "@/components/planificacion/RestriccionesPageClient";
import { obtenerRestricciones, obtenerEmpresas, obtenerTalleres } from "@/lib/api";

export const dynamic = 'force-dynamic';

export default async function RestriccionesPage() {
  const [empresas, restricciones, talleres] = await Promise.all([
    obtenerEmpresas(),
    obtenerRestricciones(),
    obtenerTalleres(),
  ]);

  return (
    <RestriccionesPageClient
      empresas={empresas}
      restricciones={restricciones}
      talleres={talleres}
    />
  );
}