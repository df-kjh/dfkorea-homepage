import { Injectable, Logger } from "@nestjs/common";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Product } from "../entities/product.entity";

export interface GeneratedPost {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
}

export interface ProductInfo {
  name: string; // 제품명
  category: string; // 카테고리
  images: string[]; // 썸네일 이미지 경로들
  modelName?: string; // 모델명
  dimensions?: string; // 규격/크기
  power?: string; // 소비전력
  lifespan?: string; // 수명
  colorTemp?: string; // 색온도
  ledChipManufacturer?: string; // LED 칩 제조사
  certifications?: string[]; // 인증 정보
}

export interface GeneratedProductDescription {
  description: string; // 마크다운 형식의 상세 설명 (이미지 포함)
  generatedImages: string[]; // 생성된 이미지 URLs
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  private readonly maxGenerateRetries = 2;
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    // Gemini API 키가 있으면 초기화
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log(`✅ Google Gemini AI initialized. model=${this.modelName}`);
    } else {
      this.logger.warn(
        "⚠️ GEMINI_API_KEY not found. AI features will be disabled."
      );
    }
  }

  /**
   * LED 산업 동향 블로그 글 생성
   */
  async generateLedIndustryTrendPost(): Promise<GeneratedPost> {
    if (!this.genAI) {
      throw new Error("Gemini API is not configured");
    }

    try {
      // 최신 Gemini 2.0 Flash 모델 사용 (2026년 1월 기준 최신)
      // 더 빠르고 강력한 성능, 긴 컨텍스트 지원
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      // 현재 날짜 정보
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const weekOfMonth = Math.ceil(today.getDate() / 7);

      const prompt = `당신은 LED 조명 산업 전문가입니다. 
${year}년 ${month}월 ${weekOfMonth}주차 LED 조명 산업의 최신 동향에 대한 블로그 글을 작성해주세요.

다음 가이드라인을 따라주세요:
1. 제목: 간결하고 눈길을 끄는 제목 (30자 이내)
2. 발췌문: 2-3문장으로 핵심 내용 요약 (100자 이내)
3. 본문: 마크다운 형식으로 작성 (1000-1500자)
   - ## 주요 동향
   - ## 기술 혁신
   - ## 시장 전망
   - ## 결론
4. 카테고리: "산업동향"으로 고정

본문에는 다음 내용을 포함해주세요:
- 최근 LED 기술 발전 (칩 효율, 광질, 스마트 조명 등)
- 에너지 절약 및 친환경 트렌드
- 글로벌 시장 동향 (한국, 미국, 유럽, 중국 등)
- 정부 정책 및 규제 변화
- 향후 전망 및 기회

응답 형식 (JSON):
{
  "title": "제목",
  "excerpt": "발췌문",
  "content": "마크다운 본문",
  "category": "산업동향"
}

참고: 실제 최신 데이터가 없다면, 업계의 일반적인 트렌드와 예상되는 발전 방향을 기반으로 작성해주세요.`;

      this.logger.log("🤖 Generating LED industry trend post...");
      const result = await this.generateContentWithRetry(
        model,
        prompt,
        "LED industry trend post",
      );
      const response = result.response;
      const text = response.text();

      // JSON 추출 (마크다운 코드 블록 제거)
      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "");
      }

      const generatedData = JSON.parse(jsonText);

      // 기본 이미지 설정 (LED 산업 관련)
      const defaultImage =
        "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800&auto=format&fit=crop";

      const post: GeneratedPost = {
        title: generatedData.title || "LED 산업 동향",
        excerpt: generatedData.excerpt || "LED 산업의 최신 동향을 소개합니다.",
        content: generatedData.content || "내용이 생성되지 않았습니다.",
        category: "산업동향",
        image: generatedData.image || defaultImage,
      };

      this.logger.log(`✅ Post generated: "${post.title}"`);
      return post;
    } catch (error) {
      this.logger.error("❌ Failed to generate post:", error);
      throw error;
    }
  }

  /**
   * DB에 저장된 제품 정보를 바탕으로 제품소식 블로그 글 생성
   */
  async generateProductCompanyNewsPost(product: Product): Promise<GeneratedPost> {
    if (!this.genAI) {
      throw new Error("Gemini API is not configured");
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      const representativeImage = product.images?.[0]?.image || "";
      const imageDescriptions = product.images
        ?.map((image, index) =>
          image.description
            ? `${index + 1}. ${image.description}`
            : `${index + 1}. ${image.image}`
        )
        .join("\n");

      const prompt = `당신은 (주)디에프코리아의 LED 조명 제품을 소개하는 브랜드 콘텐츠 에디터입니다.
아래 제품 정보와 기존 소개 글을 바탕으로 회사 홈페이지의 "제품소식" 카테고리에 올라갈 블로그 글을 작성해주세요.

작성 목표:
- 단순 스펙 나열이 아니라, 고객이 현장에서 어떤 문제를 해결할 수 있는지 중심으로 소개
- 과장된 표현, 검증되지 않은 수치, 경쟁사 비방 금지
- 제품 상세 설명에 없는 인증/성능은 새로 만들어내지 말 것
- 자연스러운 한국어 문체로 작성

제품 정보:
- 제품명: ${product.name}
- 카테고리: ${product.category}
- 모델명: ${product.modelName}
- 규격/크기: ${product.dimensions}
- 소비전력: ${product.power?.join(", ")}W
- 수명: ${product.lifespan}시간
- 색온도: ${product.colorTemp?.join(", ")}K
- LED 칩 제조사: ${product.ledChipManufacturer}
- 인증: ${product.certifications?.join(", ") || "정보 없음"}
- 역률: ${product.powerFactor || "정보 없음"}
- 광효율: ${product.luminanceEfficiency ? `${product.luminanceEfficiency}lm/W` : "정보 없음"}
- 연색성: ${product.colorRendering || "정보 없음"}
- 옵션: ${product.options?.join(", ") || "정보 없음"}
- 대표 이미지: ${representativeImage || "정보 없음"}
${imageDescriptions ? `- 이미지 설명:\n${imageDescriptions}` : ""}

기존 제품 소개 글:
${product.description || "소개 글 없음"}

작성 가이드:
1. 제목은 제품명이 들어가도록 35자 이내로 작성
2. 발췌문은 2문장 이내, 120자 이내로 작성
3. 본문은 마크다운 형식, 900-1400자 분량으로 작성
4. 본문 구성은 아래 섹션을 포함
   - ## 제품 소개
   - ## 주요 특징
   - ## 추천 적용 공간
   - ## 선택 시 확인할 점
   - ## 마무리
5. 카테고리는 반드시 "제품소식"으로 반환

응답은 JSON만 반환하세요. 마크다운 코드블록을 쓰지 마세요.
{
  "title": "제목",
  "excerpt": "발췌문",
  "content": "마크다운 본문",
  "category": "제품소식"
}`;

      this.logger.log(`📝 Generating product news post for: ${product.name}`);
      const result = await this.generateContentWithRetry(
        model,
        prompt,
        `product news post for ${product.name}`,
      );
      const response = result.response;
      const text = response.text();

      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "");
      }

      const jsonStart = jsonText.indexOf("{");
      const jsonEnd = jsonText.lastIndexOf("}");
      if (jsonStart >= 0 && jsonEnd >= 0) {
        jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
      }

      const generatedData = JSON.parse(jsonText);

      const post: GeneratedPost = {
        title: generatedData.title || `${product.name} 제품 소개`,
        excerpt:
          generatedData.excerpt ||
          `${product.name}의 주요 특징과 적용 공간을 소개합니다.`,
        content:
          generatedData.content ||
          `## 제품 소개\n\n${product.description || product.name}`,
        category: "제품소식",
        image: generatedData.image || representativeImage,
      };

      this.logger.log(`✅ Product news post generated: "${post.title}"`);
      return post;
    } catch (error) {
      this.logger.error("❌ Failed to generate product news post:", error);
      throw error;
    }
  }

  /**
   * AI 기능 사용 가능 여부 확인
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * 제품 상세 설명 및 이미지 생성
   * @param productInfo 제품 정보
   * @returns 생성된 설명과 이미지 URLs
   */
  async generateProductDescription(
    productInfo: ProductInfo
  ): Promise<GeneratedProductDescription> {
    if (!this.genAI) {
      throw new Error("Gemini API is not configured");
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
      });

      // 제품 정보를 바탕으로 상세한 설명 생성 프롬프트
      const prompt = `당신은 LED 조명 제품의 마케팅 전문가입니다.
다음 제품 정보를 바탕으로 전문적이고 매력적인 제품 상세 설명을 작성해주세요.

제품 정보:
- 제품명: ${productInfo.name}
- 카테고리: ${productInfo.category}
${productInfo.modelName ? `- 모델명: ${productInfo.modelName}` : ""}
${productInfo.dimensions ? `- 규격/크기: ${productInfo.dimensions}` : ""}
${productInfo.power ? `- 소비전력: ${productInfo.power}` : ""}
${productInfo.lifespan ? `- 수명: ${productInfo.lifespan}` : ""}
${productInfo.colorTemp ? `- 색온도: ${productInfo.colorTemp}` : ""}
${productInfo.ledChipManufacturer ? `- LED 칩 제조사: ${productInfo.ledChipManufacturer}` : ""}
${productInfo.certifications && productInfo.certifications.length > 0 ? `- 인증: ${productInfo.certifications.join(", ")}` : ""}

작성 가이드라인:
1. 마크다운 형식으로 작성 (2000-3000자)
2. 다음 섹션을 포함:
   ## 제품 개요
   - 제품의 주요 특징과 용도를 2-3문장으로 요약
   
   ## 주요 특징
   - 핵심 기능과 장점을 불릿 포인트로 나열 (5-7개)
   
   ## 기술 사양
   - 제공된 사양 정보를 표 형식으로 정리
   
   ## 설치 및 활용
   - 설치 방법과 최적 활용 시나리오 설명
   
   ## 에너지 효율 및 환경
   - 에너지 절약 효과와 친환경적 특성 강조
   
   ## 품질 보증
   - 제품 보증 기간 및 A/S 정보

3. 전문적이면서도 읽기 쉬운 톤 유지
4. 고객의 관심사(비용 절감, 품질, 내구성)를 강조
5. 기술적 세부사항과 실용적 이점의 균형 유지

그리고 이 제품을 시각적으로 표현할 수 있는 이미지 생성 프롬프트를 7개 작성해주세요.
각 프롬프트는 다음 조건을 만족해야 합니다:
- 제품을 다양한 각도와 배경에서 보여주는 장면
- 실제 설치 환경이나 사용 시나리오
- 제품의 빛 효과와 분위기를 강조
- 영어로 작성 (AI 이미지 생성 도구 호환성)
- 각 프롬프트 50-100 단어

응답 형식 (JSON):
{
  "description": "마크다운 형식의 상세 설명",
  "imagePrompts": [
    "prompt 1: Professional product photo of [product] from front angle...",
    "prompt 2: [product] installed in modern office environment...",
    "prompt 3: Close-up detail shot showing the LED chip quality...",
    "prompt 4: [product] in use during evening, showing warm light effect...",
    "prompt 5: Side angle view of [product] highlighting design features...",
    "prompt 6: [product] in commercial space with multiple units installed...",
    "prompt 7: Artistic shot emphasizing the energy-efficient glow..."
  ]
}`;

      this.logger.log(
        `🤖 Generating product description for: ${productInfo.name}`
      );
      const result = await this.generateContentWithRetry(
        model,
        prompt,
        `product description for ${productInfo.name}`,
      );
      const response = result.response;
      let text = response.text();

      // JSON 추출
      let jsonText = text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "");
      }

      // 추가 정제: 앞뒤 불필요한 텍스트 제거
      const jsonStart = jsonText.indexOf("{");
      const jsonEnd = jsonText.lastIndexOf("}");
      jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
      this.logger.debug(`📋 Extracted JSON: ${jsonText.substring(0, 100)}...`);

      const generatedData = JSON.parse(jsonText);

      this.logger.log(`✅ Product description generated`);
      return generatedData;
    } catch (error) {
      this.logger.error("❌ Failed to generate product description:", error);
      throw error;
    }
  }

  private async generateContentWithRetry(
    model: { generateContent: (prompt: string) => Promise<any> },
    prompt: string,
    context: string
  ): Promise<any> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxGenerateRetries; attempt += 1) {
      try {
        if (attempt > 0) {
          this.logger.warn(
            `Retrying Gemini generation for ${context} (${attempt}/${this.maxGenerateRetries})`
          );
        }

        return await model.generateContent(prompt);
      } catch (error) {
        lastError = error;

        if (
          attempt >= this.maxGenerateRetries ||
          !this.isRetryableGenerateError(error)
        ) {
          break;
        }

        const delayMs = this.getRetryDelayMs(attempt);
        this.logger.warn(
          `Gemini generation failed for ${context}. Retrying in ${delayMs}ms.`,
          error instanceof Error ? error.message : String(error)
        );
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private getRetryDelayMs(attempt: number): number {
    return [5000, 15000][attempt] ?? 15000;
  }

  private isRetryableGenerateError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return !/\[(400 Bad Request|404 Not Found)]/.test(message);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
