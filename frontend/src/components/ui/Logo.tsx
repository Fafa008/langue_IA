import Image from "next/image";
import Link from "next/link";
import { LOGO, NOM_PLATEFORME } from "@/lib/marque";
import { ROUTES } from "@/lib/routes";

/**
 * Logo rond : l'image (horizontale) est affichée entière, centrée dans un cercle blanc,
 * lisible sur fond clair comme sur fond foncé. La taille du cercle se règle avec `className`.
 */
export function ImageLogo({ className = "h-10 w-10 md:h-12 md:w-12", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-card ring-2 ring-primary/15 ${className}`}>
      <Image
        src={LOGO.src}
        alt="" // le nom est déjà écrit à côté
        width={LOGO.largeur}
        height={LOGO.hauteur}
        priority={priority}
        className="h-auto w-full object-contain"
      />
    </span>
  );
}

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href={ROUTES.home} className="flex items-center gap-3">
      <ImageLogo priority />
      <span className={`text-xl font-bold ${light ? "text-white" : "text-primary"}`}>{NOM_PLATEFORME}</span>
    </Link>
  );
}
