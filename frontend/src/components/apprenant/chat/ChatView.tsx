"use client";

import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import ExerciceConversation, { type MessageEnChat } from "@/components/pedagogie/parcours/exercices/ExerciceConversation";
import { useFermerSessionChatbot, useParcoursPersonnalise } from "@/hooks/useParcoursPersonnalise";
import { ApiError } from "@/lib/api-client";
import { libellesChat } from "@/lib/libellesChat";
import { messageErreurParcours } from "@/lib/parcours-personnalise";
import { ROUTES } from "@/lib/routes";
import { nouvelleSessionChatbot, sessionChatbotCourante } from "@/lib/session-chatbot";
import { messageInitialChat, SCENARIOS_CHAT } from "@/lib/scenariosChat";
import type { MessageChatbot } from "@/types/parcours-personnalise";
import RapportConversation from "./RapportConversation";

type StatutConversationMemoire = "active" | "archivee" | "terminee";

interface ConversationMemoire {
  id: number;
  scenarioId: string;
  statut: StatutConversationMemoire;
  messages: MessageEnChat[];
  rapport?: MessageChatbot[];
}

function titreConversation(conversation: ConversationMemoire): string {
  const premierMessage = conversation.messages.find((message) => message.role === "apprenant")?.contenu.trim();
  if (!premierMessage) {
    return SCENARIOS_CHAT.find((scenario) => scenario.id === conversation.scenarioId)?.libelle ?? "";
  }
  return premierMessage.length > 38 ? `${premierMessage.slice(0, 38)}…` : premierMessage;
}

/**
 * L'historique reste en mémoire pendant la visite de la page : il n'est pas persisté dans le navigateur.
 * La conversation active et ses corrections restent celles du tuteur IA existant.
 */
export default function ChatView() {
  const [conversations, setConversations] = useState<ConversationMemoire[]>([
    { id: 0, scenarioId: SCENARIOS_CHAT[0].id, statut: "active", messages: [] },
  ]);
  const [conversationSelectionneeId, setConversationSelectionneeId] = useState(0);
  const prochainId = useRef(1);
  const fermerSession = useFermerSessionChatbot();
  const parcours = useParcoursPersonnalise();

  const conversation = conversations.find((item) => item.id === conversationSelectionneeId) ?? conversations[0];
  const scenario = SCENARIOS_CHAT.find((item) => item.id === conversation.scenarioId) ?? SCENARIOS_CHAT[0];
  const langue = parcours.data?.langue.code ?? "fr";
  const libelles = libellesChat(langue);

  const actualiserHistorique = useCallback((messages: MessageEnChat[]) => {
    setConversations((items) =>
      items.map((item) => item.id === conversationSelectionneeId && item.statut === "active" ? { ...item, messages } : item),
    );
  }, [conversationSelectionneeId]);

  /** Une seule session backend reste active ; les échanges précédents sont consultables en lecture seule. */
  function nouvelleConversation(scenarioId = conversation.scenarioId) {
    if (conversations.some((item) => item.statut === "active")) {
      fermerSession.mutate(sessionChatbotCourante());
    }
    nouvelleSessionChatbot();
    const id = prochainId.current++;
    setConversations((items) => [
      ...items
        .filter((item) => item.statut !== "active" || item.messages.some((message) => message.role === "apprenant"))
        .map((item) => item.statut === "active" ? { ...item, statut: "archivee" as const } : item),
      { id, scenarioId, statut: "active", messages: [] },
    ]);
    setConversationSelectionneeId(id);
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
  const estEnLectureSeule = conversation.statut !== "active";

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
            value={conversation.scenarioId}
            onChange={(e) => nouvelleConversation(e.target.value)}
            className="input w-full"
          >
            {SCENARIOS_CHAT.map((item) => (
              <option key={item.id} value={item.id}>
                {item.libelle}
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

      <section className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside aria-label={libelles.historique} className="card h-fit space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-content">{libelles.historique}</h2>
            <button
              type="button"
              onClick={() => nouvelleConversation()}
              className="btn-secondary inline-flex min-h-10 items-center gap-1 px-3 py-2 text-small"
            >
              <Plus size={16} aria-hidden />
              {libelles.nouvelleConversation}
            </button>
          </div>
          <p className="text-xs text-content-secondary">{libelles.historiqueTemporaire}</p>
          <ul className="flex max-h-72 gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
            {[...conversations].reverse().map((item) => {
              const scenarioItem = SCENARIOS_CHAT.find((option) => option.id === item.scenarioId) ?? SCENARIOS_CHAT[0];
              const selectionnee = item.id === conversation.id;
              return (
                <li key={item.id} className="min-w-52 lg:min-w-0">
                  <button
                    type="button"
                    aria-current={selectionnee ? "page" : undefined}
                    onClick={() => setConversationSelectionneeId(item.id)}
                    className={`flex min-h-12 w-full items-start gap-2 rounded-btn px-3 py-2 text-left text-small transition-colors ${
                      selectionnee ? "bg-primary/10 text-primary" : "text-content-secondary hover:bg-background"
                    }`}
                  >
                    <MessageSquare size={16} aria-hidden className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{titreConversation(item)}</span>
                      <span className="block truncate text-xs">
                        {scenarioItem.libelle}
                        {item.statut === "active" ? ` · ${libelles.conversationEnCours}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section aria-label={libelles.conversation} className="min-w-0 space-y-4">
          <ExerciceConversation
            key={conversation.id}
            contenu={{
              format: "conversation",
              consigne: libelles.consigne,
              sujet: scenario.sujet,
              messageInitial: messageInitialChat(scenario, langue),
              echangesMinimum: 3,
            }}
            langue={langue}
            enCours={false}
            verrouille={estEnLectureSeule}
            lectureSeule={estEnLectureSeule}
            messagesInitiales={conversation.messages.length ? conversation.messages : undefined}
            onMessagesChange={estEnLectureSeule ? undefined : actualiserHistorique}
            modeVocalParTours
            libelleTerminer={libelles.terminerRapport}
            onSoumettre={(reponse) => {
              if (reponse.format !== "conversation") return;
              fermerSession.mutate(sessionChatbotCourante());
              setConversations((items) =>
                items.map((item) =>
                  item.id === conversation.id ? { ...item, statut: "terminee", rapport: reponse.messages } : item,
                ),
              );
            }}
          />
          {conversation.rapport && (
            <RapportConversation
              messages={conversation.rapport}
              scenario={scenario.libelle}
              langue={libelleLangue}
              onRecommencer={() => nouvelleConversation(conversation.scenarioId)}
            />
          )}
        </section>
      </section>
    </div>
  );
}
