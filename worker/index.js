/**
 * VGP Inspect - Cloudflare Worker API
 * Auth via Magic Link email
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Public routes (no auth)
      if (path === '/api/auth/request-link' && request.method === 'POST') {
        return await requestMagicLink(request, env, corsHeaders);
      }

      if (path === '/api/auth/verify' && request.method === 'GET') {
        return await verifyMagicLink(url, env, corsHeaders);
      }

      if (path === '/api/ping') {
        return jsonResponse({ ok: true }, 200, corsHeaders);
      }

      // Protected routes - require session token
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Non authentifié' }, 401, corsHeaders);
      }

      const sessionToken = authHeader.slice(7);
      const session = await env.VGP_DATA.get(`session:${sessionToken}`, 'json');

      if (!session) {
        return jsonResponse({ error: 'Session expirée' }, 401, corsHeaders);
      }

      const userNs = session.userId;

      // API routes
      if (path === '/api/inspections' && request.method === 'GET') {
        return await listInspections(env, userNs, corsHeaders);
      }

      if (path === '/api/inspections' && request.method === 'POST') {
        return await saveInspection(request, env, userNs, corsHeaders);
      }

      if (path.startsWith('/api/inspections/') && request.method === 'GET') {
        const id = path.split('/')[3];
        return await getInspection(env, userNs, id, corsHeaders);
      }

      if (path.startsWith('/api/inspections/') && request.method === 'DELETE') {
        const id = path.split('/')[3];
        return await deleteInspection(env, userNs, id, corsHeaders);
      }

      if (path === '/api/sync' && request.method === 'POST') {
        return await syncData(request, env, userNs, corsHeaders);
      }

      if (path === '/api/me') {
        return jsonResponse({ email: session.email }, 200, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);

    } catch (err) {
      console.error(err);
      return jsonResponse({ error: err.message }, 500, corsHeaders);
    }
  }
};

// ========== AUTH ==========

async function requestMagicLink(request, env, corsHeaders) {
  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return jsonResponse({ error: 'Email invalide' }, 400, corsHeaders);
  }

  // Generate magic token
  const token = crypto.randomUUID() + crypto.randomUUID();
  const userId = await hashEmail(email);

  // Store token (expires in 15 min)
  await env.VGP_DATA.put(`magic:${token}`, JSON.stringify({
    email,
    userId,
    createdAt: Date.now()
  }), { expirationTtl: 900 });

  // Send email via Resend
  const magicLink = `https://vgp-api.hzukic.workers.dev/api/auth/verify?token=${token}`;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'VGP Inspect <vgp@neteco.pro>',
      to: email,
      subject: 'Connexion à VGP Inspect',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #0f766e; font-size: 24px; margin-bottom: 20px;">VGP Inspect</h1>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Cliquez sur le bouton ci-dessous pour vous connecter :</p>
          <a href="${magicLink}" style="display: inline-block; background: #0f766e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0;">Se connecter</a>
          <p style="color: #6b7280; font-size: 14px;">Ce lien expire dans 15 minutes.</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 40px;">Si vous n'avez pas demandé ce lien, ignorez cet email.</p>
        </div>
      `
    })
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return jsonResponse({ error: 'Erreur envoi email' }, 500, corsHeaders);
  }

  return jsonResponse({ success: true, message: 'Email envoyé' }, 200, corsHeaders);
}

async function verifyMagicLink(url, env, corsHeaders) {
  const token = url.searchParams.get('token');

  if (!token) {
    return htmlResponse('Lien invalide', false);
  }

  const data = await env.VGP_DATA.get(`magic:${token}`, 'json');

  if (!data) {
    return htmlResponse('Lien expiré ou déjà utilisé', false);
  }

  // Delete magic token (one-time use)
  await env.VGP_DATA.delete(`magic:${token}`);

  // Create session (30 days)
  const sessionToken = crypto.randomUUID() + crypto.randomUUID();
  await env.VGP_DATA.put(`session:${sessionToken}`, JSON.stringify({
    email: data.email,
    userId: data.userId,
    createdAt: Date.now()
  }), { expirationTtl: 60 * 60 * 24 * 30 });

  // Redirect to app with token in URL (localStorage doesn't work cross-domain)
  const appUrl = `https://vgp-chi.vercel.app?auth_token=${sessionToken}&auth_email=${encodeURIComponent(data.email)}`;
  return new Response(null, {
    status: 302,
    headers: { 'Location': appUrl }
  });
}

function htmlResponse(content, success) {
  const color = success ? '#0f766e' : '#dc2626';
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VGP Inspect</title>
      <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        h1 { color: ${color}; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>VGP Inspect</h1>
        ${content}
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// ========== HELPERS ==========

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ========== INSPECTIONS ==========

async function listInspections(env, userNs, corsHeaders) {
  const listKey = `${userNs}:list`;
  const list = await env.VGP_DATA.get(listKey, 'json') || [];
  return jsonResponse({ inspections: list }, 200, corsHeaders);
}

async function getInspection(env, userNs, id, corsHeaders) {
  const key = `${userNs}:inspection:${id}`;
  const data = await env.VGP_DATA.get(key, 'json');
  if (!data) {
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }
  return jsonResponse(data, 200, corsHeaders);
}

async function saveInspection(request, env, userNs, corsHeaders) {
  const data = await request.json();

  if (!data.id) {
    data.id = crypto.randomUUID();
  }

  data.updatedAt = new Date().toISOString();

  const key = `${userNs}:inspection:${data.id}`;
  await env.VGP_DATA.put(key, JSON.stringify(data));

  const listKey = `${userNs}:list`;
  const list = await env.VGP_DATA.get(listKey, 'json') || [];

  const existing = list.findIndex(i => i.id === data.id);
  const listItem = {
    id: data.id,
    client: data.client,
    immat: data.immat,
    dateInspection: data.dateInspection,
    avis: data.avis,
    updatedAt: data.updatedAt
  };

  if (existing >= 0) {
    list[existing] = listItem;
  } else {
    list.unshift(listItem);
  }

  await env.VGP_DATA.put(listKey, JSON.stringify(list));

  return jsonResponse({ success: true, id: data.id }, 200, corsHeaders);
}

async function deleteInspection(env, userNs, id, corsHeaders) {
  const key = `${userNs}:inspection:${id}`;
  await env.VGP_DATA.delete(key);

  const listKey = `${userNs}:list`;
  const list = await env.VGP_DATA.get(listKey, 'json') || [];
  const newList = list.filter(i => i.id !== id);
  await env.VGP_DATA.put(listKey, JSON.stringify(newList));

  return jsonResponse({ success: true }, 200, corsHeaders);
}

async function syncData(request, env, userNs, corsHeaders) {
  const { lastSync, localData } = await request.json();

  const listKey = `${userNs}:list`;
  const serverList = await env.VGP_DATA.get(listKey, 'json') || [];

  const result = { toUpload: [], toDownload: [] };
  const lastSyncDate = lastSync ? new Date(lastSync) : new Date(0);

  for (const local of localData || []) {
    const server = serverList.find(s => s.id === local.id);
    if (!server) {
      result.toUpload.push(local.id);
    } else {
      const localDate = new Date(local.updatedAt || 0);
      const serverDate = new Date(server.updatedAt || 0);
      if (localDate > serverDate) {
        result.toUpload.push(local.id);
      } else if (serverDate > localDate) {
        result.toDownload.push(server.id);
      }
    }
  }

  for (const server of serverList) {
    const local = (localData || []).find(l => l.id === server.id);
    if (!local && new Date(server.updatedAt || 0) > lastSyncDate) {
      result.toDownload.push(server.id);
    }
  }

  return jsonResponse(result, 200, corsHeaders);
}
