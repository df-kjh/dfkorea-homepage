import { maybeWriteTestBootstrapConfigProbe } from "./bootstrap-config-probe";

describe("test-only bootstrap config probe", () => {
  const databaseOptions = {
    host: "selected.internal",
    port: 6543,
    username: "selected-user",
    password: "secret-must-not-be-written",
    database: "selected-database",
  };

  it("is unavailable in production even when its path variable is supplied", () => {
    const writeProbe = jest.fn();

    expect(
      maybeWriteTestBootstrapConfigProbe(
        {
          NODE_ENV: "production",
          TEST_BOOTSTRAP_CONFIG_PROBE_PATH: "/tmp/must-not-write.json",
        },
        databaseOptions,
        writeProbe,
      ),
    ).toBe(false);
    expect(writeProbe).not.toHaveBeenCalled();
  });

  it("writes only sanitized Nest database identity in test mode", () => {
    const writeProbe = jest.fn();

    expect(
      maybeWriteTestBootstrapConfigProbe(
        {
          NODE_ENV: "test",
          TEST_BOOTSTRAP_CONFIG_PROBE_PATH: "/tmp/probe.json",
        },
        databaseOptions,
        writeProbe,
      ),
    ).toBe(true);
    expect(writeProbe).toHaveBeenCalledWith(
      "/tmp/probe.json",
      JSON.stringify({
        host: "selected.internal",
        port: 6543,
        username: "selected-user",
        database: "selected-database",
      }),
      "utf8",
    );
    expect(JSON.stringify(writeProbe.mock.calls)).not.toContain(
      "secret-must-not-be-written",
    );
  });
});
