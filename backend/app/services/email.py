"""Envoi d'e-mails par SMTP ; sans SMTP configuré (développement), le message est écrit dans les journaux."""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def envoyer_email(destinataire: str, sujet: str, corps: str) -> None:
    settings = get_settings()
    if not settings.smtp_configure:
        logger.warning("SMTP non configuré : e-mail non envoyé à %s\nSujet : %s\n%s", destinataire, sujet, corps)
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = destinataire
    message["Subject"] = sujet
    message.set_content(corps)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        # Un e-mail non parti ne doit pas faire échouer la requête (ni révéler si le compte existe)
        logger.exception("Échec de l'envoi de l'e-mail à %s", destinataire)


def envoyer_lien_reinitialisation(destinataire: str, prenom: str, jeton: str) -> None:
    settings = get_settings()
    lien = f"{settings.frontend_url}/reset-password?token={jeton}"
    duree = settings.reset_token_expire_minutes
    envoyer_email(
        destinataire,
        "Réinitialisation de votre mot de passe – La Digithèque",
        f"Bonjour {prenom},\n\n"
        f"Pour choisir un nouveau mot de passe, ouvrez ce lien (valable {duree} minutes) :\n{lien}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n",
    )


def envoyer_invitation_formateur(destinataire: str, prenom: str, jeton: str) -> None:
    """Compte créé par l'administrateur : le formateur choisit son mot de passe (page de réinitialisation)."""
    settings = get_settings()
    lien = f"{settings.frontend_url}/reset-password?token={jeton}"
    jours = settings.invitation_token_expire_minutes // (24 * 60)
    envoyer_email(
        destinataire,
        "Votre compte formateur – La Digithèque",
        f"Bonjour {prenom},\n\n"
        "Un compte formateur vient d'être créé pour vous sur La Digithèque.\n"
        f"Pour choisir votre mot de passe, ouvrez ce lien (valable {jours} jours) :\n{lien}\n\n"
        "Vous pourrez ensuite vous connecter avec votre adresse e-mail.\n",
    )
