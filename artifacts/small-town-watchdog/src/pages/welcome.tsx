import { useState } from "react";
import { useLocation } from "wouter";
import { MapPin, Vote, ArrowRight, ChevronDown } from "lucide-react";
import { useListEntities } from "@workspace/api-client-react";
import { LocationPickerModal } from "@/components/settings/LocationPickerModal";
import { useFollowedEntities, useSelectedLocation } from "@/hooks/useFollowedEntities";
import { markVisited } from "@/lib/visited";
import { DonationButton } from "@/components/shared/DonationButton";

export default function Welcome() {
  const [, navigate] = useLocation();
  const [showPicker, setShowPicker] = useState(false);
  const { data: allEntities = [] } = useListEntities();
  const { selectedLocation, setLocation } = useSelectedLocation();
  const { followedIds } = useFollowedEntities();

  const hasLocation = !!selectedLocation || followedIds.length > 0;

  function handleEnterApp() {
    if (!hasLocation) {
      // Must pick a location first — don't mark visited yet
      setShowPicker(true);
    } else {
      markVisited();
      navigate("/home");
    }
  }

  function handlePickerClose() {
    setShowPicker(false);
    // Do NOT markVisited — user cancelled without selecting a location
  }

  function handlePickerSelect(loc: Parameters<typeof setLocation>[0]) {
    if (loc) setLocation(loc);
    setShowPicker(false);
    markVisited(); // Location confirmed — now mark as visited
    navigate("/home");
  }

  function handleChooseLocation() {
    setShowPicker(true);
  }

  function handleElections() {
    markVisited();
    navigate("/elections");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">

      {/* Hero image — never cropped */}
      <div className="relative w-full flex-shrink-0">
        <img
          src="/watchdog-hero.png"
          alt="Small Town Watchdog detective dog holding a magnifying glass in front of City Hall and County Courthouse"
          className="w-full h-auto block"
          style={{ maxHeight: "62vh", objectFit: "contain", objectPosition: "top center" }}
        />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0f1e] to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="flex flex-col items-center px-5 pt-1 pb-10 gap-5 flex-1">

        {/* Location prompt */}
        <div className="text-center mt-1">
          <p className="text-base font-semibold text-white/90 leading-snug max-w-[280px] mx-auto">
            What community would you like me to watch?
          </p>
          <p className="text-xs text-blue-300/60 mt-1 max-w-[260px] mx-auto">
            Select your parish or county — I'll monitor official sources and surface records automatically.
          </p>
        </div>

        {/* Divider stars */}
        <div className="flex items-center gap-3">
          <span className="text-red-500 text-xs">★</span>
          <span className="w-12 h-px bg-white/10" />
          <span className="text-white/40 text-xs">★</span>
          <span className="w-12 h-px bg-white/10" />
          <span className="text-blue-500 text-xs">★</span>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={handleEnterApp}
            className="flex items-center justify-center gap-3 w-full rounded-2xl bg-[#c8102e] hover:bg-[#a50d24] active:scale-[0.98] transition-all text-white font-bold text-base tracking-wide shadow-lg shadow-red-900/40"
            style={{ minHeight: "54px" }}
          >
            <span>Enter App</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={handleChooseLocation}
            className="flex items-center justify-center gap-3 w-full rounded-2xl bg-white/8 hover:bg-white/12 active:scale-[0.98] border border-white/15 hover:border-white/25 transition-all text-white font-semibold text-sm tracking-wide"
            style={{ minHeight: "50px" }}
          >
            <MapPin className="w-4 h-4 text-blue-400" />
            <span>Choose My Parish / County</span>
            <ChevronDown className="w-4 h-4 text-white/40 ml-auto" />
          </button>

          <button
            onClick={handleElections}
            className="flex items-center justify-center gap-3 w-full rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] border border-white/10 hover:border-blue-500/30 transition-all text-white/80 hover:text-white font-semibold text-sm tracking-wide"
            style={{ minHeight: "50px" }}
          >
            <Vote className="w-4 h-4 text-blue-400/70" />
            <span>View Election Info</span>
          </button>
        </div>

        {/* Location status */}
        {hasLocation && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {selectedLocation
              ? `Tracking ${selectedLocation.countyParish}, ${selectedLocation.stateName}`
              : `Following ${followedIds.length} agenc${followedIds.length === 1 ? "y" : "ies"}`}
          </div>
        )}

        {/* Donation */}
        <div className="w-full max-w-sm">
          <DonationButton variant="ghost" />
        </div>

        {/* Footer */}
        <div className="mt-auto pt-2 flex flex-col items-center gap-1.5">
          <p className="text-[10px] text-white/25 text-center">
            Louisiana &amp; Mississippi Public Records Tracker
          </p>
          <p className="text-[9px] text-white/15 text-center max-w-[260px]">
            Free public record summaries. Not affiliated with any government entity.
          </p>
        </div>
      </div>

      {showPicker && (
        <LocationPickerModal
          currentLocation={selectedLocation}
          onSelect={handlePickerSelect}
          onClose={handlePickerClose}
        />
      )}
    </div>
  );
}
