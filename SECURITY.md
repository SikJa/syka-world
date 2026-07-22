# Security

Syka World is local-first. The default game and bridge bind to loopback addresses, and the game treats Hermes as the source of truth.

- Never commit Hermes credentials, API keys, session transcripts or private memory files.
- Do not expose the bridge or a Hermes gateway directly to the public internet.
- The published bridge is observational and GET-only; actions that could start real work require a separate, explicit design and permission boundary.
- Report security issues privately to the repository owner instead of opening a public issue containing secrets or personal data.
