import { useState } from "react";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { useCreateEmailSubscriber } from "@workspace/api-client-react";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailSignup() {
  const { selectedLocation } = useSelectedLocation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { mutateAsync, isPending } = useCreateEmailSubscriber();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      await mutateAsync({
        data: {
          email: trimmed,
          stateCode: selectedLocation?.stateCode,
          countyParish: selectedLocation?.countyParish,
          signupSource: "home_page",
        },
      });
      setDone(true);
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-primary/25 bg-primary/5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Mail className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-bold text-foreground">Get notified when new records appear</h2>
      </div>

      <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-1">
        <li>• Public records &amp; meeting minutes</li>
        <li>• Elections &amp; candidate notices</li>
        <li>• Budget changes &amp; tax proposals</li>
        <li>• Red flags &amp; audit findings</li>
      </ul>

      {done ? (
        <div className="flex items-start gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <p>You're on the list. We'll send civic updates for your area.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-card border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
              aria-label="Email address"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Get Updates
            </button>
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </form>
      )}

      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        Neutral civic updates only. We don't sell your information or share it with sponsors.
        Optional — you can use the app without signing up.
      </p>
    </div>
  );
}
