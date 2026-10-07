import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href={ROUTES.home} className="flex items-center">
      <Image
        src="/logo.jpg"
        alt="" // le nom est déjà écrit à côté
        width={200}
        height={48}
        priority
        className="h-10 w-auto md:h-12"
      />
      <span className={`text-xl font-bold ${light ? "text-white" : "text-primary"}`}>
        Digithèque
      </span>
    </Link>
  );
}
