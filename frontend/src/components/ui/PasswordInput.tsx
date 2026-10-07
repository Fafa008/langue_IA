"use client";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import Input, { type InputProps } from "./Input";

/** Champ mot de passe avec une icône œil pour afficher ou masquer la saisie. */
export default function PasswordInput({ className = "", ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={`pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-controls={props.id}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-2 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-content-secondary transition-colors hover:bg-background hover:text-primary"
      >
        <Icon size={20} aria-hidden />
      </button>
    </div>
  );
}
