"""Mémoire du service IA.

La mémoire courte est portée par Redis (tours, résumé glissant, cache de traduction). La mémoire long terme reste
la propriété du backend : ce package ne contient aucun accès SQLAlchemy, seulement la charge utile que le service
IA renvoie au backend à la clôture d'une session.
"""
