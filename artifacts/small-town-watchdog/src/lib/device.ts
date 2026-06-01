const DEVICE_ID_KEY  = "stw_device_id";
const SESSION_ID_KEY = "stw_session_id";

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) { id = uuid(); localStorage.setItem(DEVICE_ID_KEY, id); }
    return id;
  } catch { return "unknown"; }
}

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) { id = uuid(); sessionStorage.setItem(SESSION_ID_KEY, id); }
    return id;
  } catch { return "unknown"; }
}

export function getDeviceInfo(): Record<string, string> {
  return {
    deviceId:   getDeviceId(),
    sessionId:  getSessionId(),
    userAgent:  navigator.userAgent,
    screen:     `${screen.width}x${screen.height}`,
    language:   navigator.language,
    appVersion: import.meta.env.VITE_APP_VERSION ?? "dev",
  };
}
