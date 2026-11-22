"use client";

import { useState } from "react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { useFermerSessionChatbot } from "@/hooks/useParcoursPersonnalise";
import { LANGUES } from "@/lib/languages";
import { nouvelleSessionChatbot } from "@/lib/session-chatbot";
import { SCENARIOS_CHAT } from "@/lib/scenariosChat";
import type { Langue } from "@/types/langue";
import type { MessageChatbot } from "@/types/parcours-personnalise";
import RapportConversation from "./RapportConversation";

/**
 * US72/US73-FE — Page du chat avec le professeur IA : choix du scénario et de la langue, libellé de contexte,
 * puis synthèse locale à la fin de l'échange. Chaque conversation ouvre et ferme sa propre session backend.
 */
export default function ChatView() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS_CHAT[0].id);
  const [langue, setLangue] = useState<Langue["code"]>(LANGUES[0].code);
  const [rapport, setRapport] = useState<MessageChatbot[] | null>(null);
  const [cleConversation, setCleConversation] = useState(0);
  const fermerSession = useFermerSessionChatbot();

  const scenario = SCENARIOS_CHAT.find((s) => s.id === scenarioId) ?? SCENARIOS_CHAT[0];
  const libelleLangueChoisie = LANGUES.find((l) => l.code === langue)?.libelle ?? langue;

  /** Change de contexte : la session précédente est fermée avant d'en ouvrir une nouvelle. */
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Espace apprenant</p>
        <h1 className="mt-2">Professeur IA</h1>
      </header>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="flex-1">
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
        <label className="md:w-64">
          <span className="text-small font-semibold text-content-secondary">Langue</span>
          <select
            value={langue}
            onChange={(e) => changerContexte(() => setLangue(e.target.value as Langue["code"]))}
            className="input mt-1 w-full"
          >
            {LANGUES.map((l) => (
              <option key={l.code} value={l.code}>{l.libelle}</option>
            ))}
          </select>
        </label>
      </div>

      <p data-testid="contexte-chat" className="text-content-secondary">
        Contexte : <strong className="text-content">{scenario.libelle}</strong> · {libelleLangueChoisie}
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
          langue={libelleLangueChoisie}
          onRecommencer={recommencer}
        />
      ) : (
        <section className="card" aria-label="Conversation">
          {/* La clé réinitialise la conversation à chaque changement de scénario, de langue ou de session */}
          <ExerciceConversation
            key={`${scenario.id}-${langue}-${cleConversation}`}
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
