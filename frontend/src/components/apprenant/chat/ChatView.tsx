"use client";

import { useState } from "react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { LANGUES } from "@/lib/languages";
import type { Langue } from "@/types/langue";
import { SCENARIOS_CHAT } from "@/lib/scenariosChat";

/**
 * US72/US73-FE — Page du chat avec le professeur IA : choix du scénario et de la langue, libellé de contexte.
 * Le composant de conversation utilise le service backend (ou le mock explicite en développement).
 */
export default function ChatView() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS_CHAT[0].id);
  const [langue, setLangue] = useState<Langue["code"]>(LANGUES[0].code);
  const scenario = SCENARIOS_CHAT.find((s) => s.id === scenarioId) ?? SCENARIOS_CHAT[0];
  const libelleLangueChoisie = LANGUES.find((l) => l.code === langue)?.libelle ?? langue;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="eyebrow">Espace apprenant</p>
        <h1 className="mt-2">Professeur IA</h1>
      </header>

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="flex-1">
          <span className="text-small font-semibold text-content-secondary">Scénario</span>
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className="input mt-1 w-full">
            {SCENARIOS_CHAT.map((s) => (
              <option key={s.id} value={s.id}>{s.libelle}</option>
            ))}
          </select>
        </label>
        <label className="md:w-64">
          <span className="text-small font-semibold text-content-secondary">Langue</span>
          <select value={langue} onChange={(e) => setLangue(e.target.value as Langue["code"])} className="input mt-1 w-full">
            {LANGUES.map((l) => (
              <option key={l.code} value={l.code}>{l.libelle}</option>
            ))}
          </select>
        </label>
      </div>

      <p data-testid="contexte-chat" className="text-content-secondary">
        Contexte : <strong className="text-content">{scenario.libelle}</strong> · {libelleLangueChoisie}
      </p>

      <section className="card" aria-label="Conversation">
        {/* La clé réinitialise la conversation à chaque changement de scénario ou de langue */}
        <ExerciceConversation
          key={`${scenario.id}-${langue}`}
          contenu={{
            format: "conversation",
            consigne: "Discutez avec le professeur IA, à l'écrit ou à la voix.",
            sujet: scenario.sujet,
            messageInitial: scenario.messageInitial,
            echangesMinimum: 3,
          }}
          langue={langue}
          enCours={false}
          verrouille
          onSoumettre={() => {}}
        />
      </section>
    </div>
  );
}
