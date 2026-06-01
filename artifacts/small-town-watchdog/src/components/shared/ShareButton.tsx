import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  title: string;
  summary?: string | null;
  entityName?: string | null;
  date?: string | null;
  sourceUrl?: string | null;
  isAiGenerated?: boolean;
  className?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  label?: string;
}

export function ShareButton({
  title,
  summary,
  entityName,
  date,
  sourceUrl,
  isAiGenerated = false,
  className,
  variant = "outline",
  size = "sm",
  label = "Share",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  function buildShareText() {
    const lines: string[] = ["Small Town Watchdog", "", title];
    if (summary) lines.push("", summary);
    if (entityName) lines.push("", `Entity: ${entityName}`);
    if (date) lines.push(`Date: ${date}`);
    lines.push("", `Read more: ${currentUrl}`);
    if (sourceUrl) lines.push(`Original source: ${sourceUrl}`);
    if (isAiGenerated) {
      lines.push("", "AI-generated summary. Always verify with the original public source.");
    }
    return lines.join("\n");
  }

  async function handleShare() {
    const text = buildShareText();

    // Native share (mobile browsers, modern desktop Chrome/Edge)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Small Town Watchdog — ${title}`, text, url: currentUrl });
      } catch {
        // user cancelled — nothing to do
      }
      return;
    }

    // Desktop fallback: clipboard copy
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "Share text is ready to paste." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Last resort: mailto
      const subject = encodeURIComponent(`Small Town Watchdog — ${title}`);
      const body = encodeURIComponent(text);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      className={cn(
        "gap-1.5 transition-all",
        variant === "outline" && "border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/80",
        variant === "ghost"   && "text-muted-foreground hover:text-foreground hover:bg-white/5",
        className
      )}
      title="Share this"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          {size !== "icon" && <span className="text-emerald-400 text-xs">Copied!</span>}
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5 shrink-0" />
          {size !== "icon" && <span className="text-xs">{label}</span>}
        </>
      )}
    </Button>
  );
}
