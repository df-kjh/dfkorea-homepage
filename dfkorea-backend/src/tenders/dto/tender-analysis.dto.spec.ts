import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SaveTenderAnalysisReviewDto } from "./tender-analysis.dto";

describe("analysis review DTO", () => {
  it("trims notes before the 2000 character limit and accepts empty notes", async () => {
    for (const note of ["", "   ", "  checked  ", `  ${"a".repeat(2000)}  `]) {
      const dto = plainToInstance(SaveTenderAnalysisReviewDto, {
        completed: true,
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
        (await validate(plainToInstance(SaveTenderAnalysisReviewDto, value)))
          .length,
      ).toBeGreaterThan(0);
    }
  });
});
