import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  placeholder?: string;
  options: { value: string; label: string }[];
}

export default function Select({ invalid = false, placeholder, options, className = "", ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...props}
        aria-invalid={invalid}
        className={`input appearance-none pr-10 disabled:cursor-wait disabled:opacity-60 ${
          invalid ? "input-error" : ""
        } ${props.value ? "" : "text-content-secondary"} ${className}`}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-content">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 my-auto text-primary"
      />
    </div>
  );
}
