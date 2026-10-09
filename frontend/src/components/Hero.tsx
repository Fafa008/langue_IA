import { ArrowRight, Bot, Languages, Monitor, Cpu, Users } from "lucide-react";
import Link from "next/link";

const features = [
  { icon: Cpu, title: "IA personnalisée", sub: "à votre rythme" },
  { icon: Monitor, title: "Ateliers en présentiel", sub: "et en ligne" },
  { icon: Users, title: "Formateurs experts", sub: "et bienveillants" },
];

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-[#EEF6F6] to-background">
      <div className="container-page grid items-center gap-10 py-12 md:py-20 lg:grid-cols-2">
        {/* Texte */}
        <div>
          <p className="eyebrow mb-4">Centre hybride d&apos;apprentissage des langues</p>
          <h1 className="text-[2rem] leading-tight md:text-5xl md:leading-[1.15]">
            Apprenez une langue autrement
          </h1>
          <p className="mt-6 max-w-lg text-base text-content md:text-lg">
            Une expérience d&apos;apprentissage moderne et hybride, alliant
            l&apos;intelligence artificielle et l&apos;accompagnement de formateurs
            passionnés.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary">
              Commencer maintenant <ArrowRight size={18} />
            </Link>
            <Link href="#apropos" className="btn-secondary">
              Découvrir le centre
            </Link>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, sub }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E3F0F0] text-primary">
                  <Icon size={18} />
                </span>
                <span className="text-small leading-snug text-content-secondary">
                  {title}
                  <br />
                  {sub}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Visuel */}
        <div className="relative mx-auto w-full max-w-xl">
          <div className="aspect-[4/3] overflow-hidden rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-gradient-to-br from-[#BFDDDD] to-[#7FB5B5]">
            <img src="/hero.jpg" alt="" className="h-full w-full object-cover" />
          </div>

          <div className="absolute left-[8%] top-[22%] flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white shadow-card">
            <Languages size={28} />
          </div>
          <div className="absolute right-[18%] top-[6%] rounded-2xl bg-primary px-5 py-2 text-lg font-semibold text-white shadow-card">
            Hello!
          </div>
          <div className="absolute bottom-[14%] right-[2%] flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-card">
            <Bot size={32} />
          </div>
        </div>
      </div>
    </section>
  );
}