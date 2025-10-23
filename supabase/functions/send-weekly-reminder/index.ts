import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "KPI Dashboard <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return response.json();
};

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Weekly Reminder Function Started ===");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Fetching active email preferences...");
    
    // Get all active email subscribers
    const { data: emailPrefs, error: emailError } = await supabase
      .from("email_preferences")
      .select("email")
      .eq("enabled", true);

    if (emailError) {
      console.error("Error fetching email preferences:", emailError);
      throw emailError;
    }

    if (!emailPrefs || emailPrefs.length === 0) {
      console.log("No active email subscribers found");
      return new Response(
        JSON.stringify({ message: "No active subscribers" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${emailPrefs.length} active subscribers`);

    // Get current week info
    const now = new Date();
    const currentYear = now.getFullYear();
    const onejan = new Date(currentYear, 0, 1);
    const weekNumber = Math.ceil(
      ((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
    );

    console.log(`Sending reminders for Year ${currentYear}, Week ${weekNumber}`);

    // Send email to each subscriber
    const emailPromises = emailPrefs.map(async (pref) => {
      try {
        const emailResponse = await sendEmail(
          pref.email,
          `📊 Rappel hebdomadaire - Semaine ${weekNumber}`,
          `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; border-radius: 12px; text-align: center; }
                  .content { background: #f8fafc; padding: 30px; border-radius: 12px; margin-top: 20px; }
                  .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
                  .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
                  .metrics { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                  .metric-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0; font-size: 28px;">📊 Rappel Hebdomadaire</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Semaine ${weekNumber} - ${currentYear}</p>
                  </div>
                  
                  <div class="content">
                    <h2 style="color: #1e293b; margin-top: 0;">Bonjour ! 👋</h2>
                    <p>C'est le moment de mettre à jour vos KPIs pour cette semaine.</p>
                    
                    <div class="metrics">
                      <h3 style="margin-top: 0; color: #1e293b;">Rappel des métriques à suivre :</h3>
                      <div class="metric-item">
                        <span>💰 Revenus</span>
                        <span style="color: #3b82f6;">General EFT, PT, Retail, Fast Cash</span>
                      </div>
                      <div class="metric-item">
                        <span>👥 Membres</span>
                        <span style="color: #8b5cf6;">PIF, Recurring, PT, Exits</span>
                      </div>
                      <div class="metric-item">
                        <span>🎯 Ventes</span>
                        <span style="color: #10b981;">Leads, Scheduled, Show, Close</span>
                      </div>
                      <div class="metric-item">
                        <span>💳 Dépenses</span>
                        <span style="color: #ef4444;">Ad Spend, Rent, Utilities, etc.</span>
                      </div>
                    </div>
                    
                    <p>Prenez quelques minutes pour entrer vos données et garder une vue claire de votre performance !</p>
                    
                    <div style="text-align: center;">
                      <a href="${supabaseUrl.replace('rujpspjvyndjtkvjbbhq.supabase.co', 'lovable.app')}" class="button">
                        Mettre à jour mes KPIs →
                      </a>
                    </div>
                  </div>
                  
                  <div class="footer">
                    <p>Vous recevez cet email car vous êtes abonné aux rappels hebdomadaires KPI.</p>
                    <p style="margin-top: 10px;">
                      <a href="${supabaseUrl.replace('rujpspjvyndjtkvjbbhq.supabase.co', 'lovable.app')}" style="color: #3b82f6;">
                        Gérer mes préférences
                      </a>
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `
        );

        console.log(`Email sent successfully to ${pref.email}:`, emailResponse);
        return { email: pref.email, success: true };
      } catch (error: any) {
        console.error(`Error sending email to ${pref.email}:`, error);
        return { email: pref.email, success: false, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;

    console.log(`=== Summary: ${successCount}/${results.length} emails sent successfully ===`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} reminder emails`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-weekly-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
