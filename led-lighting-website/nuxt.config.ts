import { fileURLToPath, URL } from "node:url";

const configuredApiBaseUrl = process.env.VITE_API_BASE_URL?.trim();
const isProductionBuild =
  process.env.NODE_ENV === "production" &&
  process.argv.some((argument) => argument === "build" || argument === "generate");
if (isProductionBuild && !configuredApiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required for production builds");
}

export default defineNuxtConfig({
  compatibilityDate: "2026-06-11",
  srcDir: "src/",
  serverDir: "src/server",
  ssr: true,
  css: ["@/assets/main.css", "@/assets/dark-mode.css"],
  // Keep Nuxt's default component extensions while excluding the explicitly
  // imported parking-garage controllers that collide with ParkingGarageScene.vue.
  components: {
    dirs: [{ path: "@/components", ignore: ["home/parking-garage/**"] }],
  },
  runtimeConfig: {
    g2bRelaySharedSecret: process.env.G2B_RELAY_SHARED_SECRET || "",
    g2bTenderApiBaseUrl: process.env.G2B_TENDER_API_BASE_URL || "",
    // Vercel reserves PUBLIC_* for browser-exposed values, so the relay must
    // fail closed unless its separately named server-only key is configured.
    publicDataServiceKey: process.env.G2B_DATA_SERVICE_KEY || "",
    public: {
      apiBaseUrl:
        configuredApiBaseUrl ||
        "http://localhost:3000",
      siteUrl:
        process.env.NUXT_PUBLIC_SITE_URL ||
        process.env.PUBLIC_SITE_URL ||
        "https://www.dfkorealed.com",
    },
  },
  app: {
    head: {
      htmlAttrs: {
        lang: "ko",
      },
      title: "(주)디에프코리아 - LED 조명 전문 기업 | 혁신적인 조명 솔루션",
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes",
        },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "theme-color", content: "#22a8c3" },
        {
          name: "description",
          content:
            "혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 (주)디에프코리아. 고품질 LED 제품과 솔루션을 경험해보세요.",
        },
        {
          name: "keywords",
          content:
            "LED 조명, LED lighting, 조명, 산업용 조명, 상업용 조명, 에너지 절약, LED 제품, (주)디에프코리아, 디에프코리아",
        },
        { name: "author", content: "디에프코리아" },
        { name: "robots", content: "index, follow" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://www.dfkorealed.com/" },
        { property: "og:title", content: "(주)디에프코리아 - LED 조명 전문 기업" },
        {
          property: "og:description",
          content: "혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 (주)디에프코리아",
        },
        { property: "og:image", content: "https://www.dfkorealed.com/images/og-image.jpg" },
        { property: "og:site_name", content: "(주)디에프코리아" },
        { property: "og:locale", content: "ko_KR" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:url", content: "https://www.dfkorealed.com/" },
        { name: "twitter:title", content: "(주)디에프코리아 - LED 조명 전문 기업" },
        {
          name: "twitter:description",
          content: "혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 (주)디에프코리아",
        },
        { name: "twitter:image", content: "https://www.dfkorealed.com/images/og-image.jpg" },
      ],
      link: [
        { rel: "icon", href: "/favicon.ico" },
        { rel: "canonical", href: "https://www.dfkorealed.com/" },
        {
          rel: "alternate",
          type: "application/rss+xml",
          title: "(주)디에프코리아 RSS Feed",
          href: "https://www.dfkorealed.com/rss.xml",
        },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200",
        },
      ],
      script: [
        {
          type: "application/ld+json",
          innerHTML: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "디에프코리아",
            url: "https://www.dfkorealed.com",
            logo: "https://www.dfkorealed.com/images/logo.svg",
            description: "혁신적인 LED 조명 기술로 더 나은 빛을 제공하는 전문 기업",
            address: {
              "@type": "PostalAddress",
              addressCountry: "KR",
            },
            sameAs: [],
          }),
        },
      ],
    },
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ["/", "/about", "/certificates", "/products", "/blog"],
    },
  },
});
