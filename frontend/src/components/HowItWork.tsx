import { ArrowRight, User, FileText, GraduationCap, Calendar } from "lucide-react";
import { Fragment } from "react";

const steps = [
  { icon: User, title: "Inscription", text: "Créez votre compte en quelques minutes." },
  { icon: FileText, title: "Diagnostic", text: "Évaluez votre niveau et vos objectifs." },
  { icon: GraduationCap, title: "Parcours personnalisé", text: "Suivez des contenus adaptés à votre profil." },
  { icon: Calendar, title: "Ateliers", text: "Progressez avec des ateliers et des formateurs." },
];

export default function HowItWorks() {
  return (
    <section id="ateliers" className="bg-surface py-16">
      <div className="container-page text-center">
        <p className="eyebrow">Comment ça fonctionne ?</p>
        <h2 className="mt-2">Un parcours simple et efficace</h2>

        <div className="mt-10 flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <Fragment key={title}>
              <div className="flex max-w-[200px] flex-col items-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E3F0F0] text-primary">
                  <Icon size={26} />
                </span>
                <p className="mt-4 text-base font-semibold text-primary">
                  <span className="mr-2">{i + 1}</span>
                  {title}
                </p>
                <p className="mt-1 text-small text-content-secondary">{text}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="mt-5 hidden shrink-0 text-border md:block" />
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}