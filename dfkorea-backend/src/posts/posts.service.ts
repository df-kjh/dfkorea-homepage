import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { CreatePostDto } from "./dto/post.dto";
import { UpdatePostDto } from "./dto/post.dto";
import { Post } from "../entities/post.entity";

@Injectable()
export class PostsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(): Promise<Post[]> {
    return this.databaseService.getPosts();
  }

  async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{
    data: Post[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let allPosts = await this.databaseService.getPosts();

    // 검색어가 있으면 필터링
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      allPosts = allPosts.filter((post) =>
        post.title.toLowerCase().includes(searchLower),
      );
    }

    const total = allPosts.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const data = allPosts.slice(startIndex, endIndex);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Post | undefined> {
    const posts = await this.databaseService.getPosts();
    return posts.find((post) => post.id === id);
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    // TypeORM이 createdAt, updatedAt, views 기본값을 자동 관리합니다
    return this.databaseService.createPost(createPostDto);
  }

  async update(id: string, updatePostDto: UpdatePostDto): Promise<Post | null> {
    const post = await this.findOne(id);
    if (!post) {
      return null;
    }

    // TypeORM이 updatedAt을 자동 관리합니다
    return this.databaseService.updatePost(id, updatePostDto);
  }

  async remove(id: string): Promise<boolean> {
    return this.databaseService.deletePost(id);
  }

  async incrementViews(id: string): Promise<Post | null> {
    return this.databaseService.incrementPostViews(id);
  }
}
