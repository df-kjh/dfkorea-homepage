import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Post } from '../entities/post.entity';
import { Admin } from '../entities/admin.entity';
import { Certificate } from '../entities/certificate.entity';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(Certificate)
    private certificateRepository: Repository<Certificate>,
  ) {}

  // Product methods
  async getProducts(): Promise<Product[]> {
    return this.productRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.productRepository.findOne({ where: { id } });
  }

  async createProduct(
    product: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Product> {
    const newProduct = this.productRepository.create(product);
    return this.productRepository.save(newProduct);
  }

  async updateProduct(
    id: string,
    updates: Partial<Omit<Product, 'id' | 'createdAt'>>,
  ): Promise<Product | null> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) return null;

    Object.assign(product, updates);
    return this.productRepository.save(product);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await this.productRepository.delete(id);
    return result.affected > 0;
  }

  // Post methods
  async getPosts(): Promise<Post[]> {
    return this.postRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getPostById(id: string): Promise<Post | null> {
    return this.postRepository.findOne({ where: { id } });
  }

  async createPost(
    post: Partial<Omit<Post, 'id' | 'views' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Post> {
    const newPost = this.postRepository.create({
      ...post,
      views: 0,
    });
    return this.postRepository.save(newPost);
  }

  async updatePost(
    id: string,
    updates: Partial<Omit<Post, 'id' | 'views' | 'createdAt'>>,
  ): Promise<Post | null> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) return null;

    Object.assign(post, updates);
    return this.postRepository.save(post);
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await this.postRepository.delete(id);
    return result.affected > 0;
  }

  async incrementPostViews(id: string): Promise<Post | null> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) return null;

    post.views += 1;
    return this.postRepository.save(post);
  }

  // Admin methods
  async getAdmin(): Promise<{ username: string; password: string } | null> {
    const admin = await this.adminRepository.findOne({
      where: { username: 'admin' },
    });
    return admin;
  }

  async createAdmin(
    username: string,
    password: string,
  ): Promise<Admin> {
    const admin = this.adminRepository.create({ username, password });
    return this.adminRepository.save(admin);
  }

  // Certificate methods
  async getCertificates(): Promise<Certificate[]> {
    return this.certificateRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getCertificateById(id: string): Promise<Certificate | null> {
    return this.certificateRepository.findOne({ where: { id } });
  }

  async createCertificate(
    certificate: Partial<Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Certificate> {
    const newCertificate = this.certificateRepository.create(certificate);
    return this.certificateRepository.save(newCertificate);
  }

  async updateCertificate(
    id: string,
    updates: Partial<Omit<Certificate, 'id' | 'createdAt'>>,
  ): Promise<Certificate | null> {
    const certificate = await this.certificateRepository.findOne({ where: { id } });
    if (!certificate) return null;

    Object.assign(certificate, updates);
    return this.certificateRepository.save(certificate);
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const result = await this.certificateRepository.delete(id);
    return result.affected > 0;
  }
}
