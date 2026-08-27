import { Injectable } from "@nestjs/common";
import { TenderRelevance } from "../domain/tender.enums";
import { Tender } from "../entities/tender.entity";
import type { TenderClassificationReason } from "../domain/tender-classifier";

export interface RenderedTenderMail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class TenderMailRenderer {
  render(date: Date, tenders: readonly Tender[]): RenderedTenderMail {
    const direct = tenders.filter((tender) => tender.relevance === TenderRelevance.DIRECT);
    const potential = tenders.filter((tender) => tender.relevance === TenderRelevance.POTENTIAL);
    const dateLabel = this.toKstDate(date);
    const subject = `[DF KOREA 입찰정보] ${dateLabel} 신규 공고 ${tenders.length}건`;

    return {
      subject,
      html: this.renderHtml(dateLabel, direct, potential),
      text: this.renderText(dateLabel, direct, potential),
    };
  }

  private renderHtml(dateLabel: string, direct: readonly Tender[], potential: readonly Tender[]): string {
    return [
      '<!doctype html><html lang="ko"><body style="font-family:Arial,sans-serif;color:#172033">',
      `<h1>DF KOREA 신규 입찰 공고 (${this.escape(dateLabel)})</h1>`,
      `<p>전체 ${direct.length + potential.length}건 · 💡 직접 ${direct.length}건 · ⚡ 잠재 ${potential.length}건</p>`,
      this.renderHtmlSection("💡 직접 관련", direct),
      this.renderHtmlSection("⚡ 잠재 관련", potential),
      "</body></html>",
    ].join("");
  }

  private renderHtmlSection(label: string, tenders: readonly Tender[]): string {
    if (tenders.length === 0) return `<h2>${label} (0건)</h2><p>해당 공고가 없습니다.</p>`;
    return `<h2>${label} (${tenders.length}건)</h2>${tenders.map((tender) => {
      const safeUrl = this.safeUrl(tender.sourceUrl);
      const link = safeUrl
        ? `<p><a href="${this.escape(safeUrl)}" rel="noopener noreferrer">공식 원문 보기</a></p>`
        : "";
      return `<article><h3>${this.escape(tender.title)}</h3>` +
        `<p>발주기관: ${this.escape(tender.orderingOrganization)}</p>` +
        `<p>출처: ${this.escape(tender.source)} · 등록일: ${this.escape(this.toKstDate(tender.registeredAt))}</p>` +
        `<p>마감일: ${this.escape(tender.bidEndedAt ? this.toKstDateTime(tender.bidEndedAt) : "미정")}</p>` +
        `<p>지역: ${this.escape(tender.region ?? "미정")} · 유형: ${this.escape(tender.procurementType)}</p>` +
        `<p>금액: ${this.escape(tender.estimatedAmount ? `${tender.estimatedAmount}원` : "미정")}</p>` +
        `<p>판정 근거: ${this.escape(this.renderReasons(tender.relevanceReasons))}</p>${link}</article>`;
    }).join("")}`;
  }

  private renderText(dateLabel: string, direct: readonly Tender[], potential: readonly Tender[]): string {
    const section = (label: string, items: readonly Tender[]) => [
      `${label} (${items.length}건)`,
      ...items.map((tender) => [
        tender.title,
        `발주기관: ${tender.orderingOrganization}`,
        `출처: ${tender.source} | 등록일: ${this.toKstDate(tender.registeredAt)}`,
        `마감일: ${tender.bidEndedAt ? this.toKstDateTime(tender.bidEndedAt) : "미정"}`,
        `지역: ${tender.region ?? "미정"} | 유형: ${tender.procurementType}`,
        `금액: ${tender.estimatedAmount ? `${tender.estimatedAmount}원` : "미정"}`,
        `판정 근거: ${this.renderReasons(tender.relevanceReasons)}`,
        this.safeUrl(tender.sourceUrl) ?? "",
      ].filter(Boolean).join("\n")),
    ].join("\n\n");

    return [
      `DF KOREA 신규 입찰 공고 (${dateLabel})`,
      `전체 ${direct.length + potential.length}건 · 💡 직접 ${direct.length}건 · ⚡ 잠재 ${potential.length}건`,
      section("💡 직접 관련", direct),
      section("⚡ 잠재 관련", potential),
    ].join("\n\n");
  }

  private safeUrl(value: string): string | null {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private renderReasons(reasons: readonly unknown[]): string {
    const formatted = reasons
      .filter((reason): reason is TenderClassificationReason =>
        typeof reason === "object" &&
        reason !== null &&
        typeof (reason as Record<string, unknown>).field === "string" &&
        typeof (reason as Record<string, unknown>).keyword === "string" &&
        typeof (reason as Record<string, unknown>).score === "number",
      )
      .map((reason) => `${reason.field} · ${reason.keyword} · ${reason.score}점`);
    return formatted.join(", ") || "없음";
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character] ?? character);
  }

  private toKstDate(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  private toKstDateTime(date: Date): string {
    return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
}
