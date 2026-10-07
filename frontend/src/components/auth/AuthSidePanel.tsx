import Image from "next/image";

/**
 * Visuel de droite commun à tous les écrans d'authentification (masqué sur mobile).
 * Le fond reprend la couleur des bords de hero.jpg pour que l'image s'y fonde sans cadre visible.
 */
export default function AuthSidePanel() {
  return (
    <aside className="hidden flex-col items-center justify-center bg-[#F5FAFA] p-10 text-center lg:flex">
      <Image src="/hero.jpg" alt="" width={900} height={760} priority className="h-auto w-full max-w-md" />
      <p className="eyebrow mt-8">Une approche hybride</p>
      <p className="mt-2 text-h3 text-primary">Le meilleur de l&apos;IA et de l&apos;humain</p>
    </aside>
  );
}
