import type { Metadata } from "next";
import PageStatique from "@/components/content/PageStatique";

export const metadata: Metadata = { title: "Conditions d'utilisation – Digithèque" };

export default function ConditionsPage() {
  return (
    <PageStatique eyebrow="Informations légales" titre="Conditions d'utilisation">
      <p>
        La Digithèque met à disposition des apprenants un parcours de langues personnalisé, un test de
        positionnement et un professeur IA. L&apos;inscription est gratuite dans la version de démonstration.
      </p>
      <p>
        Les contenus pédagogiques et les suggestions de l&apos;assistant sont fournis à titre indicatif. Les
        résultats du diagnostic et les corrections ne constituent pas une certification officielle.
      </p>
      <p>
        L&apos;utilisateur s&apos;engage à ne pas saisir de données personnelles dans les conversations avec
        l&apos;assistant et à utiliser le service dans un cadre pédagogique.
      </p>
    </PageStatique>
  );
}
