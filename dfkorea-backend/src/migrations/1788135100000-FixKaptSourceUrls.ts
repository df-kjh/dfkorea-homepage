import { MigrationInterface, QueryRunner } from "typeorm";

export class FixKaptSourceUrls1788135100000 implements MigrationInterface {
  name = "FixKaptSourceUrls1788135100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable("tenders"))) return;

    await queryRunner.query(
      `UPDATE "tenders"
       SET "sourceUrl" = REPLACE("sourceUrl", $1, $2)
       WHERE "source" = 'KAPT'
         AND "sourceUrl" LIKE $3`,
      [
        "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=",
        "https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=",
        "https://www.k-apt.go.kr/web/bid/bidDetail.do?bidNum=%",
      ],
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // The previous prefix is a known 404 route, so rollback must not restore it.
  }
}
