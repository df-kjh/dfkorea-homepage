import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { Injectable } from "@nestjs/common";
import { createJwtStrategyOptions } from "./jwt-configuration";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["HS256"],
      ...createJwtStrategyOptions(process.env),
    });
  }

  async validate(payload: any) {
    return this.authService.validateSession(payload);
  }
}
