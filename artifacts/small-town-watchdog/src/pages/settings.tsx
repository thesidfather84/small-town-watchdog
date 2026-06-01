import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield, Info, AlertTriangle, ScrollText, Lock, Bot, ChevronRight,
  MapPin, Landmark, Trash2, Settings2, Eye,
  RefreshCw, RotateCcw, Edit2,
} from "lucide-react";
import { Link } from "wouter";
import { useFollowedEntities, useSelectedLocation, resetLocationSettings } from "@/hooks/useFollowedEntities";
import { useListEntities } from "@workspace/api-client-react";
import { LocationPickerModal } from "@/components/settings/LocationPickerModal";
import { cn } from "@/lib/utils";
import { useRefreshAppData } from "@/hooks/useRefreshAppData";
import { DonationButton, MISSION_TEXT } from "@/components/shared/DonationButton";

export default function Settings() {
  const [, navigate] = useLocation();
  const { data: allEntities = [] } = useListEntities();
  const { followedIds, unfollow } = useFollowedEntities();
  const { selectedLocation, setLocation } = useSelectedLocation();
  const { refreshAppData } = useRefreshAppData();

  const [showPicker, setShowPicker] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  function handleShowWelcome() {
    localStorage.removeItem("stw_has_visited");
    navigate("/welcome");
  }

  function handleResetLocation() {
    if (!confirmReset) { setConfirmReset(true); return; }
    resetLocationSettings();
    navigate("/welcome");
  }

  const followedEntities = allEntities.filter((e) => followedIds.includes(e.id));

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* ── My Location ───────────────────────────────────────────────── */}
        <Card className="p-4 bg-card border-border/60 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <h2 className="text-sm font-bold">My Location</h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8 text-xs border-border/60"
              onClick={() => setShowPicker(true)}
            >
              <Edit2 className="w-3 h-3" />
              {selectedLocation ? "Change" : "Set Location"}
            </Button>
          </div>

          {/* No location set */}
          {!selectedLocation && (
            <div className="flex flex-col items-center gap-3 py-6 text-center border border-dashed border-border/50 rounded-xl bg-card/60">
              <MapPin className="w-8 h-8 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">No location selected</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                  Choose your parish or county to filter alerts and records for your area.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 mt-1"
                onClick={() => setShowPicker(true)}
              >
                <MapPin className="w-3.5 h-3.5" />
                Choose Parish / County
              </Button>
            </div>
          )}

          {/* Current location */}
          {selectedLocation && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/8 border border-primary/20">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <span className="text-sm font-semibold text-foreground leading-snug">
                  {selectedLocation.countyParish}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedLocation.stateName}
                </span>
              </div>
              <button
                onClick={() => setLocation(null)}
                className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0"
                title="Clear location"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Followed agencies */}
          {followedEntities.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Followed Agencies
              </p>
              {followedEntities.map((entity) => (
                <div
                  key={entity.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-card/60 border-border/50"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Landmark className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    <div className="flex flex-col gap-0 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {entity.type?.replace(/-/g, " ")}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate">{entity.name}</span>
                      {entity.city && (
                        <span className="text-[11px] text-muted-foreground">{entity.city}, {entity.state}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Link
                      href={`/entities/${entity.id}`}
                      className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-primary transition-colors"
                      title="View entity"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => unfollow(entity.id)}
                      className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-400 transition-colors"
                      title="Unfollow agency"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── About ────────────────────────────────────────────────────── */}
        <Card className="p-4 bg-card border-border/50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-bold">About Small Town Watchdog</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {MISSION_TEXT}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-primary">"We read the boring government documents so citizens don't have to."</span>
          </p>
          <DonationButton variant="subtle" />
        </Card>

        {/* ── Source Policy ─────────────────────────────────────────────── */}
        <Card className="p-4 bg-card border-border/50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-bold">Source Policy</h2>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0 mt-0.5">·</span>Only public government sources are tracked</li>
            <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0 mt-0.5">·</span>All source URLs are manually whitelisted by administrators</li>
            <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0 mt-0.5">·</span>We respect robots.txt and rate limits</li>
            <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0 mt-0.5">·</span>No login pages or private data are accessed</li>
            <li className="flex items-start gap-2"><span className="text-primary font-bold shrink-0 mt-0.5">·</span>AI summaries are labeled and never presented as official records</li>
          </ul>
        </Card>

        {/* ── Red Flag Key ──────────────────────────────────────────────── */}
        <Card className="p-4 bg-card border-border/50 flex flex-col gap-2">
          <h2 className="text-sm font-bold mb-1">Red Flag Key</h2>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-destructive shrink-0" />
              <span><strong className="text-foreground">Red Flag</strong> — Large increase (+25%) or unusual change. Possible red flag, not confirmed problem.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span><strong className="text-foreground">Warning</strong> — Notable increase (+10%) or important change worth watching.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span><strong className="text-foreground">Normal</strong> — No unusual activity detected.</span>
            </div>
          </div>
        </Card>

        {/* ── Legal Disclaimer ──────────────────────────────────────────── */}
        <Card className="p-4 bg-destructive/5 border-destructive/20 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <h2 className="text-sm font-bold text-destructive">Legal Disclaimer</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Small Town Watchdog provides automated summaries of public records using artificial intelligence. Summaries may contain errors. Always review the original source documents. Not legal, financial, or political advice. A red flag indicator does not imply wrongdoing.
          </p>
        </Card>

        {/* ── Legal & Policies ──────────────────────────────────────────── */}
        <Card className="bg-card border-border/50 overflow-hidden">
          <div className="p-3 border-b border-border/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Legal &amp; Policies</h2>
          </div>
          <Link href="/terms" className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors border-b border-border/30">
            <div className="flex items-center gap-3">
              <ScrollText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Terms &amp; Conditions</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link href="/privacy" className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors border-b border-border/30">
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link href="/ai-disclosure" className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI Disclosure Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </Card>

        {/* Active location debug box */}
        {selectedLocation && (
          <Card className="p-3 bg-muted/30 border-border/40 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Active Location Filter
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                {selectedLocation.countyParish}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground">
                {selectedLocation.stateName}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              Alerts and records are filtered to this parish / county. Use "Change" above to update.
            </p>
          </Card>
        )}

        {/* Refresh App Data */}
        <button
          onClick={refreshAppData}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border/40 bg-card/40 hover:bg-card hover:border-primary/30 transition-all text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh App Data
        </button>

        {/* Show welcome screen again */}
        <button
          onClick={handleShowWelcome}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border/40 bg-card/40 hover:bg-card hover:border-border/70 transition-all text-xs text-muted-foreground hover:text-foreground"
        >
          <Eye className="w-3.5 h-3.5" />
          Show welcome screen again
        </button>

        {/* Reset Location Settings */}
        <button
          onClick={handleResetLocation}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3 rounded-xl border transition-all text-xs",
            confirmReset
              ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "border-border/40 bg-card/40 hover:bg-card hover:border-red-400/30 text-muted-foreground hover:text-red-400"
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {confirmReset ? "Tap again to confirm — this clears all location data" : "Reset Location Settings"}
        </button>

        <p className="text-center text-[10px] text-muted-foreground pb-2">
          Small Town Watchdog · Local Government Transparency
        </p>
      </div>

      {showPicker && (
        <LocationPickerModal
          currentLocation={selectedLocation}
          onSelect={(loc) => { setLocation(loc); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </AppLayout>
  );
}
