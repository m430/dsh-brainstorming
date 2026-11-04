# Security Policy

## Supported Versions

Security fixes are provided for the latest `0.0.x` release.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories:

https://github.com/m430/dsh-brainstorming/security/advisories/new

Do not open a public issue for a vulnerability and do not include API keys,
credentials, private board content, or other sensitive data in a report.

## Security Model

- The plugin does not read, store, or transmit model provider API keys itself.
- AI calls use the DeepSeek Harness `ctx.llm` service, so credentials remain in
  the Harness provider/credentials layer.
- All plugin HTTP routes are registered through the Harness authenticated `/api`
  connection.
- Board content is stored in the browser's `localStorage`. Treat it as local
  user data.
- AI prompts and board content are sent to the model provider configured in
  DeepSeek Harness. Use a local provider for confidential material.
