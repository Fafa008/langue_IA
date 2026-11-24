import Image from "next/image";

interface IllustrationBanniereEspaceProps {
  bulleGauche: string;
  bulleDroite: string;
}

export default function IllustrationBanniereEspace({
  bulleGauche,
  bulleDroite,
}: IllustrationBanniereEspaceProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-4 top-1/2 hidden h-52 w-60 -translate-y-1/2 md:block lg:right-8 lg:h-56 lg:w-72"
    >
      <div className="absolute inset-3 overflow-hidden rounded-[40%_60%_55%_45%/50%_45%_55%_50%] bg-gradient-to-br from-primary/20 to-primary/5 shadow-card">
        <Image
          src="/hero.jpg"
          alt=""
          fill
          sizes="(min-width: 1280px) 288px, (min-width: 768px) 240px, 0px"
          className="object-cover object-[50%_35%]"
        />
      </div>
      <span className="absolute left-0 top-8 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card">
        {bulleGauche}
      </span>
      <span className="absolute bottom-7 right-0 rounded-2xl border border-primary/10 bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-card">
        {bulleDroite}
      </span>
    </div>
  );
}
