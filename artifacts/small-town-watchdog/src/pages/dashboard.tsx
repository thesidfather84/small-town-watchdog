import { useMemo, useState } from "react";
import {
  useGetDashboardStats,
  useListEntities,
  useListAlerts,
  useListSourceRegistry,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AlertCard } from "@/components/shared/AlertCard";
import { EmailSignup } from "@/components/shared/EmailSignup";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";
import { matchesSelectedLocation } from "@/lib/location-filter";
import {
  subDays,
  subMonths,
  parseISO,
  isAfter,
  formatDistanceToNow,
  differenceInHours,
} from "date-fns";
import {
  MapPin,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Mail,
  Heart,
  Clock,
  Rss,
  FileText,
  Building2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ReportProblemButton } from "@/components/shared/ReportProblemButton";

type AlertTimeFilter = "30_days" | "90_days" | "6_months" | "1_year" | "all";

const TIME_FILTERS: { key: AlertTimeFilter; label: string }[] = [
  { key: "30_days",  label: "30 Days"  },
  { key: "6_months", label: "6 Months" },
  { key: "1_year",   label: "1 Year"   },
  { key: "all",      label: "All Time" },
];

function getCutoffDate(filter: AlertTimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case "30_days":  return subDays(now, 30);
    case "90_days":  return subDays(now, 90);
    case "6_months": return subMonths(now, 6);
    case "1_year":   return subMonths(now, 12);
    case "all":      return null;
  }
}

