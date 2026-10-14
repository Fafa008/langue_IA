"use client";
import { useState } from "react";
import { initiales } from "@/lib/saisie";

interface AvatarProps {
  prenom: string;
  nom: string;
  /** Photo de profil ; absente, ou si elle ne se charge pas : les initiales sont affichées. */
  photoUrl?: string | null;
  /** Diamètre en pixels. */
  size?: number;
  className?: string;
}

/** Photo ronde de l'utilisateur, ou pastille à ses initiales sur fond de la couleur principale. */
export default function Avatar({ prenom, nom, photoUrl, size = 40, className = "" }: AvatarProps) {
  // Adresse de la photo qui n'a pas pu être chargée (lien cassé, fichier supprimé…)
  const [photoEnErreur, setPhotoEnErreur] = useState<string | null>(null);
  const nomComplet = `${prenom} ${nom}`;

  if (photoUrl && photoUrl !== photoEnErreur) {
    return (
      // <img> et non next/image : la photo peut venir du backend, d'un aperçu local (blob:) ou d'une data URL
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={nomComplet}
        width={size}
        height={size}
        onError={() => setPhotoEnErreur(photoUrl)}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full bg-background object-cover ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={nomComplet}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-semibold text-white ${className}`}
    >
      {initiales(prenom, nom)}
    </span>
  );
}
