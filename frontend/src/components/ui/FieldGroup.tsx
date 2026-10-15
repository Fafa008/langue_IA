import type { ReactNode } from "react";

interface FieldGroupProps {
  id: string;
  legend: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Groupe de cases à cocher / boutons radio avec légende et message d'erreur. */
export default function FieldGroup({ id, legend, hint, error, className = "", children }: FieldGroupProps) {
  const messageId = `${id}-message`;

  return (
    <fieldset
      id={id}
      aria-describedby={error || hint ? messageId : undefined}
      aria-invalid={Boolean(error)}
      className={`mt-4 ${className}`}
    >
      <legend className="mb-1.5 font-medium text-content">{legend}</legend>
      {hint && !error && (
        <p id={messageId} className="-mt-0.5 mb-2 text-small text-content-secondary">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={messageId} className="msg-error mt-1.5">
          {error}
        </p>
      )}
    </fieldset>
  );
}
