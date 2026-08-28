import * as bcrypt from "bcrypt";
import { MigrationInterface, QueryRunner } from "typeorm";

interface ExistingAdminRow {
  id: number;
  username: string;
  password: string;
}

export class RemoveInsecureDefaultAdmin1787819900000
  implements MigrationInterface
{
  name = "RemoveInsecureDefaultAdmin1787819900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const candidates = (await queryRunner.query(
      'SELECT "id", "username", "password" FROM "admins" WHERE "username" = $1',
      ["admin"],
    )) as ExistingAdminRow[];

    for (const candidate of candidates) {
      if (!(await bcrypt.compare("admin123", candidate.password))) continue;
      // The password predicate makes this safe against a concurrent rotation.
      await queryRunner.query(
        'DELETE FROM "admins" WHERE "id" = $1 AND "username" = $2 AND "password" = $3',
        [candidate.id, "admin", candidate.password],
      );
    }
  }

  public async down(): Promise<void> {
    // Never recreate a known insecure credential during rollback.
  }
}
