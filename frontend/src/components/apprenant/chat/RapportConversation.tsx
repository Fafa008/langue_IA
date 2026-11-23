"use client";

import { Bot, RotateCcw, UserRound } from "lucide-react";
import type { MessageChatbot } from "@/types/parcours-personnalise";

/**
 * Synthèse locale d'une conversation terminée. Le backend ne fournit pas de note ni de niveau final pour le chat :
 * ce rapport ne présente donc que des faits observables (tours, langue, scénario, dernier échange).
 */
export default function RapportConversation({
  messages,
  scenario,
  langue,
  onRecommencer,
}: {
  messages: MessageChatbot[];
  scenario: string;
  langue: string;
  onRecommencer: () => void;
}) {
  const tours = messages.filter((m) => m.role === "apprenant").length;

  return (
    <section aria-labelledby="titre-rapport-chat" data-testid="rapport-chat" className="card space-y-4">
      <div>
        <p className="eyebrow">Conversation terminée</p>
        <h2 id="titre-rapport-chat" className="mt-1 text-h3 text-primary">
          Votre synthèse
        </h2>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-btn bg-background p-3">
          <dt className="text-small text-content-secondary">Scénario</dt>
          <dd className="font-semibold">{scenario}</dd>
        </div>
        <div className="rounded-btn bg-background p-3">
          <dt className="text-small text-content-secondary">Langue</dt>
          <dd className="font-semibold">{langue}</dd>
        </div>
        <div className="rounded-btn bg-background p-3">
          <dt className="text-small text-content-secondary">Vos messages</dt>
          <dd className="font-semibold">{tours}</dd>
        </div>
      </dl>
      <div>
        <h3 className="font-semibold">Dernier échange</h3>
        <ul className="mt-2 space-y-2">
          {messages.slice(-2).map((message, index) => (
            <li key={index} className="flex items-start gap-2 text-small text-content-secondary">
              {message.role === "assistant" ? (
                <Bot size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              ) : (
                <UserRound size={16} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              )}
              <span>
                <strong className="text-content">{message.role === "assistant" ? "Tuteur IA : " : "Vous : "}</strong>
                {message.contenu}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p role="note" className="rounded-btn border border-border bg-background p-3 text-small text-content-secondary">
        Synthèse indicative : aucun score ni niveau n&apos;est attribué pour une conversation libre. Les corrections,
        traductions et explications affichées pendant l&apos;échange restent disponibles dans la conversation.
      </p>
      <button type="button" onClick={onRecommencer} className="btn-primary min-h-11">
        <RotateCcw size={16} aria-hidden /> Recommencer une conversation
      </button>
    </section>
  );
}
