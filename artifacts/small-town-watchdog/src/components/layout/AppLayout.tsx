import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Shield } from "lucide-react";
import { Link } from "wouter";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 selection:text-primary">
      <div className="w-full h-1 stripe-top shrink-0" />

      <header className="w-full max-w-[430px] mx-auto px-4 py-3 flex items-center justify-between border-b border-border/60 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/35 flex items-center justify-center shadow-sm">
            <Shield className="w-3.5 h-3.5 text-red-400" />
          </div>
          <span className="font-display font-bold text-sm tracking-wide text-foreground group-hover:text-primary transition-colors">
            Small Town Watchdog
          </span>
        </Link>
        <Link
          href="/settings"
          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-full border border-border/50 hover:border-border hover:bg-card"
        >
          Change Location
        </Link>
      </header>

      <main className="flex-1 w-full max-w-[430px] mx-auto pb-20 relative">
        {children}
      </main>

      <BottomNav />

      <footer className="w-full max-w-[430px] mx-auto p-4 pb-24 text-center">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          AI summaries may contain errors. Always review original source documents.{" "}
          Not legal, financial, or political advice.
        </p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="/terms"         className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy"       className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/ai-disclosure" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">AI Disclosure</Link>
        </div>
      </footer>
    </div>
  );
}
