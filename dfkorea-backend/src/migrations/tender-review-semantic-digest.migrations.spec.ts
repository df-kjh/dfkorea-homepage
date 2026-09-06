import { AddTenderReviewSemanticDigest1788699200000 } from "./1788699200000-AddTenderReviewSemanticDigest";
import { getMetadataArgsStorage } from "typeorm";
import { TenderAnalysis } from "../tenders/entities/tender-analysis.entity";

it("adds a nullable bounded digest matching the entity, without backfilling from clipped evidence", async () => {
  const runner = { query: jest.fn().mockResolvedValue([]) };
  const migration = new AddTenderReviewSemanticDigest1788699200000();
  await migration.up(runner as never);
  expect(runner.query).toHaveBeenCalledWith(
    'ALTER TABLE "tender_analyses" ADD COLUMN "reviewSemanticDigest" varchar(64)',
  );
  expect(
    getMetadataArgsStorage().columns.find(
      (value) =>
        value.target === TenderAnalysis &&
        value.propertyName === "reviewSemanticDigest",
    ).options,
  ).toMatchObject({ type: "varchar", length: 64, nullable: true });
  await migration.down(runner as never);
  expect(runner.query).toHaveBeenLastCalledWith(
    'ALTER TABLE "tender_analyses" DROP COLUMN "reviewSemanticDigest"',
  );
});
