# GovMonitor.Org Internal Documentation

Welcome to the developer documentation for GovMonitor.Org. These docs outline the current stack, runtime behavior on the Cloudflare platform, and planned enhancements so the team can collaborate efficiently.

## Quick Links

- [Implementation Overview](/implementation/overview)
- [Cloudflare Worker Details](/implementation/worker)
- [Frontend (Pages) Details](/implementation/frontend)
- [Data & Storage](/implementation/data)
- [Improvement Plan](/pending/improvement-plan)

## Stack Summary

- **Cloudflare Workers** provide the REST API, cron-driven health checks, and integration with D1 and KV.
- **Cloudflare D1** stores configuration, target metadata, and check history.
- **Cloudflare KV** caches the latest target status and aggregated state data for fast reads.
- **Cloudflare Pages** hosts the Vite + React frontend.
- **VitePress** (these docs) capture implementation notes and roadmap items.

Refer to the sidebar for detailed sections or use the navigation above.
