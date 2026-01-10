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

      // Test endpoint
      if (path === '/api/test-pdf' && request.method === 'POST') {
        const { to } = await request.json();
        return await sendTestPDFComplete(to, env, corsHeaders);
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

      if (path === '/api/send-report' && request.method === 'POST') {
        return await sendReport(request, env, corsHeaders);
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

// ========== SEND REPORT BY EMAIL ==========

async function sendReport(request, env, corsHeaders) {
  const { to, subject, filename, pdfBase64 } = await request.json();

  if (!to || !to.includes('@')) {
    return jsonResponse({ error: 'Email destinataire invalide' }, 400, corsHeaders);
  }

  if (!pdfBase64) {
    return jsonResponse({ error: 'PDF manquant' }, 400, corsHeaders);
  }

  const emailBody = {
    from: 'VGP Inspect <vgp@neteco.pro>',
    to: to,
    subject: subject || 'Rapport VGP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1e3a5f; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px;">Rapport VGP</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint le rapport de Vérification Générale Périodique.</p>
          <p>Cordialement,<br>VGP Inspect</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">
          Conformément à l'arrêté du 1er mars 2004 - Document à conserver 5 ans minimum
        </p>
      </div>
    `,
    attachments: [
      {
        filename: filename || 'rapport-vgp.pdf',
        content: pdfBase64
      }
    ]
  };

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailBody)
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return jsonResponse({ error: 'Erreur envoi email' }, 500, corsHeaders);
  }

  return jsonResponse({ success: true, message: 'Email envoyé avec PDF' }, 200, corsHeaders);
}

// Test: Send complete report HTML (same as app PDF)
async function sendTestPDFComplete(to, env, corsHeaders) {
  if (!to || !to.includes('@')) {
    return jsonResponse({ error: 'Email invalide' }, 400, corsHeaders);
  }

  const today = new Date().toLocaleDateString('fr-FR');
  const now = new Date().toLocaleString('fr-FR');
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const nextVGP = nextYear.toLocaleDateString('fr-FR');

  // Complete HTML template (same as generateReportHTMLForPDF in app.js)
  const reportHTML = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #1a1a1a; background: white; padding: 20px; max-width: 800px; margin: 0 auto;">
      <!-- Header -->
      <div style="border: 2px solid #1e3a5f; margin-bottom: 15px;">
        <div style="display: flex; border-bottom: 1px solid #e2e8f0;">
          <div style="flex: 1; padding: 12px 15px; border-right: 1px solid #e2e8f0;">
            <div style="font-size: 18px; font-weight: 700; color: #1e3a5f;">FLEETZEN</div>
            <div style="font-size: 11px; color: #4a5568; margin-top: 5px;">Organisme de contrôle technique<br>Vérifications réglementaires des équipements de travail</div>
          </div>
          <div style="width: 160px; padding: 12px 15px; background: #f8fafc;">
            <div style="font-size: 14px; font-weight: 700; color: #1e3a5f;">N° VGP-2026-TEST</div>
            <div style="font-size: 10px; color: #718096; margin-top: 3px;">Généré le ${now}</div>
          </div>
        </div>
        <div style="text-align: center; padding: 15px; background: #1e3a5f; color: white;">
          <div style="font-size: 16px; font-weight: 700; letter-spacing: 1px;">RAPPORT DE VÉRIFICATION GÉNÉRALE PÉRIODIQUE</div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Appareil de levage − Hayon Rabattable</div>
        </div>
        <div style="padding: 8px 15px; background: #f1f5f9; font-size: 10px; color: #64748b; text-align: center;">
          Conformément à l'Arrêté du 1er mars 2004 − Articles R.4323-23 à R.4323-27 du Code du Travail
        </div>
      </div>

      <!-- Info Grid -->
      <div style="display: flex; gap: 15px; margin-bottom: 15px;">
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 700; color: white; background: #1e3a5f; padding: 8px 12px;">IDENTIFICATION DE L'APPAREIL</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600; width: 40%;">Type</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;">Hayon Rabattable</td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Marque</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;">DHOLLANDIA</td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">N° série</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;"><strong>DH-2024-12345</strong></td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Immatriculation</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;">AB-123-CD</td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Marquage CE</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;">OUI</td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">CMU</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;"><strong>1500 kg</strong></td></tr>
          </table>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 700; color: white; background: #1e3a5f; padding: 8px 12px;">INTERVENTION</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600; width: 40%;">Client</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;"><strong>Société Test SARL</strong></td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Date inspection</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;"><strong>${today}</strong></td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Inspecteur</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;">Jean Dupont</td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Charge d'essai</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;">1650 kg</td></tr>
            <tr><td style="padding: 6px 10px; border: 1px solid #d1d5db; background: #f3f4f6; font-weight: 600;">Prochaine VGP</td><td style="padding: 6px 10px; border: 1px solid #d1d5db;"><strong>${nextVGP}</strong></td></tr>
          </table>
        </div>
      </div>

      <!-- Charges -->
      <div style="background: #eff6ff; border: 1px solid #93c5fd; padding: 12px; margin-bottom: 15px;">
        <div style="font-size: 12px; font-weight: 700; color: #1e40af; margin-bottom: 8px; text-align: center;">CHARGES D'ÉPREUVE RÉGLEMENTAIRES (Appareil CE)</div>
        <div style="display: flex; gap: 10px;">
          <div style="flex: 1; background: white; border: 1px solid #bfdbfe; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #64748b;">CMU Nominale</div>
            <div style="font-size: 16px; font-weight: 700; color: #1e40af;">1500 kg</div>
          </div>
          <div style="flex: 1; background: white; border: 1px solid #bfdbfe; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #64748b;">Épreuve Dynamique</div>
            <div style="font-size: 16px; font-weight: 700; color: #1e40af;">1650 kg</div>
            <div style="font-size: 9px; color: #94a3b8;">CMU × 1.1</div>
          </div>
          <div style="flex: 1; background: white; border: 1px solid #bfdbfe; padding: 10px; text-align: center;">
            <div style="font-size: 10px; color: #64748b;">Épreuve Statique</div>
            <div style="font-size: 16px; font-weight: 700; color: #1e40af;">1875 kg</div>
            <div style="font-size: 9px; color: #94a3b8;">CMU × 1.25</div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div style="display: flex; gap: 20px; font-size: 10px; color: #374151; margin: 10px 0; padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; justify-content: center;">
        <span><span style="color: #1a5c38; font-weight: 700; font-size: 14px;">✔</span> Conforme</span>
        <span><span style="color: #d97706; font-weight: 700; font-size: 14px;">⚠</span> NC (réserve)</span>
        <span><span style="color: #8b1a1a; font-weight: 700; font-size: 14px;">✘</span> NC (arrêt)</span>
        <span><span style="color: #000; font-weight: 700; font-size: 14px;">—</span> N/A</span>
      </div>

      <!-- Section 1: Docs -->
      <div style="margin-bottom: 10px;">
        <div style="background: #1e3a5f; color: white; padding: 8px 12px; font-size: 11px; font-weight: 600;">1. EXAMEN D'ADÉQUATION ET DOCUMENTAIRE <span style="float: right; opacity: 0.8; font-weight: 400;">Art. 5</span></div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr style="background: #e5e7eb;"><th style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;">Point de contrôle</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 60px; text-align: center;">Résultat</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 25%;">Observations</th></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Plaque signalétique lisible et complète</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">CMU / Abaque de charges présent</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Consignes de sécurité affichées</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Certificat de conformité CE</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Notice d'utilisation présente</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #d97706; font-weight: 700; font-size: 16px;">⚠</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; font-style: italic; color: #6b7280;">À fournir</td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Carnet de maintenance à jour</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
        </table>
      </div>

      <!-- Section 2: Visuel (abbreviated) -->
      <div style="margin-bottom: 10px;">
        <div style="background: #1e3a5f; color: white; padding: 8px 12px; font-size: 11px; font-weight: 600;">2. EXAMEN DE L'ÉTAT DE CONSERVATION <span style="float: right; opacity: 0.8; font-weight: 400;">Art. 9</span></div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr style="background: #e5e7eb;"><th style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;">Point de contrôle</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 60px; text-align: center;">Résultat</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 25%;">Observations</th></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Fixation châssis</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">État général structure</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Flexibles hydrauliques</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Vérins hydrauliques</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Commande bi-manuelle</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Arrêt d'urgence</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
        </table>
      </div>

      <!-- Section 3: Sécurité -->
      <div style="margin-bottom: 10px;">
        <div style="background: #1e3a5f; color: white; padding: 8px 12px; font-size: 11px; font-weight: 600;">3. DISPOSITIFS DE SÉCURITÉ <span style="float: right; opacity: 0.8; font-weight: 400;">Art. 9</span></div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr style="background: #e5e7eb;"><th style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;">Point de contrôle</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 60px; text-align: center;">Résultat</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 25%;">Observations</th></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Limiteur de charge</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Limiteur de débit</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Freinage vertical</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Bandes réfléchissantes</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
        </table>
      </div>

      <!-- Section 4: Essais -->
      <div style="margin-bottom: 10px;">
        <div style="background: #1e3a5f; color: white; padding: 8px 12px; font-size: 11px; font-weight: 600;">4. ESSAIS DE FONCTIONNEMENT ET ÉPREUVES <span style="float: right; opacity: 0.8; font-weight: 400;">Art. 10-11</span></div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <tr style="background: #e5e7eb;"><th style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: left;">Point de contrôle</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 60px; text-align: center;">Résultat</th><th style="padding: 5px 8px; border: 1px solid #d1d5db; width: 25%;">Observations</th></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Essai des mouvements</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Épreuve dynamique − 1650 kg</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Épreuve statique 1h − 1875 kg</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
          <tr style="background: #fafafa;"><td style="padding: 5px 8px; border: 1px solid #d1d5db;">Maintien de charge 10 min</td><td style="padding: 5px 8px; border: 1px solid #d1d5db; text-align: center; color: #1a5c38; font-weight: 700; font-size: 16px;">✔</td><td style="padding: 5px 8px; border: 1px solid #d1d5db;"></td></tr>
        </table>
      </div>

      <!-- Conclusion -->
      <div style="border: 2px solid #1e3a5f; margin-top: 15px;">
        <div style="background: #1e3a5f; color: white; padding: 10px 15px; font-size: 13px; font-weight: 700;">CONCLUSION DE LA VÉRIFICATION</div>
        <div style="padding: 15px;">
          <div style="text-align: center; padding: 15px; margin-bottom: 15px; font-size: 16px; font-weight: 700; border-radius: 6px; border: 3px solid #8b6914; color: #8b6914; background: #fffbeb;">
            APPAREIL CONFORME SOUS RÉSERVE
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px; margin-bottom: 15px;">
            <div style="font-weight: 700; color: #991b1b; margin-bottom: 5px;">Non-conformités relevées : 1</div>
            <div style="font-size: 11px;">• Documentation : Notice d'utilisation à fournir</div>
          </div>
          <div style="display: flex; gap: 15px;">
            <div style="flex: 1;">
              <div style="font-weight: 700; color: #374151; margin-bottom: 5px;">Observations :</div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; min-height: 50px;">Bon état général. Notice d'utilisation à fournir au propriétaire.</div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; color: #374151; margin-bottom: 5px;">Actions correctives :</div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; min-height: 50px;">Levée des réserves obligatoire dans un délai raisonnable.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: flex; gap: 20px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #d1d5db;">
        <div style="flex: 1;">
          <div style="font-weight: 700; color: #374151; margin-bottom: 5px;">Inspecteur</div>
          <div style="font-size: 10px; color: #6b7280;">Jean Dupont<br>Le ${today}</div>
          <div style="border-bottom: 1px solid #1a1a1a; height: 40px; margin-top: 10px;"></div>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 700; color: #374151; margin-bottom: 5px;">Client / Représentant</div>
          <div style="font-size: 10px; color: #6b7280;">Société Test SARL<br>Lu et approuvé, le</div>
          <div style="border-bottom: 1px solid #1a1a1a; height: 40px; margin-top: 10px;"></div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #1e3a5f; font-size: 10px; color: #6b7280; display: flex; justify-content: space-between;">
        <div>
          Ce rapport est établi conformément à l'arrêté du 1er mars 2004.<br>
          Document à conserver pendant 5 ans minimum (Art. R.4323-25 du Code du Travail).
        </div>
        <div style="text-align: right;">
          <strong>Réf: VGP-2026-TEST</strong><br>
          ${now}
        </div>
      </div>
    </div>
  `;

  // Send email with HTML report
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'VGP Inspect <vgp@neteco.pro>',
      to: to,
      subject: 'Rapport VGP Complet - Société Test SARL - AB-123-CD',
      html: reportHTML
    })
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error('Resend error:', err);
    return jsonResponse({ error: err }, 500, corsHeaders);
  }

  return jsonResponse({ success: true, message: 'Email envoyé avec rapport complet !' }, 200, corsHeaders);
}
