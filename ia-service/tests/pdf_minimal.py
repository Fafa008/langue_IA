"""Générateur de PDF minimal pour les tests d'ingestion : aucun document sous droits n'est utilisé.

Chaque page est une liste de lignes ; une ligne est une liste de segments ``(x, texte)`` placés sur la même
ordonnée, ce qui reproduit la disposition en colonnes d'une grille de niveaux (code de niveau à gauche, texte à
droite). Police Helvetica en WinAnsiEncoding : les accents latins sont acceptés.
"""

from __future__ import annotations

from collections.abc import Sequence

Segment = tuple[int, str]
Ligne = Sequence[Segment]


def _chaine(texte: str) -> bytes:
    echappe = texte.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return b"(" + echappe.encode("cp1252") + b")"


def _flux(lignes: Sequence[Ligne]) -> bytes:
    morceaux = [b"BT /F1 10 Tf"]
    y = 800
    for ligne in lignes:
        for x, texte in ligne:
            morceaux.append(b"1 0 0 1 %d %d Tm " % (x, y) + _chaine(texte) + b" Tj")
        y -= 14
    morceaux.append(b"ET")
    return b"\n".join(morceaux)


def pdf_minimal(pages: Sequence[Sequence[Ligne]]) -> bytes:
    """Construire un PDF valide (table xref comprise) à partir des pages données."""
    objets: list[bytes] = []
    nombre = len(pages)
    # 1 : catalogue, 2 : arbre des pages, 3 : police, puis pour chaque page : page et flux de contenu
    enfants = " ".join(f"{4 + 2 * i} 0 R" for i in range(nombre))
    objets.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objets.append(f"<< /Type /Pages /Kids [{enfants}] /Count {nombre} >>".encode())
    objets.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    for i, lignes in enumerate(pages):
        contenu = _flux(lignes)
        objets.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> "
            f"/Contents {5 + 2 * i} 0 R >>".encode()
        )
        objets.append(b"<< /Length %d >>\nstream\n" % len(contenu) + contenu + b"\nendstream")

    sortie = bytearray(b"%PDF-1.4\n")
    positions = []
    for numero, objet in enumerate(objets, start=1):
        positions.append(len(sortie))
        sortie += b"%d 0 obj\n" % numero + objet + b"\nendobj\n"
    debut_xref = len(sortie)
    sortie += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objets) + 1)
    for position in positions:
        sortie += b"%010d 00000 n \n" % position
    sortie += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objets) + 1, debut_xref)
    return bytes(sortie)
