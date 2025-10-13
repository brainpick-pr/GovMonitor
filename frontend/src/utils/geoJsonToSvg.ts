// Utility to convert GeoJSON coordinates to SVG path commands
// Uses simple equirectangular projection

interface GeoJsonGeometry {
  type: string
  coordinates: any
}

interface GeoJsonFeature {
  type: string
  properties: {
    NAME_1?: string
    st_nm?: string
    name?: string
  }
  geometry: GeoJsonGeometry
}

interface Bounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

export function calculateBounds(features: GeoJsonFeature[]): Bounds {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  features.forEach((feature) => {
    traverseCoordinates(feature.geometry.coordinates, (lng, lat) => {
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
    })
  })

  return { minLng, maxLng, minLat, maxLat }
}

function traverseCoordinates(coords: any, callback: (lng: number, lat: number) => void) {
  if (typeof coords[0] === 'number') {
    callback(coords[0], coords[1])
  } else {
    coords.forEach((coord: any) => traverseCoordinates(coord, callback))
  }
}

export function projectToSvg(
  lng: number,
  lat: number,
  bounds: Bounds,
  width: number,
  height: number,
  padding: number = 20
): [number, number] {
  const { minLng, maxLng, minLat, maxLat } = bounds

  // Calculate aspect ratio
  const lngRange = maxLng - minLng
  const latRange = maxLat - minLat
  const aspectRatio = lngRange / latRange

  // Calculate available space
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2

  // Determine scale based on aspect ratio
  let scale: number
  let xOffset: number
  let yOffset: number

  if (aspectRatio > availableWidth / availableHeight) {
    // Width is limiting factor
    scale = availableWidth / lngRange
    xOffset = padding
    yOffset = padding + (availableHeight - latRange * scale) / 2
  } else {
    // Height is limiting factor
    scale = availableHeight / latRange
    xOffset = padding + (availableWidth - lngRange * scale) / 2
    yOffset = padding
  }

  const x = (lng - minLng) * scale + xOffset
  const y = (maxLat - lat) * scale + yOffset // Flip Y axis

  return [x, y]
}

export function coordinatesToPath(
  coordinates: any,
  bounds: Bounds,
  width: number,
  height: number
): string {
  let path = ''

  function processRing(ring: number[][]) {
    if (ring.length === 0) return

    const [startX, startY] = projectToSvg(ring[0][0], ring[0][1], bounds, width, height)
    path += `M ${startX.toFixed(2)} ${startY.toFixed(2)} `

    for (let i = 1; i < ring.length; i++) {
      const [x, y] = projectToSvg(ring[i][0], ring[i][1], bounds, width, height)
      path += `L ${x.toFixed(2)} ${y.toFixed(2)} `
    }

    path += 'Z '
  }

  function processCoordinates(coords: any, depth: number = 0) {
    if (typeof coords[0] === 'number') {
      return
    }

    if (typeof coords[0][0] === 'number') {
      // This is a ring
      processRing(coords as number[][])
    } else {
      // Recurse deeper
      coords.forEach((c: any) => processCoordinates(c, depth + 1))
    }
  }

  processCoordinates(coordinates)
  return path.trim()
}

export function getStateName(feature: GeoJsonFeature): string {
  return (
    feature.properties.NAME_1 ||
    feature.properties.st_nm ||
    feature.properties.name ||
    'Unknown'
  )
}
