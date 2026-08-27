import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from '../entities/admin.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async onModuleInit() {
    await this.initializeAdmin();
  }

  private async initializeAdmin() {
    try {
      // Admin 계정이 이미 있는지 확인
      const existingAdmin = await this.adminRepository.findOne({
        where: { username: 'admin' },
      });

      if (existingAdmin) {
        console.log('✅ Admin account already exists');
        return;
      }

      // Admin 계정 생성
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const admin = this.adminRepository.create({
        username: 'admin',
        password: hashedPassword,
      });

      await this.adminRepository.save(admin);
      console.log('✅ Admin account created successfully');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } catch (error) {
      console.error('❌ Failed to initialize admin account:', error.message);
    }
  }
}
