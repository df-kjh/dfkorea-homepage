import { configureTestDatabase } from "./test-database";

// This process intentionally has no database operation beyond validation. The
// integration Jest setup validates again before AppModule can load.
configureTestDatabase(true);
