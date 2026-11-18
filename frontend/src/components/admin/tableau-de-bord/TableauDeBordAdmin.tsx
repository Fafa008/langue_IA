"use client";
import { CalendarDays, LayoutDashboard } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { useStatistiquesAdmin } from "@/hooks/useTableauDeBord";
import { getErrorMessage } from "@/lib/api-client";
import ChiffresCles from "./ChiffresCles";
import CourbeInscriptions from "./CourbeInscriptions";
import DernieresInscriptions from "./DernieresInscriptions";
import RepartitionLangues from "./RepartitionLangues";

const dateDuJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Tableau de bord de l'administrateur : chiffres clés, apprenants par langue, courbe des inscriptions
 * et dernières inscriptions d'apprenants. Couleurs : la couleur principale (et ses nuances), le gris du texte secondaire, le blanc.
 */
export default function TableauDeBordAdmin() {
  const stats = useStatistiquesAdmin();
  const data = stats.data;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <LayoutDashboard size={36} className="mt-1 shrink-0 text-primary" aria-hidden />
          <div>
            <h1>Tableau de bord</h1>
            <p className="mt-1 text-base text-content-secondary">Vue d&apos;ensemble de la plateforme et de son activité.</p>
          </div>
        </div>
        <p className="flex items-center gap-2 rounded-btn border border-border bg-surface px-4 py-2.5 text-content first-letter:uppercase">
          <CalendarDays size={18} className="text-primary" aria-hidden />
          <span className="first-letter:uppercase">{dateDuJour.format(new Date())}</span>
        </p>
      </div>

      {stats.isError ? (
        <Alert className="mb-6">{getErrorMessage(stats.error)}</Alert>
      ) : null}

      <div aria-busy={stats.isLoading} className="space-y-6">
        {!stats.isError && <ChiffresCles totaux={data?.totaux} />}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {!stats.isError && <RepartitionLangues langues={data?.apprenantsParLangue} totalApprenants={data?.totaux.apprenants} />}
          <CourbeInscriptions />
        </div>

        {!stats.isError && <DernieresInscriptions inscriptions={data?.dernieresInscriptions} />}
      </div>
    </div>
  );
}
