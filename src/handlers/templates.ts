/**
 * Health Check Templates Handlers
 * Reusable configuration templates for common service patterns
 */

import { CheckTemplate, CreateTemplatePayload, ApplyTemplatePayload, TargetTemplateMapping } from '../types';

/**
 * List all templates
 */
export async function listTemplates(
  db: D1Database,
  category?: string
): Promise<Response> {
  try {
    let query = 'SELECT * FROM check_templates WHERE 1=1';
    const bindings: any[] = [];

    if (category) {
      query += ' AND category = ?';
      bindings.push(category);
    }

    query += ' ORDER BY is_system_template DESC, usage_count DESC, name ASC';

    const results = await db.prepare(query).bind(...bindings).all<CheckTemplate>();

    return new Response(JSON.stringify(results.results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to list templates' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplate(
  id: number,
  db: D1Database
): Promise<Response> {
  try {
    const template = await db
      .prepare('SELECT * FROM check_templates WHERE id = ?')
      .bind(id)
      .first<CheckTemplate>();

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(template), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Create a new template (user templates only)
 */
export async function createTemplate(
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    const payload = await request.json() as CreateTemplatePayload;

    // Validation
    if (!payload.name || !payload.check_mode) {
      return new Response(
        JSON.stringify({ error: 'name and check_mode are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate name
    const existing = await db
      .prepare('SELECT id FROM check_templates WHERE name = ?')
      .bind(payload.name)
      .first();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Template with this name already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const result = await db
      .prepare(`
        INSERT INTO check_templates (
          name, description, category, check_mode, expected_status,
          allowed_status_codes, json_path, expected_json_value, text_match,
          default_interval_min, is_system_template, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `)
      .bind(
        payload.name,
        payload.description || null,
        payload.category || 'custom',
        payload.check_mode,
        payload.expected_status || 200,
        payload.allowed_status_codes ? JSON.stringify(payload.allowed_status_codes) : null,
        payload.json_path || null,
        payload.expected_json_value || null,
        payload.text_match || null,
        payload.default_interval_min || 15,
        now,
        now
      )
      .run();

    const templateId = result.meta.last_row_id;

    return new Response(
      JSON.stringify({
        id: templateId,
        message: 'Template created successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Update a template (user templates only, not system templates)
 */
export async function updateTemplate(
  id: number,
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    // Check if template exists and is not a system template
    const template = await db
      .prepare('SELECT is_system_template FROM check_templates WHERE id = ?')
      .bind(id)
      .first<{ is_system_template: number }>();

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (template.is_system_template) {
      return new Response(
        JSON.stringify({ error: 'Cannot modify system templates' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = await request.json() as Partial<CreateTemplatePayload>;
    const now = Math.floor(Date.now() / 1000);

    const setClauses: string[] = [];
    const bindings: any[] = [];

    if (payload.name !== undefined) {
      setClauses.push('name = ?');
      bindings.push(payload.name);
    }

    if (payload.description !== undefined) {
      setClauses.push('description = ?');
      bindings.push(payload.description);
    }

    if (payload.category !== undefined) {
      setClauses.push('category = ?');
      bindings.push(payload.category);
    }

    if (payload.check_mode !== undefined) {
      setClauses.push('check_mode = ?');
      bindings.push(payload.check_mode);
    }

    if (payload.expected_status !== undefined) {
      setClauses.push('expected_status = ?');
      bindings.push(payload.expected_status);
    }

    if (payload.allowed_status_codes !== undefined) {
      setClauses.push('allowed_status_codes = ?');
      bindings.push(JSON.stringify(payload.allowed_status_codes));
    }

    if (payload.json_path !== undefined) {
      setClauses.push('json_path = ?');
      bindings.push(payload.json_path);
    }

    if (payload.expected_json_value !== undefined) {
      setClauses.push('expected_json_value = ?');
      bindings.push(payload.expected_json_value);
    }

    if (payload.text_match !== undefined) {
      setClauses.push('text_match = ?');
      bindings.push(payload.text_match);
    }

    if (payload.default_interval_min !== undefined) {
      setClauses.push('default_interval_min = ?');
      bindings.push(payload.default_interval_min);
    }

    if (setClauses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No updates specified' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    setClauses.push('updated_at = ?');
    bindings.push(now);
    bindings.push(id);

    await db
      .prepare(`UPDATE check_templates SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();

    return new Response(
      JSON.stringify({ message: 'Template updated successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Delete a template (user templates only, not system templates)
 */
export async function deleteTemplate(
  id: number,
  db: D1Database
): Promise<Response> {
  try {
    // Check if template exists and is not a system template
    const template = await db
      .prepare('SELECT is_system_template FROM check_templates WHERE id = ?')
      .bind(id)
      .first<{ is_system_template: number }>();

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (template.is_system_template) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete system templates' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await db
      .prepare('DELETE FROM check_templates WHERE id = ?')
      .bind(id)
      .run();

    return new Response(
      JSON.stringify({ message: 'Template deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Apply a template to a target
 */
export async function applyTemplateToTarget(
  targetId: number,
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    const payload = await request.json() as ApplyTemplatePayload;

    // Get template
    const template = await db
      .prepare('SELECT * FROM check_templates WHERE id = ?')
      .bind(payload.template_id)
      .first<CheckTemplate>();

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if target exists
    const target = await db
      .prepare('SELECT id FROM targets WHERE id = ?')
      .bind(targetId)
      .first();

    if (!target) {
      return new Response(
        JSON.stringify({ error: 'Target not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update target with template configuration
    await db
      .prepare(`
        UPDATE targets SET
          check_mode = ?,
          expected_status = ?,
          allowed_status_codes = ?,
          json_path = ?,
          expected_json_value = ?,
          text_match = ?,
          interval_min = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        template.check_mode,
        template.expected_status,
        template.allowed_status_codes,
        template.json_path,
        template.expected_json_value,
        template.text_match,
        template.default_interval_min,
        now,
        targetId
      )
      .run();

    // Record template mapping
    await db
      .prepare(`
        INSERT INTO target_template_mappings (target_id, template_id, applied_at)
        VALUES (?, ?, ?)
      `)
      .bind(targetId, payload.template_id, now)
      .run();

    // Increment template usage count
    await db
      .prepare('UPDATE check_templates SET usage_count = usage_count + 1 WHERE id = ?')
      .bind(payload.template_id)
      .run();

    return new Response(
      JSON.stringify({
        message: 'Template applied successfully',
        template_name: template.name,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to apply template' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get template application history for a target
 */
export async function getTargetTemplateHistory(
  targetId: number,
  db: D1Database
): Promise<Response> {
  try {
    const results = await db
      .prepare(`
        SELECT
          ttm.id,
          ttm.template_id,
          ttm.applied_at,
          ct.name as template_name,
          ct.category,
          ct.is_system_template
        FROM target_template_mappings ttm
        JOIN check_templates ct ON ct.id = ttm.template_id
        WHERE ttm.target_id = ?
        ORDER BY ttm.applied_at DESC
      `)
      .bind(targetId)
      .all();

    return new Response(JSON.stringify(results.results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get template history' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
