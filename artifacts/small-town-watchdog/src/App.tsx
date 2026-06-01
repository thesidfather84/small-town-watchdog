import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Alerts from "@/pages/alerts";
import Entities from "@/pages/entities";
import EntityDetail from "@/pages/entity-detail";
import DocumentDetail from "@/pages/document-detail";
import Compare from "@/pages/compare";
import Reports from "@/pages/reports";
import Admin from "@/pages/admin";
import Settings from "@/pages/settings";
import Elections from "@/pages/elections";
import ElectionDetail from "@/pages/election-detail";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import AiDisclosure from "@/pages/ai-disclosure";
import Discover from "@/pages/discover";
import Welcome from "@/pages/welcome";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// Always show the dog welcome screen at /
// Returning users with a location see their status and tap "Enter App" to go to the feed.
function RootPage() {
  return <Redirect to="/welcome" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootPage} />
      <Route path="/home" component={Dashboard} />
      <Route path="/welcome" component={Welcome} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/elections" component={Elections} />
      <Route path="/elections/:id" component={ElectionDetail} />
      <Route path="/entities" component={Entities} />
      <Route path="/entities/:id" component={EntityDetail} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/compare" component={Compare} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin" component={Admin} />
      <Route path="/settings" component={Settings} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/ai-disclosure" component={AiDisclosure} />
      <Route path="/discover" component={Discover} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
