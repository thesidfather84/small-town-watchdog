import { MapPin, Send, Heart, Vote } from "lucide-react";
import { Link } from "wouter";
import { DonationButton } from "@/components/shared/DonationButton";

interface Props {
  locationName?: string;
  onChangeLocation?: () => void;
  showElectionButton?: boolean;
}

export function LocationEmptyState({ locationName, onChangeLocation, showElectionButton }: Props) {
  const requestSubject = locationName
    ? encodeURIComponent(`Coverage Request: ${locationName}`)
    : encodeURIComponent("Coverage Request");

  return (
    <div className="flex flex-col items-center justify-center py-10 px-5 border border-dashed border-border/50 rounded-2xl bg-card/40 gap-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center">
        <MapPin className="w-6 h-6 text-muted-foreground/40" />
      </div>

      <div className="flex flex-col gap-1.5 max-w-[280px]">
        <p className="text-sm font-bold text-foreground">
          No verified agencies are available for this area yet.
        </p>
        {locationName && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            We don't have verified data for <span className="font-semibold text-foreground/70">{locationName}</span> yet.
            Help us expand coverage by requesting it or submitting an official source.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[260px]">
        <a
          href={`mailto:support@smalltownwatchdog.com?subject=${requestSubject}`}
          className="flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
        >
          <MapPin className="w-3.5 h-3.5" />
          Request Coverage
        </a>

        <a
          href="mailto:support@smalltownwatchdog.com?subject=Submit%20Official%20Source"
          className="flex items-center justify-center gap-2 h-10 rounded-xl bg-card border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          Submit Official Source
        </a>

        <div className="w-full">
          <DonationButton variant="ghost" />
        </div>

        {showElectionButton && (
          <a
            href="mailto:support@smalltownwatchdog.com?subject=Missing%20Election%20Info"
            className="flex items-center justify-center gap-2 h-10 rounded-xl bg-card border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            <Vote className="w-3.5 h-3.5" />
            Report missing election
          </a>
        )}

        {onChangeLocation ? (
          <button
            onClick={onChangeLocation}
            className="flex items-center justify-center gap-2 h-9 rounded-xl bg-transparent text-[11px] text-muted-foreground/60 hover:text-foreground transition-all"
          >
            <MapPin className="w-3 h-3" />
            Change location
          </button>
        ) : (
          <Link
            href="/settings"
            className="flex items-center justify-center gap-2 h-9 rounded-xl bg-transparent text-[11px] text-muted-foreground/60 hover:text-foreground transition-all"
          >
            <MapPin className="w-3 h-3" />
            Change location
          </Link>
        )}
      </div>
    </div>
  );
}
