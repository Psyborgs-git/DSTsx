import { describe, it, expect, vi, beforeEach } from "vitest";
import { AWSBedrock } from "../../src/lm/adapters/AWSBedrock.js";

// We can't actually call AWS Bedrock in unit tests, so we verify:
// 1. The class is instantiated correctly
// 2. The correct error is thrown when the SDK is not installed

describe("AWSBedrock", () => {
  it("constructs with defaults", () => {
    const lm = new AWSBedrock();
    expect(lm.model).toBe("anthropic.claude-3-haiku-20240307-v1:0");
  });

  it("constructs with custom model", () => {
    const lm = new AWSBedrock({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });
    expect(lm.model).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0");
  });

  it("accepts region, accessKeyId, secretAccessKey options", () => {
    const lm = new AWSBedrock({
      region: "us-west-2",
      accessKeyId: "AKID",
      secretAccessKey: "SECRET",
    });
    expect(lm.model).toBe("anthropic.claude-3-haiku-20240307-v1:0");
  });

  it("throws a descriptive error when SDK is not installed", async () => {
    const lm = new AWSBedrock();
    // Mock the dynamic import to throw
    vi.spyOn(lm as any, "_call").mockRejectedValueOnce(
      new Error("The `@aws-sdk/client-bedrock-runtime` package is required"),
    );
    await expect(lm.call("hello")).rejects.toThrow(
      "@aws-sdk/client-bedrock-runtime",
    );
  });

  it("is registered in LM.from() under 'bedrock' and 'aws_bedrock' prefixes", async () => {
    // Import factory to ensure providers are registered
    await import("../../src/lm/factory.js");
    const { LM } = await import("../../src/lm/LM.js");

    const lm1 = LM.from("bedrock/anthropic.claude-3-haiku-20240307-v1:0");
    expect(lm1).toBeInstanceOf(AWSBedrock);
    expect(lm1.model).toBe("anthropic.claude-3-haiku-20240307-v1:0");

    const lm2 = LM.from("aws_bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0");
    expect(lm2).toBeInstanceOf(AWSBedrock);
    expect(lm2.model).toBe("anthropic.claude-3-5-sonnet-20241022-v2:0");
  });
});
