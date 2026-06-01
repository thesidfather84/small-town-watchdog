import { eq, and, or, type SQL } from "drizzle-orm";
import { civicItemsTable } from "@workspace/db";

// Single source of truth for civic-item location filtering, driven by the
// item's `scope` plus the denormalized state/county columns.
//
// Rules:
//   - state only             => filter to that state (any scope)
//   - state + county/parish   => show an item when:
//        (scope = 'county_parish' AND state matches AND county matches)
//        OR (scope = 'statewide' AND state matches)
//     so a county selection surfaces that county's items PLUS the state's
//     statewide items (e.g. Legislative Auditor). Statewide items never
//     require a county_parish value.
//   - county only (no state)  => ignored (county is meaningless without a state)
export function civicLocationConditions(
  stateCode?: string,
  countyParish?: string
): SQL[] {
  if (!stateCode) return [];

  const stateMatch = eq(civicItemsTable.stateCode, stateCode);
  if (!countyParish) return [stateMatch];

  return [
    stateMatch,
    or(
      eq(civicItemsTable.scope, "statewide"),
      and(
        eq(civicItemsTable.scope, "county_parish"),
        eq(civicItemsTable.countyParish, countyParish)
      )
    )!,
  ];
}
