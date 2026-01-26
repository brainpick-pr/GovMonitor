/**
 * Website check mode
 * Simple HTTP status code validation
 */

import type { Target, CheckResult } from '../../types';

interface CheckOptions {
  timeout: number;
  userAgent: string;
}

export async function checkWebsite(target: Target, options: CheckOptions): Promise<CheckResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  const requestInit: RequestInit = {
    method: 'HEAD',
    headers: { 'User-Agent': options.userAgent },
    signal: controller.signal,
    redirect: 'follow',
    cf: {
      cacheTtl: 0, // Bypass cache for health checks
    } as RequestInitCfProperties,
  };

  let response: Response;

  try {
    response = await fetch(target.url, requestInit);
    clearTimeout(timeoutId);
  } catch (fetchError) {
    clearTimeout(timeoutId);

    // Fallback to GET if HEAD not supported
    if ((fetchError as Error).message.includes('405')) {
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), options.timeout);

      response = await fetch(target.url, {
        ...requestInit,
        method: 'GET',
        signal: getController.signal,
      });

      clearTimeout(getTimeoutId);
    } else {
      throw fetchError;
    }
  }

  const latency = Date.now() - startTime;

  // Validate status code
  const allowedCodes = target.allowed_status_codes
    ? JSON.parse(target.allowed_status_codes) as number[]
    : [target.expected_status];

  const statusOk = allowedCodes.includes(response.status);

  return {
    ok: statusOk,
    status: response.status,
    latency_ms: latency,
  };
}
