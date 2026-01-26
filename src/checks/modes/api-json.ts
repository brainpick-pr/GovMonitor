/**
 * API JSON check mode
 * Validates JSON response against expected path/value
 */

import type { Target, CheckResult } from '../../types';
import { getJsonValue } from '../../utils/json';

interface CheckOptions {
  timeout: number;
  userAgent: string;
}

export async function checkApiJson(target: Target, options: CheckOptions): Promise<CheckResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  const requestInit: RequestInit = {
    method: 'GET',
    headers: {
      'User-Agent': options.userAgent,
      'Accept': 'application/json',
    },
    signal: controller.signal,
    redirect: 'follow',
    cf: {
      cacheTtl: 0, // Bypass cache for health checks
    } as RequestInitCfProperties,
  };

  const response = await fetch(target.url, requestInit);
  clearTimeout(timeoutId);

  const latency = Date.now() - startTime;
  const responseBody = await response.text();

  // Validate status code
  const allowedCodes = target.allowed_status_codes
    ? JSON.parse(target.allowed_status_codes) as number[]
    : [target.expected_status];

  const statusOk = allowedCodes.includes(response.status);
  let validationOk = true;
  let validationDetails = '';

  if (statusOk) {
    try {
      const jsonData = JSON.parse(responseBody);

      if (target.json_path && target.expected_json_value) {
        const actualValue = getJsonValue(jsonData, target.json_path);
        validationOk = actualValue === target.expected_json_value;
        validationDetails = validationOk
          ? `JSON validation passed: ${target.json_path} = ${actualValue}`
          : `JSON validation failed: ${target.json_path} = ${actualValue}, expected ${target.expected_json_value}`;
      }
    } catch (parseError) {
      validationOk = false;
      validationDetails = `Invalid JSON response: ${(parseError as Error).message}`;
    }
  }

  return {
    ok: statusOk && validationOk,
    status: response.status,
    latency_ms: latency,
    validation_details: validationDetails || undefined,
  };
}
