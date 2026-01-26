/**
 * POST /api/check handler
 * Manual check trigger
 */

import type { Env, Target } from '../types';

export async function handleManualCheck(
  request: Request,
  env: Env,
  headers: Record<string, string>
): Promise<Response> {
  const body = await request.json() as { targetId: number };

  if (!body.targetId) {
    return new Response(
      JSON.stringify({ error: 'targetId is required' }),
      { status: 400, headers }
    );
  }

  const target = await env.DB.prepare('SELECT * FROM targets WHERE id = ?')
    .bind(body.targetId)
    .first<Target>();

  if (!target) {
    return new Response(
      JSON.stringify({ error: 'Target not found' }),
      { status: 404, headers }
    );
  }

  // Import checkTarget dynamically to avoid circular dependencies
  const { checkTarget } = await import('../checks/checker');
  const result = await checkTarget(target, env);

  return new Response(JSON.stringify(result), { headers });
}
