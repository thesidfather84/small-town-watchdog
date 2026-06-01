import { useState } from "react";
import { Bug, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useCreateErrorReport } from "@workspace/api-client-react";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";
import { getDeviceInfo } from "@/lib/device";

export function ReportProblemButton() {
  const { selectedLocation } = useSelectedLocation();
  const [open, setOpen]     = useState(false);
  const [msg, setMsg]       = useState("");
  const [done, setDone]     = useState(false);
  const { mutateAsync, isPending } = useCreateErrorReport();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const info = getDeviceInfo();
    const fullMessage = [
      msg.trim() ? `User: ${msg.trim()}` : "User: (no message)",
      `Page: ${window.location.pathname}`,
      `Location: ${selectedLocation ? `${selectedLocation.countyParish}, ${selectedLocation.stateName}` : "none"}`,
      `Device: ${info.deviceId}`,
      `Session: ${info.sessionId}`,
      `UA: ${info.userAgent}`,
      `Screen: ${info.screen}`,
      `App: ${info.appVersion}`,
    ].join("\n");

    try {
      await mutateAsync({
        data: {
          reportType: "other",
          message: fullMessage,
        },
      });
      setDone(true);
      setMsg("");
    } catch {
      // Silently fail — error reporting should never block the user
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Bug className="w-3 h-3" />
        Report a problem
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Report a Problem</span>
        </div>
        <button onClick={() => { setOpen(false); setDone(false); }}>
          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </div>

      {done ? (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Report sent. Thank you — we'll look into it.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="What's not working? (optional — tap Send to report with device info)"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border/60 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
          />
          <p className="text-[10px] text-muted-foreground/60">
            We'll automatically include your device type, app version, and current page. No personal data is collected.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="self-start flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {isPending ? "Sending…" : "Send Report"}
          </button>
        </form>
      )}
    </div>
  );
}
