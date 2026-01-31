import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface StateData {
  state: string;
  total_targets: number;
  up_count: number;
  down_count: number;
  uptime_percentage: number;
  avg_latency_ms: number | null;
}

interface InteractiveIndiaMapProps {
  stateData: StateData[];
  onStateSelect: (state: string) => void;
  selectedState: string | null;
}

// India center coordinates
const INDIA_CENTER: [number, number] = [22.5937, 78.9629];
const INDIA_ZOOM = 5;

// State name mapping (GeoJSON names to our names)
const STATE_NAME_MAP: Record<string, string> = {
  'Andaman and Nicobar': 'Andaman & Nicobar',
  'Arunachal Pradesh': 'Arunachal Pradesh',
  'Assam': 'Assam',
  'Bihar': 'Bihar',
  'Chandigarh': 'Chandigarh',
  'Chhattisgarh': 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu': 'Dadra & Nagar Haveli',
  'Delhi': 'Delhi',
  'Goa': 'Goa',
  'Gujarat': 'Gujarat',
  'Haryana': 'Haryana',
  'Himachal Pradesh': 'Himachal Pradesh',
  'Jammu and Kashmir': 'Jammu & Kashmir',
  'Jharkhand': 'Jharkhand',
  'Karnataka': 'Karnataka',
  'Kerala': 'Kerala',
  'Ladakh': 'Ladakh',
  'Lakshadweep': 'Lakshadweep',
  'Madhya Pradesh': 'Madhya Pradesh',
  'Maharashtra': 'Maharashtra',
  'Manipur': 'Manipur',
  'Meghalaya': 'Meghalaya',
  'Mizoram': 'Mizoram',
  'Nagaland': 'Nagaland',
  'Odisha': 'Odisha',
  'Puducherry': 'Puducherry',
  'Punjab': 'Punjab',
  'Rajasthan': 'Rajasthan',
  'Sikkim': 'Sikkim',
  'Tamil Nadu': 'Tamil Nadu',
  'Telangana': 'Telangana',
  'Tripura': 'Tripura',
  'Uttar Pradesh': 'Uttar Pradesh',
  'Uttarakhand': 'Uttarakhand',
  'West Bengal': 'West Bengal',
};

// Get color based on uptime percentage
function getUptimeColor(uptime: number): string {
  if (uptime >= 99) return '#22c55e'; // Green
  if (uptime >= 95) return '#84cc16'; // Lime
  if (uptime >= 90) return '#eab308'; // Yellow
  if (uptime >= 80) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

// Map bounds adjuster component
function MapBoundsHandler({ selectedState, geoJson }: { selectedState: string | null; geoJson: FeatureCollection | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedState && geoJson) {
      const feature = geoJson.features.find((f: Feature<Geometry, any>) => {
        const name = f.properties?.name || f.properties?.NAME_1 || '';
        return STATE_NAME_MAP[name] === selectedState || name === selectedState;
      });

      if (feature) {
        const layer = L.geoJSON(feature);
        const bounds = layer.getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      map.setView(INDIA_CENTER, INDIA_ZOOM);
    }
  }, [selectedState, geoJson, map]);

  return null;
}

export function InteractiveIndiaMap({ stateData, onStateSelect, selectedState }: InteractiveIndiaMapProps) {
  const [geoJson, setGeoJson] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load India GeoJSON
  useEffect(() => {
    const loadGeoJson = async () => {
      try {
        // Using Natural Earth Data for India states
        const response = await fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson');
        if (!response.ok) throw new Error('Failed to load map data');
        const data = await response.json();
        setGeoJson(data);
      } catch (err) {
        console.error('Failed to load GeoJSON:', err);
        setError('Failed to load map. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadGeoJson();
  }, []);

  // Create state data lookup
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateData>();
    stateData.forEach(s => {
      map.set(s.state, s);
      // Also map variations
      Object.entries(STATE_NAME_MAP).forEach(([geoName, ourName]) => {
        if (ourName === s.state) {
          map.set(geoName, s);
        }
      });
    });
    return map;
  }, [stateData]);

  // Style function for GeoJSON features
  const getFeatureStyle = (feature: Feature<Geometry, any> | undefined) => {
    if (!feature) return {};

    const stateName = feature.properties?.name || feature.properties?.NAME_1 || '';
    const mappedName = STATE_NAME_MAP[stateName] || stateName;
    const data = stateDataMap.get(stateName) || stateDataMap.get(mappedName);
    const isSelected = selectedState === mappedName;

    const fillColor = data ? getUptimeColor(data.uptime_percentage) : '#6b7280';
    const fillOpacity = isSelected ? 0.8 : 0.6;

    return {
      fillColor,
      fillOpacity,
      color: isSelected ? '#1e40af' : '#374151',
      weight: isSelected ? 3 : 1,
      opacity: 1,
    };
  };

  // Event handlers for GeoJSON features
  const onEachFeature = (feature: Feature<Geometry, any>, layer: L.Layer) => {
    const stateName = feature.properties?.name || feature.properties?.NAME_1 || '';
    const mappedName = STATE_NAME_MAP[stateName] || stateName;
    const data = stateDataMap.get(stateName) || stateDataMap.get(mappedName);

    // Popup content
    const popupContent = data
      ? `
        <div class="p-2 min-w-[180px]">
          <h3 class="font-semibold text-base mb-2">${mappedName}</h3>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Uptime:</span>
              <span class="font-medium" style="color: ${getUptimeColor(data.uptime_percentage)}">${data.uptime_percentage.toFixed(1)}%</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Portals:</span>
              <span class="font-medium">${data.total_targets}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Up:</span>
              <span class="font-medium text-green-600">${data.up_count}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Down:</span>
              <span class="font-medium text-red-600">${data.down_count}</span>
            </div>
            ${data.avg_latency_ms ? `
            <div class="flex justify-between">
              <span class="text-gray-600">Avg Latency:</span>
              <span class="font-medium">${Math.round(data.avg_latency_ms)}ms</span>
            </div>
            ` : ''}
          </div>
          <p class="text-xs text-gray-500 mt-2">Click to view details</p>
        </div>
      `
      : `
        <div class="p-2">
          <h3 class="font-semibold">${mappedName}</h3>
          <p class="text-sm text-gray-500">No data available</p>
        </div>
      `;

    layer.bindPopup(popupContent);

    // Event handlers
    (layer as any).on({
      click: () => {
        onStateSelect(mappedName);
      },
      mouseover: (e: any) => {
        const l = e.target;
        l.setStyle({
          fillOpacity: 0.9,
          weight: 2,
        });
        l.bringToFront();
      },
      mouseout: (e: any) => {
        const l = e.target;
        l.setStyle(getFeatureStyle(feature));
      },
    });
  };

  if (loading) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/20 rounded-lg">
        <div className="text-center text-destructive">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[500px] rounded-lg overflow-hidden border">
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        className="h-full w-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoJson && (
          <GeoJSON
            key={selectedState || 'default'}
            data={geoJson}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
        )}
        <MapBoundsHandler selectedState={selectedState} geoJson={geoJson} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 border shadow-lg z-[1000]" style={{ position: 'relative', marginTop: '-100px', marginRight: '10px', float: 'right' }}>
        <h4 className="text-xs font-semibold mb-2">Uptime Status</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></div>
            <span>99%+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#84cc16' }}></div>
            <span>95-99%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#eab308' }}></div>
            <span>90-95%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#f97316' }}></div>
            <span>80-90%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
            <span>&lt;80%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
