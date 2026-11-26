"use client";

import { Bot, RotateCcw, UserRound } from "lucide-react";
import { libellesChat } from "@/lib/libellesChat";
import type { MessageChatbot } from "@/types/parcours-personnalise";

/**
 * Synthèse locale d'une conversation terminée. Le backend ne fournit pas de note ni de niveau final pour le chat :
 * ce rapport ne présente donc que des faits observables (tours, langue, scénario, dernier échange). Ses libellés
 * suivent la langue du parcours, comme le reste de la page du tuteur.
 */
export default function RapportConversation({
  messages,
  scenario,
  langue,
  codeLangue,
  onRecommencer,
}: {
  messages: MessageChatbot[];
  scenario: string;
  langue: string;
  codeLangue: string;
  onRecommencer: () => void;
}) {
  const libelles = libellesChat(codeLangue);
  const tours = messages.filter((m) => m.role === "apprenant").length;

  return (
    <section aria-labelledby="titre-rapport-chat" data-testid="rapport-chat" className="card space-y-4">
      <div>
        <p className="eyebrow">{libelles.rapportTermine}</p>
        <h2 id="titre-rapport-chat" className="mt-1 text-h3 text-primary">
          {libelles.rapportTitre}
        </h2>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-btn bg-background p-3">
          <dt className="text-small text-content-secondary">{libelles.rapportScenario}</dt>
          <dd className="font-semibold">{scenario}</dd>
        </div>
        <div className="rounded-btn bg-background p-3">
          <dt className="text-small text-content-secondary">{libelles.rapportLangue}</dt>
          <dd className="font-semibold">{langue}</dd>
        </div>
        <div className="rounded-btn bg-background p-3">
          <dt className="text-small text-content-secondary">{libelles.rapportVosMessages}</dt>
          <dd className="font-semibold">{tours}</dd>
        </div>
      </dl>
      <div>
        <h3 className="font-semibold">{libelles.rapportDernierEchange}</h3>
        <ul className="mt-2 space-y-2">
          {messages.slice(-2).map((message, index) => (
            <li key={index} className="flex items-start gap-2 text-small text-content-secondary">
              {message.role === "assistant" ? (
                <Bot size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              ) : (
                <UserRound size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              )}
              <span>
                <strong className="text-content">{message.role === "assistant" ? libelles.rapportTuteur : libelles.rapportVous}</strong>
                {message.contenu}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p role="note" className="rounded-btn border border-border bg-background p-3 text-small text-content-secondary">
        {libelles.rapportNote}
      </p>
      <button type="button" onClick={onRecommencer} className="btn-primary min-h-11">
        <RotateCcw size={16} aria-hidden /> {libelles.recommencer}
      </button>
    </section>
  );
}
