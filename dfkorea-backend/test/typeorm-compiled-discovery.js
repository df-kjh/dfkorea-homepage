const assert = require("assert");
const { existsSync } = require("fs");
const { join } = require("path");

const backendRoot = join(__dirname, "..");
process.env.NODE_ENV = "test";

const { getTypeOrmPaths } = require(
  join(backendRoot, "dist", "database", "typeorm.config.js"),
);
const paths = getTypeOrmPaths(".js");
const discoveryPaths = [...paths.entities, ...paths.migrations];

for (const expectedGlob of [
  "dist/entities/*.entity.js",
  "dist/tenders/entities/*.entity.js",
  "dist/migrations/*.js",
]) {
  assert.ok(
    discoveryPaths.includes(expectedGlob),
    `Missing compiled TypeORM discovery glob: ${expectedGlob}`,
  );
}

for (const relativePath of [
  "dist/tenders/entities/tender-recipient.entity.js",
  "dist/tenders/entities/tender-mail-delivery.entity.js",
  "dist/tenders/entities/tender-daily-dispatch.entity.js",
  "dist/migrations/1787819500000-CreateTenderTables.js",
  "dist/migrations/1787819800000-HardenTenderMailDelivery.js",
  "dist/migrations/1787819900000-RemoveInsecureDefaultAdmin.js",
  "dist/migrations/1787820000000-AddDailyDispatchLease.js",
  "dist/scripts/provision-admin.js",
]) {
  assert.ok(
    existsSync(join(backendRoot, relativePath)),
    `Missing compiled TypeORM artifact: ${relativePath}`,
  );
}

process.stdout.write("compiled TypeORM discovery: PASS\n");
