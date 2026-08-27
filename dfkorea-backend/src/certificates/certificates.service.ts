import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCertificateDto, UpdateCertificateDto } from './dto/certificate.dto';
import { Certificate } from '../entities/certificate.entity';

@Injectable()
export class CertificatesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<Certificate[]> {
    const certificates = await this.databaseService.getCertificates();
    // 최신 등록순으로 정렬 (createdAt DESC)
    return certificates.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findOne(id: string): Promise<Certificate | undefined> {
    const certificates = await this.databaseService.getCertificates();
    return certificates.find((certificate) => certificate.id === id);
  }

  async create(createCertificateDto: CreateCertificateDto): Promise<Certificate> {
    return this.databaseService.createCertificate(createCertificateDto);
  }

  async update(
    id: string,
    updateCertificateDto: UpdateCertificateDto,
  ): Promise<Certificate | null> {
    const certificate = await this.findOne(id);
    if (!certificate) {
      return null;
    }
    return this.databaseService.updateCertificate(id, updateCertificateDto);
  }

  async remove(id: string): Promise<boolean> {
    return this.databaseService.deleteCertificate(id);
  }
}
