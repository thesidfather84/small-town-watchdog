import { useState, useCallback, useEffect } from "react";
import { getStateName } from "@/data/locations";

const ENTITY_IDS_KEY        = "stw_followed_entity_ids";
const HOME_STATE_KEY        = "stw_home_state";
const SELECTED_LOCATION_KEY = "stw_selected_location";

// ─── Entity following ────────────────────────────────────────────────────────

function readIds(): number[] {
  try {
    const raw = localStorage.getItem(ENTITY_IDS_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}
function writeIds(ids: number[]) {
  localStorage.setItem(ENTITY_IDS_KEY, JSON.stringify(ids));
}

export function useFollowedEntities() {
  const [ids, setIds] = useState<number[]>(() => readIds());

  const follow = useCallback((id: number) => {
    setIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeIds(next);
      return next;
    });
  }, []);

  const unfollow = useCallback((id: number) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      writeIds(next);
      return next;
    });
  }, []);

  const isFollowed   = useCallback((id: number) => ids.includes(id), [ids]);
  const toggleFollow = useCallback(
    (id: number) => { if (ids.includes(id)) unfollow(id); else follow(id); },
    [ids, follow, unfollow]
  );

  return { followedIds: ids, follow, unfollow, isFollowed, toggleFollow };
}

// ─── Home state ──────────────────────────────────────────────────────────────

export function useHomeState() {
  const [homeState, setHomeStateLocal] = useState<string>(
    () => localStorage.getItem(HOME_STATE_KEY) ?? ""
  );
  const setHomeState = useCallback((code: string) => {
    localStorage.setItem(HOME_STATE_KEY, code);
    setHomeStateLocal(code);
  }, []);
  return { homeState, setHomeState };
}

// ─── Selected location (current filter context) ──────────────────────────────
// Shape: { stateCode, stateName, countyParish }
// Migrates from old shape: { state, countyParish, city }

export interface SelectedLocation {
  stateCode: string;
  stateName: string;
  countyParish: string;
}

function readSelectedLocation(): SelectedLocation | null {
  try {
    const raw = localStorage.getItem(SELECTED_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;

    // New format
    if (parsed.stateCode && parsed.stateName && parsed.countyParish) {
      return {
        stateCode: parsed.stateCode,
        stateName: parsed.stateName,
        countyParish: parsed.countyParish,
      };
    }

    // Migrate from old format { state, countyParish, city }
    if (parsed.state && parsed.countyParish) {
      const migrated: SelectedLocation = {
        stateCode: parsed.state,
        stateName: getStateName(parsed.state),
        countyParish: parsed.countyParish,
      };
      // Persist migrated format immediately
      localStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return null;
  } catch {
    return null;
  }
}

export function writeSelectedLocation(loc: SelectedLocation | null) {
  if (loc) localStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(loc));
  else localStorage.removeItem(SELECTED_LOCATION_KEY);
}

export function useSelectedLocation() {
  const [location, setLocationState] = useState<SelectedLocation | null>(
    () => readSelectedLocation()
  );

  const setLocation = useCallback((loc: SelectedLocation | null) => {
    writeSelectedLocation(loc);
    setLocationState(loc);
  }, []);

  // Re-read from localStorage when another tab changes it
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === SELECTED_LOCATION_KEY) {
        setLocationState(readSelectedLocation());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { selectedLocation: location, setLocation };
}

// ─── Reset all location settings ─────────────────────────────────────────────

export function resetLocationSettings() {
  try { localStorage.removeItem(SELECTED_LOCATION_KEY); } catch {}
  try { localStorage.removeItem("stw_followed_cities"); } catch {}  // legacy cleanup
  try { localStorage.removeItem("stw_default_city"); } catch {}    // legacy cleanup
  try { localStorage.removeItem(ENTITY_IDS_KEY); } catch {}
  try { localStorage.removeItem("stw_has_visited"); } catch {}
}
