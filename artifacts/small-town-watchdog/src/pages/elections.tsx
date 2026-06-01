import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  Vote, Calendar, Bell, BellOff, ChevronRight,
  AlertTriangle, MapPin, Clock, CheckCircle2
} from "lucide-react";
import { useListElections, useListEntities } from "@workspace/api-client-react";
import {
  getNotificationPermission,
  requestNotificationPermission,
  getElectionAlerts,
  showElectionNotification,
  type NotificationPermissionState,
} from "@/lib/notifications";
import type { Election } from "@workspace/api-client-react";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";

function parseDateParts(dateStr: string | null | undefined): [number, number, number] | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts as [number, number, number];
}

function formatDate(dateStr: string | null | undefined) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "Date unknown";
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string | null | undefined) {
  const parts = parseDateParts(dateStr);
  if (!parts) return "Unknown date";
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysUntil(dateStr: string | null | undefined): number {
  const parts = parseDateParts(dateStr);
  if (!parts) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function ElectionCard({ election }: { election: Election }) {
  const daysUntil = getDaysUntil(election.electionDate);
  const isToday = daysUntil === 0;
  const isPast = daysUntil < 0;
  const isSoon = daysUntil > 0 && daysUntil <= 7;

  const typeLabel: Record<string, string> = {
    general: "General Election",
    primary: "Primary Election",
    special: "Special Election",
    runoff: "Runoff Election",
    local: "Local Election",
  };

  return (
    <Link href={`/elections/${election.id}`}>
      <Card className={`p-4 bg-card border-border/50 flex flex-col gap-3 hover:bg-muted/20 transition-colors active:scale-[0.99] cursor-pointer ${
        isToday ? "border-destructive/50 bg-destructive/5" : ""
      }`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {typeLabel[election.electionType] ?? election.electionType}
              </span>
              {isToday && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
                  TODAY
                </span>
              )}
              {isSoon && !isToday && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  {daysUntil} day{daysUntil !== 1 ? "s" : ""} away
                </span>
              )}
              {isPast && (
                <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                  Past
                </span>
              )}
            </div>
            <h2 className="font-bold text-base leading-tight">{election.title}</h2>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        </div>

        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{formatDate(election.electionDate)}</span>
          </div>
          {election.earlyVotingStart && election.earlyVotingEnd && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Early voting: {formatShortDate(election.earlyVotingStart)} – {formatShortDate(election.earlyVotingEnd)}</span>
            </div>
          )}
          {(election.ballotItemCount ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <Vote className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{election.ballotItemCount} ballot item{election.ballotItemCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {election.description && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-2 line-clamp-2">
            {election.description}
          </p>
        )}
      </Card>
    </Link>
  );
}

function NotificationBanner({
  permission,
  onRequest,
}: {
  permission: NotificationPermissionState;
  onRequest: () => void;
}) {
  if (permission === "granted") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Election reminders are on. You'll be notified on election day and the day before.</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/40 text-xs text-muted-foreground">
        <BellOff className="w-4 h-4 shrink-0" />
        <span>Notifications are blocked. Enable them in your browser settings to receive election reminders.</span>
      </div>
    );
  }

  if (permission === "unsupported") return null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
      <div className="flex items-center gap-2 text-xs text-foreground">
        <Bell className="w-4 h-4 text-primary shrink-0" />
        <span>Get notified on election day and the day before early voting starts.</span>
      </div>
      <Button size="sm" onClick={onRequest} className="shrink-0 text-xs h-7 px-3">
        Enable
      </Button>
    </div>
  );
}

// Official resource links keyed by state code — no default fallback
const OFFICIAL_LINKS: Record<string, Array<{ label: string; url: string }>> = {
  LA: [
    { label: "Louisiana Secretary of State — GeauxVote", url: "https://www.sos.la.gov/ElectionsAndVoting/Pages/default.aspx" },
    { label: "Verify Your Voter Registration", url: "https://www.sos.la.gov/ElectionsAndVoting/GetElectionInformation/LookUpYourRegistrationInformation/Pages/default.aspx" },
    { label: "View Your Sample Ballot", url: "https://voterportal.sos.la.gov/SampleBallot" },
  ],
  MS: [
    { label: "Mississippi Secretary of State — Elections", url: "https://www.sos.ms.gov/elections-voting" },
    { label: "Mississippi Voter Registration", url: "https://www.sos.ms.gov/elections-voting/voter-registration" },
    { label: "Mississippi Sample Ballot Lookup", url: "https://www.sos.ms.gov/elections-voting/ballots" },
  ],
};

// ── No-location gate ──────────────────────────────────────────────────────────

