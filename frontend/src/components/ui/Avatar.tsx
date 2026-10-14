import { initiales } from "@/lib/saisie";

interface AvatarProps {
  prenom: string;
  nom: string;
  /** Diamètre en pixels. */
  size?: number;
  className?: string;
}

/** Pastille ronde aux initiales de l'utilisateur, sur fond de la couleur principale. */
export default function Avatar({ prenom, nom, size = 40, className = "" }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={`${prenom} ${nom}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-semibold text-white ${className}`}
    >
      {initiales(prenom, nom)}
    </span>
  );
}
