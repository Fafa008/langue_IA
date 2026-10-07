import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

const VARIANTS = {
  error: { icon: AlertTriangle, className: "border-error bg-error/5 text-error" },
  success: { icon: CheckCircle2, className: "border-success bg-success/5 text-success" },
};

interface AlertProps {
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
  className?: string;
}

export default function Alert({ variant = "error", children, className = "" }: AlertProps) {
  const { icon: Icon, className: tone } = VARIANTS[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-btn border px-3.5 py-3 font-medium ${tone} ${className}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
