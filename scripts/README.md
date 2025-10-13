# Scripts

This directory contains utility scripts for GovMonitor.Org.

## generate-svg-paths.ts

Generates pre-computed SVG paths from the GeoJSON file for optimal frontend performance.

### What it does

1. Reads `frontend/src/assets/india_state.geojson`
2. Converts GeoJSON coordinates to SVG paths
3. Simplifies paths by removing redundant points
4. Generates TypeScript file with pre-computed paths

### Benefits

- **Faster load times**: No runtime GeoJSON processing
- **Smaller bundle**: Simplified paths reduce file size
- **Better performance**: Static paths instead of dynamic conversion
- **Type safety**: Generated TypeScript definitions

### Usage

```bash
# Install dependencies first (only needed once)
npm install

# Generate SVG paths
npm run generate:svg
```

### Output

Generates: `frontend/src/data/indiaSvgPaths.ts`

Contains:
- `INDIA_SVG_PATHS`: Record of state name → SVG path
- `STATE_PATHS_ARRAY`: Array of {name, path} objects
- `SVG_VIEWBOX`: Recommended viewBox dimensions

### Example Output

```
🗺️  Generating SVG paths from GeoJSON...

📖 Reading: frontend/src/assets/india_state.geojson
✅ Loaded GeoJSON file (21.87 MB)

📊 Processing 36 features...

🌍 Geographic bounds:
   Longitude: 68.1762 to 97.4025
   Latitude: 6.7473 to 35.5088

✓  1. Andaman and Nicobar Islands             12453 →   8234 points
✓  2. Andhra Pradesh                           9823 →   6521 points
✓  3. Arunachal Pradesh                       15234 →  10123 points
...

📉 Simplified 325,432 → 215,678 points (33.7% reduction)

💾 Generated: frontend/src/data/indiaSvgPaths.ts
📦 File size: 1.24 MB

✨ Done! You can now import the paths in your components:

   import { INDIA_SVG_PATHS, SVG_VIEWBOX } from "@/data/indiaSvgPaths"
```

### Using Generated Paths

#### Option 1: Use IndiaMapOptimized (Recommended)

```tsx
import { IndiaMapOptimized } from "@/components/IndiaMapOptimized"

<IndiaMapOptimized stateData={stateData} />
```

#### Option 2: Use directly in your component

```tsx
import { INDIA_SVG_PATHS, SVG_VIEWBOX } from "@/data/indiaSvgPaths"

<svg viewBox={SVG_VIEWBOX}>
  {Object.entries(INDIA_SVG_PATHS).map(([name, path]) => (
    <path key={name} d={path} fill="blue" />
  ))}
</svg>
```

### Configuration

Edit the script to adjust:

- **SVG dimensions**: Change `width` and `height` variables
- **Simplification tolerance**: Adjust `simplifyPath(rawPath, 1.0)` value
  - Lower = more detail, larger file
  - Higher = less detail, smaller file
- **Padding**: Modify `padding` parameter in `projectToSvg()`

### Requirements

- Node.js 18+
- TypeScript
- `tsx` package (auto-installed via npx)

### Troubleshooting

**Error: GeoJSON file not found**
- Ensure `frontend/src/assets/india_state.geojson` exists
- Check the path in the script matches your file location

**Error: Out of memory**
- GeoJSON file is very large (21MB+)
- Node may need more memory: `NODE_OPTIONS="--max-old-space-size=4096" npm run generate:svg`

**Generated file is too large**
- Increase simplification tolerance in the script
- Consider using a simplified GeoJSON source

### Performance Comparison

| Metric | Runtime Processing | Pre-generated |
|--------|-------------------|---------------|
| Initial render | ~2000ms | ~50ms |
| Bundle size | +22MB (GeoJSON) | +1.2MB (paths) |
| Memory usage | ~150MB | ~20MB |
| Re-renders | Slow | Fast |

### When to Regenerate

Regenerate SVG paths when:
- GeoJSON file is updated
- SVG dimensions change
- Simplification settings change
- State boundaries are modified

### Future Enhancements

Possible improvements:
- Add command-line arguments for dimensions
- Support TopoJSON input format
- Generate multiple resolution versions
- Add projection options (Mercator, etc.)
- Create separate files per state
