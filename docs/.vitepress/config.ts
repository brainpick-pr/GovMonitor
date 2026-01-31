import type { DefaultTheme, UserConfig } from "vitepress"

const config: UserConfig = {
  title: "GovMonitor.Org",
  description: "Real-time uptime monitoring for government websites",
  base: '/',

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Features", link: "/features/overview" },
      { text: "API Reference", link: "/api/endpoints" },
      { text: "Deployment", link: "/deployment/quickstart" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/guide/getting-started" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Development Workflow", link: "/guide/development-workflow" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Check Modes", link: "/guide/check-modes" },
            { text: "Database Schema", link: "/guide/database-schema" },
            { text: "Caching Strategy", link: "/guide/caching-strategy" },
            { text: "Cron & Scheduling", link: "/guide/cron-scheduling" },
          ],
        },
        {
          text: "Security",
          items: [
            { text: "Authentication", link: "/guide/authentication" },
            { text: "API Keys", link: "/guide/api-keys" },
            { text: "GDPR Compliance", link: "/guide/gdpr-compliance" },
          ],
        },
      ],

      "/features/": [
        {
          text: "Features",
          items: [
            { text: "Overview", link: "/features/overview" },
            { text: "Smart Scheduling", link: "/features/smart-scheduling" },
            { text: "Maintenance Windows", link: "/features/maintenance-windows" },
            { text: "Alert System", link: "/features/alerts" },
            { text: "Bulk Operations", link: "/features/bulk-operations" },
            { text: "Health Check Templates", link: "/features/templates" },
          ],
        },
      ],

      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Endpoints", link: "/api/endpoints" },
            { text: "Authentication", link: "/api/authentication" },
            { text: "Error Handling", link: "/api/error-handling" },
          ],
        },
        {
          text: "Monitoring",
          items: [
            { text: "Status", link: "/api/status" },
            { text: "History", link: "/api/history" },
            { text: "Targets", link: "/api/targets" },
            { text: "Checks", link: "/api/checks" },
          ],
        },
        {
          text: "Configuration",
          items: [
            { text: "Global Config", link: "/api/config" },
            { text: "State Summary", link: "/api/state-summary" },
            { text: "Scheduling", link: "/api/scheduling" },
            { text: "Maintenance", link: "/api/maintenance" },
          ],
        },
        {
          text: "Alerts",
          items: [
            { text: "Alert Management", link: "/api/alerts" },
            { text: "Channels", link: "/api/alert-channels" },
            { text: "Configuration", link: "/api/alert-config" },
          ],
        },
        {
          text: "Bulk Operations",
          items: [
            { text: "Import/Export", link: "/api/bulk-import-export" },
            { text: "Bulk Updates", link: "/api/bulk-updates" },
          ],
        },
        {
          text: "Templates",
          items: [
            { text: "Template Management", link: "/api/templates" },
          ],
        },
        {
          text: "GDPR",
          items: [
            { text: "Retention Policy", link: "/api/gdpr-retention" },
            { text: "Data Export", link: "/api/gdpr-export" },
            { text: "Data Deletion", link: "/api/gdpr-deletion" },
          ],
        },
      ],

      "/deployment/": [
        {
          text: "Deployment",
          items: [
            { text: "Quick Start", link: "/deployment/quickstart" },
            { text: "Database Setup", link: "/deployment/database" },
            { text: "Worker Deployment", link: "/deployment/worker" },
            { text: "Frontend Deployment", link: "/deployment/frontend" },
            { text: "Environment Variables", link: "/deployment/environment" },
          ],
        },
        {
          text: "Operations",
          items: [
            { text: "Monitoring", link: "/deployment/monitoring" },
            { text: "Troubleshooting", link: "/deployment/troubleshooting" },
            { text: "Migrations", link: "/deployment/migrations" },
            { text: "Rollback", link: "/deployment/rollback" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yourusername/govmonitor' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 GovMonitor.Org'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/yourusername/govmonitor/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'short'
      }
    }
  },

  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  ignoreDeadLinks: true
}

export default config
