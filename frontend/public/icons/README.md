# App Icons

This folder should contain the following PWA icons:

## Required Icons

1. **icon-192.png** - 192x192 px app icon (standard)
2. **icon-512.png** - 512x512 px app icon (standard)
3. **icon-maskable-192.png** - 192x192 px maskable icon (with safe zone)
4. **icon-maskable-512.png** - 512x512 px maskable icon (with safe zone)

## Icon Design Guidelines

- Use the GovMonitor brand colors (green: #10b981)
- Include the "Activity" monitor icon or similar government/monitoring symbol
- Maskable icons should have important elements within the safe zone (80% of canvas)
- Use transparent backgrounds for standard icons
- Use solid background for maskable icons

## Temporary Icon Generation

You can use online tools to generate these icons:
- [Favicon.io](https://favicon.io/)
- [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

## Quick SVG Icon Template

```svg
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#10b981"/>
  <path d="M256 100 L400 256 L256 412 L112 256 Z" fill="white"/>
  <circle cx="256" cy="256" r="40" fill="#10b981"/>
</svg>
```

Save this as icon.svg and convert to PNG at required sizes.
