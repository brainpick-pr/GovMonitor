import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { setup } from "./setup";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    KV: KVNamespace;
  }
}

describe("GovMonitor Worker API", () => {
  beforeAll(async () => {
    await setup();
  });

  beforeEach(async () => {
    // Clean up targets and checks before each test
    await env.DB.prepare("DELETE FROM checks").run();
    await env.DB.prepare("DELETE FROM targets").run();
    await env.KV.delete("latest_status");
  });

  describe("GET /api/status", () => {
    it("returns empty array when no targets exist", async () => {
      const response = await SELF.fetch("http://localhost/api/status");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it("returns targets with their latest check status", async () => {
      // Insert a test target
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(`
        INSERT INTO targets (name, url, hostname, state, interval_min, next_check_at, check_mode, expected_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        "Test Gov Site",
        "https://example.gov",
        "example.gov",
        "Delhi",
        15,
        now,
        "website",
        200,
        now,
        now
      ).run();

      // Get the target ID
      const target = await env.DB.prepare("SELECT id FROM targets WHERE url = ?")
        .bind("https://example.gov")
        .first<{ id: number }>();

      // Insert a check for the target
      await env.DB.prepare(`
        INSERT INTO checks (target_id, ts, ok, status, latency_ms)
        VALUES (?, ?, ?, ?, ?)
      `).bind(target!.id, now, 1, 200, 150).run();

      const response = await SELF.fetch("http://localhost/api/status");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Test Gov Site");
      expect(data[0].ok).toBe(1);
      expect(data[0].status).toBe(200);
    });
  });

  describe("POST /api/targets", () => {
    it("successfully adds a valid government target", async () => {
      const response = await SELF.fetch("http://localhost/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "White House",
          url: "https://www.whitehouse.gov",
          interval_min: 15,
          state: "Delhi",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe("White House");
      expect(data.url).toBe("https://www.whitehouse.gov");
      expect(data.hostname).toBe("www.whitehouse.gov");
      expect(data.state).toBe("Delhi");
    });

    it("rejects non-government domains", async () => {
      const response = await SELF.fetch("http://localhost/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Google",
          url: "https://www.google.com",
          state: "Delhi",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("government domains");
    });

    it("rejects targets without a state", async () => {
      const response = await SELF.fetch("http://localhost/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Site",
          url: "https://example.gov",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("state");
    });

    it("rejects invalid states", async () => {
      const response = await SELF.fetch("http://localhost/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Site",
          url: "https://example.gov",
          state: "InvalidState",
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("valid Indian state");
    });

    it("accepts targets with api-json check mode", async () => {
      const response = await SELF.fetch("http://localhost/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "API Health",
          url: "https://api.gov/health",
          state: "Maharashtra",
          check_mode: "api-json",
          expected_status: 200,
          json_path: "status",
          expected_json_value: "ok",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.check_mode).toBe("api-json");
      expect(data.json_path).toBe("status");
      expect(data.expected_json_value).toBe("ok");
    });
  });

  describe("GET /api/targets", () => {
    it("returns all targets", async () => {
      const now = Math.floor(Date.now() / 1000);

      // Add two targets
      await env.DB.prepare(`
        INSERT INTO targets (name, url, hostname, state, interval_min, next_check_at, check_mode, expected_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind("Site A", "https://a.gov", "a.gov", "Delhi", 15, now, "website", 200, now, now).run();

      await env.DB.prepare(`
        INSERT INTO targets (name, url, hostname, state, interval_min, next_check_at, check_mode, expected_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind("Site B", "https://b.gov", "b.gov", "Kerala", 30, now, "website", 200, now, now).run();

      const response = await SELF.fetch("http://localhost/api/targets");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });
  });

  describe("DELETE /api/targets/:id", () => {
    it("successfully deletes a target", async () => {
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(`
        INSERT INTO targets (name, url, hostname, state, interval_min, next_check_at, check_mode, expected_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind("To Delete", "https://delete.gov", "delete.gov", "Delhi", 15, now, "website", 200, now, now).run();

      const target = await env.DB.prepare("SELECT id FROM targets WHERE url = ?")
        .bind("https://delete.gov")
        .first<{ id: number }>();

      const response = await SELF.fetch(
        `http://localhost/api/targets/${target!.id}`,
        { method: "DELETE" }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify deletion
      const check = await env.DB.prepare("SELECT * FROM targets WHERE id = ?")
        .bind(target!.id)
        .first();
      expect(check).toBeNull();
    });
  });

  describe("GET /api/history", () => {
    it("returns 400 when targetId is missing", async () => {
      const response = await SELF.fetch("http://localhost/api/history");
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain("targetId");
    });

    it("returns check history for a target", async () => {
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(`
        INSERT INTO targets (name, url, hostname, state, interval_min, next_check_at, check_mode, expected_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind("History Target", "https://history.gov", "history.gov", "Delhi", 15, now, "website", 200, now, now).run();

      const target = await env.DB.prepare("SELECT id FROM targets WHERE url = ?")
        .bind("https://history.gov")
        .first<{ id: number }>();

      // Insert multiple checks
      for (let i = 0; i < 5; i++) {
        await env.DB.prepare(`
          INSERT INTO checks (target_id, ts, ok, status, latency_ms)
          VALUES (?, ?, ?, ?, ?)
        `).bind(target!.id, now - i * 3600, 1, 200, 100 + i * 10).run();
      }

      const response = await SELF.fetch(
        `http://localhost/api/history?targetId=${target!.id}&window=24h`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("supports 30d and 365d windows", async () => {
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(`
        INSERT INTO targets (name, url, hostname, state, interval_min, next_check_at, check_mode, expected_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind("Long History", "https://long.gov", "long.gov", "Delhi", 15, now, "website", 200, now, now).run();

      const target = await env.DB.prepare("SELECT id FROM targets WHERE url = ?")
        .bind("https://long.gov")
        .first<{ id: number }>();

      // Insert a check from 20 days ago
      const twentyDaysAgo = now - 20 * 24 * 3600;
      await env.DB.prepare(`
        INSERT INTO checks (target_id, ts, ok, status, latency_ms)
        VALUES (?, ?, ?, ?, ?)
      `).bind(target!.id, twentyDaysAgo, 1, 200, 100).run();

      // 24h window should not include it
      const response24h = await SELF.fetch(
        `http://localhost/api/history?targetId=${target!.id}&window=24h`
      );
      const data24h = await response24h.json();
      expect(data24h).toHaveLength(0);

      // 30d window should include it
      const response30d = await SELF.fetch(
        `http://localhost/api/history?targetId=${target!.id}&window=30d`
      );
      const data30d = await response30d.json();
      expect(data30d).toHaveLength(1);
    });
  });

  describe("GET /api/config", () => {
    it("returns configuration", async () => {
      const response = await SELF.fetch("http://localhost/api/config");
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.interval_min).toBeDefined();
    });
  });

  describe("PUT /api/config", () => {
    it("updates configuration", async () => {
      const response = await SELF.fetch("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_min: 30 }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.interval_min).toBe(30);
    });

    it("rejects interval less than 5 minutes", async () => {
      const response = await SELF.fetch("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_min: 3 }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("at least 5 minutes");
    });
  });

  describe("GET /api/state-summary", () => {
    it("returns state summary data", async () => {
      const response = await SELF.fetch(
        "http://localhost/api/state-summary?window=24h"
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("POST /api/check", () => {
    it("returns 400 when targetId is missing", async () => {
      const response = await SELF.fetch("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("targetId");
    });

    it("returns 404 for non-existent target", async () => {
      const response = await SELF.fetch("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: 99999 }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain("not found");
    });
  });

  describe("CORS and Options", () => {
    it("handles OPTIONS requests for CORS", async () => {
      const response = await SELF.fetch("http://localhost/api/status", {
        method: "OPTIONS",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET"
      );
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const response = await SELF.fetch("http://localhost/api/unknown");
      expect(response.status).toBe(404);
    });
  });
});
