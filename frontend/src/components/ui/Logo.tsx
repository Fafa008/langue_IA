import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href={ROUTES.home} className="flex items-center gap-3">
      <Image
        src="/logo.jpg"
        alt="" // le nom est déjà écrit à côté
        width={48}
        height={48}
        priority
        className={`h-10 w-10 rounded-full object-cover shadow-card ring-2 md:h-12 md:w-12 ${
          light ? "ring-white/40" : "ring-primary/15"
        }`}
      />
      <span className={`text-xl font-bold ${light ? "text-white" : "text-primary"}`}>
        Digithèque
      </span>
    </Link>
  );
}
