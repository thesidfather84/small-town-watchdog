import { useGetDashboardStats } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { PieChart, BarChart, Bar, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

const COLORS = ["#f5c518", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899", "#84cc16"];

export default function Reports() {
  const { data: stats, isLoading } = useGetDashboardStats();

  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-6">
        <div className="flex items-center gap-3 pt-2">
          <PieChartIcon className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Visual Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Government data visualized so you can see what's really going on.
        </p>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-64 w-full rounded-xl bg-card" />
            <Skeleton className="h-64 w-full rounded-xl bg-card" />
          </div>
        ) : stats ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="p-3 bg-card border-border/50 flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-primary">{stats.totalEntities}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Entities Tracked</span>
              </Card>
              <Card className="p-3 bg-card border-border/50 flex flex-col items-center gap-1">
                <span className="text-2xl font-bold">{stats.totalDocuments}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Total Docs</span>
              </Card>
              <Card className="p-3 bg-destructive/10 border-destructive/20 flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-destructive">{stats.redFlagCount}</span>
                <span className="text-[10px] text-destructive uppercase tracking-wider text-center">Red Flags</span>
              </Card>
            </div>

            {/* Docs by Type - Pie Chart */}
            {stats.documentsByType?.length > 0 && (
              <Card className="p-4 bg-card border-border/50 flex flex-col gap-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Documents by Type</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={stats.documentsByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      dataKey="count"
                      nameKey="label"
                    >
                      {stats.documentsByType.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(222 47% 11%)", border: "1px solid hsl(217 32% 17%)", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2">
                  {stats.documentsByType.map((item, i) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground capitalize">{item.label}</span>
                      <span className="text-xs font-bold ml-auto">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Docs by Year - Bar Chart */}
            {stats.documentsByYear?.length > 0 && (
              <Card className="p-4 bg-card border-border/50 flex flex-col gap-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Documents by Year</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.documentsByYear} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(222 47% 11%)", border: "1px solid hsl(217 32% 17%)", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                    />
                    <Bar dataKey="count" fill="#f5c518" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {!stats.documentsByType?.length && !stats.documentsByYear?.length && (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl gap-3">
                <PieChartIcon className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm text-center">
                  No data yet. Add documents in the Admin panel to see charts here.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
