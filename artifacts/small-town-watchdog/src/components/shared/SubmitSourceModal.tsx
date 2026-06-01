import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSourceSubmission } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { X, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { GOVERNMENT_ENTITY_TYPES } from "@/data/locations";

const SOURCE_CATEGORIES = [
  { value: "agenda-page",       label: "Agenda Page" },
  { value: "minutes-page",      label: "Minutes Page" },
  { value: "budget-page",       label: "Budget Page" },
  { value: "audit-page",        label: "Audit Page" },
  { value: "election-page",     label: "Election Page" },
  { value: "public-notice-page",label: "Public Notice Page" },
  { value: "contract-page",     label: "Contract Page" },
  { value: "bid-page",          label: "Bid Page" },
  { value: "news-page",         label: "News Page" },
];

interface Props {
  state: string;
  city: string;
  county?: string;
  prefillEntityName?: string;
  prefillEntityType?: string;
  onClose: () => void;
}

export function SubmitSourceModal({ state, city, county, prefillEntityName, prefillEntityType, onClose }: Props) {
  const { toast } = useToast();
  const { mutateAsync, isPending } = useCreateSourceSubmission();

  const [entityName, setEntityName] = useState(prefillEntityName ?? "");
  const [entityType, setEntityType] = useState(prefillEntityType ?? "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceCategory, setSourceCategory] = useState("");
  const [submitterNote, setSubmitterNote] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entityName || !entityType || !sourceUrl || !sourceCategory) return;

    try {
      await mutateAsync({
        data: { state, city, county, entityName, entityType, sourceUrl, sourceCategory, submitterNote: submitterNote || undefined },
      });
      toast({
        title: "Source submitted — thank you!",
        description: "Our team will review and verify your submission.",
      });
      onClose();
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl flex flex-col gap-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div>
            <h2 className="text-base font-bold">Submit a Source</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {city}, {state} · Pending admin review
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 mx-5 mt-4 p-3 rounded-xl bg-primary/8 border border-primary/20">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-primary/80 leading-relaxed">
            Submit an official government website, agenda page, budget page, or public notice.
            Only verified public sources are accepted.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {/* Entity name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Agency / Entity Name</label>
            <Input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="e.g. New Orleans City Council"
              required
            />
          </div>

          {/* Entity type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Entity Type</label>
            <Select value={entityType} onValueChange={setEntityType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {GOVERNMENT_ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                ))}
                <SelectItem value="special-district">Special District</SelectItem>
                <SelectItem value="utility-district">Utility District</SelectItem>
                <SelectItem value="drainage-district">Drainage District</SelectItem>
                <SelectItem value="fire-district">Fire District</SelectItem>
                <SelectItem value="planning-zoning">Planning / Zoning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Official Source URL</label>
            <Input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          {/* Source category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">What does this page contain?</label>
            <Select value={sourceCategory} onValueChange={setSourceCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">Note (optional)</label>
            <Textarea
              value={submitterNote}
              onChange={(e) => setSubmitterNote(e.target.value)}
              placeholder="Any context about this source..."
              rows={2}
              className="resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending || !entityName || !entityType || !sourceUrl || !sourceCategory}
            className={cn("gap-2 h-11", isPending && "opacity-70")}
          >
            <Send className="w-4 h-4" />
            {isPending ? "Submitting..." : "Submit for Review"}
          </Button>
        </form>
      </div>
    </div>
  );
}
