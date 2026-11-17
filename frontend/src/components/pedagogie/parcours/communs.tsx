/* États de chargement et d'erreur, et lien de retour, partagés par les pages du parcours. */
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";

export function Chargement({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-content-secondary">
      <Loader2 size={24} className="animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}

export function ErreurChargement({ message, onReessayer }: { message: string; onReessayer?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-error bg-error/5 p-4">
      <p className="flex items-start gap-2 font-medium text-error-dark">
        <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
        {message}
      </p>
      {onReessayer && (
        <button type="button" onClick={onReessayer} className="btn-secondary mt-3 ml-7 px-4 py-2">
          <RotateCcw size={16} aria-hidden /> Réessayer
        </button>
      )}
    </div>
  );
}

export function LienRetour({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
      <ArrowLeft size={18} aria-hidden /> {children}
    </Link>
  );
}
