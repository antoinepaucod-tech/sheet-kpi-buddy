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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
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

    const rawParams = (params && typeof params === 'object') ? { ...(params as Record<string, unknown>) } : {};

    // GHL has mixed query conventions depending on endpoint.
    // opportunities/search => snake_case ; most others => camelCase.
    const normalizeParams = (path: string, input: Record<string, unknown>): Record<string, unknown> => {
      const normalized = { ...input };

      const pick = (...keys: string[]) => {
        for (const key of keys) {
          const value = normalized[key];
          if (value !== undefined && value !== null && value !== '') return value;
        }
        return undefined;
      };

      if (path.startsWith('/opportunities/search')) {
        const location = pick('location_id', 'locationId');
        const pipeline = pick('pipeline_id', 'pipelineId');
        if (location !== undefined) normalized.location_id = location;
        if (pipeline !== undefined) normalized.pipeline_id = pipeline;
        delete normalized.locationId;
        delete normalized.pipelineId;
        return normalized;
      }

      const location = pick('locationId', 'location_id');
      const pipeline = pick('pipelineId', 'pipeline_id');
      const calendar = pick('calendarId', 'calendar_id');
      const start = pick('startTime', 'start_time');
      const end = pick('endTime', 'end_time');

      if (location !== undefined) normalized.locationId = location;
      if (pipeline !== undefined) normalized.pipelineId = pipeline;
      if (calendar !== undefined) normalized.calendarId = calendar;
      if (start !== undefined) normalized.startTime = start;
      if (end !== undefined) normalized.endTime = end;

      delete normalized.location_id;
      delete normalized.pipeline_id;
      delete normalized.calendar_id;
      delete normalized.start_time;
      delete normalized.end_time;

      return normalized;
    };

    const normalizedParams = normalizeParams(endpoint, rawParams);

    // Build URL with query params
    const url = new URL(`${GHL_BASE_URL}${endpoint}`);
    Object.entries(normalizedParams).forEach(([key, value]) => {
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
