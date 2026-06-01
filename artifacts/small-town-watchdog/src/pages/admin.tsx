import { useState, useCallback, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useListEntities, useListDocuments, useListSources,
  useCreateEntity, useUpdateEntity, useDeleteEntity,
  useCreateDocument, useUpdateDocument, useDeleteDocument,
  useCreateSource, useDeleteSource,
  useListSourceRegistry, useCreateSourceRegistry, useUpdateSourceRegistry, useDeleteSourceRegistry,
  useListSourceSubmissions, useUpdateSourceSubmission,
  useValidateSources,
  useGetDiagnostics,
  useListAdminCivicItems,
  useUpdateCivicItemReview,
  getListEntitiesQueryKey, getListDocumentsQueryKey, getListSourcesQueryKey,
  getGetDashboardStatsQueryKey, getListAlertsQueryKey,
  getListSourceRegistryQueryKey, getListSourceSubmissionsQueryKey,
  getListAdminCivicItemsQueryKey,
} from "@workspace/api-client-react";
import { useSelectedLocation } from "@/hooks/useFollowedEntities";
import { matchesSelectedLocation } from "@/lib/location-filter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlagBadge } from "@/components/shared/FlagBadge";
import { FlagItemButton } from "@/components/shared/FlagItemButton";
import {
  ShieldAlert, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Clock, ExternalLink, Globe, Link2Off, Bug,
  MapPin, RefreshCw, AlertTriangle, Download, Package, Database,
  Activity, FileText, Lock, Eye, EyeOff, LogOut, CheckCheck,
  ClipboardList, HardDrive, Wifi, WifiOff, Mail,
} from "lucide-react";
import { isValidSourceUrl } from "@/lib/source-url";
import { useToast } from "@/hooks/use-toast";
import { useListAlerts } from "@workspace/api-client-react";
import JSZip from "jszip";

// ─── Types ────────────────────────────────────────────────────────────────────

const DOC_TYPES = ["budget", "agenda", "minutes", "audit", "contract", "spending", "notice", "tax", "zoning"];
const FLAG_LEVELS = ["green", "yellow", "red"];
const ALERT_CATEGORIES = ["new-agenda", "budget-increase", "tax-proposal", "public-hearing", "big-contract", "audit-issue", "spending-increase", "zoning-change", "meeting-tonight"];
const ENTITY_TYPES = ["Parish Government", "City Government", "School Board", "Sheriff's Office", "Auditor", "Other"];
const REGISTRY_ENTITY_TYPES = ["city-government","county-government","parish-government","school-board","sheriff-office","police-department","election-office","planning-zoning","special-district","utility-district","drainage-district","fire-district"];
const REGISTRY_CATEGORIES = ["agenda-page","minutes-page","budget-page","audit-page","election-page","public-notice-page","contract-page","bid-page","news-page"];
const REGISTRY_PLATFORMS = ["Granicus","CivicPlus","Legistar","GovOS","Custom Website","PDF Repository","Other"];
const VERIFICATION_STATUSES = ["pending","verified","inactive","broken"];
const YEARS = ["2023", "2024", "2025", "2026"];

// ─── Password gate ─────────────────────────────────────────────────────────────
// Stored as SHA-256("Bull@rd2029!")
const ADMIN_HASH = "a84b503c02baa1de113d9c0a1d460cb36a53c688f67e881b9fd64089e102115e";
// Stored as SHA-256("122629") — admin PIN
const PIN_HASH = "d2e6ae7f0e839e05045c5d9e8dccad8a1737506c1e75a543a853a92472d2c396";
const SESSION_KEY = "stw_admin_v1";
const ADMIN_KEY_STORE = "stw_admin_key_v1";
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 hours

