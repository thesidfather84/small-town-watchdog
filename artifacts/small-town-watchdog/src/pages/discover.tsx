import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useListEntities, useListSourceRegistry, useGetCityCoverage } from "@workspace/api-client-react";
import { useFollowedEntities, useSelectedLocation } from "@/hooks/useFollowedEntities";
import { US_STATES, GOVERNMENT_ENTITY_TYPES, getStateName } from "@/data/locations";
import { getParishesForState } from "@/data/parishes";
import type { ParishEntry } from "@/data/parishes";
import {
  MapPin, Search, ChevronRight, ChevronLeft, Check,
  Landmark, AlertCircle, Plus, Globe, ExternalLink,
  CheckCircle2, Clock, XCircle, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SubmitSourceModal } from "@/components/shared/SubmitSourceModal";

type Step = "parishes" | "parish-detail";

const CATEGORY_LABELS: Record<string, string> = {
  "agenda-page":        "Agenda Page",
  "minutes-page":       "Minutes Page",
  "budget-page":        "Budget Page",
  "audit-page":         "Audit Page",
  "election-page":      "Election Page",
  "public-notice-page": "Public Notice Page",
  "contract-page":      "Contract Page",
  "bid-page":           "Bid Page",
  "news-page":          "News Page",
};

const COVERAGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  full:           { label: "Full Coverage",          color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  partial:        { label: "Partial Coverage",       color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/25" },
  "election-only":{ label: "Election Coverage Only", color: "text-sky-400",    bg: "bg-sky-400/10",     border: "border-sky-400/25" },
  "budget-only":  { label: "Budget Coverage Only",   color: "text-violet-400", bg: "bg-violet-400/10",  border: "border-violet-400/25" },
  none:           { label: "No Verified Sources",    color: "text-muted-foreground", bg: "bg-card/60",   border: "border-border/40" },
};

export default function Discover() {
  const { followedIds, follow, unfollow, isFollowed } = useFollowedEntities();
  const { selectedLocation, setLocation } = useSelectedLocation();
  const { toast } = useToast();

  const [selectedState, setSelectedState] = useState(
    selectedLocation?.stateCode ?? US_STATES.filter((s) => s.available)[0]?.code ?? ""
  );
  const [selectedParish, setSelectedParish] = useState<ParishEntry | null>(null);
  const [step, setStep] = useState<Step>("parishes");
  const [search, setSearch] = useState("");
  const [submitModal, setSubmitModal] = useState<{ entityName?: string; entityType?: string } | null>(null);

  const { data: allEntities = [] } = useListEntities();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parishSourceRegistry = [] } = useListSourceRegistry(
    { state: selectedState, city: selectedParish?.countyParish },
    { query: { enabled: !!selectedParish } } as any
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coverage } = useGetCityCoverage(
    selectedParish?.stateCode ?? selectedState,
    selectedParish?.countyParish ?? "",
    { query: { enabled: !!selectedParish } } as any
  );

  const stateEntities = useMemo(
    () => allEntities.filter((e) => e.state === selectedState),
    [allEntities, selectedState]
  );

  const parishes = useMemo(() => getParishesForState(selectedState), [selectedState]);

  const filteredParishes = useMemo(() => {
    if (!search.trim()) return parishes;
    const q = search.toLowerCase();
    return parishes.filter((p) => p.countyParish.toLowerCase().includes(q));
  }, [parishes, search]);

  function entitiesForParish(parish: ParishEntry) {
    return stateEntities.filter(
      (e) => e.county?.toLowerCase() === parish.countyParish.toLowerCase()
    );
  }

  function dbEntitiesForParishType(parish: ParishEntry, type: string) {
    return stateEntities.filter(
      (e) => e.county?.toLowerCase() === parish.countyParish.toLowerCase() && e.type === type
    );
  }

  function registrySourcesForType(type: string) {
    return parishSourceRegistry.filter((s) => s.entityType === type);
  }

  function handleSelectState(code: string) {
    setSelectedState(code);
    setSelectedParish(null);
    setStep("parishes");
    setSearch("");
  }

  function handleSelectParish(parish: ParishEntry) {
    setSelectedParish(parish);
    setStep("parish-detail");
  }

  function handleTrackArea(parish: ParishEntry) {
    setLocation({
      stateCode: parish.stateCode,
      stateName: parish.stateName,
      countyParish: parish.countyParish,
    });
    toast({
      title: "Location set",
      description: `Now tracking ${parish.countyParish}, ${parish.stateName}`,
    });
  }

  // ── Parish detail ──────────────────────────────────────────────────────────
  if (step === "parish-detail" && selectedParish) {
    const coverageConfig = COVERAGE_CONFIG[coverage?.coverageLevel ?? "none"];
    const hasAnySources = parishSourceRegistry.length > 0;
    const isCurrentLocation =
      selectedLocation?.stateCode === selectedParish.stateCode &&
      selectedLocation?.countyParish === selectedParish.countyParish;
    const termLabel = selectedParish.countyType === "parish" ? "Parish" : "County";

    return (
      <AppLayout>
        <div className="p-4 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => { setStep("parishes"); setSelectedParish(null); }}
              className="p-1 rounded hover:bg-card transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold leading-tight">{selectedParish.countyParish}</h1>
              <p className="text-xs text-muted-foreground">{selectedParish.stateName}</p>
            </div>
            {isCurrentLocation ? (
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                My Area
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8 border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => handleTrackArea(selectedParish)}
              >
                <MapPin className="w-3 h-3" />
                Track This Area
              </Button>
            )}
          </div>

          {/* Coverage badge */}
          {coverage && (
            <div className={cn("flex items-center justify-between p-3.5 rounded-xl border", coverageConfig.bg, coverageConfig.border)}>
              <div className="flex flex-col gap-0.5">
                <span className={cn("text-xs font-bold", coverageConfig.color)}>{coverageConfig.label}</span>
                {coverage.verifiedSourceCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {coverage.verifiedSourceCount} verified source{coverage.verifiedSourceCount !== 1 ? "s" : ""} across {Object.values(coverage.entityTypeCoverage ?? {}).filter(v => v !== "none").length} agencies
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs border-border/60"
                onClick={() => setSubmitModal({})}
              >
                <Send className="w-3 h-3" />
                Submit Source
              </Button>
            </div>
          )}

          {/* No sources */}
          {!hasAnySources && coverage && (
            <div className="flex flex-col gap-3 p-4 rounded-xl border border-amber-400/25 bg-amber-400/8">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300/90 leading-relaxed">
                  No verified sources have been added for {selectedParish.countyParish} yet.
                  Help expand our coverage by submitting an official source.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 gap-1.5"
                  onClick={() => setSubmitModal({})}
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Source
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border/40 text-muted-foreground gap-1.5"
                  onClick={() =>
                    toast({
                      title: `${termLabel} requested`,
                      description: `We'll prioritize adding official sources for ${selectedParish.countyParish}.`,
                    })
                  }
                >
                  Request This {termLabel}
                </Button>
              </div>
            </div>
          )}

          {/* Entity types */}
          <div className="flex flex-col gap-3">
            {GOVERNMENT_ENTITY_TYPES.map((entityType) => {
              const dbMatches = dbEntitiesForParishType(selectedParish, entityType.type);
              const sources = registrySourcesForType(entityType.type);
              const hasDBEntity = dbMatches.length > 0;
              const hasSources = sources.length > 0;

              return (
                <Card
                  key={entityType.type}
                  className={cn(
                    "p-4 flex flex-col gap-3 border transition-all",
                    hasSources || hasDBEntity
                      ? "bg-card border-border/60 shadow-sm"
                      : "bg-card/50 border-border/35"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        hasSources || hasDBEntity ? "text-primary/80" : "text-muted-foreground/60"
                      )}>
                        {entityType.label}
                      </span>
                      {dbMatches.length > 0 ? (
                        dbMatches.map((entity) => {
                          const followed = isFollowed(entity.id);
                          return (
                            <div key={entity.id} className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-sm font-semibold text-foreground leading-snug truncate">
                                {entity.name}
                              </span>
                              <Button
                                size="sm"
                                variant={followed ? "default" : "outline"}
                                className={cn(
                                  "shrink-0 gap-1.5 h-8 px-2.5 text-xs",
                                  followed
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50"
                                )}
                                onClick={() => {
                                  if (followed) {
                                    unfollow(entity.id);
                                    toast({ title: `Unfollowed ${entity.name}` });
                                  } else {
                                    follow(entity.id);
                                    toast({ title: `Following ${entity.name}` });
                                  }
                                }}
                              >
                                {followed ? <><Check className="w-3 h-3" />Following</> : <><Plus className="w-3 h-3" />Follow</>}
                              </Button>
                            </div>
                          );
                        })
                      ) : (
                        <span className={cn(
                          "text-sm font-medium leading-snug",
                          hasSources ? "text-muted-foreground" : "text-muted-foreground/50"
                        )}>
                          {hasSources ? entityType.description : "Not yet tracked"}
                        </span>
                      )}
                    </div>
                  </div>

                  {sources.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                        Sources
                      </span>
                      {sources.map((source) => {
                        const isVerified = source.verificationStatus === "verified";
                        const isPending = source.verificationStatus === "pending";
                        const isBroken = source.verificationStatus === "broken";
                        return (
                          <div key={source.id} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              {isPending && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              {isBroken && <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                              {!isVerified && !isPending && !isBroken && <Clock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                              <div className="flex flex-col min-w-0">
                                <span className={cn(
                                  "text-xs font-medium truncate",
                                  isVerified ? "text-foreground" : "text-muted-foreground/70"
                                )}>
                                  {CATEGORY_LABELS[source.sourceCategory] ?? source.sourceCategory}
                                </span>
                                <span className="text-[10px] text-muted-foreground/50">{source.sourcePlatform}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {source.lastChecked && (
                                <span className="text-[10px] text-muted-foreground/40">
                                  {new Date(source.lastChecked).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                </span>
                              )}
                              <a
                                href={source.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground/40 hover:text-primary transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!hasSources && (
                    <div className="flex items-center justify-between border-t border-border/30 pt-2.5">
                      <span className="text-[10px] text-muted-foreground/40">No verified sources yet</span>
                      <button
                        onClick={() => setSubmitModal({ entityName: undefined, entityType: entityType.type })}
                        className="text-[10px] font-semibold text-primary/60 hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />Submit Source
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="p-4 rounded-xl bg-card/60 border border-border/40 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Know an official source?</p>
              <p className="text-[11px] text-muted-foreground">Help us build the most complete public record registry.</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setSubmitModal({})}>
              <Send className="w-3.5 h-3.5" />
              Submit
            </Button>
          </div>
        </div>

        {submitModal !== null && (
          <SubmitSourceModal
            state={selectedParish.stateCode}
            city={selectedParish.countyParish}
            county={selectedParish.countyParish}
            prefillEntityType={submitModal.entityType}
            prefillEntityName={submitModal.entityName}
            onClose={() => setSubmitModal(null)}
          />
        )}
      </AppLayout>
    );
  }

  // ── Parish list ────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Find Agencies</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground -mt-2">
          Browse parishes and counties to see tracked agencies and sources.
        </p>

        {/* State pills */}
        <div className="flex gap-2 flex-wrap">
          {US_STATES.filter((s) => s.available).map((s) => (
            <button
              key={s.code}
              onClick={() => handleSelectState(s.code)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                selectedState === s.code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {getStateName(s.code)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder={`Search ${getStateName(selectedState)} parishes / counties…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Parish list */}
        <div className="flex flex-col gap-2">
          {filteredParishes.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border/50 rounded-xl">
              <p className="text-muted-foreground text-sm">No results for "{search}"</p>
            </div>
          ) : (
            filteredParishes.map((parish) => {
              const matchingEntities = entitiesForParish(parish);
              const followedCount = matchingEntities.filter((e) => isFollowed(e.id)).length;
              const isActive =
                selectedLocation?.stateCode === parish.stateCode &&
                selectedLocation?.countyParish === parish.countyParish;

              return (
                <button
                  key={parish.countyParish}
                  onClick={() => handleSelectParish(parish)}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group",
                    isActive
                      ? "bg-primary/8 border-primary/30"
                      : "bg-card border-border/60 hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      "text-sm font-semibold transition-colors",
                      isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                    )}>
                      {parish.countyParish}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold text-emerald-400">My Area</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {followedCount > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {followedCount} followed
                      </span>
                    )}
                    {matchingEntities.length > 0 ? (
                      <span className="text-[10px] text-muted-foreground">
                        {matchingEntities.length} agenc{matchingEntities.length !== 1 ? "ies" : "y"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">No data yet</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {followedIds.length > 0 && (
          <div className="p-3 rounded-xl bg-primary/8 border border-primary/25 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-primary/90 font-medium">
              Following {followedIds.length} agenc{followedIds.length !== 1 ? "ies" : "y"} — visible on your dashboard.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
