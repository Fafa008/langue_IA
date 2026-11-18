"use client";

import { Bot, Send, UserRound, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatbot } from "@/hooks/useParcoursPersonnalise";
import { useReconnaissanceVocale } from "@/hooks/useReconnaissanceVocale";
import { API_MOCK } from "@/lib/env";
import { messageErreurParcours } from "@/lib/parcours-personnalise";
import { lireAVoixHaute, syntheseDisponible } from "@/lib/voix";
import type { ContenuExercice, MessageChatbot, ReponseExercice } from "@/types/parcours-personnalise";
import BoutonMicro from "./BoutonMicro";

/**
 * Conversation avec le professeur IA (chatbot) : l'apprenant répond à l'écrit ou à la voix (dictée),
 * peut faire lire les réponses à voix haute, puis termine l'échange pour le faire évaluer.
 * La conversation n'est gardée que dans l'écran : aucun historique n'est conservé (tâche F-08).
 */
export default function ExerciceConversation({
  contenu,
  langue,
  enCours,
  verrouille,
  onSoumettre,
}: {
  contenu: Extract<ContenuExercice, { format: "conversation" }>;
  langue: string;
  enCours: boolean;
  verrouille: boolean;
  onSoumettre: (reponse: ReponseExercice) => void;
}) {
  const [messages, setMessages] = useState<MessageChatbot[]>([{ role: "assistant", contenu: contenu.messageInitial }]);
  const [brouillon, setBrouillon] = useState("");
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
      { onSuccess: (reponse) => setMessages((liste) => [...liste, { role: "assistant", contenu: reponse }]) },
    );
  };

  return (
    <div>
      <p className="text-small text-content-secondary">
        Sujet : <strong className="text-content">{contenu.sujet}</strong> · {Math.min(echanges, contenu.echangesMinimum)}/
        {contenu.echangesMinimum} échanges
        {API_MOCK && " · professeur IA simulé (démonstration)"}
      </p>

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
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            placeholder={voix.ecoute ? "Je vous écoute…" : "Écrivez ou dictez votre réponse…"}
            maxLength={2000}
            lang={langue}
            className="input"
          />
        </label>
        {voix.disponible && <BoutonMicro ecoute={voix.ecoute} onDemarrer={voix.demarrer} onArreter={voix.arreter} libelle="Dicter" />}
        <button type="submit" disabled={!brouillon.trim() || chatbot.isPending} className="btn-secondary min-h-11 px-4 py-2 disabled:opacity-50">
          <Send size={16} aria-hidden /> Envoyer
        </button>
      </form>
      {voix.erreur && <p role="alert" className="msg-error mt-2">{voix.erreur}</p>}

      {!verrouille && (
        <button
          type="button"
          onClick={() => onSoumettre({ format: "conversation", messages })}
          disabled={echanges === 0 || enCours || chatbot.isPending}
          className="btn-primary mt-4 px-5 py-2.5 disabled:opacity-50"
        >
          {enCours ? "Évaluation en cours…" : "Terminer et évaluer la conversation"}
        </button>
      )}
    </div>
  );
}

function Bulle({ message, langue }: { message: MessageChatbot; langue: string }) {
  const assistant = message.role === "assistant";
  return (
    <div className={`flex items-end gap-2 ${assistant ? "" : "flex-row-reverse"}`}>
      <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${assistant ? "bg-primary text-white" : "bg-surface text-primary ring-1 ring-border"}`}>
        {assistant ? <Bot size={16} /> : <UserRound size={16} />}
      </span>
      <div className={`max-w-[80%] rounded-card px-3 py-2 ${assistant ? "bg-surface shadow-card" : "bg-primary text-white"}`}>
        <span className="sr-only">{assistant ? "Professeur IA : " : "Vous : "}</span>
        <span lang={langue}>{message.contenu}</span>
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
