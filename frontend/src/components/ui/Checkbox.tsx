import type { InputHTMLAttributes, ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: ReactNode;
  error?: string;
}

export default function Checkbox({ id, label, error, className = "", ...props }: CheckboxProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-[0.8125rem] text-content-secondary">
        <input
          {...props}
          id={id}
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="msg-error mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
