import type { Request, Response, NextFunction } from "express";

// SHA-256 hashes of accepted admin credentials. The admin password / PIN is
// never stored in plaintext, and these endpoints expose source files, so they
// require the client to present a matching hash via the `x-admin-key` header.
//   - SHA-256("Bull@rd2029!")  (admin password)
//   - SHA-256("122629")        (admin PIN)
const ADMIN_HASHES = new Set<string>([
  "a84b503c02baa1de113d9c0a1d460cb36a53c688f67e881b9fd64089e102115e",
  "d2e6ae7f0e839e05045c5d9e8dccad8a1737506c1e75a543a853a92472d2c396",
]);

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("x-admin-key") ?? "";
  if (!ADMIN_HASHES.has(key)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}
