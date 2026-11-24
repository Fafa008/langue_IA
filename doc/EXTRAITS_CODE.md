# Extraits de code pour le mémoire

**Projet** : Digithèque / Centre Langues IA
**Dépôt** : `Fafa008/langue_IA`, branche `develop`
**Commit** : `2f4d0c6`
**Limite** : 40 lignes par extrait (le modèle d'origine de ce fichier n'a pas été retrouvé dans le dépôt ; limite retenue par défaut, à ajuster si le modèle en prévoit une autre).

Les extraits sont copiés à l'identique depuis le commit indiqué : aucune ligne n'a été modifiée, reformatée ni commentée. Les commentaires présents dans le code sont ceux du dépôt. Aucun extrait ne contient de secret.

---

## E1 : Modèle SQLAlchemy : tentative de diagnostic d'un apprenant

- **Fichier** : `backend/app/models/diagnostic.py`
- **Lignes** : 23 à 50 (28 lignes, limite 40)
- **Rôle** : Déclare la table `test_diagnostic` : une tentative d'un apprenant sur une langue et un niveau, avec statut, dates de début et de fin, score limité à l'intervalle 0–100 par une contrainte `CHECK`, niveau final, analyse IA stockée en JSONB, et les relations vers l'apprenant, la langue, les niveaux et les réponses (supprimées en cascade avec la tentative).
- **Découpage** : Classe `TestDiagnostic` complète. La classe suivante du même fichier (`Reponse`, ligne 53) n'est pas reprise.

```python
class TestDiagnostic(Base):
    __tablename__ = "test_diagnostic"
    __table_args__ = (
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="ck_test_diagnostic_score"),
    )

    id_test: Mapped[int] = mapped_column(primary_key=True)
    id_apprenant: Mapped[int] = mapped_column(ForeignKey("apprenant.id_user", ondelete="CASCADE"), index=True)
    id_langue: Mapped[int] = mapped_column(ForeignKey("langue.id_langue", ondelete="RESTRICT"))
    id_niveau: Mapped[int] = mapped_column(ForeignKey("niveau.id_niveau", ondelete="RESTRICT"))
    statut: Mapped[StatutDiagnostic] = mapped_column(EnumEntier(StatutDiagnostic), default=StatutDiagnostic.EN_COURS)
    date_debut: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    date_fin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Pourcentage déterministe sur 100, calculé à la clôture du test.
    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    # Niveau de référence estimé à l'issue du diagnostic.
    id_niveau_final: Mapped[int | None] = mapped_column(ForeignKey("niveau.id_niveau", ondelete="RESTRICT"))
    # Enveloppe validée de l'agent Diagnostic (PRE-05) ; null tant que l'analyse n'a pas abouti.
    analyse_ia: Mapped[dict | None] = mapped_column(JSONB)

    apprenant: Mapped["Apprenant"] = relationship()  # noqa: F821
    langue: Mapped[Langue] = relationship()
    niveau: Mapped[Niveau] = relationship(foreign_keys=[id_niveau])
    niveau_final: Mapped[Niveau | None] = relationship(foreign_keys=[id_niveau_final])
    # Supprimées avec la tentative ; les réponses d'un apprenant supprimé partent donc en cascade
    reponses: Mapped[list["Reponse"]] = relationship(
        back_populates="tentative", cascade="all, delete-orphan", order_by="Reponse.id_reponse"
    )
```

---

## E2 : Migration Alembic : création de la table `test_diagnostic`

- **Fichier** : `backend/alembic/versions/20261021_bd6763f7f861_tables_du_diagnostic.py`
- **Lignes** : 17 à 51 (35 lignes, limite 40)
- **Rôle** : Déclare la révision `bd6763f7f861` (précédente : `20261020_rbac`) et, dans `upgrade()`, crée la table `question` puis la table `test_diagnostic` avec ses clés étrangères, sa clé primaire et un index sur `id_apprenant`.
- **Découpage** : Lignes 17 à 51 : identifiants de révision et début de `upgrade()` jusqu'à l'index de `test_diagnostic`. La création de la table `reponse` (lignes 52 à 64) et `downgrade()` (lignes 67 à 72) ne sont pas repris. À noter : cette migration crée `test_diagnostic` **sans** les colonnes `score` et `analyse_ia` présentes dans le modèle E1 ; elles sont ajoutées plus tard par `backend/alembic/versions/20261027_diagnostic_scoring.py` (colonne `score` ligne 22, contrainte `ck_test_diagnostic_score` ligne 24) et `backend/alembic/versions/20261110_diagnostic_analyse_ia.py` (colonne `analyse_ia` ligne 18).

