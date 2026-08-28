import { JwtService } from "@nestjs/jwt";
import {
  createJwtModuleOptions,
  createJwtStrategyOptions,
} from "./jwt-configuration";

describe("shared JWT configuration", () => {
  it("signs and verifies with the same validated production secret", () => {
    const environment = {
      NODE_ENV: "production",
      JWT_SECRET: "Production-JWT-secret-with-32+Chars!2026",
    };
    const signing = new JwtService(createJwtModuleOptions(environment, "5m"));
    const token = signing.sign({ username: "operations-admin" });
    const verification = new JwtService({
      secret: createJwtStrategyOptions(environment).secretOrKey as string,
    });

    expect(verification.verify(token)).toEqual(
      expect.objectContaining({ username: "operations-admin" }),
    );
  });

  it("uses an explicit non-production-only fallback", () => {
    expect(createJwtModuleOptions({ NODE_ENV: "test" }).secret).toMatch(
      /dev-test-only/,
    );
  });
});
