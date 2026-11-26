"use client";

import { Bot, Send, Sparkles, UserRound, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useChatbot,
  useCorrigerChatbot,
  useExerciceChatbot,
  useTraduireChatbot,
} from "@/hooks/useParcoursPersonnalise";
import { useReconnaissanceVocale } from "@/hooks/useReconnaissanceVocale";
import { PARCOURS_MOCK } from "@/lib/env";
import { libellesChat } from "@/lib/libellesChat";
import { messageErreurParcours } from "@/lib/parcours-personnalise";
import { creerIdentifiantMessage } from "@/lib/session-chatbot";
import { lireAVoixHaute, syntheseDisponible } from "@/lib/voix";
import type {
  ContenuExercice,
  CorrectionChatbot,
  ExerciceCibleChatbot,
  MessageChatbot,
  ReponseExercice,
} from "@/types/parcours-personnalise";
import BoutonMicro from "./BoutonMicro";

/**
 * Message affiché : un message de l'apprenant peut porter les corrections renvoyées par la route séparée
 * `/chatbot/correction` (US-IA-CHAT-05). La traduction et l'explication viennent de `/chatbot/traduction` et sont
 * présentées hors du fil, avec l'identifiant de message utilisé comme clé de cache côté IA.
 */
export type MessageEnChat = MessageChatbot & {
  corrections?: CorrectionChatbot[];
  traduction?: string;
  explication?: string;
  idMessage?: string;
};

/**
 * Conversation avec le tuteur IA (chatbot) : l'apprenant répond à l'écrit ou à la voix (dictée),
 * peut faire lire les réponses à voix haute, puis termine l'échange pour le faire évaluer.
 * Les corrections, la traduction et l'explication françaises sont affichées dans un panneau à droite du fil.
 * Les sessions backend sont supprimées à leur fin ; le parent peut garder temporairement les messages en mémoire.
 */