```python
revision: str = "bd6763f7f861"
down_revision: str | None = "20261020_rbac"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "question",
        sa.Column("id_question", sa.Integer(), nullable=False),
        sa.Column("enonce", sa.Text(), nullable=False),
        sa.Column("competence", sa.String(length=50), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_question"),
    )
    op.create_table(
        "test_diagnostic",
        sa.Column("id_test", sa.Integer(), nullable=False),
        sa.Column("id_apprenant", sa.Integer(), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.Column("statut", sa.SmallInteger(), nullable=False),
        sa.Column("date_debut", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("date_fin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id_niveau_final", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["id_apprenant"], ["apprenant.id_user"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau_final"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id_test"),
    )
    op.create_index(op.f("ix_test_diagnostic_id_apprenant"), "test_diagnostic", ["id_apprenant"], unique=False)
```

---

## E3 : Client du service IA côté backend

- **Fichier** : `backend/app/services/ia.py`
- **Lignes** : 62 à 92 (31 lignes, limite 40)
- **Rôle** : Envoie en POST une requête au service IA (URL configurée, corps JSON sans les valeurs nulles), ajoute l'en-tête `X-IA-Token` lorsque le jeton interne est configuré, applique le délai `ia_service_timeout_s`, n'accepte que le statut HTTP 200 puis valide la réponse avec le modèle attendu, et lève `ErreurServiceIA` avec un code court (`non_configure`, `timeout`, `indisponible`, `http_<statut>`, `reponse_invalide`) dans tous les autres cas.
- **Découpage** : Fonction `_poster`, utilisée par toutes les fonctions d'appel du fichier (par exemple `evaluer_diagnostic`, lignes 95 à 104). La classe d'erreur dédiée `ErreurServiceIA` est définie juste avant, lignes 50 à 59 (classe et fonction ensemble : 43 lignes, au-delà de la limite). Le jeton n'est envoyé que s'il est renseigné (ligne 71).

```python
def _poster(chemin: str, requete: BaseModel, modele: type[T], transport: httpx.BaseTransport | None) -> T:
    """Appeler une route du service IA et valider son enveloppe de succès ; toute autre issue lève une erreur."""
    settings = get_settings()
    base = settings.ia_service_url.strip()
    if not base:
        raise ErreurServiceIA("non_configure")

    entetes: dict[str, str] = {}
    jeton = settings.ia_service_token.strip()
    if jeton:
        entetes["X-IA-Token"] = jeton

    try:
        with httpx.Client(timeout=settings.ia_service_timeout_s, transport=transport) as client:
            reponse = client.post(
                f"{base.rstrip('/')}{chemin}",
                json=requete.model_dump(mode="json", exclude_none=True),
                headers=entetes or None,
            )
    except httpx.TimeoutException:
        raise ErreurServiceIA("timeout") from None
    except httpx.HTTPError:
        raise ErreurServiceIA("indisponible") from None

    if reponse.status_code != 200:
        raise ErreurServiceIA(f"http_{reponse.status_code}")

    try:
        return modele.model_validate(reponse.json())
    except (ValueError, ValidationError):
        raise ErreurServiceIA("reponse_invalide") from None
```

---

## E4 : Exécution d'un agent dans le Harness

- **Fichier** : `ia-service/app/harness/execution.py`
- **Lignes** : 77 à 115 (39 lignes, limite 40)
- **Rôle** : Résout la définition de l'agent dans le registre à partir du code et de la version, valide l'entrée avec le schéma de l'agent, construit le contexte d'exécution et ses outils partagés, exécute l'agent dans son budget de temps, puis valide le résultat avec le schéma de sortie ; chaque échec est renvoyé sous forme de `ReponseErreur` codée (`AGENT_INCONNU`, `ENTREE_INVALIDE`, `LLM_TIMEOUT`, `LLM_REPONSE_INVALIDE` ou code déduit de l'exception).
- **Découpage** : Extrait de la méthode `Harness.executer` (lignes 61 à 134, 74 lignes). La variable `version_demandee` utilisée ligne 78 est calculée ligne 75 (`version_agent or requete.version_agent`). La construction de l'enveloppe de succès avec ses métadonnées (lignes 117 à 134) n'est pas reprise.

```python
        try:
            definition = self._registre.resoudre(code_agent, version_demandee)
        except ErreurAgentInconnu:
            return self._erreur(requete, agent_affiche, CodeErreur.AGENT_INCONNU)

        try:
            entree = definition.schema_entree.model_validate(requete.entree)
        except ValidationError:
            return self._erreur(requete, agent_affiche, CodeErreur.ENTREE_INVALIDE)

        outils = OutilsCommuns(
            client_llm=self._client_llm,
            registre_prompts=self._registre_prompts,
            recuperateur_rag=self._recuperateur_rag,
            horloge=self._horloge,
            memoire=self._memoire,
        )
        contexte = ContexteExecution(
            request_id=requete.request_id,
            contexte=requete.contexte,
            outils=outils,
            signalement=SignalementRAG(),
        )
        debut = self._horloge()

        try:
            async with asyncio.timeout(definition.budget_ms / 1000):
                resultat_brut = await definition.executer(entree, contexte)
        except TimeoutError:
            return self._erreur(requete, agent_affiche, CodeErreur.LLM_TIMEOUT)
        except Exception as exception:
            code = self._code_pour(exception)
            self._journaliser(exception, code, definition.code, requete.request_id)
            return self._erreur(requete, agent_affiche, code)

        try:
            resultat = definition.schema_sortie.model_validate(resultat_brut)
        except ValidationError:
            return self._erreur(requete, agent_affiche, CodeErreur.LLM_REPONSE_INVALIDE)
```

