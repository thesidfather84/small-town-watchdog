import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, ScrollText } from "lucide-react";

export default function Terms() {
  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <Link href="/settings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pt-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <div className="flex items-center gap-3">
          <ScrollText className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Terms & Conditions</h1>
        </div>

        <Card className="p-4 bg-card border-border/50 flex flex-col gap-4 text-sm">

          <Section title="Election Information">
            <p>Small Town Watchdog may provide election information, candidate listings, ballot measures, constitutional amendments, tax renewals, propositions, bond issues, and other election-related content.</p>
            <p>Small Town Watchdog does not endorse, support, oppose, recommend, or discourage any candidate, political party, amendment, proposition, tax measure, bond issue, or ballot question.</p>
            <p>All election information is provided solely for educational and informational purposes.</p>
            <p>Users are responsible for verifying election dates, polling locations, voter registration status, sample ballots, and ballot contents through official election authorities.</p>
            <p>Ballots may vary by address, district, parish, municipality, precinct, ward, school district, fire district, or other jurisdiction. Small Town Watchdog cannot guarantee that information displayed reflects every item appearing on a user's official ballot.</p>
            <p>Users should always verify election information with official sources before voting.</p>
          </Section>

          <Section title="AI Generated Content">
            <p>Small Town Watchdog utilizes artificial intelligence to summarize, analyze, organize, compare, categorize, and explain public records and election information.</p>
            <p>Artificial intelligence systems may make mistakes. AI-generated summaries, charts, alerts, comparisons, visualizations, risk indicators, explanations, and reports may contain inaccuracies, omissions, misunderstandings, outdated information, or unintended interpretations.</p>
            <p>AI-generated content is not an official government record. Official source documents always control in the event of any discrepancy.</p>
            <p>Users should review original source materials before making decisions based on information presented within the application.</p>
          </Section>

          <Section title="No Legal, Financial, or Political Advice">
            <p>Small Town Watchdog does not provide legal, financial, accounting, tax, investment, or political advice. Information presented through the application should not be relied upon as professional advice of any kind.</p>
          </Section>

          <Section title="Government Transparency Purpose">
            <p>The purpose of Small Town Watchdog is to increase public awareness and understanding of publicly available government information. The application is intended to help citizens locate, organize, understand, and review public records.</p>
            <p>The application is not intended to accuse, defame, harass, intimidate, target, investigate, or make allegations against any government official, employee, agency, contractor, business, candidate, political party, or private citizen.</p>
          </Section>

          <Section title="Red Flag and Alert System">
            <p>Alerts, warnings, comparisons, trend indicators, and "red flag" notifications are generated through automated analysis and are intended solely to identify changes, trends, unusual activity, or items that may warrant further review.</p>
            <p>A red flag indicator does not imply wrongdoing, misconduct, fraud, corruption, criminal activity, waste, abuse, or unethical behavior. Users should independently review all source materials before forming conclusions.</p>
          </Section>

          <Section title="Data Accuracy and Availability">
            <p>Small Town Watchdog relies upon information obtained from public websites, public records, government publications, third-party sources, and automated collection systems. Information may be delayed, incomplete, unavailable, changed, removed, corrected, or updated without notice.</p>
            <p>Small Town Watchdog makes no guarantee regarding the completeness, accuracy, timeliness, availability, or reliability of any information presented within the application.</p>
          </Section>

          <Section title="Visualizations and Charts">
            <p>Charts, graphs, visual summaries, infographics, comparisons, and visual reports are generated for convenience and educational purposes. Visualizations may simplify complex information and should not be considered official government documents.</p>
          </Section>

          <Section title="Limitation of Liability">
            <p>To the fullest extent permitted by law, Small Town Watchdog, its owners, operators, developers, employees, contractors, contributors, affiliates, and licensors shall not be liable for any direct, indirect, incidental, consequential, punitive, special, or exemplary damages arising from use of the application, reliance on information presented, AI-generated summaries, election information, missed elections, missed deadlines, inaccurate data, data omissions, technical failures, service interruptions, notification failures, delayed alerts, or errors in public source materials.</p>
            <p>Use of the application is entirely at the user's own risk.</p>
          </Section>

          <Section title="Source Document Priority">
            <p>Whenever available, users should review the original government document linked within the application. The original source document shall always take precedence over any summary, chart, visualization, alert, comparison, explanation, or AI-generated content presented by Small Town Watchdog.</p>
          </Section>

          <Section title="Acceptance of Terms">
            <p>By accessing or using Small Town Watchdog, users acknowledge that they have read, understood, and agreed to these Terms and Conditions and understand the limitations of automated summaries and public data analysis.</p>
          </Section>

        </Card>
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/50 pt-4 first:border-0 first:pt-0">
      <h2 className="text-sm font-bold uppercase tracking-wider text-primary">{title}</h2>
      <div className="flex flex-col gap-2 text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}
