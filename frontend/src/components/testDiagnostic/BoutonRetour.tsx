import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BoutonRetourProps = { libelle?: string; disabled?: boolean } & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

const CLASSES =
  "mb-4 inline-flex items-center gap-2 text-small font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60";

/** Lien « Retour » affiché en haut de chaque étape du test. */
export default function BoutonRetour({ libelle = "Retour", disabled = false, href, onClick }: BoutonRetourProps) {
  const contenu = (
    <>
      <ArrowLeft size={18} aria-hidden="true" />
      {libelle}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} data-testid="test-back" className={CLASSES}>
        {contenu}
      </Link>
    );
  }
  return (
    <button type="button" data-testid="test-back" className={CLASSES} disabled={disabled} onClick={onClick}>
      {contenu}
    </button>
  );
}
