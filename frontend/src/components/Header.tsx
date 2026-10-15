"use client";
import { useState } from "react";
import Link from "next/link";
import {  Menu, X } from "lucide-react";
import Image from "next/image";


const links = [
  { label: "Accueil", href: "/" },
  { label: "À propos", href: "#apropos" },
  { label: "Langues", href: "#langues" },
  { label: "Ateliers", href: "#ateliers" },
  { label: "Contact", href: "#contact" },
];


export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/logo.jpg"
        alt="Digithèque"
        width={200}
        height={48}
        priority
        className="h-10 w-auto md:h-12"
      />
      <span className={`text-xl font-bold ${light ? "text-white" : "text-primary"}`}>
        Digithèque
      </span>
    </Link>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur">
      <div className="container-page flex h-20 items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l, i) => (
            <Link
              key={l.label}
              href={l.href}
              className={`py-2 text-body font-medium ${
                i === 0
                  ? "border-b-2 border-primary text-primary"
                  : "text-content hover:text-primary"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="btn-secondary">Se connecter</Link>
          <Link href="/register" className="btn-primary">S&apos;inscrire</Link>
        </div>

        <button
          className="lg:hidden"
          aria-label="Menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-surface lg:hidden">
          <nav className="container-page flex flex-col gap-4 py-4">
            {links.map((l) => (
              <Link key={l.label} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/login" className="btn-secondary">Se connecter</Link>
            <Link href="/register" className="btn-primary">S&apos;inscrire</Link>
          </nav>
        </div>
      )}
    </header>
  );
}