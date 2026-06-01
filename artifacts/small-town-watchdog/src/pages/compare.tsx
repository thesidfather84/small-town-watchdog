import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListEntities, useCompareYears, getCompareYearsQueryKey,
  useGetMultiYearTimeline, getGetMultiYearTimelineQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FlagBadge } from "@/components/shared/FlagBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  ExternalLink, AlertTriangle, Link2Off, CheckCircle2, Clock, FileText,
} from "lucide-react";
import { Link } from "wouter";

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = 2023;
const YEARS: string[] = [];
for (let y = START_YEAR; y <= CURRENT_YEAR; y++) YEARS.push(String(y));

type ViewMode = "compare" | "timeline";

function SourceStatusIcon({ status }: { status: string }) {
  if (status === "valid") return <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
  if (status === "broken") return <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />;
  if (status === "missing") return <Link2Off className="w-3 h-3 text-muted-foreground/40 shrink-0" />;
  return <Clock className="w-3 h-3 text-muted-foreground/40 shrink-0" />;
}

export default function Compare() {
  const [location] = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const prefilledEntityId = params.get("entityId") ?? "";

  const [entityId, setEntityId] = useState<string>(prefilledEntityId);
  const [year1, setYear1] = useState(String(CURRENT_YEAR - 1 < START_YEAR ? START_YEAR : CURRENT_YEAR - 1));
  const [year2, setYear2] = useState(String(CURRENT_YEAR));
  const [triggered, setTriggered] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");

  const { data: entities } = useListEntities();

  // Auto-trigger timeline when entity is pre-selected
  useEffect(() => {
    if (prefilledEntityId) {
      setEntityId(prefilledEntityId);
      setViewMode("timeline");
    }
  }, [prefilledEntityId]);

  // Two-year comparison
  const compareEnabled = !!entityId && !!year1 && !!year2 && year1 !== year2 && triggered && viewMode === "compare";
  const { data: comparison, isLoading: compareLoading } = useCompareYears(
    { entityId: parseInt(entityId, 10), year1: parseInt(year1, 10), year2: parseInt(year2, 10) },
    { query: { enabled: compareEnabled, queryKey: getCompareYearsQueryKey({ entityId: parseInt(entityId, 10), year1: parseInt(year1, 10), year2: parseInt(year2, 10) }) } }
  );

  // Multi-year timeline
  const timelineEnabled = !!entityId && viewMode === "timeline";
  const { data: timeline, isLoading: timelineLoading } = useGetMultiYearTimeline(
    { entityId: parseInt(entityId, 10) },
    { query: { enabled: timelineEnabled, queryKey: getGetMultiYearTimelineQueryKey({ entityId: parseInt(entityId, 10) }) } }
  );

  const isLoading = viewMode === "compare" ? compareLoading : timelineLoading;

  function handleCompare() {
    if (entityId && year1 && year2 && year1 !== year2) {
      setViewMode("compare");
      setTriggered(true);
    }
  }

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <div className="flex items-center gap-3 pt-2">
          <ArrowLeftRight className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Compare Years</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          See exactly what changed from one year to the next — in plain English.
        </p>

        <Card className="p-4 bg-card border-border/50 flex flex-col gap-3">
          <Select value={entityId} onValueChange={(v) => { setEntityId(v); setTriggered(false); }}>
            <SelectTrigger data-testid="select-entity" className="bg-background border-border">
              <SelectValue placeholder="Select a government entity..." />
            </SelectTrigger>
            <SelectContent>
              {entities?.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View mode tabs */}
          {entityId && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === "timeline" ? "default" : "outline"}
                onClick={() => setViewMode("timeline")}
                className={viewMode === "timeline" ? "flex-1 bg-primary text-primary-foreground" : "flex-1 border-border"}
              >
                All Years ({START_YEAR}–{CURRENT_YEAR})
              </Button>
              <Button
                size="sm"
                variant={viewMode === "compare" ? "default" : "outline"}
                onClick={() => setViewMode("compare")}
                className={viewMode === "compare" ? "flex-1 bg-primary text-primary-foreground" : "flex-1 border-border"}
              >
                Compare Two Years
              </Button>
            </div>
          )}

          {viewMode === "compare" && (
            <>
              <div className="flex gap-2 items-center">
                <Select value={year1} onValueChange={(v) => { setYear1(v); setTriggered(false); }}>
                  <SelectTrigger data-testid="select-year1" className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>

                <span className="text-muted-foreground font-bold text-sm shrink-0">vs.</span>

                <Select value={year2} onValueChange={(v) => { setYear2(v); setTriggered(false); }}>
                  <SelectTrigger data-testid="select-year2" className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Button
                data-testid="button-compare"
                onClick={handleCompare}
                disabled={!entityId || year1 === year2 || compareLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
              >
                {compareLoading ? "Loading..." : "Compare Years"}
              </Button>
            </>
          )}
        </Card>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-card" />
            ))}
          </div>
        )}

        {/* ── Multi-year timeline view ── */}
        {viewMode === "timeline" && timeline && !timelineLoading && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">{timeline.entityName}</h2>
              <p className="text-xs text-muted-foreground">
                Public records from {START_YEAR} through {CURRENT_YEAR}
              </p>
            </div>

            {timeline.years.map((yr) => (
              <Card
                key={yr.year}
                className={`p-4 border flex flex-col gap-3 ${
                  yr.hasData
                    ? yr.brokenSourceCount > 0
                      ? "bg-card border-amber-400/25"
                      : "bg-card border-border/60"
                    : "bg-muted/10 border-border/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground">{yr.year}</span>
                    {yr.year === CURRENT_YEAR && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {yr.totalAmount != null && (
                      <span className="text-xs font-semibold text-emerald-400">
                        ${yr.totalAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {yr.documentCount} {yr.documentCount === 1 ? "doc" : "docs"}
                    </span>
                  </div>
                </div>

                {yr.hasData ? (
                  <>
                    {/* Source health badges */}
                    {(yr.brokenSourceCount > 0 || yr.missingSourceCount > 0) && (
                      <div className="flex gap-2 flex-wrap">
                        {yr.brokenSourceCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {yr.brokenSourceCount} source{yr.brokenSourceCount > 1 ? "s need" : " needs"} review
                          </span>
                        )}
                        {yr.missingSourceCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 bg-muted/20 px-2 py-0.5 rounded-full border border-border/30">
                            <Link2Off className="w-2.5 h-2.5" />
                            {yr.missingSourceCount} source{yr.missingSourceCount > 1 ? "s" : ""} missing
                          </span>
                        )}
                      </div>
                    )}

                    {/* Document list */}
                    <div className="flex flex-col gap-1.5">
                      {yr.documents.map((d) => (
                        <div key={d.id} className="flex items-center gap-2">
                          <SourceStatusIcon status={d.sourceStatus} />
                          <Link href={`/documents/${d.id}`} className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-foreground hover:text-primary transition-colors truncate block">
                              {d.title}
                            </span>
                          </Link>
                          <span className="text-[10px] text-muted-foreground/60 capitalize shrink-0">
                            {d.docType}
                          </span>
                          {d.amountInvolved != null && d.amountInvolved > 0 && (
                            <span className="text-[10px] font-semibold text-emerald-400 shrink-0">
                              ${Number(d.amountInvolved).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                            </span>
                          )}
                          {d.sourceStatus === "valid" && d.sourceUrl && (
                            <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <ExternalLink className="w-3 h-3 text-primary/60 hover:text-primary" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    No verified public records found for {yr.year}.
                  </div>
                )}
              </Card>
            ))}

            <p className="text-[10px] text-muted-foreground/50 text-center px-4">
              Only verified public records appear here. No data is fabricated. If a year is missing, records have not been added yet.
            </p>
          </div>
        )}

        {/* ── Two-year comparison view ── */}
        {viewMode === "compare" && comparison && !compareLoading && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">{comparison.entityName}</h2>
              <p className="text-sm text-muted-foreground">
                {comparison.year1} ({comparison.year1DocumentCount} docs) vs {comparison.year2} ({comparison.year2DocumentCount} docs)
              </p>
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20">
              <p className="text-sm leading-relaxed text-foreground">{comparison.aiSummary}</p>
            </Card>

            <div className="flex flex-col gap-3">
              {comparison.changes.map((change, i) => {
                const isUp = (change.changePercent ?? 0) > 0;
                const isDown = (change.changePercent ?? 0) < 0;
                return (
                  <Card key={i} className="p-4 bg-card border-border/50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-bold">{change.label}</h3>
                      <FlagBadge level={change.redFlagLevel} />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      {isUp && <TrendingUp className="w-4 h-4 text-destructive shrink-0" />}
                      {isDown && <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />}
                      {!isUp && !isDown && <Minus className="w-4 h-4 text-muted-foreground shrink-0" />}
                      {change.changePercent != null && (
                        <span className={`text-sm font-bold ${isUp ? "text-destructive" : isDown ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {isUp ? "+" : ""}{change.changePercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {change.changeDescription && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{change.changeDescription}</p>
                    )}
                    {(change.year1Value != null || change.year2Value != null) && (
                      <div className="flex gap-4 mt-2 pt-2 border-t border-border/40">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground uppercase">{comparison.year1}</span>
                          <span className="text-xs font-medium">{change.year1Value != null ? `$${Number(change.year1Value).toLocaleString()}` : "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground uppercase">{comparison.year2}</span>
                          <span className="text-xs font-medium">{change.year2Value != null ? `$${Number(change.year2Value).toLocaleString()}` : "—"}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
