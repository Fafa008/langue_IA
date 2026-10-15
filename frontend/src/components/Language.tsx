import Image from "next/image";

const langs = [
  { name: "Français", flag: "/flags/fr.jpg" },
  { name: "Anglais", flag: "/flags/gb.jpg" },
  { name: "Mandarin", flag: "/flags/cn.jpg" },
  { name: "Italien", flag: "/flags/it.jpg" },
  { name: "Allemand", flag: "/flags/de.jpg" },
];

export default function Languages() {
  return (
    <section id="langues" className="bg-background py-16">
      <div className="container-page text-center">
        <p className="eyebrow">Nos langues</p>
        <h2 className="mt-2">Choisissez la langue qui vous correspond</h2>

        <ul className="mt-10 flex flex-wrap items-start justify-center gap-8 md:gap-14">
          {langs.map((l) => (
            <li key={l.name}>
              <button className="group flex flex-col items-center gap-3">
                <Image
                  src={l.flag}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover shadow-card ring-1 ring-border transition-transform group-hover:scale-110"
                />
                <span className="text-base font-semibold text-primary">{l.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}