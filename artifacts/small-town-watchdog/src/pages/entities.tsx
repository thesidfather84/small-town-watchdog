import { useMemo } from "react";
import { useListEntities } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Landmark, ChevronRight, Globe, FileText, MapPin, Settings2 } from "lucide-react";
import { Link } from "wouter";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";
import { getStateName } from "@/data/locations";
import { LocationEmptyState } from "@/components/shared/LocationEmptyState";
import { matchesSelectedLocation } from "@/lib/location-filter";

export default function Entities() {
  const { selectedLocation } = useSelectedLocation();

  // Fetch entities filtered by state from the server; county/city filtering is client-side
  const queryParams = selectedLocation?.stateCode ? { state: selectedLocation.stateCode } : {};
  const { data: stateEntities = [], isLoading } = useListEntities(queryParams as Record<string, string>);

  // Apply county filter client-side
  const entities = useMemo(() => {
    if (!selectedLocation) return stateEntities;
    return stateEntities.filter((e) => matchesSelectedLocation(e, selectedLocation));
  }, [stateEntities, selectedLocation]);

  const locationLabel = selectedLocation
    ? `${selectedLocation.countyParish}, ${selectedLocation.stateName}`
    : null;

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Landmark className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Entities</h1>
          </div>
          {locationLabel && (
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
            >
              <MapPin className="w-3 h-3" />
              {locationLabel}
            </Link>
          )}
        </div>

        {locationLabel ? (
          <p className="text-sm text-muted-foreground -mt-2">
            Government bodies tracked in {selectedLocation?.countyParish ?? locationLabel}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground -mt-2">
            All tracked government bodies.{" "}
            <Link href="/settings" className="text-primary hover:underline">Set your location</Link> to filter.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-card" />
            ))
          ) : entities.length > 0 ? (
            entities.map((entity) => (
              <div key={entity.id} className="relative">
                <Link href={`/entities/${entity.id}`} data-testid={`card-entity-${entity.id}`} className="block">
                  <Card className="p-4 bg-card border-border/50 hover:border-primary/40 transition-all group cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {entity.type}
                          </span>
                          {!entity.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Inactive
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
                          {entity.name}
                        </h3>
                        {entity.location && (
                          <p className="text-xs text-muted-foreground">{entity.location}</p>
                        )}
                        {entity.website && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                            <Globe className="w-3 h-3 shrink-0" />
                            {entity.website.replace(/^https?:\/\//, "").slice(0, 40)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          <span>{entity.documentCount ?? 0} docs</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            ))
          ) : (
            <LocationEmptyState
              locationName={selectedLocation?.countyParish ?? locationLabel ?? undefined}
            />
          )}
        </div>

        {/* No-location prompt */}
        {!selectedLocation && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card/60 border border-border/40">
            <Settings2 className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Go to{" "}
              <Link href="/settings" className="text-primary font-semibold hover:underline">
                Settings
              </Link>{" "}
              to choose your city and filter to local agencies.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
