/**
 * Script to pre-generate SVG paths from GeoJSON
 * This creates a static TypeScript file with SVG paths to avoid runtime processing
 *
 * Usage: npx tsx scripts/generate-svg-paths.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface GeoJsonGeometry {
  type: string;
  coordinates: any;
}

interface GeoJsonFeature {
  type: string;
  properties: {
    NAME_1?: string;
    st_nm?: string;
    name?: string;
  };
  geometry: GeoJsonGeometry;
}

interface GeoJsonData {
  type: string;
  features: GeoJsonFeature[];
}

interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function calculateBounds(features: GeoJsonFeature[]): Bounds {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  features.forEach((feature) => {
    traverseCoordinates(feature.geometry.coordinates, (lng, lat) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
  });

  return { minLng, maxLng, minLat, maxLat };
}

function traverseCoordinates(coords: any, callback: (lng: number, lat: number) => void) {
  if (typeof coords[0] === 'number') {
    callback(coords[0], coords[1]);
  } else {
    coords.forEach((coord: any) => traverseCoordinates(coord, callback));
  }
}

function projectToSvg(
  lng: number,
  lat: number,
  bounds: Bounds,
  width: number,
  height: number,
  padding: number = 20
): [number, number] {
  const { minLng, maxLng, minLat, maxLat } = bounds;

  const lngRange = maxLng - minLng;
  const latRange = maxLat - minLat;
  const aspectRatio = lngRange / latRange;

  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  let scale: number;
  let xOffset: number;
  let yOffset: number;

  if (aspectRatio > availableWidth / availableHeight) {
    scale = availableWidth / lngRange;
    xOffset = padding;
    yOffset = padding + (availableHeight - latRange * scale) / 2;
  } else {
    scale = availableHeight / latRange;
    xOffset = padding + (availableWidth - lngRange * scale) / 2;
    yOffset = padding;
  }

  const x = (lng - minLng) * scale + xOffset;
  const y = (maxLat - lat) * scale + yOffset;

  return [x, y];
}

function coordinatesToPath(
  coordinates: any,
  bounds: Bounds,
  width: number,
  height: number
): string {
  let path = '';

  function processRing(ring: number[][]) {
    if (ring.length === 0) return;

    const [startX, startY] = projectToSvg(ring[0][0], ring[0][1], bounds, width, height);
    path += `M ${startX.toFixed(2)} ${startY.toFixed(2)} `;

    for (let i = 1; i < ring.length; i++) {
      const [x, y] = projectToSvg(ring[i][0], ring[i][1], bounds, width, height);
      path += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
    }

    path += 'Z ';
  }

  function processCoordinates(coords: any) {
    if (typeof coords[0] === 'number') {
      return;
    }

    if (typeof coords[0][0] === 'number') {
      processRing(coords as number[][]);
    } else {
      coords.forEach((c: any) => processCoordinates(c));
    }
  }

  processCoordinates(coordinates);
  return path.trim();
}

function getStateName(feature: GeoJsonFeature): string {
  return (
    feature.properties.NAME_1 ||
    feature.properties.st_nm ||
    feature.properties.name ||
    'Unknown'
  );
}

function simplifyPath(path: string, tolerance: number = 0.5): string {
  // Simple path simplification: remove points that are too close together
  const commands = path.split(/(?=[MLZ])/);
  const simplified: string[] = [];

  let lastX = 0;
  let lastY = 0;

  for (const cmd of commands) {
    const trimmed = cmd.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('M') || trimmed.startsWith('Z')) {
      simplified.push(trimmed);
      if (trimmed.startsWith('M')) {
        const coords = trimmed.substring(1).trim().split(' ');
        lastX = parseFloat(coords[0]);
        lastY = parseFloat(coords[1]);
      }
    } else if (trimmed.startsWith('L')) {
      const coords = trimmed.substring(1).trim().split(' ');
      const x = parseFloat(coords[0]);
      const y = parseFloat(coords[1]);

      const dx = x - lastX;
      const dy = y - lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= tolerance) {
        simplified.push(trimmed);
        lastX = x;
        lastY = y;
      }
    }
  }

  return simplified.join(' ');
}

async function generateSvgPaths() {
  console.log('🗺️  Generating SVG paths from GeoJSON...\n');

  // Read GeoJSON file
  const geoJsonPath = path.join(__dirname, '../frontend/src/assets/india_state.geojson');
  console.log(`📖 Reading: ${geoJsonPath}`);

  if (!fs.existsSync(geoJsonPath)) {
    console.error(`❌ Error: GeoJSON file not found at ${geoJsonPath}`);
    process.exit(1);
  }

  const geoJsonContent = fs.readFileSync(geoJsonPath, 'utf-8');
  console.log(`✅ Loaded GeoJSON file (${(geoJsonContent.length / 1024 / 1024).toFixed(2)} MB)\n`);

  const geoJson: GeoJsonData = JSON.parse(geoJsonContent);
  const features = geoJson.features || [];

  console.log(`📊 Processing ${features.length} features...\n`);

  // Calculate bounds
  const bounds = calculateBounds(features);
  console.log('🌍 Geographic bounds:');
  console.log(`   Longitude: ${bounds.minLng.toFixed(4)} to ${bounds.maxLng.toFixed(4)}`);
  console.log(`   Latitude: ${bounds.minLat.toFixed(4)} to ${bounds.maxLat.toFixed(4)}\n`);

  // SVG dimensions
  const width = 1000;
  const height = 1200;

  // Generate paths
  const statePaths: Record<string, string> = {};
  let totalPoints = 0;
  let simplifiedPoints = 0;

  features.forEach((feature, index) => {
    const stateName = getStateName(feature);
    const rawPath = coordinatesToPath(feature.geometry.coordinates, bounds, width, height);
    const simplifiedPath = simplifyPath(rawPath, 1.0); // 1.0 pixel tolerance

    statePaths[stateName] = simplifiedPath;

    const rawCount = (rawPath.match(/L/g) || []).length;
    const simplifiedCount = (simplifiedPath.match(/L/g) || []).length;

    totalPoints += rawCount;
    simplifiedPoints += simplifiedCount;

    console.log(`✓ ${(index + 1).toString().padStart(2, ' ')}. ${stateName.padEnd(40, ' ')} ${rawCount.toString().padStart(6, ' ')} → ${simplifiedCount.toString().padStart(6, ' ')} points`);
  });

  const reductionPercent = ((1 - simplifiedPoints / totalPoints) * 100).toFixed(1);
  console.log(`\n📉 Simplified ${totalPoints} → ${simplifiedPoints} points (${reductionPercent}% reduction)\n`);

  // Generate TypeScript file
  const outputPath = path.join(__dirname, '../frontend/src/data/indiaSvgPaths.ts');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tsContent = `/**
 * Auto-generated SVG paths for India states
 * Generated from: frontend/src/assets/india_state.geojson
 * Generated at: ${new Date().toISOString()}
 *
 * SVG ViewBox: 0 0 ${width} ${height}
 * Geographic bounds:
 *   Longitude: ${bounds.minLng.toFixed(4)} to ${bounds.maxLng.toFixed(4)}
 *   Latitude: ${bounds.minLat.toFixed(4)} to ${bounds.maxLat.toFixed(4)}
 *
 * Total states: ${features.length}
 * Total points: ${simplifiedPoints.toLocaleString()}
 */

export interface StateSvgPath {
  name: string
  path: string
}

export const SVG_VIEWBOX = "0 0 ${width} ${height}"

export const INDIA_SVG_PATHS: Record<string, string> = ${JSON.stringify(statePaths, null, 2)}

export const STATE_PATHS_ARRAY: StateSvgPath[] = [
${Object.entries(statePaths)
    .map(([name, path]) => `  { name: ${JSON.stringify(name)}, path: ${JSON.stringify(path)} }`)
    .join(',\n')}
]
`;

  fs.writeFileSync(outputPath, tsContent, 'utf-8');
  console.log(`💾 Generated: ${outputPath}`);
  console.log(`📦 File size: ${(tsContent.length / 1024).toFixed(2)} KB\n`);

  console.log('✨ Done! You can now import the paths in your components:\n');
  console.log('   import { INDIA_SVG_PATHS, SVG_VIEWBOX } from "@/data/indiaSvgPaths"\n');
}

// Run the script
generateSvgPaths().catch((error) => {
  console.error('❌ Error generating SVG paths:', error);
  process.exit(1);
});
