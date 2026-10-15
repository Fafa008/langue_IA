"""Exécution des migrations : URL lue dans la configuration de l'application (DATABASE_URL)."""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

import app.models  # noqa: F401  (enregistre toutes les tables dans Base.metadata)
from alembic import context
from app.core.config import get_settings
from app.core.database import Base
from app.models.enums import EnumEntier

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
target_metadata = Base.metadata


def render_item(type_, obj, autogen_context):
    """Les énumérations sont des entiers en base : la migration n'a pas besoin du code de l'application."""
    if type_ == "type" and isinstance(obj, EnumEntier):
        return "sa.SmallInteger()"
    return False


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata, compare_type=True, render_item=render_item
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
