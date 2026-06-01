import { useState, useMemo } from "react";
import { useListAlerts, useListEntities } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AlertCard } from "@/components/shared/AlertCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Filter, MapPin, Clock, RefreshCw, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";
import { getStateName } from "@/data/locations";
import { LocationEmptyState } from "@/components/shared/LocationEmptyState";
import { matchesSelectedLocation } from "@/lib/location-filter";
import { useRefreshAppData } from "@/hooks/useRefreshAppData";
import { parseISO, differenceInHours, formatDistanceToNow } from "date-fns";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "new-agenda", label: "New Agenda" },
  { value: "budget-increase", label: "Budget Increase" },
  { value: "tax-proposal", label: "Tax Proposal" },
  { value: "public-hearing", label: "Public Hearing" },
  { value: "big-contract", label: "Big Contract" },
  { value: "audit-issue", label: "Audit Issue" },
  { value: "spending-increase", label: "Spending Increase" },
  { value: "zoning-change", label: "Zoning Change" },
  { value: "meeting-tonight", label: "Meeting Tonight" },
];

const FLAG_LEVELS = [
  { value: "", label: "All Flags" },
  { value: "red", label: "Red Flag" },
  { value: "yellow", label: "Warning" },
  { value: "green", label: "Normal" },
];

export default function Alerts() {
  const [category, setCategory] = useState("");
  const [flagLevel, setFlagLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { selectedLocation } = useSelectedLocation();
  const { refreshAppData } = useRefreshAppData();

  const params: Record<string, string | number> = { limit: 100 };
  if (category) params.category = category;
  if (flagLevel) params.redFlagLevel = flagLevel;

  const { data: rawAlerts = [], isLoading: alertsLoading } = useListAlerts(params);
  const { data: allEntities = [], isLoading: entitiesLoading } = useListEntities();

  const isLoading = alertsLoading || entitiesLoading;

  const entityMap = useMemo(() => {
    const map = new Map<number, typeof allEntities[number]>();
    allEntities.forEach((e) => map.set(e.id, e));
    return map;
  }, [allEntities]);

  const alerts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!selectedLocation) return [];
    return rawAlerts.filter((a) => {
      const entity = entityMap.get(a.entityId);
      if (!entity) return false;
      if (!matchesSelectedLocation(entity, selectedLocation)) return false;
      if (!q) return true;
      return (
        a.title?.toLowerCase().includes(q) ||
        a.plainSummary?.toLowerCase().includes(q) ||
        a.entityName?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      );
    });
  }, [rawAlerts, selectedLocation, entityMap, searchQuery]);

  const locationLabel = selectedLocation
    ? `${selectedLocation.countyParish}, ${selectedLocation.stateName}`
    : null;

  const hasDataElsewhere = selectedLocation !== null && rawAlerts.length > 0 && alerts.length === 0;

  // Freshness: based on most recent alert's createdAt
  const freshnessText = useMemo(() => {
    if (alerts.length === 0) return null;
    const newest = alerts.reduce((a, b) =>
      new Date(a.createdAt) > new Date(b.createdAt) ? a : b
    );
    try {
      const hoursOld = differenceInHours(new Date(), parseISO(newest.createdAt));
      if (hoursOld < 24) return "Data current as of today";
      return `Last updated ${formatDistanceToNow(parseISO(newest.createdAt))} ago · Data may need refresh`;
    } catch {
      return null;
    }
  }, [alerts]);

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Alerts Feed</h1>
          </div>
          <div className="flex items-center gap-2">
            {locationLabel && (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
              >
                <MapPin className="w-3 h-3" />
                {locationLabel}
              </Link>
            )}
            <button
              onClick={refreshAppData}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh app data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Freshness indicator */}
        {freshnessText && (
          <p className={`text-[11px] flex items-center gap-1 -mt-2 ${
            freshnessText.includes("may need refresh")
              ? "text-amber-400"
              : "text-emerald-400/80"
          }`}>
            <Clock className="w-3 h-3 shrink-0" />
            {freshnessText}
          </p>
        )}

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records, agencies, summaries…"
            className="w-full h-9 pl-9 pr-8 rounded-lg bg-card border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={flagLevel} onValueChange={setFlagLevel}>
            <SelectTrigger data-testid="select-flag-level" className="h-8 text-xs bg-card border-border">
              <SelectValue placeholder="All Flags" />
            </SelectTrigger>
            <SelectContent>
              {FLAG_LEVELS.map((f) => (
                <SelectItem key={f.value || "all-flags"} value={f.value || "all"}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-category" className="h-8 text-xs bg-card border-border">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value || "all-cats"} value={c.value || "all"}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl bg-card" />
            ))
          ) : alerts.length > 0 ? (
            alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
          ) : hasDataElsewhere ? (
            <LocationEmptyState
              locationName={selectedLocation?.countyParish ?? locationLabel ?? undefined}
            />
          ) : !selectedLocation ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3">
              <Bell className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm text-center">
                No alerts found.{" "}
                <Link href="/settings" className="text-primary hover:underline">
                  Set your location
                </Link>{" "}
                to see alerts for your area.
              </p>
            </div>
          ) : (
            <LocationEmptyState
              locationName={selectedLocation?.countyParish ?? locationLabel ?? undefined}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
