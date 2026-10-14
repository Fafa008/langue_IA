import type { LucideIcon } from "lucide-react";
import Input, { type InputProps } from "./Input";

/** Champ précédé d'une icône dans une case séparée (maquette du profil). */
export default function IconInput({ icon: Icon, invalid = false, className = "", ...props }: InputProps & { icon: LucideIcon }) {
  return (
    <div
      className={`flex overflow-hidden rounded-btn border bg-surface focus-within:ring-1 ${
        invalid ? "border-error focus-within:ring-error" : "border-border focus-within:border-primary focus-within:ring-primary"
      }`}
    >
      <span className="flex w-14 shrink-0 items-center justify-center border-r border-border text-content" aria-hidden>
        <Icon size={20} />
      </span>
      <Input {...props} invalid={invalid} className={`rounded-none border-0 focus:ring-0 ${className}`} />
    </div>
  );
}
