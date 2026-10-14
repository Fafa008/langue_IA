import type { Metadata } from "next";
import TableauDeBord from "@/components/tableau-de-bord/TableauDeBord";

export const metadata: Metadata = { title: "Tableau de bord – Digithèque" };

export default function TableauDeBordPage() {
  return <TableauDeBord />;
}
