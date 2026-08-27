import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

interface JsonDatabase {
  admin: {
    username: string;
    password: string;
  };
  products: any[];
  posts: any[];
}

async function bootstrap() {
  console.log('🚀 Starting JSON to PostgreSQL migration...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const dbService = app.get(DatabaseService);

  try {
    // 기존 JSON 데이터 읽기
    const jsonPath = path.join(process.cwd(), 'data', 'database.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.log('❌ database.json file not found at:', jsonPath);
      console.log('ℹ️  No data to migrate.');
      await app.close();
      return;
    }

    const jsonData: JsonDatabase = JSON.parse(
      fs.readFileSync(jsonPath, 'utf-8'),
    );

    console.log('📊 Found data:');
    console.log(`   - ${jsonData.products.length} products`);
    console.log(`   - ${jsonData.posts.length} posts\n`);

    // Admin은 migration에서 이미 생성됨
    console.log('✅ Admin account already created via migration\n');

    // Products 마이그레이션
    console.log('📦 Migrating products...');
    for (const product of jsonData.products) {
      const { id, createdAt, updatedAt, ...productData } = product;
      
      try {
        await dbService.createProduct(productData);
        console.log(`   ✓ ${product.name}`);
      } catch (error) {
        console.log(`   ✗ Failed to migrate: ${product.name}`);
        console.log(`     Error: ${error.message}`);
      }
    }

    // Posts 마이그레이션
    console.log('\n📝 Migrating posts...');
    for (const post of jsonData.posts) {
      const { id, createdAt, updatedAt, ...postData } = post;
      
      try {
        await dbService.createPost(postData);
        console.log(`   ✓ ${post.title}`);
      } catch (error) {
        console.log(`   ✗ Failed to migrate: ${post.title}`);
        console.log(`     Error: ${error.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nℹ️  You can now safely remove the data/database.json file.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
