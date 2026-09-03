import { describe, expect, it } from "vitest";

describe("platform identity endpoint", () => {
  it("serves the configured Course360 title and logo", async () => {
    const response = await fetch("http://127.0.0.1:3000/api/platform-identity");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      title: "Course360™",
      logo: "/manus-storage/course360-logo_3d94d0e3.png",
    });
  });
});
