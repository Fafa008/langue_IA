import type { Metadata } from "next";
import PageStatique from "@/components/content/PageStatique";

export const metadata: Metadata = { title: "FAQ – Digithèque" };

export default function FaqPage() {
  return (
    <PageStatique eyebrow="Aide" titre="Questions fréquentes">
      <div>
        <h2 className="text-h4 font-semibold text-content">Comment fonctionne le test de positionnement ?</h2>
        <p>
          Le test propose des questions adaptées à la langue choisie (QCM, rédaction, compréhension orale).
          À la fin, le backend calcule un niveau et met en évidence les points à travailler. Le parcours
          personnalisé en déduit les premières leçons recommandées.
        </p>
      </div>
      <div>
        <h2 className="text-h4 font-semibold text-content">Puis-je utiliser le chat sans micro ?</h2>
        <p>
          Oui. Le mode vocal est facultatif : si le navigateur ne propose pas la dictée ou si l&apos;autorisation
          est refusée, vous pouvez poursuivre en mode écrit. La reconnaissance vocale est fournie par le navigateur
          et peut nécessiter une connexion internet ; l&apos;audio brut n&apos;est pas envoyé aux serveurs de la plateforme.
          En mode vocal, seule la transcription est envoyée au chatbot.
        </p>
      </div>
      <div>
        <h2 className="text-h4 font-semibold text-content">Que se passe-t-il si le service est indisponible ?</h2>
        <p>
          Les erreurs sont signalées à l&apos;écran avec une action de réessai. Si l&apos;agent d&apos;analyse est
          momentanément indisponible, le diagnostic peut rester partiel : les résultats calculés par le backend
          restent affichés, sans message d&apos;erreur pour l&apos;apprenant.
        </p>
      </div>
      <div>
        <h2 className="text-h4 font-semibold text-content">Les résultats sont-ils une certification ?</h2>
        <p>
          Non. Les niveaux et recommandations sont indicatifs et destinés au travail pédagogique. La validation
          vocale par un formateur et la génération automatique d&apos;exercices ne font pas partie de cette version.
        </p>
      </div>
    </PageStatique>
  );
}
