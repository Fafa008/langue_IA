# Service IA — Centre de Langues IA

Microservice FastAPI interne (`ia-service/`). Le backend reste propriétaire des sessions, du scoring et du contrat
public ; ce service ne fait que produire des estimations pédagogiques (diagnostic linguistique, puis les autres
agents du Harness).

## État

- `GET /health` : squelette de déploiement conservé (healthcheck Docker et CI).
- `app/schemas/` : contrat interne validé par Pydantic (US-151) — enveloppes du Harness, contexte apprenant, résultat
  du diagnostic et erreurs standardisées.

## Contrat des modèles

[`docs/contrat-modeles-ia.md`](docs/contrat-modeles-ia.md) : valeurs autorisées, bornes, cohérences vérifiées,
exemples JSON valides et invalides, politique d'extension aux neuf agents.

Règles principales :

- `extra="forbid"` partout : aucun JSON arbitraire, y compris dans les objets imbriqués ;
- aucune donnée personnelle (ni nom, ni e-mail, ni identifiant d'apprenant) ;
- aucun accès PostgreSQL, aucune décision métier : le service propose, le backend arbitre ;
- les niveaux, langues, compétences et phases proviennent du référentiel existant, jamais d'une valeur inventée.

## Tests

```bash
cd ia-service
pip install -r requirements-dev.txt
pytest --cov=app --cov-report=term-missing
ruff check . && ruff format --check .
```

Les tests n'appellent aucun service externe. Les exemples JSON de `tests/exemples/` sont validés par les tests : un
exemple invalide doit échouer pour la raison documentée.

## Structure

```
app/
├── main.py          # application FastAPI (squelette)
└── schemas/         # modèles Pydantic du contrat interne
tests/
├── exemples/        # charges utiles valides et invalides
└── test_*.py
```

`ia-service/models/` reste réservé aux artefacts ML montés en lecture seule ; il ne contient pas de modèles Pydantic.
