import { useState } from "react";
import { useParams } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  ArrowLeft, Vote, Calendar, Clock, ExternalLink, Link2Off, Bot,
  CheckCircle, XCircle, DollarSign, Timer, Building2,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, MapPin
} from "lucide-react";
import { isValidSourceUrl } from "@/lib/source-url";
import { useGetElection, useListBallotItems, useExplainBallotItem } from "@workspace/api-client-react";
import type { BallotItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ShareButton } from "@/components/shared/ShareButton";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";

// Official resources keyed by state code — no hardcoded fallback
const OFFICIAL_RESOURCES: Record<string, {
  ballotCheck: { label: string; url: string };
  registration: { label: string; url: string };
  sos: { label: string; url: string };
}> = {
  LA: {
    ballotCheck: {
      label: "View Your Official Sample Ballot",
      url: "https://voterportal.sos.la.gov/SampleBallot",
    },
    registration: {
      label: "Verify Your Voter Registration",
      url: "https://www.sos.la.gov/ElectionsAndVoting/GetElectionInformation/LookUpYourRegistrationInformation/Pages/default.aspx",
    },
    sos: {
      label: "Louisiana Secretary of State",
      url: "https://www.sos.la.gov/ElectionsAndVoting/Pages/default.aspx",
    },
  },
  MS: {
    ballotCheck: {
      label: "Mississippi Sample Ballot Lookup",
      url: "https://www.sos.ms.gov/elections-voting/ballots",
    },
    registration: {
      label: "Mississippi Voter Registration",
      url: "https://www.sos.ms.gov/elections-voting/voter-registration",
    },
    sos: {
      label: "Mississippi Secretary of State — Elections",
      url: "https://www.sos.ms.gov/elections-voting",
    },
  },
};

function parseDateParts(dateStr: string): [number, number, number] | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts as [number, number, number];
}

