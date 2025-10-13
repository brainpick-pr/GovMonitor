import type { DefaultTheme, UserConfig } from "vitepress"

const config: UserConfig = {
  title: "GovMonitor Internal Docs",
  description: "Developer documentation for GovMonitor.Org",
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Implementation", link: "/implementation/overview" },
      { text: "Pending Work", link: "/pending/improvement-plan" },
    ],
    sidebar: {
      "/implementation/": [
        {
          text: "Implementation",
          items: [
            { text: "Overview", link: "/implementation/overview" },
            { text: "Worker", link: "/implementation/worker" },
            { text: "Frontend", link: "/implementation/frontend" },
            { text: "Data & Storage", link: "/implementation/data" },
          ],
        },
      ],
      "/pending/": [
        {
          text: "Pending Work",
          items: [{ text: "Improvement Plan", link: "/pending/improvement-plan" }],
        },
      ],
    },
  },
}

export default config
