import type { ReactNode } from "react";

export interface FieldControlProps {
  id: string;
  invalid: boolean;
  "aria-describedby"?: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  /** Reçoit les props d'accessibilité à transmettre au contrôle (Input, Select…). */
  children: (control: FieldControlProps) => ReactNode;
}

/** Libellé + contrôle + message d'aide ou d'erreur. */
export default function FormField({ id, label, error, hint, className = "", children }: FormFieldProps) {
  const messageId = error || hint ? `${id}-message` : undefined;

  return (
    <div className={`mt-4 ${className}`}>
      <label htmlFor={id} className="mb-1.5 block font-medium text-content">
        {label}
      </label>
      {children({ id, invalid: Boolean(error), "aria-describedby": messageId })}
      {error ? (
        <p id={messageId} className="msg-error mt-1.5">
          {error}
        </p>
      ) : (
        hint && (
          <div id={messageId} className="mt-1.5 text-small text-content-secondary">
            {hint}
          </div>
        )
      )}
    </div>
  );
}
