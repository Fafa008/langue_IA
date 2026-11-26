"use client";

import Link from "next/link";
import { useState } from "react";
import ExerciceConversation from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { useFermerSessionChatbot, useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { ApiError } from "@/lib/api-client";
import { libellesChat } from "@/lib/libellesChat";
import { messageErreurParcours } from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import { nouvelleSessionChatbot } from "@/lib/session-chatbot";
import { messageInitialChat, SCENARIOS_CHAT } from "@/lib/scenariosChat";
import type { MessageChatbot } from "@/types/parcours-personnalise";
import RapportConversation from "./RapportConversation";

/**
 * US72/US73/US74-FE — Page du chat avec le tuteur IA : la langue vient du parcours de l'apprenant, jamais d'un
 * choix manuel. Les libellés de l'interface et le message d'ouverture sont dans cette langue ; la traduction et
 * l'explication françaises restent dans un panneau hors du fil. Chaque conversation ouvre et ferme sa session backend.
 */
export default function ChatView() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS_CHAT[0].id);
  const [rapport, setRapport] = useState<MessageChatbot[] | null>(null);
  const [cleConversation, setCleConversation] = useState(0);
  const fermerSession = useFermerSessionChatbot();
  const parcours = useParcoursPersonnalise();

  const scenario = SCENARIOS_CHAT.find((s) => s.id === scenarioId) ?? SCENARIOS_CHAT[0];
  const langue = parcours.data?.langue.code ?? "fr";
  const libelles = libellesChat(langue);

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
          <p className="eyebrow">{libelles.espaceApprenant}</p>
          <h1 className="mt-2">{libelles.titre}</h1>
        </header>
        <section role="alert" data-testid="alerte-sans-parcours" className="card space-y-3">
          <p>{messageErreurParcours(parcours.error, "Le chargement de votre parcours")}</p>
          {sansParcours && (
            <Link href={ROUTES.apprenant.testDiagnostic.demarrage} className="btn-primary inline-flex min-h-11 items-center">
              {libelles.faireTest}
            </Link>
          )}
        </section>
      </div>
    );
  }

  if (!parcours.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <p role="status" className="text-content-secondary">{libelles.chargement}</p>
      </div>
    );
  }

  const libelleLangue = parcours.data.langue.libelle;

  return (
    <div className="w-full space-y-5">
      {/* En-tête du tuteur */}
      <header className="card overflow-hidden p-0 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xl text-white shadow-sm">
              ✦
            </div>
            <div>
              <p className="eyebrow">{libelles.espaceApprenant}</p>
              <h1 className="mt-1 text-xl font-bold text-content">{libelles.titre}</h1>
              <p className="text-xs text-content-secondary">
                {libelleLangue} · Tuteur linguistique IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-content">{libelles.langueParcours}</span>
          </div>
        </div>
      </header>

      {/* Sélecteur de scénario */}
      <section className="card space-y-3 p-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-content">{libelles.scenario}</span>
          <select
            value={scenarioId}
            onChange={(e) => changerContexte(() => setScenarioId(e.target.value))}
            className="input w-full"
          >
            {SCENARIOS_CHAT.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle}
              </option>
            ))}
          </select>
        </label>

        <p data-testid="contexte-chat" className="text-sm text-content-secondary">
          {libelles.contexte}{" "}
          <strong className="text-content">{scenario.libelle}</strong> · {libelleLangue}
        </p>
      </section>

      {/* Avertissement pédagogique */}
      <p
        role="note"
        data-testid="avertissement-chat-rg11"
        className="rounded-card border border-warning/50 bg-warning/5 p-3 text-sm text-content"
      >
        {libelles.avertissement}
      </p>

      {/* Conversation : occupe toute la largeur disponible dans l'espace apprenant */}
      {rapport ? (
        <RapportConversation
          messages={rapport}
          scenario={scenario.libelle}
          langue={libelleLangue}
          onRecommencer={recommencer}
        />
      ) : (
        <section
          className="overflow-hidden rounded-card border border-primary/10 bg-surface shadow-card"
          aria-label={libelles.conversation}
        >
          <div className="border-b border-primary/10 bg-primary/5 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
                ✦
              </span>
              <div>
                <p className="font-semibold text-content">{libelles.titre}</p>
                <p className="text-xs text-content-secondary">{scenario.libelle}</p>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <ExerciceConversation
              key={`${scenario.id}-${cleConversation}`}
              contenu={{
                format: "conversation",
                consigne: libelles.consigne,
                sujet: scenario.sujet,
                messageInitial: messageInitialChat(scenario, langue),
                echangesMinimum: 3,
              }}
              langue={langue}
              enCours={false}
              verrouille={false}
              modeVocalParTours
              libelleTerminer={libelles.terminerRapport}
              onSoumettre={(reponse) => {
                if (reponse.format !== "conversation") return;
                fermerSession.mutate();
                setRapport(reponse.messages);
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
