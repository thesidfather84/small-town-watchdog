import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetDocument, useSummarizeDocument, getGetDocumentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { FlagBadge } from "@/components/shared/FlagBadge";
import { AiBadge } from "@/components/shared/AiBadge";
import { ShareButton } from "@/components/shared/ShareButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ExternalLink, Link2Off, AlertTriangle, Zap,
  ChevronDown, ChevronUp, Calendar, DollarSign, Building,
  Clock, FileText, BookOpen, ShieldCheck,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

type SourceStatus = "valid" | "broken" | "missing" | "pending_review";

function SourceButton({ sourceUrl, sourceStatus }: { sourceUrl?: string | null; sourceStatus?: string | null }) {
  const status = (sourceStatus ?? "pending_review") as SourceStatus;

  if ((status === "valid" || status === "pending_review") && sourceUrl?.startsWith("http")) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="button-view-source"
        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        View Official Source
      </a>
    );
  }

  if (status === "broken") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400/80">
        <AlertTriangle className="w-3 h-3" />
        Source link needs review
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
      <Link2Off className="w-3 h-3" />
      No official source link on file
    </span>
  );
}

function FlagExplanation({ level }: { level?: string | null }) {
  if (!level) return null;
  const l = level.toLowerCase();
  if (l === "red") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-300">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span><strong>Red Flag</strong> — This record contains something that may significantly affect taxpayers, such as a large budget increase, a tax proposal, or an audit finding. Read carefully.</span>
      </div>
    );
  }
  if (l === "yellow") {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/10 border border-amber-400/25 text-xs text-amber-300">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span><strong>Worth Reviewing</strong> — This record has something noteworthy, like a moderate spending change or a public notice that may affect your community.</span>
      </div>
    );
  }
  return null;
}

export default function DocumentDetail() {
  const [, params] = useRoute("/documents/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const [showEli12, setShowEli12]       = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const queryClient = useQueryClient();
  const { data: doc, isLoading } = useGetDocument(id, { query: { enabled: !!id, queryKey: getGetDocumentQueryKey(id) } });
  const summarize = useSummarizeDocument();

  function handleSummarize() {
    summarize.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) }),
    });
  }

  const ageText = doc?.createdAt
    ? formatDistanceToNow(parseISO(doc.createdAt), { addSuffix: true })
    : null;

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5 pb-8">

        {/* Back */}
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pt-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </Link>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-3/4 bg-card" />
            <Skeleton className="h-32 w-full rounded-xl bg-card" />
            <Skeleton className="h-24 w-full rounded-xl bg-card" />
          </div>
        ) : doc ? (
          <>
            {/* ── Record header ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground capitalize">
                    {doc.docType?.replace(/-/g, " ")}
                  </span>
                  {doc.year && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {doc.year}
                    </span>
                  )}
                  <FlagBadge level={doc.redFlagLevel} />
                </div>
                <ShareButton
                  title={doc.title}
                  summary={doc.plainSummary}
                  entityName={doc.entityName}
                  date={String(doc.year)}
                  sourceUrl={doc.sourceUrl}
                  isAiGenerated={doc.isAiGenerated}
                  variant="outline"
                  size="sm"
                />
              </div>

              <h1 className="text-xl font-bold leading-tight text-foreground">{doc.title}</h1>

              <div className="flex items-center gap-3 flex-wrap">
                {doc.entityName && (
                  <Link href={`/entities/${doc.entityId}`} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Building className="w-3 h-3" />
                    {doc.entityName}
                  </Link>
                )}
                {ageText && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {ageText}
                  </span>
                )}
                {doc.amountInvolved != null && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                    <DollarSign className="w-3 h-3" />
                    {Number(doc.amountInvolved).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} involved
                  </span>
                )}
              </div>

              {/* Flag explanation for citizens */}
              <FlagExplanation level={doc.redFlagLevel} />
            </div>

            {/* ── Plain English Summary ──────────────────────────────────── */}
            {doc.plainSummary ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">What This Record Says</h2>
                  {doc.isAiGenerated && <AiBadge />}
                </div>

                <Card className="p-4 bg-card border-border/50">
                  <p className="text-sm leading-relaxed text-foreground">{doc.plainSummary}</p>
                </Card>

                {/* ELI12 */}
                {doc.eli12Summary && (
                  <div className="flex flex-col gap-2">
                    <button
                      data-testid="button-eli12"
                      onClick={() => setShowEli12(!showEli12)}
                      className="self-start flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-all"
                    >
                      <Zap className="w-3 h-3" />
                      {showEli12 ? "Hide Simple Explanation" : "Explain it simply (ELI12)"}
                      {showEli12 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showEli12 && (
                      <Card className="p-4 bg-primary/5 border-primary/20">
                        <p className="text-xs font-semibold text-primary mb-1">In plain terms:</p>
                        <p className="text-sm leading-relaxed text-foreground">{doc.eli12Summary}</p>
                      </Card>
                    )}
                  </div>
                )}

                <ShareButton
                  title={doc.title}
                  summary={doc.plainSummary}
                  entityName={doc.entityName}
                  date={String(doc.year)}
                  sourceUrl={doc.sourceUrl}
                  isAiGenerated={doc.isAiGenerated}
                  variant="outline"
                  size="sm"
                  label="Share this summary"
                  className="self-start"
                />
              </div>
            ) : (
              <Card className="p-4 bg-card border-border/50 flex flex-col gap-3">
                <p className="text-sm font-semibold text-foreground">Summary not yet available</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This record has been imported but a plain-English summary hasn't been written yet.
                  The title, original source, and record text are the authoritative reference.
                </p>
                <Button
                  data-testid="button-generate-summary"
                  onClick={handleSummarize}
                  disabled={summarize.isPending}
                  className="self-start bg-primary text-primary-foreground hover:bg-primary/90"
                  size="sm"
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  {summarize.isPending ? "Generating…" : "Generate Plain-English Summary"}
                </Button>
              </Card>
            )}

            {/* ── Official Source ────────────────────────────────────────── */}
            <Card className="p-4 bg-card border-border/50 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-foreground">Official Source</h2>
              </div>

              {doc.sourceName && (
                <p className="text-xs text-muted-foreground">{doc.sourceName}</p>
              )}
              {doc.pulledAt && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Retrieved from government website: {format(parseISO(doc.pulledAt), "MMMM d, yyyy")}
                </p>
              )}
              {doc.lastVerifiedAt && (
                <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Source last verified: {format(parseISO(doc.lastVerifiedAt), "MMMM d, yyyy")}
                </p>
              )}

              <SourceButton sourceUrl={doc.sourceUrl} sourceStatus={doc.sourceStatus} />

              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                This record was pulled directly from an official government website.
                The original source document is the authoritative version.
              </p>
            </Card>

            {/* ── Original Record Text ───────────────────────────────────── */}
            {doc.content && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-primary" />
                  Original Record Text
                  {showOriginal
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
                </button>

                {showOriginal && (
                  <Card className="p-4 bg-card border-border/50">
                    <p className="text-[10px] text-muted-foreground/60 mb-3 italic">
                      This is the unedited text extracted from the official government document.
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono">
                      {doc.content}
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* ── Alert category ────────────────────────────────────────── */}
            {doc.alertCategory && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Category:</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">
                  {doc.alertCategory.replace(/-/g, " ")}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-2 items-center py-12 text-center">
            <p className="text-sm text-destructive">Record not found.</p>
            <Link href="/" className="text-xs text-primary hover:underline">Return to feed</Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
