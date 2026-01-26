/**
 * Validation utilities
 */

import { VALID_STATES } from '../constants';

/**
 * Check if hostname is a valid government domain
 * @param hostname - The hostname to validate
 * @returns true if government domain, false otherwise
 */
export function isGovernmentDomain(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return (
    lower.endsWith('.gov') ||
    lower.endsWith('.gov.in') ||
    lower.endsWith('.gov.uk') ||
    lower.endsWith('.gov.au') ||
    lower.endsWith('.gc.ca') ||
    lower.includes('.government.')
  );
}

/**
 * Check if state name is valid
 * @param state - The state name to validate
 * @returns true if valid Indian state/UT, false otherwise
 */
export function isValidState(state: string): boolean {
  return VALID_STATES.has(state.toLowerCase());
}

/**
 * Validate URL format
 * @param url - The URL string to validate
 * @returns Parsed URL object if valid, null otherwise
 */
export function validateUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
