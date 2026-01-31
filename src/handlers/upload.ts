/**
 * File Upload Handlers
 * Handle screenshot uploads to R2 storage
 */

import type { Env, User } from '../types';
import { requireUser, logUserActivity, getClientIP } from './oauth';

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Generate a unique filename for uploaded file
 */
function generateFilename(originalFilename: string, userId: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalFilename.split('.').pop() || 'png';
  return `screenshots/${userId}/${timestamp}-${random}.${extension}`;
}

/**
 * POST /api/upload/screenshot - Upload a screenshot for an issue
 */
export async function handleUploadScreenshot(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Check if R2 bucket is configured
    if (!env.SCREENSHOTS) {
      return new Response(
        JSON.stringify({ error: 'File storage not configured' }),
        { status: 503, headers: corsHeaders }
      );
    }

    // Require authenticated user
    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    // Parse multipart form data
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const issueId = formData.get('issue_id') as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file type. Allowed types: PNG, JPEG, WebP, GIF',
          allowed_types: ALLOWED_MIME_TYPES
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: 'File too large. Maximum size: 5MB',
          max_size_bytes: MAX_FILE_SIZE
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Generate filename and upload to R2
    const filename = generateFilename(file.name, user.id);
    const fileBuffer = await file.arrayBuffer();

    await env.SCREENSHOTS.put(filename, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        uploadedBy: user.id.toString(),
        originalFilename: file.name,
        issueId: issueId || '',
      },
    });

    // Construct public URL (assuming R2 public access is enabled or using Workers route)
    const publicUrl = `/api/screenshots/${filename}`;

    // If issue_id provided, add to issue_screenshots table
    if (issueId) {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `INSERT INTO issue_screenshots (issue_id, url, filename, size_bytes, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(parseInt(issueId, 10), publicUrl, filename, file.size, file.type, now).run();
    }

    // Log activity
    const ipAddress = getClientIP(request);
    await logUserActivity(env, user.id, ipAddress, 'submission', 'screenshot', undefined, {
      filename,
      size: file.size,
      issue_id: issueId
    });

    return new Response(
      JSON.stringify({
        message: 'Screenshot uploaded successfully',
        url: publicUrl,
        filename,
        size: file.size,
        type: file.type
      }),
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to upload screenshot', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/screenshots/:filename - Serve screenshot from R2
 */
export async function handleGetScreenshot(
  filename: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!env.SCREENSHOTS) {
      return new Response(
        JSON.stringify({ error: 'File storage not configured' }),
        { status: 503, headers: corsHeaders }
      );
    }

    const object = await env.SCREENSHOTS.get(filename);

    if (!object) {
      return new Response(
        JSON.stringify({ error: 'Screenshot not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
    headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve screenshot', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/screenshots/:filename - Delete screenshot (moderator or owner only)
 */
export async function handleDeleteScreenshot(
  filename: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!env.SCREENSHOTS) {
      return new Response(
        JSON.stringify({ error: 'File storage not configured' }),
        { status: 503, headers: corsHeaders }
      );
    }

    const userResult = await requireUser(request, env, corsHeaders);
    if (userResult instanceof Response) return userResult;
    const user = userResult as User;

    // Get object metadata to check ownership
    const object = await env.SCREENSHOTS.head(filename);

    if (!object) {
      return new Response(
        JSON.stringify({ error: 'Screenshot not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if user is owner or moderator
    const uploadedBy = object.customMetadata?.uploadedBy;
    const isOwner = uploadedBy === user.id.toString();
    const isModerator = user.role === 'moderator' || user.role === 'admin';

    if (!isOwner && !isModerator) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to delete this screenshot' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Delete from R2
    await env.SCREENSHOTS.delete(filename);

    // Delete from database if exists
    await env.DB.prepare('DELETE FROM issue_screenshots WHERE filename = ?').bind(filename).run();

    return new Response(
      JSON.stringify({ message: 'Screenshot deleted' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error deleting screenshot:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete screenshot', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