export default function ExerciceConversation({
  contenu,
  langue,
  enCours,
  verrouille,
  onSoumettre,
  libelleTerminer,
  modeVocalParTours = false,
  messagesInitiales,
  onMessagesChange,
  lectureSeule = false,
}: {
  contenu: Extract<ContenuExercice, { format: "conversation" }>;
  langue: string;
  enCours: boolean;
  verrouille: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
  libelleTerminer?: string;
  modeVocalParTours?: boolean;
  messagesInitiales?: MessageEnChat[];
  onMessagesChange?: (messages: MessageEnChat[]) => void;
  lectureSeule?: boolean;
}) {
  const [messages, setMessages] = useState<MessageEnChat[]>(
    () => messagesInitiales ?? [{ role: "assistant", contenu: contenu.messageInitial }],
  );
  const [brouillon, setBrouillon] = useState("");
  const [quotaRestant, setQuotaRestant] = useState<number | null>(null);
  const [exerciceCible, setExerciceCible] = useState<ExerciceCibleChatbot | null>(null);
  const chatbot = useChatbot();
  const correction = useCorrigerChatbot();
  const traduction = useTraduireChatbot();
  const exercice = useExerciceChatbot();
  const voix = useReconnaissanceVocale(langue);
  const libelles = libellesChat(langue);
  const finRef = useRef<HTMLDivElement>(null);
  const echanges = messages.filter((m) => m.role === "apprenant").length;
  const derniereTraduction = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && (message.traduction || message.explication));
  const derniereCorrection = [...messages].reverse().find((message) => (message.corrections?.length ?? 0) > 0);

  useEffect(() => {
    if (!lectureSeule) onMessagesChange?.(messages);
  }, [lectureSeule, messages, onMessagesChange]);

  // En mode vocal par tours, la transcription est envoyée directement ; sinon elle remplit la zone de saisie.
  useEffect(() => {
    if (!modeVocalParTours && voix.transcription) setBrouillon(voix.transcription);
  }, [modeVocalParTours, voix.transcription]);

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, chatbot.isPending]);

  /**
   * Un échange appelle trois routes backend distinctes : le tuteur répond, puis la correction et la traduction
   * sont demandées en parallèle. Une panne de l'une des deux tâches ne supprime pas la réponse du tuteur.
   */
  const envoyer = async (texte = brouillon, vocal = false) => {
    const message = texte.trim();
    if (!message || chatbot.isPending) return;
    const historique = messages;
    setMessages([...historique, { role: "apprenant", contenu: message }]);
    setBrouillon("");
    setExerciceCible(null);
    const idMessage = creerIdentifiantMessage();
    try {
      const reponse = await chatbot.mutateAsync({ message, historique });
      setQuotaRestant(reponse.quotaRestant);
      if (vocal) lireAVoixHaute(reponse.reponse, langue);
      const [resultatCorrection, resultatTraduction] = await Promise.allSettled([
        correction.mutateAsync({ message, historique }),
        traduction.mutateAsync({ idMessage, message: reponse.reponse }),
      ]);
      setMessages((liste) => {
        const suivants = [...liste];
        if (resultatCorrection.status === "fulfilled" && resultatCorrection.value.corrections.length > 0) {
          const indexApprenant = suivants.length - 1;
          suivants[indexApprenant] = {
            ...suivants[indexApprenant],
            corrections: resultatCorrection.value.corrections,
          };
        }
        suivants.push({
          role: "assistant",
          contenu: reponse.reponse,
          traduction: resultatTraduction.status === "fulfilled" ? resultatTraduction.value.traduction : "",
          explication: resultatTraduction.status === "fulfilled" ? resultatTraduction.value.explication : "",
          idMessage,
        });
        return suivants;
      });
    } catch {
      // L'erreur du tuteur est déjà exposée par React Query ; le message de l'apprenant reste affiché.
    }
  };

  const genererExerciceCible = async () => {
    const premiere = derniereCorrection?.corrections?.[0];
    if (!premiere) return;
    try {
      setExerciceCible(
        await exercice.mutateAsync({ typeErreur: premiere.type ?? "grammaire", erreur: premiere.extrait }),
      );
    } catch {
      // L'exercice ciblé est un complément : son échec n'interrompt pas la conversation.
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-background px-3 py-2 text-small text-content-secondary">
          <p>
            {libelles.sujet} <strong className="text-content">{contenu.sujet}</strong> ·{" "}
            {Math.min(echanges, contenu.echangesMinimum)}/{contenu.echangesMinimum} {libelles.echanges}
            {PARCOURS_MOCK && ` · ${libelles.simule}`}
          </p>
          {quotaRestant !== null && (
            <p role="status" data-testid="quota-chat" className="text-small text-content-secondary">
              {libelles.quota} {quotaRestant}
              {quotaRestant === 0 ? ` ${libelles.quotaEpuise}` : ""}
            </p>
          )}
        </div>

        <p className="mt-3 text-small font-medium text-content-secondary">{contenu.consigne}</p>

        <div
          role="log"
          aria-live="polite"
          aria-label={libelles.journal}
          className="mt-3 max-h-[26rem] min-h-[18rem] space-y-4 overflow-y-auto rounded-card border border-border/60 bg-background p-4 shadow-inner"
        >
          {messages.map((message, index) => (
            <Bulle key={index} message={message} langue={langue} libelles={libelles} />
          ))}
          {chatbot.isPending && (
            <p className="flex items-center gap-2 text-small text-content-secondary">
              <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              {libelles.tuteurEcrit}
            </p>
          )}
          <div ref={finRef} />
        </div>
        {chatbot.isError && (
          <p role="alert" className="msg-error mt-2">
            {messageErreurParcours(chatbot.error, libelles.erreurTuteur)}
          </p>
        )}

        {!lectureSeule && (
          <form
            className="mt-4 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-2 shadow-card focus-within:ring-2 focus-within:ring-primary/30"
            onSubmit={(e) => {
              e.preventDefault();
              envoyer();
            }}
          >
            <label className="min-w-0 flex-1 basis-56">
              <span className="sr-only">{libelles.votreMessage}</span>
              <input
                type="text"
                disabled={quotaRestant === 0}
                value={brouillon}
                onChange={(e) => setBrouillon(e.target.value)}
                placeholder={voix.ecoute ? libelles.placeholderEcoute : libelles.placeholder}
                maxLength={2000}
                lang={langue}
                className="input border-0 bg-transparent shadow-none focus:ring-0"
              />
            </label>
            {voix.disponible && (
              <BoutonMicro
                ecoute={voix.ecoute}
                onDemarrer={() =>
                  voix.demarrer(
                    modeVocalParTours
                      ? (transcription) => {
                        if (transcription) void envoyer(transcription, true);
                      }
                      : undefined,
                  )
                }
                onArreter={voix.arreter}
                disabled={chatbot.isPending || quotaRestant === 0}
                libelle={modeVocalParTours ? libelles.parler : libelles.dicter}
                libelleArreter={modeVocalParTours ? libelles.arreter : undefined}
                iconeSeule={modeVocalParTours}
              />
            )}
            <button
              type="submit"
              disabled={!brouillon.trim() || chatbot.isPending || quotaRestant === 0}
              className="btn-primary inline-flex min-h-11 items-center gap-2 px-4 py-2 disabled:opacity-50"
            >
              <Send size={16} aria-hidden /> {libelles.envoyer}
            </button>
          </form>
        )}
        {!lectureSeule && !voix.disponible && (
          <p role="note" className="mt-2 text-small text-content-secondary">
            {libelles.dictéeIndisponible}
          </p>
        )}
        {!lectureSeule && voix.erreur && (
          <p role="alert" className="mt-2 text-small text-content-secondary">
            {voix.erreur}
          </p>
        )}

        {!lectureSeule && !verrouille && (
          <button
            type="button"
            onClick={() => onSoumettre({ format: "conversation", messages: messages.map(({ role, contenu }) => ({ role, contenu })) })}
            disabled={echanges === 0 || enCours || chatbot.isPending || correction.isPending || traduction.isPending}
            className="btn-primary mt-4 w-full px-5 py-3 disabled:opacity-50 sm:w-auto"
          >
            {enCours ? libelles.evaluationEnCours : libelleTerminer ?? libelles.terminerDefaut}
          </button>
        )}
      </div>

      <aside
        data-testid="corrections-marge"
        aria-label={libelles.correctionsMarge}
        className="self-start rounded-card border border-primary/15 bg-gradient-to-b from-primary/5 to-surface p-4 shadow-card"
      >
        <h2 className="font-semibold text-primary">{libelles.correctionsMarge}</h2>
        {messages.filter((message) => message.role === "apprenant" && message.corrections?.length).length === 0 ? (
          <p className="mt-2 text-small text-content-secondary">{libelles.correctionsVides}</p>
        ) : (
          <div className="mt-3 space-y-4">
            {messages.map((message, index) =>
              message.role === "apprenant" && message.corrections?.length ? (
                <section key={`${index}-${message.contenu}`} className="border-t border-border/70 pt-3 first:border-0 first:pt-0">
                  <p className="text-small font-medium text-content">{message.contenu}</p>
                  <ul className="mt-2 space-y-3">
                    {message.corrections.map((c) => (
                      <li key={`${c.extrait}-${c.correction}`} className="text-small">
                        <p>
                          <del className="text-error-dark">{c.extrait}</del>{" "}
                          <span aria-hidden>→</span>{" "}
                          <ins className="font-semibold text-success-dark no-underline">{c.correction}</ins>
                        </p>
                        <p className="mt-1 text-content-secondary">{c.explication}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
          </div>
        )}
        {(correction.isPending || traduction.isPending) && (
          <p role="status" className="mt-3 text-small text-content-secondary">
            {libelles.correctionTraductionEnCours}
          </p>
        )}
        {(correction.isError || traduction.isError) && (
          <p role="status" className="mt-2 text-small text-content-secondary">
            {libelles.secondairesIndisponibles}
          </p>
        )}

        {derniereTraduction && (
          <section data-testid="traduction-explication" aria-label="Traduction et explication en français" className="mt-5 border-t border-border/70 pt-4 text-small">
            <p className="font-semibold text-primary">{libelles.traductionFr}</p>
            <p data-testid="traduction-chat" className="mt-1 italic text-content">{derniereTraduction.traduction}</p>
            <p className="mt-3 font-semibold text-primary">{libelles.explication}</p>
            <p data-testid="explication-chat" className="mt-1 text-content-secondary">{derniereTraduction.explication}</p>
          </section>
        )}

        {!lectureSeule && derniereCorrection?.corrections?.length ? (
          <button
            type="button"
            data-testid="exercice-cible"
            onClick={genererExerciceCible}
            disabled={exercice.isPending}
            className="btn-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 disabled:opacity-50"
          >
            <Sparkles size={16} aria-hidden /> {exercice.isPending ? libelles.exerciceEnCours : libelles.genererExercice}
          </button>
        ) : null}
        {!lectureSeule && exerciceCible && (
          <section data-testid="exercice-cible-result" className="mt-3 rounded-card border border-primary/20 bg-primary/5 p-4">
            <p className="font-semibold text-primary">{libelles.exerciceCible} — {exerciceCible.niveau}</p>
            <p lang={langue} className="mt-1">{exerciceCible.enonce}</p>
            <p className="mt-1 text-small text-content-secondary">{exerciceCible.consigne}</p>
            <p className="text-small text-content-secondary">{libelles.descripteur} {exerciceCible.descripteurId}</p>
          </section>
        )}
        {!lectureSeule && exercice.isError && (
          <p role="status" className="mt-2 text-small text-content-secondary">
            {libelles.exerciceIndisponible}
          </p>
        )}
      </aside>
    </div>
  );
}

function Bulle({ message, langue, libelles }: { message: MessageEnChat; langue: string; libelles: ReturnType<typeof libellesChat> }) {
  const assistant = message.role === "assistant";
  return (
    <div className={`flex items-start gap-3 ${assistant ? "" : "flex-row-reverse"}`}>
      <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm ${assistant ? "bg-primary text-white" : "bg-surface text-primary ring-1 ring-border"}`}>
        {assistant ? <Bot size={17} /> : <UserRound size={17} />}
      </span>
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-card ${assistant ? "rounded-tl-sm bg-surface" : "rounded-tr-sm bg-primary text-white"}`}>
        <span className="sr-only">{assistant ? `${libelles.titre} : ` : `${libelles.votreMessage} : `}</span>
        <span lang={langue} className="block leading-relaxed">{message.contenu}</span>
        {assistant && syntheseDisponible() && (
          <button
            type="button"
            onClick={() => lireAVoixHaute(message.contenu, langue)}
            aria-label={libelles.ecouter}
            className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full align-middle text-primary hover:bg-background"
          >
            <Volume2 size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
