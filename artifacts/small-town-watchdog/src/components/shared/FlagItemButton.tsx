import { useState } from "react";
import { Flag } from "lucide-react";

const REASONS = [
  { value: "inaccurate", label: "Inaccurate information" },
  { value: "outdated", label: "Outdated / no longer current" },
  { value: "broken_link", label: "Broken source link" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  civicItemId: number;
  className?: string;
};

export function FlagItemButton({ civicItemId, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("other");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/civic-item-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ civicItemId, reason, notes: notes.trim() || undefined, flaggedBy: "public" }),
      });
      setSubmitted(true);
    } catch {
      // silently reset so user can retry
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  if (submitted) {
    return (
      <span className={`text-[11px] text-muted-foreground/60 italic ${className}`}>
        Thanks for the report.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors ${className}`}
        title="Flag this item"
        type="button"
      >
        <Flag className="w-3 h-3" />
        Flag
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-2 p-2 bg-muted/30 rounded border border-border/40 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
          <Flag className="w-3 h-3" />
          Flag this item
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground"
        >
          ✕
        </button>
      </div>

      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="text-[11px] bg-background border border-border/60 rounded px-2 py-1 text-foreground"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional note (leave blank if unsure)"
        maxLength={300}
        rows={2}
        className="text-[11px] bg-background border border-border/60 rounded px-2 py-1 text-foreground resize-none placeholder:text-muted-foreground/40"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 text-[11px] font-semibold py-1.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        >
          {busy ? "Sending…" : "Submit Flag"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] px-3 py-1.5 rounded bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground/40">
        Flagged items stay visible. An admin will review your report.
      </p>
    </form>
  );
}
