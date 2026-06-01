import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Home, FileText, Vote, Landmark, MoreHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/",          icon: Home,            label: "Home"      },
  { href: "/alerts",    icon: FileText,        label: "Records"   },
  { href: "/elections", icon: Vote,            label: "Elections" },
  { href: "/entities",  icon: Landmark,        label: "Agencies"  },
  { href: "/discover",  icon: MoreHorizontal,  label: "More"      },
];

// Secret admin: tap Agencies 10 times within 8 seconds
const SECRET_TARGET = "/entities";
const SECRET_TAPS   = 10;
const SECRET_WINDOW = 8000;

export function BottomNav() {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Secret admin tap state
  const tapCount   = useRef(0);
  const tapTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapHint, setTapHint] = useState(0); // shows dot hints at 7+

  function handleHomeClick(e: React.MouseEvent) {
    const onHome = location === "/" || location === "/home";
    if (onHome) {
      e.preventDefault();
      setRefreshing(true);
      queryClient.invalidateQueries();
      setTimeout(() => setRefreshing(false), 1500);
    }
  }

  function handleSecretTap(e: React.MouseEvent) {
    // Don't interrupt normal nav if already on /admin
    if (location === "/admin") return;

    tapCount.current += 1;
    const count = tapCount.current;

    // Show hint dots in last 3 taps
    if (count >= SECRET_TAPS - 3) setTapHint(count);

    if (count >= SECRET_TAPS) {
      // Unlock — navigate to admin, reset
      e.preventDefault();
      tapCount.current = 0;
      setTapHint(0);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      navigate("/admin");
      return;
    }

    // Reset counter after window expires
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
      setTapHint(0);
    }, SECRET_WINDOW);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/60 pb-safe shadow-lg">
      <div className="w-full h-0.5 stripe-top" />
      {refreshing && (
        <div className="absolute -top-6 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[10px] text-primary/80 font-semibold bg-card/90 px-3 py-1 rounded-full border border-border/50 shadow-sm animate-pulse">
            Checking for updates…
          </span>
        </div>
      )}
      <div className="mx-auto max-w-[430px] flex justify-around items-center h-16 px-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href)) ||
            (item.href === "/" && location === "/home");
          const Icon = item.icon;
          const isHome    = item.href === "/";
          const isSecret  = item.href === SECRET_TARGET;

          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-${item.label.toLowerCase()}`}
              onClick={
                isHome   ? handleHomeClick :
                isSecret ? handleSecretTap :
                undefined
              }
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-150 rounded-lg mx-0.5",
                isActive
                  ? "text-red-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <div className={cn(
                "w-8 h-6 flex items-center justify-center rounded-md transition-colors relative",
                isActive && "bg-red-500/15"
              )}>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive && "fill-red-500/20",
                    isHome && refreshing && "animate-spin"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {/* Subtle tap hint dots — only visible during secret sequence */}
                {isSecret && tapHint >= SECRET_TAPS - 3 && tapHint < SECRET_TAPS && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary/60" />
                )}
              </div>
              <span className={cn(
                "text-[9px] font-semibold tracking-wide leading-none",
                isActive ? "text-red-400" : "text-muted-foreground"
              )}>
                {isHome && refreshing ? "Updating" : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
