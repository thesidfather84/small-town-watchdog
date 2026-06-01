import type { SelectedLocation } from "@/hooks/useFollowedEntities";

export interface LocationFilterable {
  state?: string | null;
  city?: string | null;
  county?: string | null;
  type?: string | null;
}

export function matchesSelectedLocation(
  record: LocationFilterable,
  selectedLocation: SelectedLocation | null
): boolean {
  if (!selectedLocation) return false;

  const sameState  = record.state === selectedLocation.stateCode;
  const sameCounty = !!(record.county && record.county === selectedLocation.countyParish);
  const statewide  = record.type === "statewide" || record.type === "auditor";

  return sameState && (sameCounty || statewide);
}
