"use client";
import { CalendarRange, ChevronDown, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import Alert from "@/components/ui/Alert";
import { useInscriptions } from "@/hooks/useTableauDeBord";
import { getErrorMessage } from "@/lib/api-client";
import { graduations, indicesEtiquettes } from "@/lib/graphique";
import { pluriel } from "@/lib/format";
import { PERIODES_INSCRIPTIONS, type InscriptionsDuJour, type PeriodeInscriptions } from "@/types/tableau-de-bord";
import CarteSection from "./CarteSection";

const HAUTEUR = 220;
const MARGES = { haut: 12, droite: 12, bas: 28, gauche: 36 };

const jourMois = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const jourComplet = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « 2026-10-14 » lu en heure locale (new Date("2026-10-14") serait minuit UTC, donc parfois la veille). */
function lireDate(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(a, m - 1, j);
}

/** Largeur disponible du conteneur, mise à jour quand la fenêtre change de taille. */
function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entree]) => setLargeur(entree.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, largeur };
}

/** Nouvelles inscriptions par jour : une seule courbe, survol avec repère et infobulle. */
export default function CourbeInscriptions() {
  const [jours, setJours] = useState<PeriodeInscriptions>(30);
  const requete = useInscriptions(jours);
  const donnees = requete.data;
  const total = donnees?.reduce((somme, d) => somme + d.nombre, 0) ?? 0;

  return (
    <CarteSection
      titre="Évolution des inscriptions"
      icon={TrendingUp}
      action={
        <label className="relative flex items-center rounded-btn border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <CalendarRange size={16} className="pointer-events-none absolute left-3 text-content-secondary" aria-hidden />
          <select
            aria-label="Période affichée"
            value={jours}
            onChange={(e) => setJours(Number(e.target.value) as PeriodeInscriptions)}
            className="cursor-pointer appearance-none rounded-btn bg-transparent py-2 pl-9 pr-9 text-small text-content focus:outline-none"
          >
            {PERIODES_INSCRIPTIONS.map((p) => (
              <option key={p} value={p}>
                {p} derniers jours
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 text-primary" aria-hidden />
        </label>
      }
    >
      {requete.isError ? (
        <Alert>{getErrorMessage(requete.error)}</Alert>
      ) : !donnees ? (
        <div className="flex items-center justify-center text-content-secondary" style={{ height: HAUTEUR + 32 }}>
          <Loader2 className="animate-spin" aria-label="Chargement des inscriptions" />
        </div>
      ) : donnees.length === 0 ? (
        <p className="flex items-center justify-center text-center text-content-secondary" style={{ height: HAUTEUR + 32 }}>
          Aucune donnée d&apos;inscription pour cette période.
        </p>
      ) : (
        <div aria-busy={requete.isFetching} className={`transition-opacity ${requete.isPlaceholderData ? "opacity-60" : ""}`}>
          <p className="mb-3 text-content-secondary">
            <span className="text-h3 font-bold text-primary">{total}</span> {total > 1 ? "nouveaux comptes" : "nouveau compte"} sur{" "}
            {pluriel(donnees.length, "jour")}
          </p>
          <Courbe donnees={donnees} />
        </div>
      )}
    </CarteSection>
  );
}

/** `donnees` contient au moins un point. */
function Courbe({ donnees }: { donnees: InscriptionsDuJour[] }) {
  const { ref, largeur } = useLargeur<HTMLDivElement>();
  const [survol, setSurvol] = useState<number | null>(null);

  const ticks = graduations(Math.max(...donnees.map((d) => d.nombre)));
  const yMax = ticks[ticks.length - 1];
  const zoneL = Math.max(0, largeur - MARGES.gauche - MARGES.droite);
  const zoneH = HAUTEUR - MARGES.haut - MARGES.bas;
  const x = (i: number) => MARGES.gauche + (donnees.length > 1 ? (i / (donnees.length - 1)) * zoneL : zoneL / 2);
  const y = (v: number) => MARGES.haut + zoneH - (v / yMax) * zoneH;

  const ligne = donnees.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.nombre)}`).join(" ");
  const aire = `${ligne} L${x(donnees.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const dernier = donnees.length - 1;

  function suivre(e: PointerEvent<SVGRectElement>) {
    const gauche = e.currentTarget.getBoundingClientRect().left;
    const ratio = (e.clientX - gauche) / zoneL;
    setSurvol(Math.min(dernier, Math.max(0, Math.round(ratio * dernier))));
  }

  const point = survol === null ? null : donnees[survol];

  return (
    <div ref={ref} className="relative">
      {largeur > 0 && (
        <svg width={largeur} height={HAUTEUR} role="img" aria-label="Courbe des inscriptions par jour (détail dans le tableau qui suit)">
          <defs>
            <linearGradient id="aire-inscriptions" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#013C4A" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#013C4A" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grille et axe vertical, en retrait */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGES.gauche} x2={largeur - MARGES.droite} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray={t ? "3 4" : undefined} />
              <text x={MARGES.gauche - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-content-secondary text-[0.6875rem]">
                {t}
              </text>
            </g>
          ))}
          {indicesEtiquettes(donnees.length).map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HAUTEUR - 8}
              textAnchor={i === 0 ? "start" : i === dernier ? "end" : "middle"}
              className="fill-content-secondary text-[0.6875rem]"
            >
              {jourMois.format(lireDate(donnees[i].date))}
            </text>
          ))}

          <path d={aire} fill="url(#aire-inscriptions)" />
          <path d={ligne} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Dernière valeur toujours marquée ; point survolé avec son repère vertical */}
          <circle cx={x(dernier)} cy={y(donnees[dernier].nombre)} r={4.5} className="fill-primary stroke-surface" strokeWidth={2} />
          {point && survol !== null && (
            <>
              <line x1={x(survol)} x2={x(survol)} y1={MARGES.haut} y2={y(0)} className="stroke-content-secondary" strokeDasharray="2 3" />
              <circle cx={x(survol)} cy={y(point.nombre)} r={5} className="fill-primary stroke-surface" strokeWidth={2} />
            </>
          )}

          {/* Zone de survol plus large que la courbe */}
          <rect
            x={MARGES.gauche}
            y={MARGES.haut}
            width={zoneL}
            height={zoneH}
            fill="transparent"
            onPointerMove={suivre}
            onPointerDown={suivre}
            onPointerLeave={() => setSurvol(null)}
          />
        </svg>
      )}

      {point && survol !== null && (
        <div
          aria-hidden
          // À côté du repère vertical, du côté où il reste de la place, pour ne pas cacher la courbe
          className={`pointer-events-none absolute top-0 whitespace-nowrap rounded-btn bg-primary px-3 py-2 text-small text-white shadow-card ${
            survol > dernier / 2 ? "-translate-x-full" : ""
          }`}
          style={{ left: x(survol) + (survol > dernier / 2 ? -12 : 12) }}
        >
          <span className="block first-letter:uppercase">{jourComplet.format(lireDate(point.date))}</span>
          <span className="font-semibold">{pluriel(point.nombre, "inscription")}</span>
        </div>
      )}

      {/* Mêmes données en tableau, pour les lecteurs d'écran */}
      <table className="sr-only">
        <caption>Inscriptions par jour</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Inscriptions</th>
          </tr>
        </thead>
        <tbody>
          {donnees.map((d) => (
            <tr key={d.date}>
              <td>{jourComplet.format(lireDate(d.date))}</td>
              <td>{d.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