function NoLocationGate() {
  const [, navigate] = useLocation();
  return (
    <AppLayout>
      <div className="p-6 flex flex-col gap-8 pt-20 items-center text-center">
        <div className="w-16 h-16 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center">
          <Vote className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <div className="flex flex-col gap-2 max-w-xs">
          <h2 className="text-lg font-bold text-foreground">Select Your Location First</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please select a State and Parish/County to view election information for your area.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <Link href="/settings">
            <Button className="w-full gap-2">
              <MapPin className="w-4 h-4" />
              Select Location
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/home")}
          >
            Cancel
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

// ── Main Elections page ───────────────────────────────────────────────────────

export default function Elections() {
  const { selectedLocation } = useSelectedLocation();
  const { data: elections = [], isLoading: electionsLoading } = useListElections();
  const { data: allEntities = [], isLoading: entitiesLoading } = useListEntities();
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const isLoading = electionsLoading || entitiesLoading;

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  // ── Gate: require location ────────────────────────────────────────────────
  if (!selectedLocation) {
    return <NoLocationGate />;
  }

  // Build entity-ID → state map for election filtering
  const entityStateMap = new Map<number, string>();
  allEntities.forEach((e) => { if (e.state) entityStateMap.set(e.id, e.state); });

  // Filter elections by selected state only — no fallback to all
  const locationFilteredElections = elections.filter((e) => {
    if (e.entityId) {
      const entityState = entityStateMap.get(e.entityId);
      return entityState === selectedLocation.stateCode;
    }
    // No entityId — treat as statewide for the selected state; filter out other states
    const text = `${e.title} ${e.description ?? ""}`.toLowerCase();
    const otherStateNames = Object.entries({
      LA: "louisiana",
      MS: "mississippi",
    })
      .filter(([code]) => code !== selectedLocation.stateCode)
      .map(([, name]) => name);
    if (otherStateNames.some((s) => text.includes(s))) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = locationFilteredElections.filter((e) => {
    if (filter === "upcoming") return e.electionDate >= today;
    if (filter === "past") return e.electionDate < today;
    return true;
  });

  // Notification alerts
  useEffect(() => {
    if (permission === "granted" && filtered.length > 0) {
      const alerts = getElectionAlerts(filtered);
      for (const alert of alerts) {
        showElectionNotification(alert.title, alert.message);
      }
    }
  }, [permission, filtered]);

  const upcomingAlerts = filtered.length > 0
    ? getElectionAlerts(filtered.filter((e) => e.electionDate >= today))
    : [];

  // Official links — only show for the selected state; null if state not in map
  const officialLinks = OFFICIAL_LINKS[selectedLocation.stateCode] ?? null;

  const locationLabel = `${selectedLocation.countyParish}, ${selectedLocation.stateName}`;
  const hasElsewhere = elections.length > 0 && locationFilteredElections.length === 0;

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Vote className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Elections</h1>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
          >
            <MapPin className="w-3 h-3" />
            {locationLabel}
          </Link>
        </div>

        <div className="flex flex-col gap-2 p-3 rounded-lg border border-amber-500/25 bg-amber-500/5 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-semibold text-foreground">Ballots vary by address and precinct.</span>{" "}
              Always confirm your ballot with your official registrar before voting. This app does not endorse any candidate or position.
            </p>
          </div>
        </div>

        <NotificationBanner permission={permission} onRequest={async () => {
          const result = await requestNotificationPermission();
          setPermission(result);
        }} />

        {upcomingAlerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {upcomingAlerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                alert.type === "today"
                  ? "bg-destructive/10 border-destructive/30 text-foreground"
                  : "bg-amber-500/10 border-amber-500/30 text-foreground"
              }`}>
                <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${alert.type === "today" ? "text-destructive" : "text-amber-400"}`} />
                <div>
                  <p className="font-bold text-xs">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 bg-card border-border/50 h-28 animate-pulse" />
            ))}
          </div>
        ) : hasElsewhere ? (
          <Card className="p-8 bg-card border-border/50 flex flex-col items-center gap-3 text-center">
            <Vote className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No elections found for {locationLabel}.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Elections appear here once they are imported and approved for your area.
            </p>
            <a
              href="mailto:support@smalltownwatchdog.com?subject=Missing%20Election%20Info"
              className="text-xs text-primary hover:underline"
            >
              Report missing election info
            </a>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 bg-card border-border/50 flex flex-col items-center gap-3 text-center">
            <Vote className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {filter === "upcoming"
                ? `No upcoming elections tracked for ${locationLabel}.`
                : filter === "past"
                ? "No past elections on record."
                : "No elections on record."}
            </p>
            <a
              href="mailto:support@smalltownwatchdog.com?subject=Missing%20Election%20Info"
              className="text-xs text-primary hover:underline"
            >
              Report missing election info
            </a>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered
              .sort((a, b) => a.electionDate.localeCompare(b.electionDate))
              .map((election) => (
                <ElectionCard key={election.id} election={election} />
              ))}
          </div>
        )}

        {officialLinks && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Official {selectedLocation.stateName} Resources
                </p>
                {officialLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors underline underline-offset-2"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
