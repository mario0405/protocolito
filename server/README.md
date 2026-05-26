# Protocolito Cloud Proxy

Small Node.js API that keeps Infomaniak credentials on the server and lets the desktop app authenticate with a per-company Protocolito key.

## Endpoints

- `GET /health`
- `POST /v1/access/check`
- `GET /v1/models`
- `POST /v1/summarize`
- `POST /v1/transcribe`

All `/v1/*` endpoints require:

```http
x-protocolito-key: <company-api-key>
```

For the desktop app MVP, this company API key is also the activation/license key users paste into settings.

Admin monitoring:

- `GET /admin/usage`

Requires:

```http
x-admin-token: <admin-token>
```

## Production Shape

Secrets live in `.env` on the VPS:

- `INFOMANIAK_PRODUCT_ID`
- `INFOMANIAK_API_KEY`
- `PROTOCOLITO_COMPANIES_JSON`
- `ADMIN_TOKEN`

Access checks and cloud usage are appended to `data/usage.jsonl`.

For MVP this is intentionally simple. Move usage and company records to Postgres once billing/reporting needs grow.
