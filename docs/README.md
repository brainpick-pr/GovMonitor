# GovMonitor Documentation

This directory contains the complete documentation for GovMonitor.Org, powered by VitePress.

## Quick Start

### Development

Start the documentation development server:

```bash
npm run docs:dev
```

The site will be available at `http://localhost:5173`

### Build

Build the documentation for production:

```bash
npm run docs:build
```

Output will be in `docs/.vitepress/dist/`

### Preview Build

Preview the production build locally:

```bash
npm run docs:preview
```

## Structure

```
docs/
├── .vitepress/
│   ├── config.ts          # VitePress configuration
│   └── dist/              # Build output
├── guide/
│   ├── getting-started.md # Introduction and concepts
│   ├── quick-start.md     # 5-minute setup guide
│   └── authentication.md  # Complete auth guide
├── features/
│   └── overview.md        # All features overview
├── api/
│   └── endpoints.md       # Complete API reference
├── deployment/
│   └── quickstart.md      # Deployment guide
└── index.md               # Home page
```

## Features

- **Modern UI**: Clean, responsive design with dark mode support
- **Search**: Full-text search powered by local search
- **Navigation**: Comprehensive sidebar and navbar
- **Code Highlighting**: Syntax highlighting for multiple languages
- **Mobile-Friendly**: Responsive design for all devices

## Adding Documentation

### New Guide Page

Create a new file in the appropriate directory:

```bash
touch docs/guide/new-feature.md
```

Add the following frontmatter:

```markdown
# Page Title

Content goes here...
```

Update `.vitepress/config.ts` to add the page to the sidebar.

### New API Endpoint

Add to `docs/api/endpoints.md` following the existing format.

## Configuration

Documentation configuration is in `.vitepress/config.ts`:

- **Title & Description**: Site metadata
- **Navigation**: Top navbar links
- **Sidebar**: Per-section navigation
- **Theme**: Colors, fonts, and styling
- **Search**: Search provider configuration

## Deployment

The documentation can be deployed to:

- **Cloudflare Pages**: Automatic deployment from Git
- **Vercel**: One-click deployment
- **Netlify**: Drag-and-drop or Git integration
- **GitHub Pages**: Static site hosting

### Cloudflare Pages

```bash
# Build command
npm run docs:build

# Output directory
docs/.vitepress/dist
```

## Contributing

When contributing documentation:

1. Keep language clear and concise
2. Include code examples for technical concepts
3. Add links to related pages
4. Test locally before committing
5. Follow the existing structure and style

## License

MIT License - See LICENSE file for details
