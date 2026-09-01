# G2B Vercel Relay Fallback Design

Date: 2026-09-01
Status: Approved in chat; awaiting written-spec review

## Problem and evidence

The production Railway service consistently receives HTTP 200 responses for all three G2B operations but cannot find a provider `resultCode`. Every operation is therefore recorded as `PROVIDER_RESULT_ERROR` with `providerCode=none`, `page=1`, and `attempts=1`.

The same production service key, API base URL, operations, and 15-hour 33-minute collection window succeed from the local network and return 971 notices. KAPT succeeds from Railway. This rules out the configured key, date window, broad construction/goods/service scope, and the common HTTP client as the primary cause. The remaining boundary is the Railway-to-G2B outbound path or an intermediary response specific to that path.

The system must remain fail-closed. A missing result code must not be treated as success unless the response also has the complete canonical data body. Accepting arbitrary HTTP 200 responses would allow a gateway or WAF error to advance the successful watermark and silently skip notices.

## Goals

- Restore reliable G2B construction, goods, and service collection without requiring Railway Pro.
- Keep Railway direct collection as the primary path when it works.
- Automatically retry eligible Railway-specific failures through the existing Vercel deployment.
- Preserve per-operation partial success, deduplication, classification, and the `SUCCEEDED`-only watermark.
- Never expose or persist the public-data service key, relay secret, provider URL/query string, raw provider error body, or raw error cause.
- Verify the complete production path with the authenticated collect endpoint before declaring success.

## Non-goals

- No goods-only or MAS-only filtering.
- No changes to KAPT, KEPCO, mail delivery, calendar filtering, or collection schedule.
- No acceptance of unknown HTTP 200 bodies as success.
- No Railway or Vercel paid static-IP upgrade.
- No public general-purpose proxy.

## Chosen architecture

### Primary and fallback paths

`G2bTenderAdapter` continues to call the existing direct `PublicApiClient` first, sequentially in this order:

1. `getBidPblancListInfoCnstwk`
2. `getBidPblancListInfoThng`
3. `getBidPblancListInfoServc`

If an operation fails with HTTP 200, `PROVIDER_RESULT_ERROR`, and no provider result code, the adapter retries only that operation through a second `PublicApiClient` whose fetcher targets the Vercel relay. Directly successful operations are never repeated through the relay.

Other permanent failures remain failures. Existing transient handling stays unchanged: provider code 23, HTTP 429/502/503/504, timeout, and network failures use at most the two existing retry delays.

If the relay succeeds, its rows replace that operation's failure and participate in normal normalization, classification, persistence, and counts. If the relay also fails, the safe relay failure replaces the direct failure in the final operation metadata. The source is:

- `SUCCEEDED` when all three operations ultimately succeed, including relay recovery;
- `PARTIAL` when at least one operation succeeds and at least one remains failed;
- `FAILED` only when all three operations remain failed.

### Relay transport

The Nuxt application adds one server-only route:

`POST /api/internal/g2b-relay`

The Railway relay fetcher receives the provider URL created by `PublicApiClient`, extracts only the whitelisted operation and query fields, removes `serviceKey`, and sends a JSON payload to the relay. The service key never crosses from Railway to Vercel in the request.

Allowed payload fields:

```json
{
  "operation": "getBidPblancListInfoCnstwk",
  "query": {
    "type": "json",
    "inqryDiv": "1",
    "inqryBgnDt": "202608311500",
    "inqryEndDt": "202609010633",
    "pageNo": "1",
    "numOfRows": "100"
  }
}
```

The only allowed operation values are the three G2B operations above. Dates must be 12 decimal digits, `pageNo` must be 1–100, `numOfRows` must be exactly 100, `type` must be `json`, and `inqryDiv` must be `1`. Unknown or duplicate fields are rejected. Request bodies are size-limited.

Vercel reconstructs the provider URL from its own `G2B_TENDER_API_BASE_URL` and `PUBLIC_DATA_SERVICE_KEY`, performs one provider-page request, and returns the provider JSON to Railway without logging it. Railway's existing `PublicApiClient` remains responsible for provider result validation and pagination.

