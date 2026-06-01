import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function useRefreshAppData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function refreshAppData() {
    queryClient.invalidateQueries();
    toast({ title: "App data refreshed.", description: "All data has been reloaded for your current location." });
  }

  return { refreshAppData };
}
