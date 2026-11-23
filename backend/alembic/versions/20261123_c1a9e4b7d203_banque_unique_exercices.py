"""Banque unique d'exercices : fusion de `question` dans `exercice` (US-N01).

Option A retenue (T1) : les questions reçoivent de nouveaux `id_exercice` et la table de
correspondance `migration_question_exercice` est conservée jusqu'à validation. `reponse.id_question`
devient `reponse.id_exercice` ; aucune réponse ne peut rester orpheline (arrêt explicite).

Le contrat IA conserve `id_question` (T2) : côté API, l'identifiant de l'exercice est toujours
sérialisé sous ce nom. Le code `audio` devient `prononciation` (T3), `difficulte` vaut 3 (T4).

Révision : c1a9e4b7d203
Précédente : dfbf0715302a
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c1a9e4b7d203"
down_revision: str | None = "dfbf0715302a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AUTEUR_SYSTEME = "systeme:seed_diagnostic"
"""Auteur système documenté : l'auteur historique des questions n'est pas en base (D8)."""


def _verifier_tentatives_en_cours() -> None:
    """Critère d'arrêt du plan §6.2 : aucune tentative ouverte ne doit être clôturée après la bascule."""
    nombre = op.get_bind().scalar(sa.text("SELECT count(*) FROM test_diagnostic WHERE statut = 1"))
    if nombre:
        raise RuntimeError(
            f"Migration refusée : {nombre} tentative(s) EN_COURS. Attendre leur clôture ou appliquer "
            "la double lecture transitoire décrite au §6.2 du plan de migration."
        )


def _verifier_audio_sans_binaire() -> None:
    """D7 : une référence audio est un chemin, jamais un octet ni une URI `data:`."""
    connexion = op.get_bind()
    valeurs = (
        connexion.execute(sa.text("SELECT DISTINCT audio_url FROM question WHERE audio_url IS NOT NULL"))
        .scalars()
        .all()
    )
    for valeur in valeurs:
        if valeur.startswith("data:") or valeur.startswith("\\x") or valeur.lower().startswith("blob:"):
            raise RuntimeError(f"Valeur audio_url binaire interdite dans la question migrée : {valeur[:40]!r}")


