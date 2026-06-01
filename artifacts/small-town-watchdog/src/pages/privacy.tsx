import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Lock } from "lucide-react";

export default function Privacy() {
  return (
    <AppLayout>
      <div className="p-4 flex flex-col gap-5">
        <Link href="/settings" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pt-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
        </div>

        <Card className="p-4 bg-card border-border/50 flex flex-col gap-4 text-sm">

          <Section title="Information We Collect">
            <p>Small Town Watchdog is a public records transparency tool. We do not require user registration or login to access information. We do not collect personal information such as names, email addresses, or phone numbers through normal use of the application.</p>
            <p>If you choose to enable push notifications, your browser creates an anonymous subscription identifier that is stored locally on your device. This identifier is not tied to your personal identity.</p>
          </Section>

          <Section title="Public Records Data">
            <p>All government information displayed within Small Town Watchdog is sourced from public websites, government publications, and publicly available records. This information was already public before being added to our application.</p>
            <p>We do not sell, share, or distribute any user data to third parties.</p>
          </Section>

          <Section title="Cookies and Local Storage">
            <p>Small Town Watchdog may store small amounts of data in your browser's local storage to remember your preferences (such as notification settings). This data never leaves your device and is not transmitted to our servers.</p>
          </Section>

          <Section title="Push Notifications">
            <p>If you choose to enable push notifications, your browser will ask for your explicit permission. You may revoke this permission at any time through your browser settings. We only send election-related reminders when you have given permission.</p>
          </Section>

          <Section title="Third-Party Services">
            <p>Small Town Watchdog uses artificial intelligence services to generate plain-language summaries of public records. Document text submitted for summarization is processed by AI systems subject to their own privacy policies. We do not submit personal information to AI systems — only the text of public government documents.</p>
          </Section>

          <Section title="Data Retention">
            <p>Public records data is retained as long as it remains relevant and publicly available. You may contact us to request removal of specific information from our platform.</p>
          </Section>

          <Section title="Children's Privacy">
            <p>Small Town Watchdog is intended for general audiences. We do not knowingly collect information from children under the age of 13.</p>
          </Section>

          <Section title="Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. Continued use of the application following any update constitutes acceptance of the revised policy.</p>
          </Section>

          <Section title="Contact">
            <p>If you have questions about this Privacy Policy or how your information is handled, please contact us through the official channels listed on our website.</p>
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
