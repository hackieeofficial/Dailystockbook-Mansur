import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { JWT } from 'npm:google-auth-library';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { token, tokens, title, body, data } = await req.json();
    
    const targetTokens: string[] = tokens || (token ? [token] : []);
    
    if (targetTokens.length === 0) {
      return new Response(JSON.stringify({ error: 'No tokens provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT secret.');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const accessTokenObj = await jwtClient.getAccessToken();
    const accessToken = accessTokenObj.token;

    if (!accessToken) {
      throw new Error('Failed to get access token from Google');
    }

    const projectId = serviceAccount.project_id;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // FCM data values must all be strings
    const stringifiedData: Record<string, string> = {};
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        stringifiedData[k] = String(v);
      }
    }

    const results = await Promise.all(
      targetTokens.map(async (t: string) => {
        const fcmPayload = {
          message: {
            token: t,
            notification: {
              title: title,
              body: body,
            },
            ...(Object.keys(stringifiedData).length > 0 ? { data: stringifiedData } : {}),
          },
        };

        const response = await fetch(fcmEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        });
        const result = await response.json();
        return { ok: response.ok, result, token: t.slice(-6) }; // log only last 6 chars for privacy
      })
    );

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      console.error(`FCM: ${failed.length}/${results.length} messages failed:`, failed.map(f => f.result));
    }

    const hasPartialFailure = failed.length > 0 && failed.length < results.length;
    const hasAllFailure = failed.length === results.length;

    if (hasAllFailure) {
      return new Response(JSON.stringify({ error: 'All messages failed', details: results.map(r => r.result) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      sent: results.length - failed.length,
      failed: failed.length,
      hasPartialFailure,
      details: results.map(r => r.result),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('send_fcm fatal error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
