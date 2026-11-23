import type { Metadata } from "next";
import PageStatique from "@/components/content/PageStatique";

export const metadata: Metadata = { title: "Confidentialité – Digithèque" };

export default function ConfidentialitePage() {
  return (
    <PageStatique eyebrow="Informations légales" titre="Politique de confidentialité">
      <p>
        La Digithèque conserve les informations nécessaires au fonctionnement du service : identifiants de
        connexion, profil, réponses aux exercices et au test de positionnement, ainsi que les échanges avec
        l&apos;assistant IA.
      </p>
      <p>
        Les mots de passe sont stockés sous forme d&apos;empreintes. Le jeton d&apos;accès ne contient que
        l&apos;identifiant et l&apos;usage ; le rôle et le statut du compte sont relus en base à chaque requête,
        afin qu&apos;une suspension prenne effet immédiatement.
      </p>
      <p>
        Les échanges avec l&apos;assistant sont enregistrés pour la session en cours afin d&apos;assurer la
        cohérence des réponses ; ils peuvent être supprimés depuis le chat. Aucun enregistrement audio n&apos;est
        transmis au serveur : le mode vocal repose sur les fonctions de dictée du navigateur.
      </p>
      <p>
        Dans la version de démonstration, les réponses de l&apos;assistant peuvent être produites par un
        fournisseur factice déterministe, sans appel à un modèle de langue externe.
      </p>
    </PageStatique>
  );
}
