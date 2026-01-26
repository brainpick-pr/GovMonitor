/**
 * API Text check mode
 * Searches for substring in response body
 */

import type { Target, CheckResult } from '../../types';

interface CheckOptions {
  timeout: number;
  userAgent: string;
}

export async function checkApiText(target: Target, options: CheckOptions): Promise<CheckResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  const requestInit: RequestInit = {
    method: 'GET',
    headers: { 'User-Agent': options.userAgent },
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

  if (statusOk && target.text_match) {
    validationOk = responseBody.includes(target.text_match);
    validationDetails = validationOk
      ? `Text match found: "${target.text_match}"`
      : `Text match failed: "${target.text_match}" not found`;
  }

  return {
    ok: statusOk && validationOk,
    status: response.status,
    latency_ms: latency,
    validation_details: validationDetails || undefined,
  };
}
