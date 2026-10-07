import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "../../scripts/gen-types";

describe("generated database types", () => {
  it("src/types/database.ts matches the migrations (run `npm run types:gen` if this fails)", async () => {
    const committed = readFileSync(path.resolve(__dirname, "..", "..", "src", "types", "database.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(await generate());
  });
});
