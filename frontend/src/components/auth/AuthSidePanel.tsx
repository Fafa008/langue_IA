import Image from "next/image";

/** Visuel de droite commun à tous les écrans d'authentification (masqué sur mobile). */
export default function AuthSidePanel() {
  return (
    <aside className="hidden flex-col items-center justify-center bg-gradient-to-br from-[#E6F1F1] to-[#F5F9FA] p-10 text-center lg:flex">
      <Image src="/hero.jpg" alt="" width={480} height={360} priority className="h-auto w-full max-w-md" />
      <p className="eyebrow mt-8">Une approche hybride</p>
      <p className="mt-2 text-h3 text-primary">Le meilleur de l&apos;IA et de l&apos;humain</p>
    </aside>
  );
}
