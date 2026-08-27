/**
 * Subscription delivery is deliberately global. A concrete empty DTO makes
 * Nest's global whitelist reject accidental display filters instead of quietly
 * accepting an email-filter feature that the product does not support.
 */
export class TenderSubscriptionQueryDto {}
