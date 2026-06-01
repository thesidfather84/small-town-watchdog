import { useState, useMemo } from "react";
import { X, MapPin, ChevronRight, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { US_STATES } from "@/data/locations";
import { getParishesForState } from "@/data/parishes";
import type { SelectedLocation } from "@/hooks/useFollowedEntities";
import { cn } from "@/lib/utils";

interface Props {
  currentLocation?: SelectedLocation | null;
  onSelect: (loc: SelectedLocation) => void;
  onClose: () => void;
}

type Step = "state" | "parish";

export function LocationPickerModal({ currentLocation, onSelect, onClose }: Props) {
  const [step, setStep] = useState<Step>(
    currentLocation?.stateCode ? "parish" : "state"
  );
  const [selectedState, setSelectedState] = useState<{ code: string; name: string } | null>(
    currentLocation?.stateCode
      ? { code: currentLocation.stateCode, name: currentLocation.stateName }
      : null
  );
  const [query, setQuery] = useState("");

  const availableStates = US_STATES.filter((s) => s.available);

  const parishes = useMemo(() => {
    if (!selectedState) return [];
    return getParishesForState(selectedState.code);
  }, [selectedState]);

  const filteredParishes = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return parishes;
    return parishes.filter((p) => p.countyParish.toLowerCase().includes(q));
  }, [parishes, query]);

  function handleStateSelect(code: string, name: string) {
    setSelectedState({ code, name });
    setQuery("");
    setStep("parish");
  }

  function handleParishSelect(countyParish: string) {
    if (!selectedState) return;
    onSelect({
      stateCode: selectedState.code,
      stateName: selectedState.name,
      countyParish,
    });
    onClose();
  }

  const termLabel = selectedState?.code === "LA" ? "Parish" : "County";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0d1425] rounded-t-3xl border border-white/10 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            {step === "parish" && (
              <button
                onClick={() => { setStep("state"); setQuery(""); }}
                className="p-1 rounded-full text-white/50 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-white">Choose Your Area</h2>
              <p className="text-xs text-white/40">
                {step === "state"
                  ? "Select a state to get started"
                  : `Select your ${termLabel.toLowerCase()} in ${selectedState?.name}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step: State */}
        {step === "state" && (
          <div className="px-5 pb-6 flex flex-col gap-2 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
              Available States
            </p>
            {availableStates.map((s) => (
              <button
                key={s.code}
                onClick={() => handleStateSelect(s.code, s.name)}
                className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-blue-400/70 shrink-0" />
                  <span className="text-sm font-semibold text-white">{s.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            ))}
            <p className="text-[10px] text-white/20 text-center mt-2">
              Additional states coming soon
            </p>
          </div>
        )}

        {/* Step: Parish / County */}
        {step === "parish" && (
          <>
            {/* Search bar */}
            <div className="px-5 pb-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  placeholder={`Search ${termLabel.toLowerCase()}…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Parish list */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 flex flex-col gap-1.5">
              {filteredParishes.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-6">No results found</p>
              ) : (
                filteredParishes.map((p) => {
                  const isActive = currentLocation?.countyParish === p.countyParish &&
                    currentLocation?.stateCode === p.stateCode;
                  return (
                    <button
                      key={p.countyParish}
                      onClick={() => handleParishSelect(p.countyParish)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left",
                        isActive
                          ? "bg-primary/15 border-primary/40 text-white"
                          : "bg-white/4 border-white/8 hover:bg-white/8 hover:border-white/15 text-white/80 hover:text-white"
                      )}
                    >
                      <span className="text-sm font-medium">{p.countyParish}</span>
                      {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Footer hint */}
        <div className="shrink-0 px-5 pb-5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-white/30 text-xs hover:text-white/60"
            onClick={onClose}
          >
            Cancel — I'll set this later
          </Button>
        </div>
      </div>
    </div>
  );
}
