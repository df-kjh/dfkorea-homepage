import { writeFileSync } from "fs";

interface DatabaseIdentity {
  host?: unknown;
  port?: unknown;
  username?: unknown;
  database?: unknown;
}

type ProbeWriter = (
  path: string,
  content: string,
  encoding: BufferEncoding,
) => void;

export const maybeWriteTestBootstrapConfigProbe = (
  environment: NodeJS.ProcessEnv,
  databaseOptions: DatabaseIdentity,
  writeProbe: ProbeWriter = writeFileSync,
): boolean => {
  const outputPath = environment.TEST_BOOTSTRAP_CONFIG_PROBE_PATH;
  if (environment.NODE_ENV !== "test" || !outputPath) {
    return false;
  }

  writeProbe(
    outputPath,
    JSON.stringify({
      host: databaseOptions.host,
      port: databaseOptions.port,
      username: databaseOptions.username,
      database: databaseOptions.database,
    }),
    "utf8",
  );
  return true;
};
