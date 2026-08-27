import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PostsService } from "./posts.service";
import { CreatePostDto, UpdatePostDto } from "./dto/post.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;

    if (pageNum !== undefined && limitNum !== undefined) {
      return this.postsService.findAllPaginated(pageNum, limitNum, search);
    }

    return this.postsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const post = await this.postsService.findOne(id);
    if (!post) {
      throw new HttpException("Post not found", HttpStatus.NOT_FOUND);
    }
    return post;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async update(@Param("id") id: string, @Body() updatePostDto: UpdatePostDto) {
    const post = await this.postsService.update(id, updatePostDto);
    if (!post) {
      throw new HttpException("Post not found", HttpStatus.NOT_FOUND);
    }
    return post;
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string) {
    const success = await this.postsService.remove(id);
    if (!success) {
      throw new HttpException("Post not found", HttpStatus.NOT_FOUND);
    }
    return { message: "Post deleted successfully" };
  }

  @Post(":id/view")
  async incrementViews(@Param("id") id: string) {
    const post = await this.postsService.incrementViews(id);
    if (!post) {
      throw new HttpException("Post not found", HttpStatus.NOT_FOUND);
    }
    return post;
  }
}
