export default function LevelScale({ niveau, niveaux }: { niveau: string; niveaux: string[] }) {
  return (
    <div data-testid="level-scale" data-level={niveau} className="my-5">
      <p className="mb-2 text-small text-content-secondary">Niveau de la question</p>
      <ol className="flex flex-wrap gap-2">
        {niveaux.map((n) => (
          <li
            key={n}
            aria-current={n === niveau ? "step" : undefined}
            className={`min-w-[3rem] flex-1 rounded-btn py-1 text-center text-small font-semibold ${
              n === niveau ? "bg-primary text-white" : "bg-border text-content-secondary"
            }`}
          >
            {n}
          </li>
        ))}
      </ol>
    </div>
  );
}