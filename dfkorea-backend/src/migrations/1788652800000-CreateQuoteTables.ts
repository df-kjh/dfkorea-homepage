import { MigrationInterface, QueryRunner } from "typeorm";
export class CreateQuoteTables1788652800000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE quote_sessions (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, verification_count integer NOT NULL DEFAULT 0, upload_count integer NOT NULL DEFAULT 0, submit_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE quote_ip_quotas (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), ip_hash text NOT NULL, window_start timestamptz NOT NULL, requests integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ip_hash,window_start));
      CREATE TABLE quote_business_verifications (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), session_id uuid NOT NULL REFERENCES quote_sessions(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, input_hash text NOT NULL, consent_version text NOT NULL, verified_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX quote_verification_session_idx ON quote_business_verifications(session_id);
      CREATE TABLE quote_requests (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), session_id uuid REFERENCES quote_sessions(id) ON DELETE SET NULL, reference text NOT NULL UNIQUE, idempotency_key text NOT NULL, payload_hash text NOT NULL, company jsonb NOT NULL, verified_at timestamptz NOT NULL, consent_version text NOT NULL, consented_at timestamptz NOT NULL, notes text, requested_delivery_date date, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id,idempotency_key));
      CREATE INDEX quote_request_retention_idx ON quote_requests(expires_at);
      CREATE TABLE quote_items (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE, client_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('catalog','custom')), product_id uuid REFERENCES products(id) ON DELETE SET NULL, snapshot jsonb NOT NULL, selected jsonb NOT NULL, quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 999999), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,client_id));
      CREATE TABLE quote_attachments (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), client_attachment_id uuid NOT NULL, source_hash text NOT NULL, source_size integer NOT NULL CHECK(source_size BETWEEN 1 AND 5242880), upload_claim_token uuid, upload_claimed_at timestamptz, UNIQUE(session_id,client_attachment_id), session_id uuid NOT NULL REFERENCES quote_sessions(id) ON DELETE RESTRICT, request_id uuid REFERENCES quote_requests(id) ON DELETE RESTRICT, item_id uuid REFERENCES quote_items(id) ON DELETE RESTRICT, storage_key text NOT NULL UNIQUE, name text NOT NULL, mime_type text NOT NULL, size integer NOT NULL CHECK(size BETWEEN 0 AND 2097152), sha256 text NOT NULL, state text NOT NULL CHECK(state IN ('UPLOADING','READY','DELETING')), cleanup_retry_at timestamptz, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX quote_attachment_cleanup_idx ON quote_attachments(expires_at);
      CREATE INDEX quote_attachment_session_idx ON quote_attachments(session_id);
      CREATE TABLE quote_mail_deliveries (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), request_id uuid NOT NULL UNIQUE REFERENCES quote_requests(id) ON DELETE CASCADE, status text NOT NULL CHECK(status IN ('PENDING','SENDING','PROVIDER_ACCEPTED','FAILED','DELIVERY_UNCERTAIN')), attempts integer NOT NULL DEFAULT 0, claimed_at timestamptz, claim_token uuid, next_attempt_at timestamptz NOT NULL DEFAULT now(), error_code text, provider_accepted_at timestamptz, history jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX quote_delivery_due_idx ON quote_mail_deliveries(status,next_attempt_at);
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      "DROP TABLE quote_mail_deliveries, quote_attachments, quote_items, quote_requests, quote_business_verifications, quote_ip_quotas, quote_sessions",
    );
  }
}
