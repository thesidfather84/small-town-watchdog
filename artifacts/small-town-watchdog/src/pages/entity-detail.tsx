import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetEntity, useListDocuments } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { FlagBadge } from "@/components/shared/FlagBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Globe, FileText, ChevronRight, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

const DOC_TYPES = ["All", "budget", "agenda", "minutes", "audit", "contract", "spending", "notice", "tax", "zoning"];
const YEARS = ["All", "2026", "2025", "2024", "2023"];

export default function EntityDetail() {
  const [, params] = useRoute("/entities/:id");
  const id = parseInt(params?.id ?? "0", 10);
  const [selectedType, setSelectedType] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entity, isLoading: entityLoading } = useGetEntity(id, { query: { enabled: !!id } } as any);

  const docParams: Record<string, string | number> = { entityId: id, limit: 100 };
  if (selectedType !== "All") docParams.type = selectedType;
  if (selectedYear !== "All") docParams.year = parseInt(selectedYear, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: documents, isLoading: docsLoading } = useListDocuments(docParams, { query: { enabled: !!id } } as any);

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <Link href="/entities" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pt-2">
          <ArrowLeft className="w-4 h-4" />
          All Entities
        </Link>

        {entityLoading ? (
          <Skeleton className="h-24 w-full rounded-xl bg-card" />
        ) : entity ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entity.type}</span>
            <h1 className="text-2xl font-bold tracking-tight">{entity.name}</h1>
            {entity.location && <p className="text-sm text-muted-foreground">{entity.location}</p>}
            {entity.description && <p className="text-sm text-muted-foreground mt-1">{entity.description}</p>}
            {entity.website && (
              <a href={entity.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline mt-1 w-fit">
                <Globe className="w-3 h-3" />
                Official Website
              </a>
            )}
          </div>
        ) : (
          <p className="text-destructive text-sm">Entity not found.</p>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {YEARS.map((y) => (
              <button
                key={y}
                data-testid={`filter-year-${y}`}
                onClick={() => setSelectedYear(y)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedYear === y
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {DOC_TYPES.map((t) => (
              <button
                key={t}
                data-testid={`filter-type-${t}`}
                onClick={() => setSelectedType(t)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                  selectedType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div className="flex flex-col gap-3">
          {docsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl bg-card" />
            ))
          ) : documents?.length ? (
            documents.map((doc) => (
              <Link key={doc.id} href={`/documents/${doc.id}`} data-testid={`card-doc-${doc.id}`} className="block">
                <Card className="p-4 bg-card border-border/50 hover:border-primary/40 transition-all group cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                          {doc.docType}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {doc.year}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {doc.title}
                      </h3>
                      {doc.plainSummary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{doc.plainSummary}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <FlagBadge level={doc.redFlagLevel} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-xl gap-3">
              <FileText className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm text-center">No documents found with these filters.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
