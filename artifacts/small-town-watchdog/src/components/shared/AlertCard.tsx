import { useState } from "react";
import { useGetDocument } from "@workspace/api-client-react";
import type { Alert } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { FlagBadge } from "./FlagBadge";
import { AiBadge } from "./AiBadge";
import { ShareButton } from "./ShareButton";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import {
  ExternalLink, Link2Off, ChevronDown, ChevronUp,
  Building2, Calendar, ShieldCheck, BookOpen, Zap, Bot,
} from "lucide-react";
import { isValidSourceUrl } from "@/lib/source-url";
import { cn } from "@/lib/utils";

// ─── Flag colour helpers ──────────────────────────────────────────────────────

function flagBorderClass(level: string | undefined) {
  const l = level?.toLowerCase();
  if (l === "red")    return "border-l-[3px] border-l-red-500 border-t-border/60 border-r-border/60 border-b-border/60";
  if (l === "yellow") return "border-l-[3px] border-l-amber-400 border-t-border/60 border-r-border/60 border-b-border/60";
  return "border-border/50 hover:border-border";
}

function FlagExplanationInline({ level }: { level?: string | null }) {
  const l = level?.toLowerCase();
  if (l === "red") return (
    <p className="text-[11px] text-red-300/80 leading-relaxed">
      <strong>Red Flag</strong> — This record may contain a significant impact on taxpayers: a large budget change, tax proposal, audit finding, or major contract.
    </p>
  );
  if (l === "yellow") return (
    <p className="text-[11px] text-amber-300/80 leading-relaxed">
      <strong>Worth Reviewing</strong> — This record has something noteworthy, like a moderate spending change or public notice that may affect your community.
    </p>
  );
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertCard({ alert }: { alert: Alert }) {
  const [expanded, setExpanded] = useState(false);

  // Lazy-fetch the full document only when the card is expanded.
  // React Query caches this — expanding and collapsing is instant after first load.
  const { data: doc, isLoading: docLoading } = useGetDocument(alert.documentId, {
    query: { enabled: expanded },
  });

  const isRed    = alert.redFlagLevel?.toLowerCase() === "red";
  const isYellow = alert.redFlagLevel?.toLowerCase() === "yellow";

  const dateStr = alert.createdAt
    ? format(parseISO(alert.createdAt), "MMM d, yyyy")
    : undefined;

  const hasSource = isValidSourceUrl(alert.sourceUrl);

  // ── Collapsed card ──────────────────────────────────────────────────────────
  const collapsedContent = (
    <div className="p-4 flex flex-col gap-3">

      {/* Top stripe for red flags */}
      {isRed && (
        <div className="-mx-4 -mt-4 mb-0 h-px bg-gradient-to-r from-red-500/60 via-red-400/20 to-transparent" />
      )}

      {/* Header row: flag + title + date */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          {/* Agency */}
          <Link
            href={`/entities/${alert.entityId}`}
            className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Building2 className="w-2.5 h-2.5 shrink-0" />
            {alert.entityName}
          </Link>

          {/* Title */}
          <h3 className="text-[15px] font-bold leading-snug text-foreground">
            {alert.title}
          </h3>
        </div>

        {/* Flag badge + date */}
        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
          <FlagBadge level={alert.redFlagLevel} />
          {dateStr && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
              <Calendar className="w-2.5 h-2.5" />
              {dateStr}
            </span>
          )}
        </div>
      </div>

      {/* Short AI summary */}
      {alert.plainSummary && (
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {alert.plainSummary}
        </p>
      )}

      {/* Verified source indicator */}
      {hasSource && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-400/80 font-medium">
          <ShieldCheck className="w-3 h-3" />
          Verified Official Source
        </div>
      )}

      {/* Footer: category + actions */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2 flex-wrap">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/60 text-secondary-foreground border border-border/40 capitalize">
          {alert.category.replace(/-/g, " ")}
        </span>

        <div className="flex items-center gap-1.5">
          <ShareButton
            title={alert.title}
            summary={alert.plainSummary}
            entityName={alert.entityName}
            date={dateStr}
            sourceUrl={alert.sourceUrl}
            isAiGenerated={alert.isAiGenerated}
            size="sm"
            variant="ghost"
            className="h-8 px-2"
          />

          {hasSource ? (
            <a
              href={alert.sourceUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors h-8 px-1"
              onClick={(e) => e.stopPropagation()}
            >
              SOURCE <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/30 h-8 px-1 select-none">
              <Link2Off className="w-3 h-3" />
            </span>
          )}

          <Link
            href={`/documents/${alert.documentId}`}
            className="inline-flex items-center justify-center h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            View Details
          </Link>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(true)}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all"
            title="Show more"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Expanded card ───────────────────────────────────────────────────────────
  const expandedContent = (
    <div className="p-4 flex flex-col gap-4">

      {isRed && (
        <div className="-mx-4 -mt-4 mb-0 h-px bg-gradient-to-r from-red-500/60 via-red-400/20 to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <Link
            href={`/entities/${alert.entityId}`}
            className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Building2 className="w-2.5 h-2.5 shrink-0" />
            {alert.entityName}
          </Link>
          <h3 className="text-[15px] font-bold leading-snug text-foreground">{alert.title}</h3>
          <div className="flex items-center gap-3 flex-wrap mt-0.5">
            <FlagBadge level={alert.redFlagLevel} />
            {dateStr && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {dateStr}
              </span>
            )}
            {doc?.docType && (
              <span className="text-[10px] text-muted-foreground capitalize">
                {doc.docType.replace(/-/g, " ")}
              </span>
            )}
            {alert.year && (
              <span className="text-[10px] text-muted-foreground">Year: {alert.year}</span>
            )}
          </div>
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setExpanded(false)}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all shrink-0"
          title="Show less"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Flag explanation */}
      <FlagExplanationInline level={alert.redFlagLevel} />

      {/* Loading state for expanded data */}
      {docLoading && (
        <div className="flex flex-col gap-2">
          <div className="h-3 bg-card/80 rounded animate-pulse w-full" />
          <div className="h-3 bg-card/80 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-card/80 rounded animate-pulse w-3/5" />
        </div>
      )}

      {/* ── AI Summary ── */}
      {alert.plainSummary && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              What This Record Says
            </span>
            {alert.isAiGenerated && <AiBadge />}
          </div>
          <div className="p-3 rounded-xl bg-card/60 border border-border/40">
            <p className="text-sm leading-relaxed text-foreground">{alert.plainSummary}</p>
          </div>
        </div>
      )}

      {/* ── ELI12 ── */}
      {doc?.eli12Summary && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              In Simple Terms
            </span>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
            <p className="text-sm leading-relaxed text-foreground">{doc.eli12Summary}</p>
          </div>
        </div>
      )}

      {/* ── Original text snippet ── */}
      {doc?.content && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Original Record Text
            </span>
          </div>
          <div className="p-3 rounded-xl bg-card/40 border border-border/30 max-h-40 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">
              {doc.content.slice(0, 800)}{doc.content.length > 800 ? "…" : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── Official Source ── */}
      <div className={cn(
        "flex flex-col gap-2 p-3 rounded-xl border",
        hasSource
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-card/40 border-border/30"
      )}>
        <div className="flex items-center gap-2">
          <ShieldCheck className={cn("w-3.5 h-3.5", hasSource ? "text-emerald-400" : "text-muted-foreground/40")} />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Official Source
          </span>
          {hasSource && (
            <span className="text-[10px] text-emerald-400 font-semibold ml-auto">✓ Verified Government Source</span>
          )}
        </div>

        {doc?.sourceName && (
          <p className="text-xs text-muted-foreground">{doc.sourceName}</p>
        )}

        {doc?.pulledAt && (
          <p className="text-[10px] text-muted-foreground/60">
            Retrieved: {format(parseISO(doc.pulledAt), "MMMM d, yyyy")}
          </p>
        )}

        {hasSource ? (
          <a
            href={alert.sourceUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors self-start"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Official Source
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
            <Link2Off className="w-3 h-3" />
            No official source link on file yet
          </span>
        )}
      </div>

      {/* ── Category + location meta ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/60 text-secondary-foreground border border-border/40 capitalize">
          {alert.category.replace(/-/g, " ")}
        </span>
        {alert.year && (
          <span className="text-[10px] text-muted-foreground">Year {alert.year}</span>
        )}
        {alert.isAiGenerated && (
          <span className="text-[10px] text-indigo-400/70">AI-assisted summary</span>
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2 flex-wrap">
        <ShareButton
          title={alert.title}
          summary={alert.plainSummary}
          entityName={alert.entityName}
          date={dateStr}
          sourceUrl={alert.sourceUrl}
          isAiGenerated={alert.isAiGenerated}
          variant="outline"
          size="sm"
          label="Share Record"
        />

        <Link
          href={`/documents/${alert.documentId}`}
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
          onClick={(e) => e.stopPropagation()}
        >
          View Full Details
        </Link>
      </div>
    </div>
  );

  // ── Card wrapper ──────────────────────────────────────────────────────────
  return (
    <Card className={cn(
      "flex flex-col bg-card shadow-sm relative overflow-hidden transition-all duration-200",
      expanded ? "shadow-md" : "hover:shadow-md",
      flagBorderClass(alert.redFlagLevel),
    )}>
      {expanded ? expandedContent : collapsedContent}
    </Card>
  );
}
