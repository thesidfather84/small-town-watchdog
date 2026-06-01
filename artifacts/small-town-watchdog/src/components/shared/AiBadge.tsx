import { Bot } from "lucide-react";

export function AiBadge() {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-medium tracking-wide uppercase">
      <Bot className="w-3 h-3" />
      <span>AI Generated Summary</span>
    </div>
  );
}
