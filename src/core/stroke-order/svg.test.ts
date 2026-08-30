import { describe, expect, it } from "vitest";

import { createStrokeOrderDiagram, createStrokeOrderSvg } from "./svg";

const strokes = ["M 100 100 L 900 100", "M 500 50 L 500 850"];

describe("createStrokeOrderSvg", () => {
  it("creates one progressive tile per stroke", () => {
    const svg = createStrokeOrderSvg("十", strokes);

    expect(svg.match(/data-step=/g)).toHaveLength(2);
    expect(svg.match(/<path /g)).toHaveLength(4);
    expect(svg).not.toContain("<use");
    expect(svg).not.toContain("<defs");
    expect(svg.match(/fill="#E5484D"/g)).toHaveLength(4);
  });

  it("escapes SVG attribute data", () => {
    const svg = createStrokeOrderSvg("&", ['M 0 0 L 1 1" onload="alert(1)']);

    expect(svg).toContain("Stroke order for &amp;");
    expect(svg).toContain("&quot; onload=&quot;");
    expect(svg).not.toContain('onload="alert');
  });

  it("rejects implausibly large stroke arrays", () => {
    const tooManyStrokes = Array.from({ length: 129 }, () => "M 0 0 L 1 1");
    expect(() => createStrokeOrderSvg("龍", tooManyStrokes)).toThrow("128-stroke safety limit");
  });

  it("rejects diagrams whose inlined paths would be too large", () => {
    const largePath = `M${" 0".repeat(7_000)}`;
    const oversizedDiagram = Array.from({ length: 20 }, () => largePath);
    expect(() => createStrokeOrderSvg("龍", oversizedDiagram)).toThrow("too large to render safely");
  });
});

describe("createStrokeOrderDiagram", () => {
  it("returns a base64 SVG data URI with intrinsic dimensions", () => {
    const diagram = createStrokeOrderDiagram("十", strokes);
    const encodedSvg = diagram.dataUri.replace("data:image/svg+xml;base64,", "");
    const decodedSvg = Buffer.from(encodedSvg, "base64").toString();

    expect(diagram.width).toBeGreaterThan(0);
    expect(diagram.height).toBeGreaterThan(0);
    expect(decodedSvg).toContain("<svg");
    expect(decodedSvg).toContain("Stroke order for 十");
  });
});
