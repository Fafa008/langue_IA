import type { Metadata } from "next";
import TableauDeBordAdmin from "@/components/admin/tableau-de-bord/TableauDeBordAdmin";

export const metadata: Metadata = { title: "Tableau de bord – Digithèque" };

export default function TableauDeBordAdminPage() {
  return <TableauDeBordAdmin />;
}
