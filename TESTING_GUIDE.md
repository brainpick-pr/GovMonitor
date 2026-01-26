# Frontend Features Testing Guide

Quick guide to test the newly implemented features.

---

## Setup & Build

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already done)
npm install

# Build the application
npm run build

# Start preview server to test PWA features
npm run preview
```

The preview server will show the production build at `http://localhost:4173` (or similar).

---

## 1. Testing Dark Mode

### Quick Test Steps

1. **Open the application** in your browser
2. **Locate the theme toggle** in the top-right header navigation
3. **Click the theme icon** (should show sun/moon/monitor)
4. **Test each mode**:
   - Select **Light** → Verify UI is in light mode
   - Select **Dark** → Verify UI switches to dark mode
   - Select **System** → Should match your OS theme

### What to Check

✅ **Theme Switching**:
- All components update immediately
- No flickering or flash of wrong theme
- Charts and graphs are readable in both modes
- Text contrast is sufficient

✅ **Persistence**:
- Refresh the page → Theme should remain the same
- Close and reopen browser → Theme persists
- Open in new tab → Same theme applied

✅ **Visual Quality**:
- Dark mode colors are pleasant, not too bright
- No pure white backgrounds in dark mode
- Status indicators (green/red) are visible in both modes
- Table headers and borders are visible

### OS System Theme Test

**Windows/Linux**:
1. Set theme to "System"
2. Change OS theme (Windows Settings > Personalization > Colors)
3. GovMonitor should update automatically

**macOS**:
1. Set theme to "System"
2. Change System Preferences > General > Appearance
3. App should update in real-time

---

## 2. Testing Progressive Web App (PWA)

### Desktop Installation Test (Chrome/Edge)

1. **Open in Chrome/Edge**
2. **Look for install icon** in address bar (⊕ or ⬇ icon)
3. **Click "Install GovMonitor"**
4. **Verify**:
   - App opens in standalone window
   - No browser UI (address bar, tabs)
   - App appears in Start Menu/Applications
   - App has correct icon and name

### Mobile Installation Test (Android)

1. **Open in Chrome mobile**
2. **Tap menu (⋮)**
3. **Select "Add to Home Screen"** or "Install app"
4. **Verify**:
   - Install banner appears
   - App installs to home screen
   - Tapping icon opens in fullscreen
   - Splash screen shows briefly

### Mobile Installation Test (iOS)

1. **Open in Safari** (must use Safari on iOS)
2. **Tap Share button** (square with arrow)
3. **Scroll down** and tap "Add to Home Screen"
4. **Name the app** and tap "Add"
5. **Verify**:
   - App appears on home screen
   - Opens in fullscreen mode
   - Shows correct app icon

### Offline Functionality Test

1. **Open the app** (installed or browser)
2. **Navigate around** (visit different pages)
3. **Open DevTools** > Network tab
4. **Throttle to "Offline"**
5. **Navigate the app**:
   - Static pages should still work
   - Cached data should display
   - Recent API data might be available
6. **Go back online**
7. **Refresh data** → Should fetch new data

### Service Worker Test

**Chrome DevTools**:
1. Press **F12** to open DevTools
2. Go to **Application** tab
3. Click **Service Workers** in sidebar
4. **Verify**:
   - Service worker is "activated and running"
   - Source shows `sw.js`
   - Update on reload is checked (optional)

**Check Cached Assets**:
1. In Application tab, click **Cache Storage**
2. Expand caches
3. **Verify**:
   - `workbox-precache-*` contains app assets
   - `api-cache` may contain API responses

### PWA Manifest Test

1. In DevTools **Application** tab
2. Click **Manifest**
3. **Verify**:
   - Name: "GovMonitor.Org"
   - Short name: "GovMonitor"
   - Start URL: "/"
   - Theme color: #10b981
   - Icons appear (even if placeholder)

---

## 3. Testing State Map Drill-Down

### Basic Click Navigation Test

1. **Navigate to "State Dashboard"** view
2. **Click any state** on the India map
3. **Verify**:
   - State border turns blue
   - State appears brighter
   - "Clear Filter" button appears above map
   - Statistics table shows only that state
   - Summary cards update to show state-specific data

### Filter Interaction Test

**Test Multiple States**:
1. Click **Maharashtra** → Verify filter
2. Click **Karnataka** → Should switch to Karnataka
3. Click **Karnataka again** → Filter should clear

**Test Clear Button**:
1. Click any state
2. Click **"Clear Filter"** button in map section
3. Map should reset, table shows all states

**Alternative Clear**:
1. Click any state
2. Click **"Show All States"** button in table header
3. Same result as above

### Visual Feedback Test

**Hover Effects**:
- Hover over states → Should show lighter color
- Cursor changes to pointer
- Tooltip shows state info

**Selection Highlight**:
- Selected state has thick blue border
- Selected state is brighter than others
- Deselected states return to normal

