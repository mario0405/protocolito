# Protocolito Cloud Proxy

Small Node.js API that keeps Infomaniak credentials on the server and lets the desktop app authenticate with a per-company Protocolito key.

## Endpoints

- `GET /health`
- `POST /v1/access/check`
- `GET /v1/models`
- `GET /v1/integrations`
- `POST /v1/integrations/connect`
- `POST /v1/integrations/status`
- `POST /v1/integrations/send-summary`
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
- `COMPOSIO_API_KEY`

Optional Composio overrides:

- `COMPOSIO_BASE_URL`
- `COMPOSIO_INTEGRATIONS_JSON`
- `COMPOSIO_<PROVIDER>_AUTH_CONFIG_ID`
- `COMPOSIO_<PROVIDER>_TOOL_SLUG`

The bundled defaults use Composio-managed OAuth auth configs for Notion, Asana, Google Docs, Slack, Microsoft Teams, Jira, Monday.com, HubSpot, and Salesforce. The desktop app only calls these Protocolito Cloud endpoints; it does not store the owner Composio API key.

Access checks and cloud usage are appended to `data/usage.jsonl`.

For MVP this is intentionally simple. Move usage and company records to Postgres once billing/reporting needs grow.
