import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { createJwtStrategyOptions } from "./jwt-configuration";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...createJwtStrategyOptions(process.env),
    });
  }

  async validate(payload: any) {
    return { username: payload.username };
  }
}
