/**
 * Constants for GovMonitor.Org
 */

import type { CheckMode } from './types';

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export const VALID_STATES = new Set(INDIAN_STATES.map(state => state.toLowerCase()));

// Validation constants
export const VALIDATION = {
  MAX_NAME_LENGTH: 100,
  MAX_URL_LENGTH: 2048,
  MIN_INTERVAL: 5,
  MAX_INTERVAL: 1440, // 24 hours in minutes
  BATCH_SIZE: 25,
  CACHE_TTL: 60,
  FETCH_TIMEOUT: 5000,
  VALID_CHECK_MODES: new Set<CheckMode>(['website', 'api-json', 'api-text']),
} as const;

// Time window mappings (in seconds)
export const TIME_WINDOWS = {
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
  '365d': 31536000,
} as const;

// Valid view names for SQL injection protection
export const VALID_VIEWS = {
  '24h': 'state_uptime_24h',
  '7d': 'state_uptime_7d',
  '30d': 'state_uptime_30d',
  '365d': 'state_uptime_365d',
} as const;