function formatDate(dateStr: string) {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getDaysUntil(dateStr: string): number {
  const parts = parseDateParts(dateStr);
  if (!parts) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = parts;
  const target = new Date(year, month - 1, day);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  amendment: "Constitutional Amendment",
  proposition: "Proposition",
  tax: "Tax Measure",
  bond: "Bond Issue",
  race: "Candidate Race",
  renewal: "Tax Renewal",
};

const CHANGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "text-primary bg-primary/10 border-primary/20" },
  renewed: { label: "Renewal", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  increased: { label: "Increase", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  continued: { label: "Continuing", color: "text-muted-foreground bg-muted/40 border-border/40" },
};

function BallotItemCard({ item }: { item: BallotItem }) {
  const [expanded, setExpanded] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const queryClient = useQueryClient();
  const { mutateAsync: explain } = useExplainBallotItem();

  const changeType = item.changeType ? CHANGE_TYPE_LABELS[item.changeType] : null;
  const hasExplainer = !!(item.yesMeans || item.noMeans || item.description);

  const handleExplain = async () => {
    setExplainLoading(true);
    try {
      await explain({ id: item.id });
      queryClient.invalidateQueries({ queryKey: ["listBallotItems"] });
    } catch {
      /* fail silently */
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border/50 overflow-hidden">
      <button
        className="w-full p-4 text-left flex items-start justify-between gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
            </span>
            {changeType && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${changeType.color}`}>
                {changeType.label}
              </span>
            )}
            {item.isAiGenerated && (
              <span className="text-[10px] font-medium flex items-center gap-1 text-muted-foreground">
                <Bot className="w-3 h-3" />AI
              </span>
            )}
          </div>
          <h3 className="font-bold text-sm leading-snug">{item.title}</h3>
          {item.description && !expanded && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 flex flex-col gap-0">
          {item.description && (
            <div className="p-4 pb-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          )}

          {(item.yesMeans || item.noMeans) && (
            <div className="grid grid-cols-2 gap-0 border-t border-border/40">
              <div className="p-3 border-r border-border/40 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">YES means</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.yesMeans}</p>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">NO means</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.noMeans}</p>
              </div>
            </div>
          )}

          {(item.whoPays || item.amountInvolved || item.duration || item.receivingBody) && (
            <div className="border-t border-border/40 p-3 flex flex-col gap-2">
              {item.amountInvolved && (
                <div className="flex items-start gap-2 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Amount: </span>
                    <span className="text-muted-foreground">{item.amountInvolved}</span>
                  </div>
                </div>
              )}
              {item.whoPays && (
                <div className="flex items-start gap-2 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Who pays: </span>
                    <span className="text-muted-foreground">{item.whoPays}</span>
                  </div>
                </div>
              )}
              {item.duration && (
                <div className="flex items-start gap-2 text-xs">
                  <Timer className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Duration: </span>
                    <span className="text-muted-foreground">{item.duration}</span>
                  </div>
                </div>
              )}
              {item.receivingBody && (
                <div className="flex items-start gap-2 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">Goes to: </span>
                    <span className="text-muted-foreground">{item.receivingBody}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {item.officialText && (
            <div className="border-t border-border/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Official Language</p>
              <p className="text-xs text-muted-foreground leading-relaxed italic">{item.officialText}</p>
            </div>
          )}

          <div className="border-t border-border/40 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isValidSourceUrl(item.sourceUrl) ? (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Official Source
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/40 cursor-default select-none">
                  <Link2Off className="w-3 h-3" />
                  Source not added yet
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ShareButton
                title={item.title}
                summary={item.description}
                sourceUrl={item.sourceUrl}
                isAiGenerated={item.isAiGenerated}
                size="sm"
                variant="ghost"
                className="h-7 px-2"
              />
              {!hasExplainer && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  disabled={explainLoading}
                  onClick={handleExplain}
                >
                  {explainLoading ? (
                    <><RefreshCw className="w-3 h-3 animate-spin" />Explaining…</>
                  ) : (
                    <><Bot className="w-3 h-3" />AI Explain</>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-border/30 p-2 bg-muted/20">
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              This information does not constitute a recommendation on how to vote.{" "}
              {item.isAiGenerated && "AI-generated summary — verify with official sources."}{" "}
              Always confirm your ballot with official election authorities.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ElectionDetail() {
  const { id } = useParams<{ id: string }>();
  const electionId = parseInt(id ?? "0");
  const { data: election, isLoading } = useGetElection(electionId);
  const { data: ballotItems = [], isLoading: itemsLoading } = useListBallotItems(electionId);
  const { selectedLocation } = useSelectedLocation();

  // Resolve official resources from selectedLocation — no hardcoded state
  const officialRes = selectedLocation ? OFFICIAL_RESOURCES[selectedLocation.stateCode] ?? null : null;
  const stateName = selectedLocation?.stateName ?? null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4">
          <div className="h-32 bg-card border border-border/50 rounded-lg animate-pulse mt-4" />
        </div>
      </AppLayout>
    );
  }

  if (!election) {
    return (
      <AppLayout>
        <div className="p-4 flex flex-col gap-4">
          <Link href="/elections" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pt-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Elections
          </Link>
          <p className="text-muted-foreground text-sm">Election not found.</p>
        </div>
      </AppLayout>
    );
  }

  const daysUntil = getDaysUntil(election.electionDate);
  const isToday = daysUntil === 0;
  const isPast = daysUntil < 0;

  const typeLabel: Record<string, string> = {
    general: "General Election", primary: "Primary Election",
    special: "Special Election", runoff: "Runoff Election", local: "Local Election",
  };

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <Link href="/elections" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pt-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Elections
        </Link>

        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {typeLabel[election.electionType] ?? election.electionType}
            </span>
            {isToday && (
              <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full uppercase">
                Election Day
              </span>
            )}
            {!isPast && !isToday && daysUntil <= 7 && (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {daysUntil} day{daysUntil !== 1 ? "s" : ""} away
              </span>
            )}
            {isPast && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Past</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight leading-tight">{election.title}</h1>
        </div>

        <Card className="p-4 bg-card border-border/50 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span>{formatDate(election.electionDate)}</span>
          </div>
          {election.earlyVotingStart && election.earlyVotingEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>Early voting: {formatShortDate(election.earlyVotingStart)} – {formatShortDate(election.earlyVotingEnd)}</span>
            </div>
          )}
          {election.description && (
            <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-2.5 mt-0.5">
              {election.description}
            </p>
          )}
        </Card>

        <div className="flex flex-col gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Ballots vary by address and district. The items below may not match your specific ballot.{" "}
              {officialRes ? (
                <a
                  href={officialRes.ballotCheck.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Always verify with your official sample ballot.
                </a>
              ) : (
                "Always verify with your official sample ballot through your local election authority."
              )}
            </p>
          </div>
        </div>

        {ballotItems.length > 0 && (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Ballot Items ({ballotItems.length})
            </h2>
            <div className="flex flex-col gap-3">
              {itemsLoading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i} className="p-4 bg-card border-border/50 h-20 animate-pulse" />
                ))
              ) : (
                ballotItems.map((item) => (
                  <BallotItemCard key={item.id} item={item} />
                ))
              )}
            </div>
          </div>
        )}

        {ballotItems.length === 0 && !itemsLoading && (
          <Card className="p-6 bg-card border-border/50 flex flex-col items-center gap-2 text-center">
            <Vote className="w-7 h-7 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No ballot items have been added yet.</p>
            <p className="text-xs text-muted-foreground">Administrators can add ballot items via the Admin panel.</p>
          </Card>
        )}

        {officialRes && stateName && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Official {stateName} Resources
              </p>
            </div>
            <a href={officialRes.ballotCheck.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" />{officialRes.ballotCheck.label}
            </a>
            <a href={officialRes.registration.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" />{officialRes.registration.label}
            </a>
            <a href={officialRes.sos.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" />{officialRes.sos.label}
            </a>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