async function hashPwd(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// The matched credential hash is sent as the `x-admin-key` header so admin-only
// export endpoints (which expose source files) can verify the request.
function adminKey(): string {
  try { return localStorage.getItem(ADMIN_KEY_STORE) ?? ""; } catch { return ""; }
}
function isSessionValid(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { expires } = JSON.parse(raw) as { expires: number };
    return Date.now() < expires;
  } catch { return false; }
}
function setSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ expires: Date.now() + SESSION_TTL }));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ADMIN_KEY_STORE);
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!pwd) return;
    setBusy(true);
    setError("");
    const hash = await hashPwd(pwd);
    if (hash === ADMIN_HASH || hash === PIN_HASH) {
      setSession();
      try { localStorage.setItem(ADMIN_KEY_STORE, hash); } catch { /* ignore */ }
      onUnlock();
    } else {
      setError("Incorrect password or PIN.");
    }
    setBusy(false);
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
        <div className="flex flex-col items-center gap-8 w-full max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center flex flex-col gap-1">
            <h1 className="text-xl font-bold">Admin Access Required</h1>
            <p className="text-sm text-muted-foreground">Enter your admin password or PIN to continue.</p>
          </div>
          <form onSubmit={handleUnlock} className="flex flex-col gap-3 w-full">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                placeholder="Admin password or PIN"
                value={pwd}
                onChange={(e) => { setPwd(e.target.value); setError(""); }}
                className="bg-background pr-10"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={busy || !pwd} className="w-full">
              <Lock className="w-4 h-4 mr-2" />
              {busy ? "Checking…" : "Unlock Admin Panel"}
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchJSON(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function downloadZip(zip: JSZip, filename: string) {
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// For admin-only endpoints that require the x-admin-key header.
async function fetchAdminJSON(path: string) {
  const res = await fetch(path, { headers: { "x-admin-key": adminKey() } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const { selectedLocation } = useSelectedLocation();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      toast({ title: "Download started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function downloadDiagnostics() {
    await run("diagnostics", async () => {
      const params = selectedLocation
        ? `?stateCode=${selectedLocation.stateCode}&countyParish=${encodeURIComponent(selectedLocation.countyParish)}`
        : "";
      const diag = await fetchJSON(`/api/diagnostics${params}`);

      let apiHealth: Record<string, string> = {};
      try {
        const h = await fetchJSON("/api/healthz");
        apiHealth = h;
      } catch { apiHealth = { status: "unreachable" }; }

      const payload = {
        exported_at: new Date().toISOString(),
        selected_location: selectedLocation ?? {},
        database_counts: {
          locations: diag.locationsCount ?? 0,
          entities: diag.entitiesCount ?? 0,
          sources: diag.sourcesCount ?? 0,
          valid_sources: diag.validSources ?? 0,
          broken_sources: diag.brokenSources ?? 0,
        },
        source_counts: {
          valid: diag.validSources ?? 0,
          broken: diag.brokenSources ?? 0,
        },
        approved_items: diag.civicItemsApproved ?? 0,
        pending_items: diag.civicItemsPending ?? 0,
        broken_sources: diag.brokenSources ?? 0,
        last_scraper_run: diag.lastScraperRun ?? null,
        last_export_run: new Date().toISOString(),
        api_health: apiHealth,
        errors: [],
        raw: diag,
      };
      triggerDownload(JSON.stringify(payload, null, 2), "diagnostics.json");
    });
  }

  async function downloadCivicItems() {
    await run("civic-items", async () => {
      const items: any[] = await fetchJSON("/api/admin/civic-items");
      const safe = items.map((i: any) => ({
        id: i.id,
        title: i.title,
        item_type: i.itemType,
        state_code: i.stateCode ?? null,
        county_parish: i.countyParish ?? null,
        source_url: i.sourceUrl ?? null,
        source_agency: i.sourceAgency ?? null,
        source_status: i.sourceStatus,
        admin_review_status: i.adminReviewStatus,
        red_flag_level: i.redFlagLevel,
        amount_involved: i.amountInvolved ?? null,
        created_at: i.createdAt,
      }));
      triggerDownload(JSON.stringify(safe, null, 2), "civic_items.json");
    });
  }

  async function downloadSourceHealth() {
    await run("sources", async () => {
      const registry: any[] = await fetchJSON("/api/source-registry");
      const safe = registry.map((s: any) => ({
        source_title: s.entityName,
        source_url: s.sourceUrl,
        entity_type: s.entityType,
        source_category: s.sourceCategory,
        platform: s.sourcePlatform,
        verification_status: s.verificationStatus,
        state: s.state,
        county: s.county ?? null,
        city: s.city ?? null,
        last_checked_at: s.lastChecked ?? null,
        last_successful_fetch_at: s.lastSuccessfulUpdate ?? null,
        last_error: s.notes ?? null,
        is_active: s.isActive ?? true,
      }));
      triggerDownload(JSON.stringify(safe, null, 2), "sources.json");
    });
  }

  async function downloadScraperLog() {
    await run("scraper-log", async () => {
      const params = selectedLocation
        ? `?stateCode=${selectedLocation.stateCode}&countyParish=${encodeURIComponent(selectedLocation.countyParish)}`
        : "";
      const diag = await fetchJSON(`/api/diagnostics${params}`);
      const registry: any[] = await fetchJSON("/api/source-registry");
      const items: any[] = await fetchJSON("/api/admin/civic-items");

      const lines: string[] = [
        `Small Town Watchdog — Scraper Log Export`,
        `Generated: ${new Date().toISOString()}`,
        `Location: ${selectedLocation ? `${selectedLocation.countyParish}, ${selectedLocation.stateCode}` : "(no location selected)"}`,
        ``,
        `──────────────────────────────────────────`,
        `SOURCE VALIDATION`,
        `──────────────────────────────────────────`,
        ...registry.map((s: any) =>
          `[${(s.verificationStatus ?? "unknown").toUpperCase().padEnd(8)}] ${s.entityName} — ${s.sourceUrl}`
        ),
        ``,
        `──────────────────────────────────────────`,
        `FETCH RESULTS (source registry)`,
        `──────────────────────────────────────────`,
        `Total sources: ${registry.length}`,
        `Verified: ${registry.filter((s: any) => s.verificationStatus === "verified").length}`,
        `Broken: ${registry.filter((s: any) => s.verificationStatus === "broken").length}`,
        `Pending: ${registry.filter((s: any) => s.verificationStatus === "pending").length}`,
        ``,
        `──────────────────────────────────────────`,
        `PARSE RESULTS (civic items ingested)`,
        `──────────────────────────────────────────`,
        ...items.map((i: any) =>
          `[${(i.adminReviewStatus ?? "unknown").toUpperCase().padEnd(12)}] #${i.id} ${i.title}`
        ),
        ``,
        `──────────────────────────────────────────`,
        `APPROVAL PIPELINE`,
        `──────────────────────────────────────────`,
        `Total items: ${diag.civicItemsTotal ?? items.length}`,
        `Approved: ${diag.civicItemsApproved ?? items.filter((i: any) => i.adminReviewStatus === "approved").length}`,
        `Pending review: ${diag.civicItemsPending ?? items.filter((i: any) => i.adminReviewStatus === "needs_review").length}`,
        `Rejected: ${items.filter((i: any) => i.adminReviewStatus === "rejected").length}`,
        ``,
        `──────────────────────────────────────────`,
        `SCRAPER STATUS`,
        `──────────────────────────────────────────`,
        `Last scraper run: ${diag.lastScraperRun ?? "Never"}`,
        ``,
        `──────────────────────────────────────────`,
        `ERRORS`,
        `──────────────────────────────────────────`,
        registry.filter((s: any) => s.verificationStatus === "broken").length > 0
          ? registry.filter((s: any) => s.verificationStatus === "broken").map((s: any) =>
              `[BROKEN] ${s.entityName} — ${s.sourceUrl}`
            ).join("\n")
          : "(no broken sources detected)",
      ];

      triggerDownload(lines.join("\n"), "scraper.log", "text/plain");
    });
  }

  async function downloadSchemaFiles() {
    await run("schema", async () => {
      const { files } = await fetchAdminJSON("/api/admin/export/files?sets=schema") as { files: Record<string, string> };
      const zip = new JSZip();
      let count = 0;
      for (const [p, content] of Object.entries(files)) {
        zip.file(`schema/${p.split("/").pop()}`, content);
        count++;
      }
      if (count === 0) throw new Error("No schema files returned");
      await downloadZip(zip, "watchdog_schema_files.zip");
    });
  }

  async function downloadPythonEngine() {
    await run("python-engine", async () => {
      const { files } = await fetchAdminJSON("/api/admin/export/files?sets=python_engine") as { files: Record<string, string> };
      const zip = new JSZip();
      let count = 0;
      for (const [p, content] of Object.entries(files)) {
        zip.file(p, content);
        count++;
      }
      if (count === 0) throw new Error("No python_engine files returned");
      await downloadZip(zip, "watchdog_python_engine.zip");
    });
  }

  async function downloadFullExport() {
    await run("full-zip", async () => {
      const params = selectedLocation
        ? `?stateCode=${selectedLocation.stateCode}&countyParish=${encodeURIComponent(selectedLocation.countyParish)}`
        : "";

      // Fetch all DB data + server-side source files in parallel.
      const [diag, items, registry, locations, entities, pipelineRuns, errorReports, serverFiles] =
        await Promise.all([
          fetchJSON(`/api/diagnostics${params}`),
          fetchJSON("/api/admin/civic-items"),
          fetchJSON("/api/source-registry"),
          fetchJSON("/api/locations"),
          fetchJSON("/api/entities"),
          fetchAdminJSON("/api/admin/scraper-runs"),
          fetchJSON("/api/admin/error-reports"),
          fetchAdminJSON("/api/admin/export/files?sets=package,config,schema,python_engine")
            .then((r: { files: Record<string, string> }) => r.files),
        ]);

      let apiHealth: Record<string, string> = {};
      try { apiHealth = await fetchJSON("/api/healthz"); } catch { apiHealth = { status: "unreachable" }; }

      const now = new Date().toISOString();
      const appVersion = (() => {
        try { return JSON.parse(serverFiles["app_config.json"] ?? "{}").version ?? "unknown"; }
        catch { return "unknown"; }
      })();

      // diagnostics.json
      const diagnosticsJson = JSON.stringify({
        exported_at: now,
        selected_location: selectedLocation ?? {},
        database_counts: {
          locations: diag.locationsCount ?? 0,
          entities: diag.entitiesCount ?? 0,
          sources: diag.sourcesCount ?? 0,
          valid_sources: diag.validSources ?? 0,
          broken_sources: diag.brokenSources ?? 0,
        },
        source_counts: { valid: diag.validSources ?? 0, broken: diag.brokenSources ?? 0 },
        approved_items: diag.civicItemsApproved ?? 0,
        pending_items: diag.civicItemsPending ?? 0,
        broken_sources: diag.brokenSources ?? 0,
        last_scraper_run: diag.lastScraperRun ?? null,
        last_export_run: now,
        api_health: apiHealth,
        errors: [],
        raw: diag,
      }, null, 2);

      // civic_items.json — safe fields only
      const civicItemsJson = JSON.stringify(
        (items as any[]).map((i: any) => ({
          id: i.id,
          title: i.title,
          item_type: i.itemType,
          state_code: i.stateCode ?? null,
          county_parish: i.countyParish ?? null,
          source_url: i.sourceUrl ?? null,
          source_agency: i.sourceAgency ?? null,
          source_status: i.sourceStatus,
          admin_review_status: i.adminReviewStatus,
          red_flag_level: i.redFlagLevel,
          amount_involved: i.amountInvolved ?? null,
          created_at: i.createdAt,
        })),
        null, 2
      );

      // sources.json
      const sourcesJson = JSON.stringify(
        (registry as any[]).map((s: any) => ({
          source_title: s.entityName,
          source_url: s.sourceUrl,
          entity_type: s.entityType,
          source_category: s.sourceCategory,
          platform: s.sourcePlatform,
          verification_status: s.verificationStatus,
          state: s.state,
          county: s.county ?? null,
          last_checked_at: s.lastChecked ?? null,
          last_successful_fetch_at: s.lastSuccessfulUpdate ?? null,
          last_error: s.notes ?? null,
          is_active: s.isActive ?? true,
        })),
        null, 2
      );

      // scraper.log
      const scraperLog = [
        `Small Town Watchdog — Scraper Log Export`,
        `Generated: ${now}`,
        `Location: ${selectedLocation ? `${selectedLocation.countyParish}, ${selectedLocation.stateCode}` : "(none)"}`,
        ``,
        `SOURCE VALIDATION`,
        ...(registry as any[]).map((s: any) =>
          `[${(s.verificationStatus ?? "unknown").toUpperCase().padEnd(8)}] ${s.entityName} — ${s.sourceUrl}`
        ),
        ``,
        `PARSE RESULTS`,
        ...(items as any[]).map((i: any) =>
          `[${(i.adminReviewStatus ?? "unknown").toUpperCase().padEnd(12)}] #${i.id} ${i.title}`
        ),
        ``,
        `PIPELINE SUMMARY`,
        `Total: ${diag.civicItemsTotal ?? (items as any[]).length}`,
        `Approved: ${diag.civicItemsApproved ?? (items as any[]).filter((i: any) => i.adminReviewStatus === "approved").length}`,
        `Pending: ${diag.civicItemsPending ?? (items as any[]).filter((i: any) => i.adminReviewStatus === "needs_review").length}`,
        `Last run: ${diag.lastScraperRun ?? "Never"}`,
      ].join("\n");

      const readme = [
        "Small Town Watchdog — Full Project Support Export",
        "==================================================",
        `Export date:      ${now}`,
        `App version:      ${appVersion}`,
        `Selected location: ${selectedLocation ? `${selectedLocation.countyParish}, ${selectedLocation.stateCode}` : "(none selected)"}`,
        "",
        "DATABASE COUNTS",
        `  Locations:    ${diag.locationsCount ?? 0}`,
        `  Entities:     ${diag.entitiesCount ?? 0}`,
        `  Sources:      ${diag.sourcesCount ?? 0} (valid ${diag.validSources ?? 0} / broken ${diag.brokenSources ?? 0})`,
        `  Civic items:  ${diag.civicItemsTotal ?? (items as any[]).length} (approved ${diag.civicItemsApproved ?? 0} / pending ${diag.civicItemsPending ?? 0})`,
        `  Error reports: ${(errorReports as any[]).length}`,
        `  Pipeline runs: ${(pipelineRuns as any[]).length}`,
        `Last scraper run: ${diag.lastScraperRun ?? "Never"}`,
        "",
        "CONTENTS",
        "  diagnostics.json    — DB counts, API health, pipeline status",
        "  scraper.log         — Source validation and pipeline log",
        "  sources.json        — Source registry health",
        "  civic_items.json    — Imported civic items",
        "  locations.json      — Tracked locations",
        "  entities.json       — Tracked government entities",
        "  pipeline_runs.json  — Scraper run history",
        "  error_reports.json  — User-submitted error reports",
        "  app_config.json     — App configuration (no secrets)",
        "  package.json        — Project manifest",
        "  python_engine/      — Scraper engine source",
        "  schema/             — Current database schema files",
        "  README_export.txt   — This file",
        "",
        "SECURITY",
        "  This export contains NO .env files, API keys, passwords, tokens,",
        "  cookies, secrets, or private user data.",
        "",
        "Safe to send for troubleshooting.",
      ].join("\n");

      const zip = new JSZip();
      zip.file("diagnostics.json", diagnosticsJson);
      zip.file("scraper.log", scraperLog);
      zip.file("sources.json", sourcesJson);
      zip.file("civic_items.json", civicItemsJson);
      zip.file("locations.json", JSON.stringify(locations, null, 2));
      zip.file("entities.json", JSON.stringify(entities, null, 2));
      zip.file("pipeline_runs.json", JSON.stringify(pipelineRuns, null, 2));
      // Redact freeform user-submitted text — never export private data.
      zip.file("error_reports.json", JSON.stringify(
        (errorReports as any[]).map((r: any) => ({
          id: r.id,
          civic_item_id: r.civicItemId ?? null,
          report_type: r.reportType,
          status: r.status,
          has_message: Boolean(r.message),
          message_length: r.message ? String(r.message).length : 0,
          created_at: r.createdAt,
        })),
        null, 2
      ));
      zip.file("README_export.txt", readme);

      // Server-side files: package.json, app_config.json, schema/, python_engine/
      for (const [p, content] of Object.entries(serverFiles)) {
        if (p === "package.json" || p === "app_config.json") {
          zip.file(p, content);
        } else if (p.startsWith("python_engine/")) {
          zip.file(p, content);
        } else if (p.startsWith("lib/db/src/schema/")) {
          zip.file(`schema/${p.split("/").pop()}`, content);
        } else {
          zip.file(p, content);
        }
      }

      await downloadZip(zip, "watchdog_full_export.zip");
    });
  }

  const exports = [
    {
      key: "diagnostics",
      icon: <Activity className="w-5 h-5 text-primary" />,
      title: "Download Diagnostics Only",
      desc: "DB counts, API health, pipeline status, broken sources",
      file: "diagnostics.json",
      fn: downloadDiagnostics,
    },
    {
      key: "civic-items",
      icon: <Database className="w-5 h-5 text-blue-400" />,
      title: "Download Civic Items JSON",
      desc: "All imported civic items — id, title, source, status, flag level",
      file: "civic_items.json",
      fn: downloadCivicItems,
    },
    {
      key: "sources",
      icon: <Globe className="w-5 h-5 text-emerald-400" />,
      title: "Download Sources JSON",
      desc: "Source registry — verification status, last checked, errors",
      file: "sources.json",
      fn: downloadSourceHealth,
    },
    {
      key: "scraper-log",
      icon: <FileText className="w-5 h-5 text-amber-400" />,
      title: "Download Scraper Log",
      desc: "Source validation, fetch results, parse results, pipeline summary",
      file: "scraper.log",
      fn: downloadScraperLog,
    },
    {
      key: "schema",
      icon: <Database className="w-5 h-5 text-purple-400" />,
      title: "Download Schema Files",
      desc: "Current database schema TypeScript files",
      file: "watchdog_schema_files.zip",
      fn: downloadSchemaFiles,
    },
    {
      key: "python-engine",
      icon: <HardDrive className="w-5 h-5 text-cyan-400" />,
      title: "Download Python Engine ZIP",
      desc: "Scraper engine source (no caches, no secrets)",
      file: "watchdog_python_engine.zip",
      fn: downloadPythonEngine,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" /> Export Logs & Data
        </h3>
        <p className="text-xs text-muted-foreground">
          All exports are safe to send for troubleshooting. No passwords, secrets, or API keys are included.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {exports.map((ex) => (
          <Card key={ex.key} className="p-4 bg-card border-border/50 flex items-center gap-4">
            <div className="shrink-0">{ex.icon}</div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <p className="text-sm font-semibold">{ex.title}</p>
              <p className="text-xs text-muted-foreground">{ex.desc}</p>
              <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{ex.file}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === ex.key}
              onClick={ex.fn}
              className="shrink-0 gap-1.5"
            >
              {busy === ex.key ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download
            </Button>
          </Card>
        ))}
      </div>

      {/* Full Project Support ZIP */}
      <div className="border-t border-border/30 pt-4">
        <Card className="p-4 bg-primary/5 border-primary/20 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Package className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold">Download Full Project Support ZIP</p>
              <p className="text-xs text-muted-foreground">
                One click — creates <span className="font-mono text-[11px]">watchdog_full_export.zip</span> with the full
                project state for troubleshooting. No secrets, keys, or passwords included.
              </p>
            </div>
          </div>
          <Button
            disabled={busy === "full-zip"}
            onClick={downloadFullExport}
            className="gap-2"
          >
            {busy === "full-zip" ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Building export…</>
            ) : (
              <><Package className="w-4 h-4" /> Download Full Project Support ZIP</>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Contains: diagnostics · scraper.log · sources · civic_items · locations · entities · pipeline_runs · error_reports · app_config · package.json · python_engine/ · schema/ · README_export.txt
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─── Review Queue Tab ─────────────────────────────────────────────────────────

function ReviewQueueTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<"needs_review" | "approved" | "rejected" | "all">("needs_review");

  const { data: items = [], isLoading, refetch } = useListAdminCivicItems(
    filter !== "all" ? { adminReviewStatus: filter } : {}
  );

  const { data: pendingItems = [] } = useListAdminCivicItems({ adminReviewStatus: "needs_review" });
  const pendingCount = pendingItems.length;

  const { mutateAsync: updateReview, isPending: updating } = useUpdateCivicItemReview();

  async function handleAction(id: number, status: "approved" | "rejected") {
    try {
      await updateReview({ id, data: { adminReviewStatus: status } });
      queryClient.invalidateQueries({ queryKey: getListAdminCivicItemsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      toast({ title: status === "approved" ? "✓ Approved — item is now live" : "Item rejected" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  }

  const FLAG_COLORS: Record<string, string> = {
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    yellow: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    green: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Review Queue</h3>
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button onClick={() => refetch()} className="p-1.5 text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {pendingCount === 0 && filter === "needs_review" && !isLoading && (
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20 flex items-center gap-3">
          <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">All caught up!</p>
            <p className="text-xs text-muted-foreground">No items waiting for review.</p>
          </div>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["needs_review", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "needs_review" ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` : f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-24 animate-pulse bg-card border-border/50" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No items in this category.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`bg-card border-border/50 overflow-hidden ${
                item.adminReviewStatus === "needs_review" ? "border-amber-500/30" : ""
              }`}
            >
              {/* Header row */}
              <div className="p-4 flex items-start gap-3">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {item.itemType}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      FLAG_COLORS[item.redFlagLevel] ?? FLAG_COLORS.green
                    }`}>
                      {item.redFlagLevel}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      item.adminReviewStatus === "approved"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : item.adminReviewStatus === "rejected"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {item.adminReviewStatus === "needs_review" ? "pending" : item.adminReviewStatus}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm leading-snug">{item.title}</h3>

                  {/* Source + date */}
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {item.sourceAgency && (
                      <p className="text-xs text-muted-foreground">
                        Source: <span className="text-foreground/80">{item.sourceAgency}</span>
                      </p>
                    )}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[220px]">{item.sourceUrl}</span>
                      </a>
                    )}
                    {(item.sourceDate ?? item.createdAt) && (
                      <p className="text-[10px] text-muted-foreground">
                        {item.sourceDate
                          ? `Document date: ${item.sourceDate}`
                          : `Imported: ${new Date(item.createdAt).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  {expanded === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded original text */}
              {expanded === item.id && item.originalText && (
                <div className="border-t border-border/40 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Original Text
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {item.originalText}
                    </p>
                  </div>
                </div>
              )}
              {expanded === item.id && !item.originalText && (
                <div className="border-t border-border/40 p-4">
                  <p className="text-xs text-muted-foreground italic">No original text attached to this item.</p>
                </div>
              )}

              {/* Flag button — available on all items */}
              <div className="px-4 pb-2">
                <FlagItemButton civicItemId={item.id} />
              </div>

              {/* Action buttons — only show for needs_review items */}
              {item.adminReviewStatus === "needs_review" && (
                <div className="border-t border-border/40 p-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    disabled={updating}
                    onClick={() => handleAction(item.id, "approved")}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5"
                    disabled={updating}
                    onClick={() => handleAction(item.id, "rejected")}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── System Dashboard (top stats bar) ─────────────────────────────────────────

function SystemDashboard() {
  const { selectedLocation } = useSelectedLocation();
  const params = selectedLocation
    ? { stateCode: selectedLocation.stateCode, countyParish: selectedLocation.countyParish }
    : undefined;
  const { data, isLoading, refetch } = useGetDiagnostics(params);

  const stats = data ? [
    { label: "Locations", value: data.locationsCount, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: "Entities", value: data.entitiesCount, icon: <HardDrive className="w-3.5 h-3.5" /> },
    { label: "Sources", value: data.sourcesCount, icon: <Globe className="w-3.5 h-3.5" /> },
    { label: "Approved", value: data.civicItemsApproved, icon: <CheckCheck className="w-3.5 h-3.5" />, good: true },
    { label: "Pending", value: data.civicItemsPending, icon: <Clock className="w-3.5 h-3.5" />, warn: data.civicItemsPending > 0 },
    { label: "Broken Src", value: data.brokenSources ?? 0, icon: <WifiOff className="w-3.5 h-3.5" />, warn: (data.brokenSources ?? 0) > 0 },
  ] : [];

  if (isLoading || !data) return null;

  return (
    <Card className="p-3 bg-card border-border/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> System Status
        </span>
        <div className="flex items-center gap-2">
          {data.lastScraperRun && (
            <span className="text-[10px] text-muted-foreground/60">
              Last scrape: {new Date(data.lastScraperRun).toLocaleDateString()}
            </span>
          )}
          <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-center ${
              s.warn
                ? "bg-amber-500/10 border-amber-500/20"
                : s.good
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-muted/20 border-border/30"
            }`}
          >
            <span className={`${s.warn ? "text-amber-400" : s.good ? "text-emerald-400" : "text-muted-foreground"}`}>
              {s.icon}
            </span>
            <span className={`text-base font-bold ${s.warn ? "text-amber-400" : s.good ? "text-emerald-400" : "text-foreground"}`}>
              {s.value}
            </span>
            <span className="text-[9px] text-muted-foreground leading-tight">{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Diagnostics Tab (full detail) ────────────────────────────────────────────

function DiagnosticsTab() {
  const { selectedLocation } = useSelectedLocation();
  const params = selectedLocation
    ? { stateCode: selectedLocation.stateCode, countyParish: selectedLocation.countyParish }
    : undefined;
  const { data, isLoading, refetch } = useGetDiagnostics(params);

  const rows: Array<{ label: string; value: string | number; warn?: boolean; sep?: boolean }> = data
    ? [
        { label: "Selected State",         value: selectedLocation?.stateCode ?? "(none)" },
        { label: "Selected Parish/County", value: selectedLocation?.countyParish ?? "(none)" },
        { label: "──────────────────────", value: "", sep: true },
        { label: "Locations in DB",        value: data.locationsCount },
        { label: "Entities in DB",         value: data.entitiesCount },
        { label: "Sources in DB",          value: data.sourcesCount },
        { label: "Valid Sources",          value: data.validSources ?? 0 },
        { label: "Broken Sources",         value: data.brokenSources ?? 0, warn: (data.brokenSources ?? 0) > 0 },
        { label: "──────────────────────", value: "", sep: true },
        { label: "Civic Items (total)",    value: data.civicItemsTotal },
        { label: "Approved Items",         value: data.civicItemsApproved },
        { label: "Pending Review",         value: data.civicItemsPending, warn: data.civicItemsPending > 0 },
        { label: "Red Flag",               value: data.civicItemsRed, warn: data.civicItemsRed > 0 },
        { label: "Yellow Flag",            value: data.civicItemsYellow },
        { label: "Green Flag",             value: data.civicItemsGreen },
        { label: "──────────────────────", value: "", sep: true },
        { label: "Last Scraper Run",       value: data.lastScraperRun ? new Date(data.lastScraperRun).toLocaleString() : "Never" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold">System Diagnostics</h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="p-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <Card className="h-40 animate-pulse bg-card border-border/50" />
      ) : data ? (
        <Card className="bg-card border-border/50 overflow-hidden">
          <table className="w-full text-xs">
            <tbody>
              {rows.map((r, i) =>
                r.sep ? (
                  <tr key={i}><td colSpan={2} className="px-3 py-1 text-muted-foreground/30 select-none text-[10px]">{r.label}</td></tr>
                ) : (
                  <tr key={i} className="border-t border-border/30">
                    <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${r.warn ? "text-amber-400" : "text-foreground"}`}>
                      {r.value}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Diagnostics unavailable.</p>
      )}

      <EmailSubscribersPanel />
    </div>
  );
}

type SubscriberCount = { stateCode: string | null; countyParish: string | null; count: number };

function EmailSubscribersPanel() {
  const { data = [], isLoading } = useQuery<SubscriberCount[]>({
    queryKey: ["admin-email-subscriber-counts"],
    queryFn: () => fetchAdminJSON("/api/admin/email-subscribers/counts"),
  });
  const total = data.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Email Subscribers by State / Parish</h3>
      </div>
      {isLoading ? (
        <Card className="h-24 animate-pulse bg-card border-border/50" />
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-2">No active subscribers yet.</p>
      ) : (
        <Card className="bg-card border-border/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">State</th>
                <th className="px-3 py-2 text-left font-semibold">Parish / County</th>
                <th className="px-3 py-2 text-right font-semibold">Subscribers</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="border-t border-border/30">
                  <td className="px-3 py-2 text-foreground font-mono">{r.stateCode ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.countyParish ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{r.count}</td>
                </tr>
              ))}
              <tr className="border-t border-border/50 bg-muted/20">
                <td className="px-3 py-2 font-bold text-foreground" colSpan={2}>Total</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-foreground">{total}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─── Flagged Items Tab ────────────────────────────────────────────────────────

type CivicItemFlag = {
  id: number;
  civicItemId: number;
  reason: string;
  notes: string | null;
  flaggedBy: string | null;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  itemTitle: string | null;
  itemSourceUrl: string | null;
};

function FlaggedItemsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "dismissed">("open");
  const [busy, setBusy] = useState<number | null>(null);

  const { data: flags = [], isLoading, refetch } = useQuery<CivicItemFlag[]>({
    queryKey: ["admin-civic-item-flags", statusFilter],
    queryFn: () => fetchAdminJSON(`/api/admin/civic-item-flags?status=${statusFilter}`),
  });

  async function handleFlag(flagId: number, status: "resolved" | "dismissed") {
    setBusy(flagId);
    try {
      const res = await fetch(`/api/admin/civic-item-flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey() },
        body: JSON.stringify({ status, resolvedBy: "admin" }),
      });
      if (!res.ok) throw new Error(await res.text());
      queryClient.invalidateQueries({ queryKey: ["admin-civic-item-flags"] });
      toast({ title: status === "resolved" ? "Flag marked resolved" : "Flag dismissed" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function handleHideItem(civicItemId: number, flagId: number) {
    setBusy(flagId);
    try {
      const res = await fetch(`/api/admin/civic-items/${civicItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey() },
        body: JSON.stringify({ adminReviewStatus: "rejected" }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Also resolve the flag
      await fetch(`/api/admin/civic-item-flags/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey() },
        body: JSON.stringify({ status: "resolved", resolvedBy: "admin" }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-civic-item-flags"] });
      queryClient.invalidateQueries({ queryKey: getListAdminCivicItemsQueryKey() });
      toast({ title: "Item hidden and flag resolved" });
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  const REASON_LABELS: Record<string, string> = {
    inaccurate: "Inaccurate",
    outdated: "Outdated",
    broken_link: "Broken Link",
    inappropriate: "Inappropriate",
    other: "Other",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold">Flagged Items</h3>
          {statusFilter === "open" && flags.length > 0 && (
            <span className="text-[10px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full">
              {flags.length} open
            </span>
          )}
        </div>
        <button onClick={() => refetch()} className="p-1.5 text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex gap-2">
        {(["open", "resolved", "dismissed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-20 animate-pulse bg-card border-border/50" />)}
        </div>
      ) : flags.length === 0 ? (
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20 flex items-center gap-3">
          <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400 font-semibold">No {statusFilter} flags.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map((flag) => (
            <Card key={flag.id} className="bg-card border-amber-500/20 overflow-hidden">
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2 justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate leading-snug">{flag.itemTitle ?? `Item #${flag.civicItemId}`}</p>
                    {flag.itemSourceUrl && (
                      <a
                        href={flag.itemSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary/70 hover:text-primary truncate flex items-center gap-1"
                      >
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        Source
                      </a>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                    {REASON_LABELS[flag.reason] ?? flag.reason}
                  </span>
                </div>

                {flag.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5 leading-relaxed">
                    "{flag.notes}"
                  </p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                  {flag.flaggedBy && <span>By: <span className="text-foreground/70">{flag.flaggedBy}</span></span>}
                  <span>{new Date(flag.createdAt).toLocaleDateString()}</span>
                  {flag.resolvedBy && <span>Resolved by: {flag.resolvedBy}</span>}
                </div>

                {statusFilter === "open" && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => handleHideItem(flag.civicItemId, flag.id)}
                      disabled={busy === flag.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <EyeOff className="w-3 h-3" />
                      Hide Item
                    </button>
                    <button
                      onClick={() => handleFlag(flag.id, "resolved")}
                      disabled={busy === flag.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Resolve
                    </button>
                    <button
                      onClick={() => handleFlag(flag.id, "dismissed")}
                      disabled={busy === flag.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Data Health Tab ──────────────────────────────────────────────────────────

function DataHealthTab() {
  const { data: allItems = [], isLoading } = useListAdminCivicItems({});

  const byStatus = {
    approved: allItems.filter((i) => i.adminReviewStatus === "approved").length,
    needs_review: allItems.filter((i) => i.adminReviewStatus === "needs_review").length,
    rejected: allItems.filter((i) => i.adminReviewStatus === "rejected").length,
  };
  const byFlag = {
    red: allItems.filter((i) => i.redFlagLevel === "red").length,
    yellow: allItems.filter((i) => i.redFlagLevel === "yellow").length,
    green: allItems.filter((i) => i.redFlagLevel === "green").length,
  };
  const byType: Record<string, number> = {};
  allItems.forEach((i) => { byType[i.itemType] = (byType[i.itemType] ?? 0) + 1; });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold">Data Health</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{allItems.length} total items</span>
      </div>

      {isLoading ? (
        <Card className="h-32 animate-pulse bg-card border-border/50" />
      ) : (
        <>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">By Review Status</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Approved", val: byStatus.approved, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                { label: "Pending", val: byStatus.needs_review, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                { label: "Rejected", val: byStatus.rejected, color: "text-red-400 bg-red-500/10 border-red-500/20" },
              ].map((s) => (
                <div key={s.label} className={`p-3 rounded-lg border text-center ${s.color}`}>
                  <p className="text-xl font-bold">{s.val}</p>
                  <p className="text-[10px]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">By Flag Level</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Red", val: byFlag.red, color: "text-red-400 bg-red-500/10 border-red-500/20" },
                { label: "Yellow", val: byFlag.yellow, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                { label: "Green", val: byFlag.green, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              ].map((s) => (
                <div key={s.label} className={`p-3 rounded-lg border text-center ${s.color}`}>
                  <p className="text-xl font-bold">{s.val}</p>
                  <p className="text-[10px]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {Object.keys(byType).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">By Item Type</p>
              <Card className="bg-card border-border/50 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {Object.entries(byType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                      <tr key={type} className="border-t border-border/30 first:border-0">
                        <td className="px-3 py-2 text-muted-foreground capitalize">{type.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Source Health Panel ───────────────────────────────────────────────────────

function SourceHealthPanel() {
  const { data: allDocuments = [] } = useListDocuments({ limit: 500 });
  const validateSources = useValidateSources();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const brokenDocs = allDocuments.filter((d: any) => d.sourceStatus === "broken");
  const missingDocs = allDocuments.filter((d: any) => d.sourceStatus === "missing");
  const pendingDocs = allDocuments.filter((d: any) => !d.sourceStatus || d.sourceStatus === "pending_review");
  const validDocs = allDocuments.filter((d: any) => d.sourceStatus === "valid");

  function handleCheckSources() {
    validateSources.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({}) });
        toast({ title: "Source check complete", description: `${result.valid} valid · ${result.broken} broken · ${result.missing} missing` });
      },
      onError: () => toast({ title: "Source check failed", variant: "destructive" }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Source Health</h3>
        </div>
        <Button
          size="sm"
          onClick={handleCheckSources}
          disabled={validateSources.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${validateSources.isPending ? "animate-spin" : ""}`} />
          {validateSources.isPending ? "Checking…" : "Check Sources Now"}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Valid",    count: validDocs.length,   color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
          { label: "Broken",  count: brokenDocs.length,  color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/20" },
          { label: "Missing", count: missingDocs.length, color: "text-muted-foreground", bg: "bg-muted/20 border-border/30" },
          { label: "Pending", count: pendingDocs.length, color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`flex flex-col gap-1 p-2 rounded-lg border text-center ${bg}`}>
            <span className={`text-lg font-bold ${color}`}>{count}</span>
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {brokenDocs.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Broken ({brokenDocs.length})</p>
          {brokenDocs.slice(0, 5).map((d: any) => (
            <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-amber-400/5 border border-amber-400/15 text-xs">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate flex-1">{d.title}</span>
            </div>
          ))}
          {brokenDocs.length > 5 && <p className="text-[10px] text-muted-foreground/60 pl-2">…and {brokenDocs.length - 5} more</p>}
        </div>
      )}

      {validateSources.data && (
        <Card className="p-3 bg-emerald-400/5 border-emerald-400/20 text-xs">
          <p className="font-semibold text-emerald-400 mb-1">Last check results</p>
          <p className="text-muted-foreground">
            Checked {validateSources.data.checked} · {validateSources.data.valid} valid ·{" "}
            {validateSources.data.broken} broken · {validateSources.data.missing} missing
          </p>
        </Card>
      )}
    </div>
  );
}

// ─── Existing content tabs ─────────────────────────────────────────────────────

function DocumentsTab({ invalidateAll, toast }: { invalidateAll: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const { data: entities } = useListEntities();
  const { data: documents } = useListDocuments({ limit: 100 });
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const emptyForm = { entityId: "", title: "", docType: "budget", year: "2026", content: "", sourceUrl: "", sourceName: "", plainSummary: "", eli12Summary: "", alertCategory: "", redFlagLevel: "green", amountInvolved: "" };
  const [form, setForm] = useState(emptyForm);
  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function startEdit(doc: NonNullable<typeof documents>[0]) {
    setEditId(doc.id);
    setForm({ entityId: String(doc.entityId), title: doc.title, docType: doc.docType, year: String(doc.year), content: doc.content ?? "", sourceUrl: doc.sourceUrl ?? "", sourceName: doc.sourceName ?? "", plainSummary: doc.plainSummary ?? "", eli12Summary: doc.eli12Summary ?? "", alertCategory: doc.alertCategory ?? "", redFlagLevel: doc.redFlagLevel ?? "green", amountInvolved: doc.amountInvolved != null ? String(doc.amountInvolved) : "" });
    setShowForm(true);
  }
  function reset() { setForm(emptyForm); setEditId(null); setShowForm(false); }
  function handleSubmit() {
    if (!form.entityId || !form.title) { toast({ title: "Entity and title are required", variant: "destructive" }); return; }
    const payload = { entityId: parseInt(form.entityId, 10), title: form.title, docType: form.docType, year: parseInt(form.year, 10), content: form.content || undefined, sourceUrl: form.sourceUrl || undefined, sourceName: form.sourceName || undefined, plainSummary: form.plainSummary || undefined, eli12Summary: form.eli12Summary || undefined, alertCategory: form.alertCategory || undefined, redFlagLevel: form.redFlagLevel, amountInvolved: form.amountInvolved ? parseFloat(form.amountInvolved) : undefined };
    if (editId) {
      updateDocument.mutate({ id: editId, data: payload }, { onSuccess: () => { invalidateAll(); queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() }); reset(); toast({ title: "Document updated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
    } else {
      createDocument.mutate({ data: payload }, { onSuccess: () => { invalidateAll(); reset(); toast({ title: "Document added" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Button data-testid="button-add-document" onClick={() => { reset(); setShowForm(true); }} className="self-start bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Plus className="w-4 h-4 mr-1.5" /> Add Document</Button>
      {showForm && (
        <Card className="p-4 bg-card border-primary/30 flex flex-col gap-3">
          <h3 className="text-sm font-bold">{editId ? "Edit Document" : "New Document"}</h3>
          <Select value={form.entityId} onValueChange={(v) => setField("entityId", v)}><SelectTrigger data-testid="select-doc-entity" className="bg-background text-sm"><SelectValue placeholder="Select entity *" /></SelectTrigger><SelectContent>{entities?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent></Select>
          <Input data-testid="input-doc-title" placeholder="Document title *" value={form.title} onChange={(e) => setField("title", e.target.value)} className="bg-background text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.docType} onValueChange={(v) => setField("docType", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Select value={form.year} onValueChange={(v) => setField("year", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
          </div>
          <Input data-testid="input-doc-source-url" placeholder="Source URL" value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} className="bg-background text-sm" />
          <Input placeholder="Source name" value={form.sourceName} onChange={(e) => setField("sourceName", e.target.value)} className="bg-background text-sm" />
          <Input placeholder="Amount involved ($)" type="number" value={form.amountInvolved} onChange={(e) => setField("amountInvolved", e.target.value)} className="bg-background text-sm" />
          <Textarea data-testid="textarea-doc-content" placeholder="Paste document text here..." value={form.content} onChange={(e) => setField("content", e.target.value)} className="bg-background text-sm min-h-[80px]" />
          <Textarea placeholder="Plain English summary" value={form.plainSummary} onChange={(e) => setField("plainSummary", e.target.value)} className="bg-background text-sm min-h-[60px]" />
          <Textarea placeholder="Explain Like I'm 12 summary" value={form.eli12Summary} onChange={(e) => setField("eli12Summary", e.target.value)} className="bg-background text-sm min-h-[60px]" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.alertCategory} onValueChange={(v) => setField("alertCategory", v)}><SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Alert category" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{ALERT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/-/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Select value={form.redFlagLevel} onValueChange={(v) => setField("redFlagLevel", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{FLAG_LEVELS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-save-document" onClick={handleSubmit} disabled={createDocument.isPending || updateDocument.isPending} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Save className="w-3.5 h-3.5 mr-1.5" />{editId ? "Update" : "Save"}</Button>
            <Button variant="outline" onClick={reset} size="sm"><X className="w-3.5 h-3.5" /></Button>
          </div>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {documents?.map((doc) => (
          <Card key={doc.id} data-testid={`admin-doc-${doc.id}`} className="p-3 bg-card border-border/50 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">{doc.docType} · {doc.year}</span>
              <p className="text-sm font-medium leading-tight line-clamp-1">{doc.title}</p>
              <span className="text-[10px] text-muted-foreground">{doc.entityName}</span>
              <FlagBadge level={doc.redFlagLevel} className="mt-1 self-start" />
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => startEdit(doc)} className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteDocument.mutate({ id: doc.id }, { onSuccess: invalidateAll })} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </Card>
        ))}
        {documents?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No documents yet.</p>}
      </div>
    </div>
  );
}

function EntitiesTab({ invalidateAll, toast }: { invalidateAll: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const { data: entities } = useListEntities();
  const createEntity = useCreateEntity();
  const updateEntity = useUpdateEntity();
  const deleteEntity = useDeleteEntity();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const emptyForm = { name: "", type: "Parish Government", state: "LA", city: "", county: "", location: "", website: "", description: "" };
  const [form, setForm] = useState(emptyForm);
  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function startEdit(e: NonNullable<typeof entities>[0]) { setEditId(e.id); setForm({ name: e.name, type: e.type, state: e.state ?? "LA", city: e.city ?? "", county: e.county ?? "", location: e.location ?? "", website: e.website ?? "", description: e.description ?? "" }); setShowForm(true); }
  function reset() { setForm(emptyForm); setEditId(null); setShowForm(false); }
  function handleSubmit() {
    if (!form.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const payload = { name: form.name, type: form.type, state: form.state || undefined, city: form.city || undefined, county: form.county || undefined, location: form.location || undefined, website: form.website || undefined, description: form.description || undefined };
    if (editId) {
      updateEntity.mutate({ id: editId, data: payload }, { onSuccess: () => { invalidateAll(); reset(); toast({ title: "Entity updated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
    } else {
      createEntity.mutate({ data: payload }, { onSuccess: () => { invalidateAll(); reset(); toast({ title: "Entity added" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <Button data-testid="button-add-entity" onClick={() => { reset(); setShowForm(true); }} className="self-start bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Plus className="w-4 h-4 mr-1.5" /> Add Entity</Button>
      {showForm && (
        <Card className="p-4 bg-card border-primary/30 flex flex-col gap-3">
          <h3 className="text-sm font-bold">{editId ? "Edit Entity" : "New Entity"}</h3>
          <Input data-testid="input-entity-name" placeholder="Entity name *" value={form.name} onChange={(e) => setField("name", e.target.value)} className="bg-background text-sm" />
          <Select value={form.type} onValueChange={(v) => setField("type", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.state} onValueChange={(v) => setField("state", v)}><SelectTrigger className="bg-background text-sm"><SelectValue placeholder="State" /></SelectTrigger><SelectContent><SelectItem value="LA">Louisiana</SelectItem><SelectItem value="MS">Mississippi</SelectItem></SelectContent></Select>
            <Input placeholder="City" value={form.city} onChange={(e) => setField("city", e.target.value)} className="bg-background text-sm" />
          </div>
          <Input placeholder="County/Parish" value={form.county} onChange={(e) => setField("county", e.target.value)} className="bg-background text-sm" />
          <Input placeholder="Location label" value={form.location} onChange={(e) => setField("location", e.target.value)} className="bg-background text-sm" />
          <Input placeholder="Official website URL" value={form.website} onChange={(e) => setField("website", e.target.value)} className="bg-background text-sm" />
          <Textarea placeholder="Description" value={form.description} onChange={(e) => setField("description", e.target.value)} className="bg-background text-sm min-h-[60px]" />
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={createEntity.isPending || updateEntity.isPending} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Save className="w-3.5 h-3.5 mr-1.5" />{editId ? "Update" : "Save"}</Button>
            <Button variant="outline" onClick={reset} size="sm"><X className="w-3.5 h-3.5" /></Button>
          </div>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {entities?.map((e) => (
          <Card key={e.id} className="p-3 bg-card border-border/50 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">{e.type}</span>
              <p className="text-sm font-medium">{e.name}</p>
              {e.location && <span className="text-[10px] text-muted-foreground">{e.location}</span>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => startEdit(e)} className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteEntity.mutate({ id: e.id }, { onSuccess: invalidateAll })} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SourcesTab({ invalidateAll, toast }: { invalidateAll: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const { data: entities } = useListEntities();
  const { data: sources } = useListSources({});
  const createSource = useCreateSource();
  const deleteSource = useDeleteSource();
  const [showForm, setShowForm] = useState(false);
  const emptyForm = { entityId: "", url: "", name: "", sourceType: "agenda" };
  const [form, setForm] = useState(emptyForm);
  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function reset() { setForm(emptyForm); setShowForm(false); }
  function handleSubmit() {
    if (!form.entityId || !form.url || !form.name) { toast({ title: "Entity, URL, and name are required", variant: "destructive" }); return; }
    createSource.mutate({ data: { entityId: parseInt(form.entityId, 10), url: form.url, name: form.name, sourceType: form.sourceType } }, { onSuccess: () => { invalidateAll(); reset(); toast({ title: "Source added" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
  }
  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => { reset(); setShowForm(true); }} className="self-start bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Plus className="w-4 h-4 mr-1.5" /> Add Source</Button>
      {showForm && (
        <Card className="p-4 bg-card border-primary/30 flex flex-col gap-3">
          <h3 className="text-sm font-bold">New Source URL</h3>
          <Select value={form.entityId} onValueChange={(v) => setField("entityId", v)}><SelectTrigger className="bg-background text-sm"><SelectValue placeholder="Select entity *" /></SelectTrigger><SelectContent>{entities?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent></Select>
          <Input placeholder="Source name *" value={form.name} onChange={(e) => setField("name", e.target.value)} className="bg-background text-sm" />
          <Input placeholder="URL * (https://...)" value={form.url} onChange={(e) => setField("url", e.target.value)} className="bg-background text-sm" />
          <Select value={form.sourceType} onValueChange={(v) => setField("sourceType", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={createSource.isPending} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Save className="w-3.5 h-3.5 mr-1.5" /> Save</Button>
            <Button variant="outline" onClick={reset} size="sm"><X className="w-3.5 h-3.5" /></Button>
          </div>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {sources?.map((s) => (
          <Card key={s.id} className="p-3 bg-card border-border/50 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm font-medium">{s.name}</p>
              <span className="text-[10px] text-muted-foreground truncate">{s.url}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteSource.mutate({ id: s.id }, { onSuccess: invalidateAll })} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
          </Card>
        ))}
        {sources?.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No sources yet.</p>}
      </div>
    </div>
  );
}

function SourceRegistryTab({ invalidateAll, toast }: { invalidateAll: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const queryClient = useQueryClient();
  const { data: registry = [] } = useListSourceRegistry({});
  const createEntry = useCreateSourceRegistry();
  const updateEntry = useUpdateSourceRegistry();
  const deleteEntry = useDeleteSourceRegistry();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const emptyForm = { state: "LA", county: "", city: "", entityName: "", entityType: "city-government", sourceUrl: "", sourceCategory: "agenda-page", sourcePlatform: "Other", verificationStatus: "pending", notes: "" };
  const [form, setForm] = useState(emptyForm);
  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function reset() { setForm(emptyForm); setEditId(null); setShowForm(false); }
  function startEdit(entry: NonNullable<typeof registry>[0]) { setEditId(entry.id); setForm({ state: entry.state ?? "LA", county: entry.county ?? "", city: entry.city ?? "", entityName: entry.entityName, entityType: entry.entityType, sourceUrl: entry.sourceUrl, sourceCategory: entry.sourceCategory, sourcePlatform: entry.sourcePlatform, verificationStatus: entry.verificationStatus, notes: entry.notes ?? "" }); setShowForm(true); }
  function handleSubmit() {
    if (!form.state || !form.entityName || !form.sourceUrl) { toast({ title: "State, entity name, and URL are required", variant: "destructive" }); return; }
    if (!isValidSourceUrl(form.sourceUrl)) { toast({ title: "Invalid URL — must start with https://", variant: "destructive" }); return; }
    const payload = { state: form.state, county: form.county || undefined, city: form.city || undefined, entityName: form.entityName, entityType: form.entityType, sourceUrl: form.sourceUrl, sourceCategory: form.sourceCategory, sourcePlatform: form.sourcePlatform, verificationStatus: form.verificationStatus, notes: form.notes || undefined, isActive: true };
    if (editId) {
      updateEntry.mutate({ id: editId, data: payload }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSourceRegistryQueryKey() }); reset(); toast({ title: "Entry updated" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
    } else {
      createEntry.mutate({ data: payload }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSourceRegistryQueryKey() }); reset(); toast({ title: "Entry added" }); }, onError: () => toast({ title: "Failed", variant: "destructive" }) });
    }
  }
  const statusIcon = (s: string) => { if (s === "verified") return <CheckCircle2 className="w-3 h-3 text-emerald-400" />; if (s === "broken") return <XCircle className="w-3 h-3 text-red-400" />; return <Clock className="w-3 h-3 text-amber-400" />; };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button onClick={() => { reset(); setShowForm(true); }} className="self-start bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Plus className="w-4 h-4 mr-1.5" /> Add Source</Button>
        <span className="text-xs text-muted-foreground">{registry.length} entries</span>
      </div>
      {showForm && (
        <Card className="p-4 bg-card border-primary/30 flex flex-col gap-3">
          <h3 className="text-sm font-bold">{editId ? "Edit Registry Entry" : "New Registry Entry"}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="State (LA)" value={form.state} onChange={(e) => setField("state", e.target.value)} className="bg-background text-sm" maxLength={2} />
            <Input placeholder="County/Parish" value={form.county} onChange={(e) => setField("county", e.target.value)} className="bg-background text-sm" />
            <Input placeholder="City" value={form.city} onChange={(e) => setField("city", e.target.value)} className="bg-background text-sm" />
          </div>
          <Input placeholder="Entity name *" value={form.entityName} onChange={(e) => setField("entityName", e.target.value)} className="bg-background text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.entityType} onValueChange={(v) => setField("entityType", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{REGISTRY_ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/-/g, " ")}</SelectItem>)}</SelectContent></Select>
            <Select value={form.sourceCategory} onValueChange={(v) => setField("sourceCategory", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{REGISTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/-/g, " ")}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1">
            <Input placeholder="Source URL * (https://...)" value={form.sourceUrl} onChange={(e) => setField("sourceUrl", e.target.value)} className={`bg-background text-sm ${form.sourceUrl && !isValidSourceUrl(form.sourceUrl) ? "border-red-500/60" : ""}`} />
            {form.sourceUrl && !isValidSourceUrl(form.sourceUrl) && <p className="text-[10px] text-red-400 flex items-center gap-1"><Link2Off className="w-3 h-3" /> Must start with https://</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.sourcePlatform} onValueChange={(v) => setField("sourcePlatform", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{REGISTRY_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
            <Select value={form.verificationStatus} onValueChange={(v) => setField("verificationStatus", v)}><SelectTrigger className="bg-background text-sm"><SelectValue /></SelectTrigger><SelectContent>{VERIFICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setField("notes", e.target.value)} className="bg-background text-sm" />
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={createEntry.isPending || updateEntry.isPending} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" size="sm"><Save className="w-3.5 h-3.5 mr-1.5" />{editId ? "Update" : "Save"}</Button>
            <Button variant="outline" onClick={reset} size="sm"><X className="w-3.5 h-3.5" /></Button>
          </div>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {registry.map((entry) => (
          <Card key={entry.id} className="p-3 bg-card border-border/50 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5">{statusIcon(entry.verificationStatus)}<span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{entry.entityType?.replace(/-/g, " ")} · {entry.sourceCategory?.replace(/-/g, " ")}</span></div>
              <p className="text-sm font-medium leading-tight truncate">{entry.entityName}</p>
              <span className="text-[10px] text-muted-foreground">{entry.city && `${entry.city}, `}{entry.state} · {entry.sourcePlatform}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isValidSourceUrl(entry.sourceUrl) ? <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary"><ExternalLink className="w-3.5 h-3.5" /></a> : <span className="p-1.5 text-red-400/60"><Link2Off className="w-3.5 h-3.5" /></span>}
              <Button variant="ghost" size="icon" onClick={() => startEdit(entry)} className="h-8 w-8 text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate({ id: entry.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSourceRegistryQueryKey() }) })} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </Card>
        ))}
        {registry.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No registry entries yet.</p>}
      </div>
    </div>
  );
}

function SourceSubmissionsTab({ invalidateAll, toast }: { invalidateAll: () => void; toast: ReturnType<typeof useToast>["toast"] }) {
  const queryClient = useQueryClient();
  const { data: submissions = [] } = useListSourceSubmissions({});
  const updateSubmission = useUpdateSourceSubmission();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  function handleAction(id: number, status: "approved" | "rejected") {
    updateSubmission.mutate({ id, data: { status } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSourceSubmissionsQueryKey() }); queryClient.invalidateQueries({ queryKey: getListSourceRegistryQueryKey() }); toast({ title: status === "approved" ? "Approved — added to registry" : "Rejected" }); },
      onError: () => toast({ title: "Action failed", variant: "destructive" }),
    });
  }
  return (
    <div className="flex flex-col gap-4">
      {pendingCount > 0 && <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-400/10 border border-amber-400/25"><Clock className="w-4 h-4 text-amber-400 shrink-0" /><p className="text-xs text-amber-300 font-medium">{pendingCount} pending review</p></div>}
      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/60 text-muted-foreground"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}{f === "pending" && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {filtered.map((sub) => (
          <Card key={sub.id} className="p-4 bg-card border-border/50 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{sub.entityType?.replace(/-/g, " ")} · {sub.sourceCategory?.replace(/-/g, " ")}</span>
                <p className="text-sm font-semibold">{sub.entityName}</p>
                <span className="text-[11px] text-muted-foreground">{sub.city}, {sub.state}</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sub.status === "approved" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : sub.status === "rejected" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-amber-400/10 border-amber-400/20 text-amber-400"}`}>{sub.status}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card/60 border border-border/40 rounded-lg px-3 py-2">
              <Globe className="w-3.5 h-3.5 shrink-0" /><a href={sub.sourceUrl} target="_blank" rel="noreferrer" className="truncate hover:text-primary">{sub.sourceUrl}</a>
            </div>
            {sub.submitterNote && <p className="text-xs text-muted-foreground italic border-l-2 border-border/50 pl-2">{sub.submitterNote}</p>}
            {sub.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" disabled={updateSubmission.isPending} onClick={() => handleAction(sub.id, "approved")}><CheckCircle2 className="w-3.5 h-3.5" /> Approve</Button>
                <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5" disabled={updateSubmission.isPending} onClick={() => handleAction(sub.id, "rejected")}><XCircle className="w-3.5 h-3.5" /> Reject</Button>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No {filter === "all" ? "" : filter + " "}submissions.</p>}
      </div>
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => isSessionValid());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSourceRegistryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSourceSubmissionsQueryKey() });
  }

  function handleLogout() {
    clearSession();
    setUnlocked(false);
  }

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 text-muted-foreground hover:text-foreground text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock
          </Button>
        </div>

        {/* System Dashboard bar */}
        <SystemDashboard />

        {/* ── Operations Tabs ── */}
        <Tabs defaultValue="review">
          <div className="overflow-x-auto pb-0.5">
            <TabsList className="flex w-max min-w-full bg-card border border-border gap-0">
              <TabsTrigger value="review" className="text-[11px] flex-1 min-w-[80px]">
                <ReviewQueueBadge />
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="text-[11px] flex-1 min-w-[80px]">Diagnostics</TabsTrigger>
              <TabsTrigger value="flags"       className="text-[11px] flex-1 min-w-[80px]"><FlaggedTabBadge /></TabsTrigger>
              <TabsTrigger value="export"      className="text-[11px] flex-1 min-w-[80px]">Export</TabsTrigger>
              <TabsTrigger value="data"        className="text-[11px] flex-1 min-w-[80px]">Data</TabsTrigger>
              <TabsTrigger value="src-health"  className="text-[11px] flex-1 min-w-[80px]">Sources</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="review"      className="mt-4"><ReviewQueueTab /></TabsContent>
          <TabsContent value="diagnostics" className="mt-4"><DiagnosticsTab /></TabsContent>
          <TabsContent value="flags"       className="mt-4"><FlaggedItemsTab /></TabsContent>
          <TabsContent value="export"      className="mt-4"><ExportTab /></TabsContent>
          <TabsContent value="data"        className="mt-4"><DataHealthTab /></TabsContent>
          <TabsContent value="src-health"  className="mt-4"><SourceHealthPanel /></TabsContent>
        </Tabs>

        {/* ── Content Management Tabs ── */}
        <div className="border-t border-border/30 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Content Management</p>
          <Tabs defaultValue="documents">
            <TabsList className="grid grid-cols-5 bg-card border border-border w-full">
              <TabsTrigger value="documents"   className="text-[10px]">Docs</TabsTrigger>
              <TabsTrigger value="entities"    className="text-[10px]">Entities</TabsTrigger>
              <TabsTrigger value="sources"     className="text-[10px]">Sources</TabsTrigger>
              <TabsTrigger value="registry"    className="text-[10px]">Registry</TabsTrigger>
              <TabsTrigger value="submissions" className="text-[10px]">Subs</TabsTrigger>
            </TabsList>
            <TabsContent value="documents"   className="mt-4"><DocumentsTab   invalidateAll={invalidateAll} toast={toast} /></TabsContent>
            <TabsContent value="entities"    className="mt-4"><EntitiesTab    invalidateAll={invalidateAll} toast={toast} /></TabsContent>
            <TabsContent value="sources"     className="mt-4"><SourcesTab     invalidateAll={invalidateAll} toast={toast} /></TabsContent>
            <TabsContent value="registry"    className="mt-4"><SourceRegistryTab invalidateAll={invalidateAll} toast={toast} /></TabsContent>
            <TabsContent value="submissions" className="mt-4"><SourceSubmissionsTab invalidateAll={invalidateAll} toast={toast} /></TabsContent>
          </Tabs>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-2 pb-1 border-t border-border/30">
          <span className="text-[11px] text-muted-foreground/50">Questions or issues?</span>
          <a href="mailto:support@smalltownwatchdog.com" className="text-[11px] font-semibold text-primary/70 hover:text-primary">
            support@smalltownwatchdog.com
          </a>
        </div>
      </div>
    </AppLayout>
  );
}

// Small wrapper to show live open flag count on the Flags tab trigger
function FlaggedTabBadge() {
  const { data: flags = [] } = useQuery<CivicItemFlag[]>({
    queryKey: ["admin-civic-item-flags", "open"],
    queryFn: () => fetchAdminJSON("/api/admin/civic-item-flags?status=open"),
  });
  return (
    <span className="flex items-center gap-1">
      Flags
      {flags.length > 0 && (
        <span className="ml-1 text-[9px] font-bold bg-amber-500 text-black rounded-full px-1.5 py-0.5 leading-none">
          {flags.length}
        </span>
      )}
    </span>
  );
}

// Small wrapper to show live pending count on the Review tab trigger
function ReviewQueueBadge() {
  const { data: pending = [] } = useListAdminCivicItems({ adminReviewStatus: "needs_review" });
  return (
    <span className="flex items-center gap-1">
      Review
      {pending.length > 0 && (
        <span className="ml-1 text-[9px] font-bold bg-amber-500 text-black rounded-full px-1.5 py-0.5 leading-none">
          {pending.length}
        </span>
      )}
    </span>
  );
}
