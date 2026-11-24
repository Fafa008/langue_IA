import Image from "next/image";
import Link from "next/link";
import { LANGUES } from "@/lib/languages";

export default function Languages() {
  return (
    <section id="langues" className="bg-background py-16">
      <div className="container-page text-center">
        <p className="eyebrow">Nos langues</p>
        <h2 className="mt-2">Choisissez la langue qui vous correspond</h2>

        <ul className="mt-10 flex flex-wrap items-start justify-center gap-8 md:gap-14">
          {LANGUES.map((l) => (
            <li key={l.code}>
              <Link href={`/register?lang=${l.code}`} className="group flex flex-col items-center gap-3">
                <Image
                  src={l.flag}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover shadow-card ring-1 ring-border transition-transform group-hover:scale-110"
                />
                <span className="text-base font-semibold text-primary">{l.libelle}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}