---

## E5 : Registre des prompts : chargement d'un prompt versionné et empreinte SHA-256

- **Fichier** : `ia-service/app/prompts/registre.py`
- **Lignes** : 435 à 461 (27 lignes, limite 40)
- **Rôle** : Lit les trois fichiers versionnés du prompt de diagnostic (`evaluation@<version>.systeme.md`, `.utilisateur.md` et `.jsonl` des exemples), valide le gabarit et les exemples, calcule une empreinte SHA-256 sur la concaténation des trois textes séparés par un octet nul, et retourne la définition du prompt avec sa version (`diagnostic/evaluation@…`) et son empreinte au format `sha256:<hex>`.
- **Découpage** : Méthode `RegistrePrompts._charger_evaluation_diagnostic`. La version chargée est `VERSION_EVALUATION_DIAGNOSTIC = "1.1.0"` (ligne 26). Les autres prompts sont chargés par des méthodes analogues (lignes 417 à 629) et déclarés dans le constructeur de la classe `RegistrePrompts` (lignes 104 à 140) ; la lecture des fichiers passe par `_lire` (ligne 631).

```python
    def _charger_evaluation_diagnostic(self) -> _DefinitionPrompt:
        nom = f"evaluation@{VERSION_EVALUATION_DIAGNOSTIC}"
        repertoire = self._repertoire / "diagnostic"
        systeme = self._lire(repertoire / f"{nom}.systeme.md")
        texte_utilisateur = self._lire(repertoire / f"{nom}.utilisateur.md")
        texte_exemples = self._lire(repertoire / f"{nom}.jsonl")
        template = _valider_template(texte_utilisateur)
        exemples = _charger_exemples(texte_exemples)

        empreinte = hashlib.sha256(
            b"\0".join(
                (
                    systeme.encode("utf-8"),
                    texte_utilisateur.encode("utf-8"),
                    texte_exemples.encode("utf-8"),
                )
            )
        ).hexdigest()
        return _DefinitionPrompt(
            version_prompt=f"diagnostic/evaluation@{VERSION_EVALUATION_DIAGNOSTIC}",
            systeme=systeme.strip(),
            template_utilisateur=template,
            exemples=exemples,
            empreinte_prompt=f"sha256:{empreinte}",
            temperature=0.2,
            max_tokens=MAX_TOKENS_JSON,
        )
```

---

## E6 : Route d'évaluation du diagnostic

- **Fichier** : `ia-service/app/api/diagnostic.py`
- **Lignes** : 23 à 51 (29 lignes, limite 40)
- **Rôle** : Déclare `POST /diagnostic/evaluer` avec son modèle de réponse et ses réponses d'erreur documentées, reçoit une `RequeteAgent` validée par FastAPI, la transmet au Harness en retenant la version 1.0.0 de l'agent Diagnostic quand aucune version n'est demandée, et renvoie l'enveloppe de succès, ou l'enveloppe d'erreur avec le statut HTTP associé à son code.
- **Découpage** : Décorateur et fonction `evaluer`. Les imports et les types d'union des contrats v1 et v2 (lignes 1 à 20) ne sont pas repris.

```python
@router.post(
    "/evaluer",
    response_model=ReponseAgent[ResultatDiagnosticContrat],
    responses={
        # Corps refusé avant d'atteindre le Harness : pas encore d'enveloppe, seulement {code, message, retryable}.
        422: {"model": ErreurAgent, "description": "Entrée hors contrat (ENTREE_INVALIDE)"},
        429: {"model": ReponseErreur, "description": "Limite de requêtes du fournisseur LLM atteinte"},
        500: {"model": ReponseErreur, "description": "Configuration LLM, prompt introuvable ou erreur interne"},
        502: {"model": ReponseErreur, "description": "Réponse du fournisseur LLM inexploitable ou refusée"},
        503: {"model": ReponseErreur, "description": "Fournisseur LLM ou corpus indisponible"},
        504: {"model": ReponseErreur, "description": "Délai dépassé"},
    },
)
async def evaluer(
    requete: RequeteAgent[EntreeDiagnosticContrat], request: Request
) -> ReponseAgent[ResultatDiagnosticContrat] | JSONResponse:
    """Transmettre les réponses du test au modèle et retourner l'estimation validée du diagnostic.

    Sans ``version_agent``, la v1 reste le défaut pour ne pas changer le contrat des clients existants.
    """
    reponse = await request.app.state.harness.executer(
        CODE_AGENT, requete, version_agent=requete.version_agent or VERSION_AGENT
    )
    if isinstance(reponse, ReponseErreur):
        return JSONResponse(
            status_code=STATUTS_HTTP[reponse.erreur.code],
            content=reponse.model_dump(mode="json"),
        )
    return reponse
```

---
