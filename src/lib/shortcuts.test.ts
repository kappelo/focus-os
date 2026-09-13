import { describe, expect, it } from "vitest";
import { normalizeWebUrl, shortcutCaption } from "@/lib/shortcuts";

describe("shortcut links", () => {
  it("normalizes domains and keeps http URLs", () => {
    expect(normalizeWebUrl("wikipedia.org")).toBe("https://wikipedia.org/");
    expect(normalizeWebUrl("http://localhost:2026/path")).toBe(
      "http://localhost:2026/path",
    );
  });

  it("rejects script and file protocols", () => {
    expect(normalizeWebUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebUrl("file:///secret.txt")).toBeNull();
  });

  it("uses a useful caption for old internal shortcuts", () => {
    expect(
      shortcutCaption({ id: "1", label: "Plan", kind: "view", view: "planner" }),
    ).toBe("Planer");
  });
});
