export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export function showElectionNotification(title: string, body: string) {
  if (getNotificationPermission() !== "granted") return;

  const notification = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "election-reminder",
    requireInteraction: false,
  });

  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  return notification;
}

export function checkElectionToday(electionDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return electionDate === today;
}

export function checkEarlyVotingStartsTomorrow(earlyVotingStart: string | null): boolean {
  if (!earlyVotingStart) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return earlyVotingStart === tomorrow.toISOString().slice(0, 10);
}

export function checkElectionTomorrow(electionDate: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return electionDate === tomorrow.toISOString().slice(0, 10);
}

export function getElectionAlerts(elections: Array<{
  title: string;
  electionDate: string;
  earlyVotingStart?: string | null;
  earlyVotingEnd?: string | null;
}>): Array<{ type: "today" | "tomorrow" | "early-voting"; title: string; message: string }> {
  const alerts: Array<{ type: "today" | "tomorrow" | "early-voting"; title: string; message: string }> = [];

  for (const election of elections) {
    if (checkElectionToday(election.electionDate)) {
      alerts.push({
        type: "today",
        title: `Election Day: ${election.title}`,
        message: "Polls are open today. Check your sample ballot before you vote.",
      });
    } else if (checkElectionTomorrow(election.electionDate)) {
      alerts.push({
        type: "tomorrow",
        title: `Election Tomorrow: ${election.title}`,
        message: "Election day is tomorrow. Confirm your polling location and sample ballot.",
      });
    } else if (election.earlyVotingStart && checkEarlyVotingStartsTomorrow(election.earlyVotingStart)) {
      alerts.push({
        type: "early-voting",
        title: `Early Voting Starts Tomorrow: ${election.title}`,
        message: "Early voting begins tomorrow. Check your registration and polling location.",
      });
    }
  }

  return alerts;
}
