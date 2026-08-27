import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { CreateCertificateDto, UpdateCertificateDto } from './dto/certificate.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  async findAll() {
    return this.certificatesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const certificate = await this.certificatesService.findOne(id);
    if (!certificate) {
      throw new HttpException('Certificate not found', HttpStatus.NOT_FOUND);
    }
    return certificate;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createCertificateDto: CreateCertificateDto) {
    return this.certificatesService.create(createCertificateDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateCertificateDto: UpdateCertificateDto,
  ) {
    const certificate = await this.certificatesService.update(id, updateCertificateDto);
    if (!certificate) {
      throw new HttpException('Certificate not found', HttpStatus.NOT_FOUND);
    }
    return certificate;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    const success = await this.certificatesService.remove(id);
    if (!success) {
      throw new HttpException('Certificate not found', HttpStatus.NOT_FOUND);
    }
    return { message: 'Certificate deleted successfully' };
  }
}
