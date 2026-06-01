const DONATION_URL = "https://buy.stripe.com/eVq28s61l24xaradYD33W00";

export function openDonationPage() {
  window.open(DONATION_URL, "_blank", "noopener,noreferrer");
}

interface Props {
  variant?: "primary" | "subtle" | "ghost";
  className?: string;
}

export function DonationButton({ variant = "subtle", className = "" }: Props) {
  const base = "flex items-center justify-center gap-2 w-full font-semibold text-xs transition-all active:scale-[0.98]";

  const styles: Record<string, string> = {
    primary:
      "h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm",
    subtle:
      "h-10 rounded-xl border border-rose-500/30 bg-rose-500/8 text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/50",
    ghost:
      "h-9 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/8",
  };

  return (
    <button
      onClick={openDonationPage}
      className={`${base} ${styles[variant]} ${className}`}
    >
      <span>❤️</span>
      Help Keep Small Town Watchdog Free
    </button>
  );
}

export const MISSION_TEXT =
  "Small Town Watchdog is an independent, nonpartisan platform helping citizens better understand local government information, elections, budgets, audits, and public records. Donations help support hosting, development, and keeping public information free.";
