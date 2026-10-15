import Link from "next/link";
import { Logo } from "./Header";

export default function Footer() {
  return (
    <footer id="contact" className="bg-primary text-white">
      <div className="container-page flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-10">
          <Logo light />
          <p className="text-small leading-snug">
            Apprendre aujourd&apos;hui,
            <br />
            réussir demain.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <nav className="flex gap-6 text-small">
            <Link href="#apropos" className="hover:underline">À propos</Link>
            <Link href="/faq" className="hover:underline">FAQ</Link>
            <Link href="#contact" className="hover:underline">Contact</Link>
          </nav>
          <p className="text-small text-white/70">
            © 2025 Digithèque. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}