import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FlagLevel = "red" | "yellow" | "green" | string | null | undefined;

export function FlagBadge({ level, className }: { level: FlagLevel; className?: string }) {
  if (!level) return null;
  const l = level.toLowerCase();

  if (l === "red") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs",
        "bg-red-500/20 text-red-400 border border-red-500/40",
        className
      )}>
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Red Flag</span>
      </div>
    );
  }

  if (l === "yellow") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs",
        "bg-amber-400/15 text-amber-300 border border-amber-400/35",
        className
      )}>
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Warning</span>
      </div>
    );
  }

  if (l === "green") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px]",
        "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
        className
      )}>
        <CheckCircle2 className="w-3 h-3" />
        <span>Normal</span>
      </div>
    );
  }

  return null;
}
