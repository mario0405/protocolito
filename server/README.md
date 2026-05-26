# Protocolito Cloud Proxy

Small Node.js API that keeps Infomaniak credentials on the server and lets the desktop app authenticate with a per-company Protocolito key.

## Endpoints

- `GET /health`
- `GET /v1/models`
- `POST /v1/summarize`
- `POST /v1/transcribe`

All `/v1/*` endpoints require:

```http
x-protocolito-key: <company-api-key>
```

## Production Shape

Secrets live in `.env` on the VPS:

- `INFOMANIAK_PRODUCT_ID`
- `INFOMANIAK_API_KEY`
- `PROTOCOLITO_COMPANIES_JSON`

Usage is appended to `data/usage.jsonl`.

For MVP this is intentionally simple. Move usage and company records to Postgres once billing/reporting needs grow.
