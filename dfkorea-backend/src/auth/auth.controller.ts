import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() request: Request) {
    // Never trust caller-controlled X-Forwarded-For. Behind a proxy this conservatively
    // shares its source bucket; account throttling still spans different proxy nodes.
    return this.authService.login(
      loginDto.username,
      loginDto.password,
      request.socket.remoteAddress ?? "unknown",
    );
  }

  @Get("session")
  @UseGuards(JwtAuthGuard)
  session(@Req() request: Request) {
    return { user: request.user };
  }
}
