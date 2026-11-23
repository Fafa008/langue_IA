"use client";

import Link from "next/link";
import { useState } from "react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { useFermerSessionChatbot, useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { ApiError } from "@/lib/api-client";
import { messageErreurParcours } from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import { nouvelleSessionChatbot } from "@/lib/session-chatbot";
import { SCENARIOS_CHAT } from "@/lib/scenariosChat";
import type { MessageChatbot } from "@/types/parcours-personnalise";
import RapportConversation from "./RapportConversation";

/**
 * US72/US73-FE — Page du chat avec le professeur IA : la langue vient du parcours de l'apprenant, jamais d'un
 * choix manuel. Chaque conversation ouvre et ferme sa propre session backend.
 */
export default function ChatView() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS_CHAT[0].id);
  const [rapport, setRapport] = useState<MessageChatbot[] | null>(null);
  const [cleConversation, setCleConversation] = useState(0);
  const fermerSession = useFermerSessionChatbot();
  const parcours = useParcoursPersonnalise();

  const scenario = SCENARIOS_CHAT.find((s) => s.id === scenarioId) ?? SCENARIOS_CHAT[0];

  /** Change de scénario : la session précédente est fermée avant d'en ouvrir une nouvelle. */
  function changerContexte(Changer: () => void) {
    fermerSession.mutate();
    nouvelleSessionChatbot();
    setRapport(null);
    setCleConversation((cle) => cle + 1);
    Changer();
  }

  function recommencer() {
    fermerSession.mutate();
    nouvelleSessionChatbot();
    setRapport(null);
    setCleConversation((cle) => cle + 1);
  }

  if (parcours.isError) {
    const sansParcours = parcours.error instanceof ApiError && parcours.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="eyebrow">Espace apprenant</p>
          <h1 className="mt-2">Professeur IA</h1>
        </header>
        <section role="alert" data-testid="alerte-sans-parcours" className="card space-y-3">
          <p>{messageErreurParcours(parcours.error, "Le chargement de votre parcours")}</p>
          {sansParcours && (
            <Link href={ROUTES.apprenant.testDiagnostic.demarrage} className="btn-primary inline-flex min-h-11 items-center">
              Faire le test de positionnement
            </Link>
          )}
        </section>
      </div>
    );
  }

  if (!parcours.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <p role="status" className="text-content-secondary">
          Chargement de votre parcours…
        </p>
      </div>
    );
  }

  const langue = parcours.data.langue.code;
  const libelleLangue = parcours.data.langue.libelle;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Espace apprenant</p>
        <h1 className="mt-2">Professeur IA</h1>
      </header>

      <div>
        <label className="block md:w-80">
          <span className="text-small font-semibold text-content-secondary">Scénario</span>
          <select
            value={scenarioId}
            onChange={(e) => changerContexte(() => setScenarioId(e.target.value))}
            className="input mt-1 w-full"
          >
            {SCENARIOS_CHAT.map((s) => (
              <option key={s.id} value={s.id}>{s.libelle}</option>
            ))}
          </select>
        </label>
      </div>

      <p data-testid="contexte-chat" className="text-content-secondary">
        Contexte : <strong className="text-content">{scenario.libelle}</strong> · {libelleLangue} (langue de votre parcours)
      </p>

      <p role="note" data-testid="avertissement-chat-rg11" className="rounded-card border border-warning/50 bg-warning/5 p-3 text-small text-content">
        Avant votre premier message : vos échanges et les 20 derniers tours sont transmis au service IA pour produire une
        réponse. N’y saisissez aucune donnée personnelle (adresse e-mail, numéro de téléphone, etc.). L’historique est
        supprimé à la fin de la conversation ; le journal ne conserve aucun texte brut.
      </p>

      {rapport ? (
        <RapportConversation
          messages={rapport}
          scenario={scenario.libelle}
          langue={libelleLangue}
          onRecommencer={recommencer}
        />
      ) : (
        <section className="card" aria-label="Conversation">
          {/* La clé réinitialise la conversation à chaque changement de scénario ou de session */}
          <ExerciceConversation
            key={`${scenario.id}-${cleConversation}`}
            contenu={{
              format: "conversation",
              consigne: "Discutez avec le professeur IA, à l'écrit ou à la voix.",
              sujet: scenario.sujet,
              messageInitial: scenario.messageInitial,
              echangesMinimum: 3,
            }}
            langue={langue}
            enCours={false}
            verrouille={false}
            libelleTerminer="Terminer et voir le rapport"
            onSoumettre={(reponse) => {
              if (reponse.format !== "conversation") return;
              fermerSession.mutate();
              setRapport(reponse.messages);
            }}
          />
        </section>
      )}
    </div>
  );
}
