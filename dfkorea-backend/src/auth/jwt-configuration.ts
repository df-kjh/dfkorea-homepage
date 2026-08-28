import { JwtModuleOptions } from "@nestjs/jwt";
import { resolveJwtSecret } from "../config/production-environment";

export const createJwtModuleOptions = (
  environment: NodeJS.ProcessEnv,
  expiresIn = "24h",
): JwtModuleOptions => ({
  secret: resolveJwtSecret(environment),
  signOptions: { expiresIn } as JwtModuleOptions["signOptions"],
});

export const createJwtStrategyOptions = (
  environment: NodeJS.ProcessEnv,
): { secretOrKey: string } => ({
  secretOrKey: resolveJwtSecret(environment),
});