export default function Dashboard() {
  const { selectedLocation } = useSelectedLocation();
  const [timeFilter, setTimeFilter] = useState<AlertTimeFilter>("1_year");
  const [showSources, setShowSources]   = useState(false);
  const [showAgencies, setShowAgencies] = useState(false);

  // Data
  const statsParams = selectedLocation
    ? { stateCode: selectedLocation.stateCode, countyParish: selectedLocation.countyParish }
    : undefined;

  const { data: stats } = useGetDashboardStats(statsParams);
  const { data: _rawEntities } = useListEntities();
  const allEntities = Array.isArray(_rawEntities) ? _rawEntities : [];
  const { data: _rawAlerts = [], isLoading: alertsLoading } = useListAlerts({ limit: 200 });
  const allAlerts = Array.isArray(_rawAlerts) ? _rawAlerts : [];

  const { data: _rawSources = [] } = useListSourceRegistry(
    selectedLocation ? { state: selectedLocation.stateCode } : undefined
  );
  const allSources = Array.isArray(_rawSources) ? _rawSources : [];

  // Location-filtered entities
  const locationEntities = useMemo(() => {
    if (!selectedLocation) return [];
    return allEntities.filter((e) => matchesSelectedLocation(e, selectedLocation));
  }, [allEntities, selectedLocation]);

  // Location-filtered sources (client-side county filter since API only supports state)
  const locationSources = useMemo(() => {
    if (!selectedLocation) return [];
    return allSources.filter((s) => {
      const sameState  = s.state?.toUpperCase() === selectedLocation.stateCode;
      const sameCounty = s.county === selectedLocation.countyParish;
      return sameState && sameCounty;
    });
  }, [allSources, selectedLocation]);

  // Entity map for alert filtering
  const entityMap = useMemo(() => {
    const map = new Map<number, typeof allEntities[number]>();
    allEntities.forEach((e) => map.set(e.id, e));
    return map;
  }, [allEntities]);

  // Location-filtered alerts
  const locationAlerts = useMemo(() => {
    if (!selectedLocation) return [];
    return allAlerts.filter((a) => {
      const entity = entityMap.get(a.entityId);
      if (!entity) return false;
      return matchesSelectedLocation(entity, selectedLocation);
    });
  }, [allAlerts, selectedLocation, entityMap]);

  // Time-filtered alerts
  const filteredAlerts = useMemo(() => {
    const cutoff = getCutoffDate(timeFilter);
    if (!cutoff) return locationAlerts;
    return locationAlerts.filter((a) => {
      try { return isAfter(parseISO(a.createdAt), cutoff); } catch { return true; }
    });
  }, [locationAlerts, timeFilter]);

  // Next wider filter that has results (for empty-state suggestion)
  const nextFilterWithResults = useMemo(() => {
    if (filteredAlerts.length > 0) return null;
    const idx = TIME_FILTERS.findIndex((f) => f.key === timeFilter);
    for (let i = idx + 1; i < TIME_FILTERS.length; i++) {
      const cutoff = getCutoffDate(TIME_FILTERS[i].key);
      const count = cutoff
        ? locationAlerts.filter((a) => {
            try { return isAfter(parseISO(a.createdAt), cutoff); } catch { return true; }
          }).length
        : locationAlerts.length;
      if (count > 0) return TIME_FILTERS[i];
    }
    return null;
  }, [filteredAlerts.length, locationAlerts, timeFilter]);

  // Red/yellow/green split for feed prioritization
  const redAlerts    = filteredAlerts.filter((a) => a.redFlagLevel?.toLowerCase() === "red");
  const yellowAlerts = filteredAlerts.filter((a) => a.redFlagLevel?.toLowerCase() === "yellow");
  const greenAlerts  = filteredAlerts.filter((a) => !["red","yellow"].includes(a.redFlagLevel?.toLowerCase() ?? ""));

  // Freshness
  const freshnessText = useMemo(() => {
    if (locationAlerts.length === 0) return null;
    const newest = locationAlerts.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );
    const hoursOld = differenceInHours(new Date(), parseISO(newest.createdAt));
    if (hoursOld < 24) return "Updated today";
    return `Updated ${formatDistanceToNow(parseISO(newest.createdAt))} ago`;
  }, [locationAlerts]);

  const displayLocation = selectedLocation
    ? `${selectedLocation.countyParish}, ${selectedLocation.stateName}`
    : null;

  // ─── No location set ────────────────────────────────────────────────────────
  if (!selectedLocation) {
    return (
      <AppLayout>
        <div className="p-5 flex flex-col gap-6 items-center text-center pt-12">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-foreground">Choose Your Location</h2>
            <p className="text-sm text-muted-foreground max-w-[280px]">
              Select your state and parish or county to start seeing your local government records.
            </p>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors shadow-md"
          >
            <MapPin className="w-4 h-4" />
            Choose My Parish / County
          </Link>
        </div>
      </AppLayout>
    );
  }

  // ─── Main feed ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="flex flex-col gap-0">

        {/* ── Community Overview ─────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Watching</p>
              <h1 className="text-lg font-bold text-foreground leading-tight">{displayLocation}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="w-3 h-3" />
                  {locationEntities.length} {locationEntities.length === 1 ? "agency" : "agencies"}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Rss className="w-3 h-3" />
                  {locationSources.length} {locationSources.length === 1 ? "source" : "sources"} monitored
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  {locationAlerts.length} records
                </span>
              </div>
            </div>
            {freshnessText && (
              <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap shrink-0 mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {freshnessText}
              </span>
            )}
          </div>

          {/* Active flags summary */}
          {((stats?.redFlagCount ?? 0) > 0 || (stats?.yellowFlagCount ?? 0) > 0 || redAlerts.length > 0 || yellowAlerts.length > 0) && (
            <div className="flex gap-2 mt-3">
              {(redAlerts.length > 0) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span className="text-[11px] font-bold text-red-400">{redAlerts.length} Red Flag{redAlerts.length !== 1 ? "s" : ""}</span>
                </div>
              )}
              {(yellowAlerts.length > 0) && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="text-[11px] font-bold text-amber-400">{yellowAlerts.length} Warning{yellowAlerts.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Community Intelligence Feed ────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2 flex flex-col gap-4">

          {/* Time filter */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">Public Records Feed</h2>
            <div className="flex gap-1">
              {TIME_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTimeFilter(key)}
                  className={[
                    "px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                    timeFilter === key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-card",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed content */}
          {alertsLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl bg-card border border-border/50" />
              ))}
            </div>
          ) : filteredAlerts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Red flags first */}
              {redAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
              {/* Yellow warnings */}
              {yellowAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
              {/* Green / informational */}
              {greenAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
              {locationAlerts.length > filteredAlerts.length && (
                <button
                  onClick={() => setTimeFilter("all")}
                  className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-dashed border-border/50 rounded-xl hover:border-border transition-all"
                >
                  Show all {locationAlerts.length} records
                </button>
              )}
            </div>
          ) : locationAlerts.length > 0 ? (
            /* Has records, but not in this time range */
            <div className="flex flex-col gap-3 p-5 border border-dashed border-border/50 rounded-xl bg-card/40 text-center">
              <p className="text-sm font-semibold text-foreground">No records in this time range</p>
              {nextFilterWithResults ? (
                <button
                  onClick={() => setTimeFilter(nextFilterWithResults.key)}
                  className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/25 text-xs font-semibold text-primary hover:bg-primary/15 transition-all"
                >
                  <Clock className="w-3 h-3" />
                  Show {nextFilterWithResults.label}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">No records match this filter.</p>
              )}
            </div>
          ) : (
            /* No records for location at all */
            <div className="flex flex-col gap-4 p-5 border border-dashed border-border/50 rounded-xl bg-card/40 text-center">
              <p className="text-sm font-semibold text-foreground">No records yet for {displayLocation}</p>
              <p className="text-xs text-muted-foreground">
                Records appear here once our crawler has processed verified sources for this location.
                {locationSources.length > 0
                  ? ` We are monitoring ${locationSources.length} official source${locationSources.length !== 1 ? "s" : ""} and will post records as they become available.`
                  : " You can help by submitting an official source below."}
              </p>
              <div className="flex flex-col gap-2 mt-1">
                <a
                  href="mailto:coverage@smalltownwatchdog.com?subject=Coverage%20Request"
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors text-center"
                >
                  Request Coverage for This Area
                </a>
              </div>
            </div>
          )}

          {filteredAlerts.length > 0 && (
            <Link
              href="/alerts"
              className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary transition-colors py-2"
            >
              View full records archive →
            </Link>
          )}
        </div>

        {/* ── Official Sources (collapsed by default) ────────────────────── */}
        {locationSources.length > 0 && (
          <div className="px-4 py-3 border-t border-border/40">
            <button
              onClick={() => setShowSources((v) => !v)}
              className="w-full flex items-center justify-between gap-2 group"
            >
              <div className="flex items-center gap-2">
                <Rss className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  {locationSources.length} Official Source{locationSources.length !== 1 ? "s" : ""} Being Monitored
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">✓ Verified</span>
              </div>
              {showSources
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </button>

            {showSources && (
              <div className="flex flex-col gap-2 mt-3">
                {locationSources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-card border border-border/50"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {source.entityName}
                      </span>
                      <span className="text-xs text-foreground capitalize">
                        {source.sourceCategory?.replace(/-/g, " ")}
                      </span>
                      {source.verificationStatus === "verified" && (
                        <span className="text-[10px] text-emerald-400 font-semibold">✓ Verified Government Source</span>
                      )}
                    </div>
                    {source.sourceUrl && (
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Government Bodies (collapsed by default) ───────────────────── */}
        {locationEntities.length > 0 && (
          <div className="px-4 py-3 border-t border-border/40">
            <button
              onClick={() => setShowAgencies((v) => !v)}
              className="w-full flex items-center justify-between gap-2 group"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  {locationEntities.length} Government {locationEntities.length === 1 ? "Agency" : "Agencies"} in {selectedLocation.countyParish}
                </span>
              </div>
              {showAgencies
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </button>

            {showAgencies && (
              <div className="flex flex-col gap-1.5 mt-3">
                {locationEntities.map((entity) => (
                  <Link
                    key={entity.id}
                    href={`/entities/${entity.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-card/80 transition-all group"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground capitalize">
                        {entity.type?.replace(/-/g, " ")}
                      </span>
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {entity.name}
                      </span>
                    </div>
                    {entity.documentCount != null && entity.documentCount > 0 && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {entity.documentCount} records
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Email Signup ───────────────────────────────────────────────── */}
        <div className="px-4 py-4 border-t border-border/40">
          <EmailSignup />
        </div>

        {/* ── Community Actions ──────────────────────────────────────────── */}
        <div className="px-4 py-4 border-t border-border/40">
          <h2 className="text-sm font-bold text-foreground mb-3">Help Build Coverage</h2>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:coverage@smalltownwatchdog.com?subject=Coverage%20Request"
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-card/80 transition-all group"
            >
              <MapPin className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">Request Coverage</span>
                <span className="text-[11px] text-muted-foreground">Ask us to add your area</span>
              </div>
            </a>
            <a
              href="mailto:sources@smalltownwatchdog.com?subject=Official%20Source%20Submission"
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-card/80 transition-all group"
            >
              <Rss className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">Submit an Official Source</span>
                <span className="text-[11px] text-muted-foreground">Know of a government website we should monitor?</span>
              </div>
            </a>
            <a
              href="mailto:donate@smalltownwatchdog.com?subject=Donation"
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-card/80 transition-all group"
            >
              <Heart className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">Donate</span>
                <span className="text-[11px] text-muted-foreground">Help us expand coverage to more communities</span>
              </div>
            </a>
            <ReportProblemButton />
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
