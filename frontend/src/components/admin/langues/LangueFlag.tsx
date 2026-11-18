import Image from "next/image";
import { drapeauLangue } from "@/lib/languages";

/** Drapeau rond de la langue ; à défaut (langue ajoutée par l'administrateur), son code. */
export default function LangueFlag({ code, size = 36 }: { code: string; size?: number }) {
  const drapeau = drapeauLangue(code);
  if (drapeau) {
    return <Image src={drapeau} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover ring-1 ring-border" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-small font-semibold text-primary"
    >
      {code.toUpperCase()}
    </span>
  );
}