def upgrade() -> None:
    _verifier_tentatives_en_cours()
    _verifier_audio_sans_binaire()

    op.create_table(
        "migration_question_exercice",
        sa.Column("id_question", sa.Integer(), primary_key=True),
        sa.Column("id_exercice", sa.Integer(), nullable=False, unique=True),
    )

    # Les colonnes sont ajoutéesnullable, puis rendues NOT NULL après backfill.
    op.add_column("exercice", sa.Column("usage", sa.String(length=20)))
    op.add_column("exercice", sa.Column("statut", sa.String(length=20)))
    op.add_column("exercice", sa.Column("version", sa.Integer(), server_default="1"))
    op.add_column("exercice", sa.Column("origine", sa.String(length=30)))
    op.add_column("exercice", sa.Column("auteur", sa.String(length=100)))
    op.add_column("exercice", sa.Column("date_creation", sa.DateTime(timezone=True), server_default=sa.text("now()")))
    op.add_column("exercice", sa.Column("donnees_test", sa.Boolean(), server_default=sa.false()))
    op.add_column("exercice", sa.Column("framework", sa.String(length=20)))
    op.add_column("exercice", sa.Column("level", sa.String(length=20)))
    op.add_column("exercice", sa.Column("audio_ref", sa.Text()))
    op.add_column("exercice", sa.Column("id_question_originel", sa.Integer()))

    connexion = op.get_bind()
    # Les exercices déjà présents appartiennent au parcours de démonstration (seed_parcours).
    connexion.execute(
        sa.text(
            """
            UPDATE exercice
            SET usage = 'parcours',
                statut = 'publié',
                origine = 'systeme:seed_parcours',
                auteur = 'systeme:seed_parcours',
                framework = CASE WHEN l.code = 'zh' THEN 'HSK' ELSE 'CECRL' END,
                level = n.code
            FROM langue l, niveau n
            WHERE l.id_langue = exercice.id_langue AND n.id_niveau = exercice.id_niveau
            """
        )
    )

    # Chaque question devient un exercice `diagnostic`, publié, sans leçon fixée (§2 du plan).
    connexion.execute(
        sa.text(
            """
            INSERT INTO exercice (
                type, contenu, difficulte, id_langue, id_niveau, numero_lecon,
                usage, statut, version, origine, auteur, date_creation, donnees_test,
                framework, level, audio_ref, id_question_originel
            )
            SELECT
                CASE q.competence
                    WHEN 'grammaire' THEN 1   -- GRAMMAIRE
                    WHEN 'vocabulaire' THEN 2 -- VOCABULAIRE
                    WHEN 'ecoute' THEN 4      -- ECOUTE
                    WHEN 'oral' THEN 5        -- ORAL
                    ELSE 3                    -- COMPREHENSION
                END,
                jsonb_strip_nulls(jsonb_build_object(
                    'enonce', q.enonce,
                    'competence', q.competence,
                    'format', CASE q.type_reponse WHEN 'audio' THEN 'prononciation' ELSE q.type_reponse END,
                    'choix', q.choix,
                    'reponses', CASE WHEN q.reponse_correcte IS NOT NULL
                                     THEN jsonb_build_array(q.reponse_correcte) END,
                    'support', q.support,
                    'audio_url', q.audio_url,
                    'texte_audio', q.audio_texte
                ))::text,
                3, q.id_langue, q.id_niveau, NULL,
                'diagnostic', 'publié', 1, 'humain', :auteur, now(), false,
                CASE WHEN l.code = 'zh' THEN 'HSK' ELSE 'CECRL' END,
                n.code,
                q.audio_url,  -- D7 : chemin uniquement, jamais d'octets ; conservé aussi dans contenu.audio_url
                q.id_question
            FROM question q
            JOIN langue l ON l.id_langue = q.id_langue
            JOIN niveau n ON n.id_niveau = q.id_niveau
            """,
        ),
        {"auteur": AUTEUR_SYSTEME},
    )
    connexion.execute(
        sa.text(
            """
            INSERT INTO migration_question_exercice (id_question, id_exercice)
            SELECT id_question_originel, id_exercice
            FROM exercice
            WHERE id_question_originel IS NOT NULL
            """
        )
    )

    op.add_column("reponse", sa.Column("id_exercice", sa.Integer()))
    connexion.execute(
        sa.text(
            """
            UPDATE reponse r
            SET id_exercice = m.id_exercice
            FROM migration_question_exercice m
            WHERE m.id_question = r.id_question
            """
        )
    )
    orphelines = connexion.scalar(sa.text("SELECT count(*) FROM reponse WHERE id_exercice IS NULL"))
    if orphelines:
        raise RuntimeError(f"Migration interrompue : {orphelines} réponse(s) sans exercice correspondant.")

    op.create_foreign_key(
        "fk_reponse_id_exercice", "reponse", "exercice", ["id_exercice"], ["id_exercice"], ondelete="RESTRICT"
    )
    op.create_index("ix_reponse_id_exercice", "reponse", ["id_exercice"], unique=False)
    op.drop_constraint("reponse_id_question_fkey", "reponse", type_="foreignkey")
    op.drop_constraint("reponse_id_tentative_id_question_key", "reponse", type_="unique")
    op.drop_index("ix_reponse_id_question", table_name="reponse")
    op.drop_column("reponse", "id_question")
    op.create_unique_constraint("uq_reponse_tentative_exercice", "reponse", ["id_tentative", "id_exercice"])

    for colonne in ("usage", "statut", "version", "origine", "date_creation", "donnees_test", "framework", "level"):
        op.alter_column("exercice", colonne, nullable=False)
    op.create_check_constraint("ck_exercice_usage", "exercice", "usage IN ('diagnostic', 'parcours', 'les deux')")
    op.create_check_constraint("ck_exercice_statut", "exercice", "statut IN ('brouillon', 'publié')")
    op.create_check_constraint(
        "ck_exercice_origine",
        "exercice",
        "origine IN ('humain', 'systeme:seed_parcours', 'systeme:seed_diagnostic')",
    )
    op.create_check_constraint("ck_exercice_framework", "exercice", "framework IN ('CECRL', 'HSK')")

    op.drop_table("question")

    connexion.execute(
        sa.text(
            """
            SELECT setval(
                pg_get_serial_sequence('exercice', 'id_exercice'),
                COALESCE((SELECT MAX(id_exercice) FROM exercice), 1),
                true
            )
            """
        )
    )