The relay client uses a conservative 1,500 ms minimum request-start interval. Calls are sequential, so this also keeps proxied provider page starts safely above the existing 1,100 ms target despite network-latency variation.

### Authentication

Railway and Vercel share a new randomly generated secret of at least 32 bytes in `G2B_RELAY_SHARED_SECRET`.

Railway sends:

- `x-dfkorea-timestamp`: Unix milliseconds;
- `x-dfkorea-signature`: lowercase hexadecimal HMAC-SHA256 of `<timestamp>.<exact request body>`.

Vercel rejects timestamps outside a five-minute window and compares signatures using a timing-safe comparison. The endpoint is read-only and requests are time-bounded, so persistent nonce storage is not required.

Required Railway variables:

- `G2B_RELAY_ENABLED=true`
- `G2B_RELAY_URL=https://dfkorealed.com/api/internal/g2b-relay`
- `G2B_RELAY_SHARED_SECRET`: a newly generated secret of at least 32 bytes

Required Vercel variables:

- `G2B_RELAY_SHARED_SECRET`: the exact same generated value used by Railway
- `G2B_TENDER_API_BASE_URL`: the existing production G2B base URL
- `PUBLIC_DATA_SERVICE_KEY`: the existing production public-data service key

Secrets are set through authenticated CLIs without echoing their values.

## Direct response validation

The public API parser may accept a missing `resultCode` only when all of the following are present:

- a canonical `response.body` object;
- `totalCount` is a finite non-negative number;
- `items` is present in the canonical body;
- there is no recognized gateway-error envelope or error object.

This narrowly handles a legitimate body with an omitted header. Any other missing-code shape stays `PROVIDER_RESULT_ERROR` and becomes eligible for the relay fallback.

Safe diagnostics add only a bounded response-shape category such as `CANONICAL_BODY_WITHOUT_CODE`, `GATEWAY_ERROR_SHAPE`, or `UNKNOWN_RESPONSE_SHAPE`. Key names, values, bodies, URLs, and provider messages are not logged.

## Failure behavior

- Missing or invalid relay configuration: direct collection continues; relay failure is `CONFIGURATION_ERROR` without secret details.
- Invalid HMAC or payload: relay returns a generic 401 or 400 response with no provider information.
- Relay timeout/network/transient HTTP error: existing bounded transient retries apply.
- Provider permanent error through relay: no extra retry outside the existing policy.
- Some operations recovered: persist them and report `PARTIAL` only for remaining failures.
- All operations recovered: report `SUCCEEDED` and allow the normal watermark advance.

## Testing

Backend tests must prove:

- fallback occurs only for HTTP-200 missing-code provider failures;
- directly successful operations are not repeated;
- all recovered operations produce `SUCCEEDED` and correct counts;
- mixed relay recovery preserves `PARTIAL` and successful rows;
- HMAC signing is deterministic and the service key is stripped;
- relay URL, shared secret, service key, provider body, and raw causes never appear in logs/errors;
- direct and relay request pacing and retry bounds remain intact.

Frontend/server tests must prove:

- valid HMAC and allowed payload proxy exactly one page;
- invalid/expired signatures and malformed payloads are rejected;
- unknown operations and query fields are rejected;
- Vercel injects its own service key and never returns it in error output;
- provider status/body forwarding is sufficient for the backend parser;
- no relay route is included in client-side runtime configuration.

Full backend CI, frontend tests, type checks, and production builds remain required.

## Deployment and production verification

1. Deploy the relay route to Vercel with relay variables set.
2. Send one signed, non-secret shape probe through the production relay and require a canonical G2B success response.
3. Set Railway relay variables and deploy the backend fallback.
4. Confirm Railway and Vercel deployments are successful and both public health checks return 200.
5. Call the authenticated production collect endpoint once.
6. Require G2B `SUCCEEDED`, a nonzero fetched count for a window known to contain notices, no failed G2B operation logs, and saved notices visible through the existing query path.
7. If the relay probe itself receives a gateway/WAF error, do not loosen parsing. Stop and report that a separate Korean-hosted collector with a permitted outbound address is required.

## Documentation

Update `docs/menus/tenders.md` with the direct/relay behavior, safe failure reporting, and operating variables. No database schema change is planned, so `database-schema.md` does not need a schema update.
