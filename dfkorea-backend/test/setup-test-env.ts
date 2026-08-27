// This suite uses controller and repository doubles by default, so it never
// opens a production database. When a disposable PostgreSQL service is
// supplied, these aliases let an opt-in test harness load only TEST_DB_*.
process.env.NODE_ENV = "test";
process.env.CRON_TIMEZONE = "Asia/Seoul";
process.env.TYPEORM_SYNCHRONIZE = "false";

const databaseVariables = [
  "HOST",
  "PORT",
  "USERNAME",
  "PASSWORD",
  "NAME",
] as const;
for (const suffix of databaseVariables) {
  const value = process.env[`TEST_DB_${suffix}`];
  if (value !== undefined) {
    process.env[`DB_${suffix}`] = value;
  }
}
