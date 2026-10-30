import { Hourglass } from "lucide-react";

interface ResultatEnAttenteProps {
  verificationEnCours: boolean;
  onVerifier: () => void;
  /** Intervalle de la vérification automatique, affiché à l'apprenant ; null une fois celle-ci arrêtée. */
  intervalleSecondes: number | null;
}

/** Test fini, résultat pas encore prêt : l'analyse des réponses par le LLM se poursuit côté serveur. */
export default function ResultatEnAttente({ verificationEnCours, onVerifier, intervalleSecondes }: ResultatEnAttenteProps) {
  return (
    <section className="card text-center" data-testid="resultat-en-attente" aria-labelledby="resultat-en-attente-titre">
      <Hourglass size={40} aria-hidden className="mx-auto text-primary" />
      <h2 id="resultat-en-attente-titre" className="mt-4 text-h3 text-content">Résultat en attente</h2>
      <p className="mx-auto mt-2 max-w-md text-content-secondary">
        Votre test est terminé et vos réponses sont enregistrées. Leur analyse est en cours : votre résultat sera
        disponible dans quelques instants.
      </p>
      <p role="status" aria-live="polite" className="mt-3 text-small text-content-secondary">
        {verificationEnCours
          ? "Vérification en cours…"
          : intervalleSecondes
            ? `Nouvelle vérification automatique toutes les ${intervalleSecondes} secondes.`
            : "L'analyse prend plus de temps que prévu. Revenez dans quelques minutes et vérifiez votre résultat."}
      </p>
      <button type="button" className="btn-primary mx-auto mt-6" onClick={onVerifier} disabled={verificationEnCours}>
        Vérifier mon résultat
      </button>
    </section>
  );
}
