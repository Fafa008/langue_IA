"""Base commune des modèles du service IA."""

from pydantic import BaseModel, ConfigDict


class ModeleStrict(BaseModel):
    """Modèle du contrat interne : aucun champ supplémentaire n'est accepté.

    ``extra="forbid"`` est la règle centrale de la mission : le service refuse le JSON arbitraire au lieu de
    l'ignorer silencieusement. Les agents et les enveloppes en héritent, donc la règle s'applique aussi aux objets
    imbriqués.
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
