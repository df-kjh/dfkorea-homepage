import { ChildProcess, spawn } from "child_process";
import { join } from "path";
import {
  prepareProductionEnvironment,
  ProductionEnvironmentMode,
} from "../config/production-environment";

export type ProductionProcessAction =
  | "start"
  | "migration:run"
  | "migration:revert";

export const parseProductionProcessArguments = (
  arguments_: readonly string[],
): {
  mode: ProductionEnvironmentMode;
  action: ProductionProcessAction;
} => {
  const [mode, action] = arguments_;
  if (mode !== "file" && mode !== "ambient") {
    throw new Error(
      "Production process requires an explicit file or ambient mode",
    );
  }
  if (
    action !== "start" &&
    action !== "migration:run" &&
    action !== "migration:revert"
  ) {
    throw new Error("Unsupported production process action");
  }
  return { mode, action };
};

export const getProductionProcessCommand = (
  action: ProductionProcessAction,
  workingDirectory: string,
  typeOrmCliPath = require.resolve("typeorm/cli.js"),
):
  | { kind: "module"; modulePath: string }
  | { kind: "child"; executable: string; arguments: string[] } => {
  if (action === "start") {
    return {
      kind: "module",
      modulePath: join(workingDirectory, "dist", "main.js"),
    };
  }

  return {
    kind: "child",
    executable: process.execPath,
    arguments: [
      typeOrmCliPath,
      action,
      "-d",
      "dist/database/typeorm.config.js",
    ],
  };
};

const forwardSignals = (child: ChildProcess): (() => void) => {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  const listeners = signals.map((signal) => {
    const listener = () => child.kill(signal);
    process.once(signal, listener);
    return { signal, listener };
  });
  return () => {
    for (const { signal, listener } of listeners) {
      process.removeListener(signal, listener);
    }
  };
};

export const runProductionProcess = async (
  mode: ProductionEnvironmentMode,
  action: ProductionProcessAction,
  workingDirectory = process.cwd(),
): Promise<number> => {
  prepareProductionEnvironment(mode, workingDirectory, process.env);
  const command = getProductionProcessCommand(action, workingDirectory);
  if (command.kind === "module") {
    // Keep Nest in this process so PM2 cluster workers retain their shared
    // listener and lifecycle semantics after the environment is prepared.
    require(command.modulePath);
    return 0;
  }

  return new Promise<number>((resolve, reject) => {
    const child = spawn(command.executable, command.arguments, {
      cwd: workingDirectory,
      env: process.env,
      stdio: "inherit",
    });
    const removeSignalListeners = forwardSignals(child);
    child.once("error", (error) => {
      removeSignalListeners();
      reject(new Error(`Production process could not start: ${error.message}`));
    });
    child.once("exit", (code) => {
      removeSignalListeners();
      resolve(code ?? 1);
    });
  });
};

if (require.main === module) {
  try {
    const { mode, action } = parseProductionProcessArguments(
      process.argv.slice(2),
    );
    void runProductionProcess(mode, action)
      .then((status) => {
        process.exitCode = status;
      })
      .catch((error: unknown) => {
        console.error(
          error instanceof Error ? error.message : "Production process failed",
        );
        process.exitCode = 1;
      });
  } catch (error) {
    // Controlled errors list variable names or paths, never environment values.
    console.error(
      error instanceof Error ? error.message : "Production process failed",
    );
    process.exitCode = 1;
  }
}