def downgrade() -> None:
    connexion = op.get_bind()

    op.create_table(
        "question",
        sa.Column("id_question", sa.Integer(), primary_key=True),
        sa.Column("enonce", sa.Text(), nullable=False),
        sa.Column("competence", sa.String(length=50), nullable=False),
        sa.Column("id_langue", sa.Integer(), nullable=False),
        sa.Column("id_niveau", sa.Integer(), nullable=False),
        sa.Column("type_reponse", sa.String(length=10), server_default="choix", nullable=False),
        sa.Column("choix", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("support", sa.Text()),
        sa.Column("audio_url", sa.Text()),
        sa.Column("audio_texte", sa.Text()),
        sa.Column("reponse_correcte", sa.Text()),
        sa.ForeignKeyConstraint(["id_langue"], ["langue.id_langue"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["id_niveau"], ["niveau.id_niveau"], ondelete="RESTRICT"),
        sa.CheckConstraint("type_reponse IN ('choix', 'texte', 'audio')", name="ck_question_type_reponse"),
        sa.CheckConstraint(
            "reponse_correcte IS NULL OR (type_reponse = 'choix' AND choix IS NOT NULL)",
            name="ck_question_reponse_correcte_choix",
        ),
    )
    op.create_index("ix_question_id_langue_id_niveau", "question", ["id_langue", "id_niveau"], unique=False)
    op.alter_column("question", "type_reponse", server_default=None)

    # Seules les lignes issues de `question` sont restaurées ; les exercices du parcours restent dans `exercice`.
    connexion.execute(
        sa.text(
            """
            INSERT INTO question (
                id_question, enonce, competence, type_reponse, choix, reponse_correcte,
                support, audio_url, audio_texte, id_langue, id_niveau
            )
            SELECT
                id_question_originel,
                contenu::jsonb ->> 'enonce',
                contenu::jsonb ->> 'competence',
                CASE WHEN contenu::jsonb ->> 'format' = 'prononciation'
                     THEN 'audio' ELSE contenu::jsonb ->> 'format' END,
                CASE WHEN contenu::jsonb ? 'choix' THEN contenu::jsonb -> 'choix' END,
                contenu::jsonb -> 'reponses' ->> 0,
                contenu::jsonb ->> 'support',
                contenu::jsonb ->> 'audio_url',
                contenu::jsonb ->> 'texte_audio',
                id_langue, id_niveau
            FROM exercice
            WHERE id_question_originel IS NOT NULL
            """
        )
    )

    op.add_column("reponse", sa.Column("id_question", sa.Integer()))
    connexion.execute(
        sa.text(
            """
            UPDATE reponse r
            SET id_question = m.id_question
            FROM migration_question_exercice m
            WHERE m.id_exercice = r.id_exercice
            """
        )
    )
    orphelines = connexion.scalar(sa.text("SELECT count(*) FROM reponse WHERE id_question IS NULL"))
    if orphelines:
        raise RuntimeError(f"Downgrade interrompu : {orphelines} réponse(s) sans question correspondante.")

    op.create_foreign_key(
        "reponse_id_question_fkey", "reponse", "question", ["id_question"], ["id_question"], ondelete="RESTRICT"
    )
    op.create_index("ix_reponse_id_question", "reponse", ["id_question"], unique=False)
    op.create_unique_constraint("reponse_id_tentative_id_question_key", "reponse", ["id_tentative", "id_question"])
    op.drop_constraint("fk_reponse_id_exercice", "reponse", type_="foreignkey")
    op.drop_index("ix_reponse_id_exercice", table_name="reponse")
    op.drop_constraint("uq_reponse_tentative_exercice", "reponse", type_="unique")
    op.drop_column("reponse", "id_exercice")

    for contrainte in ("ck_exercice_framework", "ck_exercice_origine", "ck_exercice_statut", "ck_exercice_usage"):
        op.drop_constraint(contrainte, "exercice", type_="check")
    for colonne in (
        "id_question_originel",
        "audio_ref",
        "level",
        "framework",
        "donnees_test",
        "date_creation",
        "auteur",
        "origine",
        "version",
        "statut",
        "usage",
    ):
        op.drop_column("exercice", colonne)

    op.drop_table("migration_question_exercice")
