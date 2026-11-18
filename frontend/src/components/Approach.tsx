import { Bot, User } from "lucide-react";

const cards = [
  {
    icon: Bot,
    title: "Intelligence Artificielle",
    text: "Des outils intelligents pour un apprentissage personnalisé, interactif et motivant.",
  },
  {
    icon: User,
    title: "Formateurs experts",
    text: "Des professionnels à votre écoute pour vous accompagner dans votre progression.",
  },
];

export default function Approach() {
  return (
    <section id="apropos" className="bg-surface py-16">
      <div className="container-page text-center">
        <p className="eyebrow">Une approche hybride</p>
        <h2 className="mt-2">Le meilleur de l&apos;IA et de l&apos;humain</h2>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
          {cards.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex items-center gap-5 rounded-card border border-[#D6E9E9] bg-[#EEF7F7] p-6 text-left"
            >
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#D9EEEE] text-primary">
                <Icon size={36} />
              </span>
              <div>
                <h3 className="text-primary">{title}</h3>
                <p className="mt-2 text-content-secondary">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}