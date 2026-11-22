"use client";

import { Bot, Send, UserRound, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatbot } from "@/hooks/useParcoursPersonnalise";
import { useReconnaissanceVocale } from "@/hooks/useReconnaissanceVocale";
import { PARCOURS_MOCK } from "@/lib/env";
import { messageErreurParcours } from "@/lib/parcours-personnalise";
import { lireAVoixHaute, syntheseDisponible } from "@/lib/voix";
import type { ContenuExercice, CorrectionChatbot, MessageChatbot, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonMicro from "./BoutonMicro";

/** Message affiché : un message de l'apprenant peut porter les corrections renvoyées par le backend (US74-FE). */
type MessageEnChat = MessageChatbot & { corrections?: CorrectionChatbot[] };

/**
 * Conversation avec le professeur IA (chatbot) : l'apprenant répond à l'écrit ou à la voix (dictée),
 * peut faire lire les réponses à voix haute, puis termine l'échange pour le faire évaluer.
 * L'historique est conservé par le backend pendant la session et supprimé à sa fin (D2).
 */
export default function ExerciceConversation({
  contenu,
  langue,
  enCours,
  verrouille,
  onSoumettre,
  libelleTerminer,
}: {
  contenu: Extract<ContenuExercice, { format: "conversation" }>;
  langue: string;
  enCours: boolean;
  verrouille: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
  libelleTerminer?: string;
}) {
  const [messages, setMessages] = useState<MessageEnChat[]>([{ role: "assistant", contenu: contenu.messageInitial }]);
  const [brouillon, setBrouillon] = useState("");
  const [quotaRestant, setQuotaRestant] = useState<number | null>(null);
  const chatbot = useChatbot();
  const voix = useReconnaissanceVocale(langue);
  const finRef = useRef<HTMLDivElement>(null);
  const echanges = messages.filter((m) => m.role === "apprenant").length;

  // La dictée remplit la zone de saisie ; l'apprenant relit avant d'envoyer
  useEffect(() => {
    if (voix.transcription) setBrouillon(voix.transcription);
  }, [voix.transcription]);

  useEffect(() => {
    finRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [messages, chatbot.isPending]);

  const envoyer = () => {
    const message = brouillon.trim();
    if (!message || chatbot.isPending) return;
    const historique = messages;
    setMessages([...historique, { role: "apprenant", contenu: message }]);
    setBrouillon("");
    chatbot.mutate(
      { message, historique },
      {
        onSuccess: (reponse) => {
          setQuotaRestant(reponse.quotaRestant);
          setMessages((liste) => [
            ...liste.map((tour, index) =>
              index === liste.length - 1 && reponse.corrections.length > 0
                ? { ...tour, corrections: reponse.corrections }
                : tour,
            ),
            { role: "assistant", contenu: reponse.reponse },
          ]);
        },
      },
    );
  };

  return (
    <div>
      <p className="text-small text-content-secondary">
        Sujet : <strong className="text-content">{contenu.sujet}</strong> · {Math.min(echanges, contenu.echangesMinimum)}/
        {contenu.echangesMinimum} échanges
        {PARCOURS_MOCK && " · professeur IA simulé (démonstration)"}
      </p>
      {quotaRestant !== null && (
        <p role="status" data-testid="quota-chat" className="mt-1 text-small text-content-secondary">
          Messages restants dans cette session : {quotaRestant}
          {quotaRestant === 0 ? " — terminez et recommencez une conversation." : ""}
        </p>
      )}

      <div role="log" aria-live="polite" aria-label="Conversation avec le professeur IA" className="mt-3 max-h-80 space-y-3 overflow-y-auto rounded-card bg-background p-3">
        {messages.map((message, index) => (
          <Bulle key={index} message={message} langue={langue} />
        ))}
        {chatbot.isPending && <p className="text-small text-content-secondary">Le professeur IA écrit…</p>}
        <div ref={finRef} />
      </div>
      {chatbot.isError && (
        <p role="alert" className="msg-error mt-2">
          {messageErreurParcours(chatbot.error, "La réponse du professeur IA")}
        </p>
      )}

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <label className="min-w-0 flex-1 basis-56">
          <span className="sr-only">Votre message</span>
          <input
            type="text"
            disabled={quotaRestant === 0}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            placeholder={voix.ecoute ? "Je vous écoute…" : "Écrivez ou dictez votre réponse…"}
            maxLength={2000}
            lang={langue}
            className="input"
          />
        </label>
        {voix.disponible && <BoutonMicro ecoute={voix.ecoute} onDemarrer={voix.demarrer} onArreter={voix.arreter} libelle="Dicter" />}
        <button type="submit" disabled={!brouillon.trim() || chatbot.isPending || quotaRestant === 0} className="btn-secondary min-h-11 px-4 py-2 disabled:opacity-50">
          <Send size={16} aria-hidden /> Envoyer
        </button>
      </form>
      {!voix.disponible && (
        <p role="note" className="mt-2 text-small text-content-secondary">
          Dictée indisponible dans ce navigateur : le mode écrit de secours reste actif.
        </p>
      )}
      {voix.erreur && (
        <p role="alert" className="mt-2 text-small text-content-secondary">
          {voix.erreur} Le mode écrit reste disponible.
        </p>
      )}

      {!verrouille && (
        <button
          type="button"
          onClick={() => onSoumettre({ format: "conversation", messages: messages.map(({ role, contenu }) => ({ role, contenu })) })}
          disabled={echanges === 0 || enCours || chatbot.isPending}
          className="btn-primary mt-4 px-5 py-2.5 disabled:opacity-50"
        >
          {enCours ? "Évaluation en cours…" : libelleTerminer ?? "Terminer et évaluer la conversation"}
        </button>
      )}
    </div>
  );
}

function Bulle({ message, langue }: { message: MessageEnChat; langue: string }) {
  const assistant = message.role === "assistant";
  return (
    <div className={`flex items-end gap-2 ${assistant ? "" : "flex-row-reverse"}`}>
      <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${assistant ? "bg-primary text-white" : "bg-surface text-primary ring-1 ring-border"}`}>
        {assistant ? <Bot size={16} /> : <UserRound size={16} />}
      </span>
      <div className={`max-w-[80%] rounded-card px-3 py-2 ${assistant ? "bg-surface shadow-card" : "bg-primary text-white"}`}>
        <span className="sr-only">{assistant ? "Professeur IA : " : "Vous : "}</span>
        <span lang={langue}>{message.contenu}</span>
        {message.corrections && message.corrections.length > 0 && (
          <div data-testid="corrections-marge" className="mt-2 space-y-1 border-l-2 border-warning pl-2 text-small text-content">
            <p className="font-semibold text-warning-dark">Corrections en marge</p>
            <ul aria-label="Corrections du message">
              {message.corrections.map((c) => (
                <li key={c.extrait}>
                  <del className="text-error-dark">{c.extrait}</del> → <ins className="font-semibold text-success-dark no-underline">{c.correction}</ins>
                  <span className="block text-content-secondary">{c.explication}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {assistant && syntheseDisponible() && (
          <button
            type="button"
            onClick={() => lireAVoixHaute(message.contenu, langue)}
            aria-label="Écouter ce message"
            className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full align-middle text-primary hover:bg-background"
          >
            <Volume2 size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
