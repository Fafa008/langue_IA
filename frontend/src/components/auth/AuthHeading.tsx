import type { ReactNode } from "react";

interface AuthHeadingProps {
  title: string;
  subtitle: ReactNode;
}

export default function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold leading-tight md:text-2xl">{title}</h1>
      <p className="mb-5 mt-1 text-content-secondary">{subtitle}</p>
    </>
  );
}
