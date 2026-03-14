import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const GHL_API_KEY = Deno.env.get('GHL_API_KEY');
    if (!GHL_API_KEY) {
      return new Response(JSON.stringify({ error: 'GHL_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { endpoint, params } = await req.json();

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rawParams = (params && typeof params === 'object') ? { ...params as Record<string, unknown> } : {};

    // GHL endpoints are inconsistent between camelCase and snake_case query params.
    // We normalize by adding aliases when missing.
    const aliasPairs: Array<[string, string]> = [
      ['locationId', 'location_id'],
      ['pipelineId', 'pipeline_id'],
      ['calendarId', 'calendar_id'],
      ['startTime', 'start_time'],
      ['endTime', 'end_time'],
    ];

    for (const [camelKey, snakeKey] of aliasPairs) {
      const camelVal = rawParams[camelKey];
      const snakeVal = rawParams[snakeKey];

      if ((camelVal === undefined || camelVal === null || camelVal === '') && snakeVal !== undefined && snakeVal !== null && snakeVal !== '') {
        rawParams[camelKey] = snakeVal;
      }

      if ((snakeVal === undefined || snakeVal === null || snakeVal === '') && camelVal !== undefined && camelVal !== null && camelVal !== '') {
        rawParams[snakeKey] = camelVal;
      }
    }

    // Build URL with query params
    const url = new URL(`${GHL_BASE_URL}${endpoint}`);
    Object.entries(rawParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    console.log(`GHL API Request: ${url.toString()}`);

    const ghlResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await ghlResponse.json();

    if (!ghlResponse.ok) {
      console.error(`GHL API Error [${ghlResponse.status}]:`, JSON.stringify(responseData));
      return new Response(JSON.stringify({ 
        error: `GHL API error`, 
        status: ghlResponse.status,
        details: responseData 
      }), {
        status: ghlResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in ghl-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