### Data Accuracy Test

1. **Note total stats** before filtering
2. **Click a state**
3. **Verify summary cards**:
   - "Selected State: 1"
   - Total targets = sum for that state only
   - Total checks = sum for that state only
   - Average uptime = that state's uptime only
4. **Check table**:
   - Shows only one row (selected state)
   - Values match the state's actual data

---

## Browser Compatibility Testing

### Recommended Test Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Dark Mode | ✅ | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ⚠️ Partial | ✅ iOS 15.4+ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| State Map Click | ✅ | ✅ | ✅ | ✅ |

### Browser-Specific Tests

**Firefox**:
- PWA installation limited, but service worker works
- Dark mode should work perfectly
- State map navigation fully functional

**Safari**:
- PWA on iOS requires iOS 15.4+
- Manual "Add to Home Screen" required
- Dark mode works well
- Test on both macOS and iOS

**Mobile Browsers**:
- Test on actual devices when possible
- Touch interaction for state map
- PWA installation flow
- Portrait/landscape orientation

---

## Performance Testing

### Load Time Test

1. Open DevTools **Performance** tab
2. Reload page
3. Check **Lighthouse** (in Chrome):
   - Performance score should be > 90
   - PWA score should be > 90
   - Accessibility > 90

### Dark Mode Performance

1. Open Performance tab
2. Record while switching themes
3. Verify theme switch takes < 100ms
4. No layout shifts during transition

### State Map Performance

1. Record Performance while clicking states
2. Verify filtering completes < 50ms
3. No janky animations
4. Smooth state highlighting

---

## Accessibility Testing

### Keyboard Navigation

**Theme Toggle**:
1. Tab to theme toggle button
2. Press Enter/Space → Should open dropdown
3. Arrow keys to navigate options
4. Enter to select

**State Map**:
- Currently no keyboard support (known limitation)
- Mouse/touch only

### Screen Reader Test

**NVDA/JAWS/VoiceOver**:
1. Navigate to State Dashboard
2. Verify map is announced
3. State tooltips should be readable
4. Filter buttons should have clear labels

### Color Contrast

Use browser extensions:
- WAVE (Web Accessibility Evaluation Tool)
- axe DevTools
- Check contrast ratios meet WCAG AA (4.5:1)

---

## Issue Reporting

If you find any issues during testing, please note:

1. **Browser & version** (e.g., Chrome 120, Safari 17.2)
2. **Operating System** (e.g., Windows 11, macOS Sonoma, iOS 17)
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Screenshots/screen recording** (if applicable)
7. **Console errors** (open DevTools, check Console tab)

### Common Issues & Solutions

**Issue**: Theme doesn't change
- **Solution**: Check browser localStorage is enabled, hard refresh (Ctrl+Shift+R)

**Issue**: PWA won't install
- **Solution**: Must use HTTPS (localhost is ok), check service worker registered

**Issue**: State map clicks don't work
- **Solution**: Ensure JavaScript is enabled, check for console errors

**Issue**: Service worker outdated
- **Solution**: DevTools > Application > Service Workers > Unregister, then refresh

---

## Automated Testing (Optional)

If you want to run automated tests:

```bash
# Unit tests (if configured)
npm test

# E2E tests with Playwright (if configured)
npx playwright test

# Lighthouse CI
npm install -g @lhci/cli
lhci autorun --collect.url=http://localhost:4173
```

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Generate actual PNG icons (see `/frontend/public/icons/README.md`)
- [ ] Update manifest.json `start_url` to production URL
- [ ] Verify HTTPS is enabled (required for PWA)
- [ ] Test PWA installation on production URL
- [ ] Run Lighthouse audit (aim for >90 in all categories)
- [ ] Test on real mobile devices (iOS and Android)
- [ ] Verify service worker updates correctly on deployment
- [ ] Test dark mode on various displays (OLED, LCD)
- [ ] Verify state map data matches backend API

---

## Next Steps After Testing

1. **Generate Production Icons**:
   ```bash
   npm install -g pwa-asset-generator
   pwa-asset-generator frontend/public/icons/icon.svg frontend/public/icons --icon-only --favicon --type png
   ```

2. **Update Documentation**:
   - Add screenshots to README
   - Document new features in user guide
   - Update API documentation if needed

3. **Deploy to Production**:
   ```bash
   # Build for production
   npm run build

   # Deploy dist/ folder to hosting
   # (specific commands depend on your hosting provider)
   ```

4. **Monitor in Production**:
   - Check service worker registration rate
   - Monitor PWA install events (if analytics configured)
   - Track dark mode usage (if analytics configured)
   - Monitor state map interaction (if analytics configured)

---

**Happy Testing! 🚀**

All features should work smoothly. If you encounter any issues, refer to the troubleshooting section or check the console for errors.
