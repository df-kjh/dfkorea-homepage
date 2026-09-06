import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SaveTenderAnalysisReviewDto } from "./tender-analysis.dto";

describe("analysis review DTO", () => {
  it("trims notes before the 2000 character limit and accepts empty notes", async () => {
    for (const note of ["", "   ", "  checked  ", `  ${"a".repeat(2000)}  `]) {
      const dto = plainToInstance(SaveTenderAnalysisReviewDto, {
        completed: true,
        analysisFingerprint: "a".repeat(64),
        note,
      });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.note).toBe(note.trim());
    }
  });
  it("rejects nonboolean completion, oversized notes and null notes", async () => {
    for (const value of [
      { completed: "true", note: "" },
      { completed: false, note: "a".repeat(2001) },
      { completed: true, note: null },
    ]) {
      expect(
        (
          await validate(
            plainToInstance(SaveTenderAnalysisReviewDto, {
              analysisFingerprint: "a".repeat(64),
              ...value,
            }),
          )
        ).length,
      ).toBeGreaterThan(0);
    }
  });
});

it("requires the displayed analysis fingerprint", async () => {
  for (const analysisFingerprint of [
    undefined,
    null,
    "",
    "old",
    "a".repeat(65),
  ]) {
    expect(
      (
        await validate(
          plainToInstance(SaveTenderAnalysisReviewDto, {
            completed: true,
            note: "checked",
            analysisFingerprint,
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  }
});
