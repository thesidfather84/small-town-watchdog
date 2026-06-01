const VISITED_KEY = "stw_has_visited";

export function markVisited(): void {
  localStorage.setItem(VISITED_KEY, "1");
}

export function hasVisited(): boolean {
  return !!localStorage.getItem(VISITED_KEY);
}
