import { configureTestDatabase } from "./test-database";

// Contract suites use controller/repository doubles and never open a database.
// The AppModule integration suite opts in with REQUIRE_TEST_DATABASE=true; its
// configuration is validated before any TypeORM provider is constructed.
process.env.NODE_ENV = "test";
process.env.CRON_TIMEZONE = "Asia/Seoul";
process.env.TYPEORM_SYNCHRONIZE = "false";
configureTestDatabase(process.env.REQUIRE_TEST_DATABASE === "true");
