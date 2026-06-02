// Test: import express but use raw Node handler
import express from "express";
export default function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: true, express_type: typeof express, express_fn: typeof express === "function" }));
}
