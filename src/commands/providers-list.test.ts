import { describe, expect, it } from "vitest";

import { renderProvidersList } from "./providers-list.js";

describe("renderProvidersList", () => {
  it("renders a stable provider table", () => {
    expect(renderProvidersList()).toEqual([
      "Providers",
      "",
      "Provider   Type        Name",
      "openai     direct      OpenAI",
      "google     direct      Google",
      "together   aggregated  Together",
      "replicate  aggregated  Replicate",
    ]);
  });
});
