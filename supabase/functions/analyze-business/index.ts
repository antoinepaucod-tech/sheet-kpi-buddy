import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { monthlyData, activeMembers, monthlyRevenue, monthlyExpenses, courses } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate trends
    const recentMonths = monthlyData.slice(-3);
    const avgRevenue = recentMonths.reduce((sum: number, m: any) => sum + (m.total_revenue || 0), 0) / 3;
    const avgExpenses = recentMonths.reduce((sum: number, m: any) => sum + (m.total_expenses || 0), 0) / 3;
    const revenueGrowth = recentMonths.length >= 2 ? 
      ((recentMonths[recentMonths.length - 1].total_revenue - recentMonths[0].total_revenue) / recentMonths[0].total_revenue * 100) : 0;
    
    const systemPrompt = `Tu es un consultant business expert en gestion de salles de sport. Analyse les données suivantes et fournis des insights actionnables en français.

Données actuelles:
- Revenus mensuels: ${monthlyRevenue} CHF
- Dépenses mensuelles: ${monthlyExpenses} CHF
- Profit: ${monthlyRevenue - monthlyExpenses} CHF
- Membres actifs: ${activeMembers}
- Nombre de cours: ${courses}
- Revenu moyen (3 derniers mois): ${avgRevenue.toFixed(2)} CHF
- Dépenses moyennes (3 derniers mois): ${avgExpenses.toFixed(2)} CHF
- Croissance revenus: ${revenueGrowth.toFixed(1)}%

Fournis une analyse concise (maximum 200 mots) qui inclut:
1. 📊 Tendance principale (positive, stable ou préoccupante)
2. 🎯 2-3 recommandations stratégiques concrètes
3. ⚠️ 1 point d'attention important

Ton ton doit être professionnel mais encourageant. Sois direct et actionnable.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyse ces données et donne-moi des recommandations pour améliorer les performances de ma salle." }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits Lovable AI épuisés. Veuillez ajouter des crédits dans les paramètres." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-business function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Une erreur est survenue lors de l'analyse" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
