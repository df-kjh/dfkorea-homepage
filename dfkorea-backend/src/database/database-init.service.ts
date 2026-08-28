import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Admin } from "../entities/admin.entity";

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV !== "production") return;
    if ((await this.adminRepository.count()) === 0) {
      throw new Error(
        "No production admin exists. Run the approved admin:provision:prod command before startup.",
      );
    }
  }
}
