import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Member {
  id: string;
  name: string;
  membership: string;
  member_type: string;
  contract_signed_date: string;
  exit_date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting recurring transactions generation...');

    // Get current month info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const currentMonthName = monthNames[now.getMonth()];

    // Monthly membership keywords
    const monthlyKeywords = ['MENSUEL', 'PAIEMENT MENSUEL', 'THE COACH PASS MENSUEL'];

    // Get all active members with monthly memberships
    const { data: members, error: membersError } = await supabase
      .from('customer_members')
      .select('*')
      .or('exit_date.is.null,exit_date.gt.' + now.toISOString());

    if (membersError) {
      console.error('Error fetching members:', membersError);
      throw membersError;
    }

    console.log(`Found ${members?.length || 0} active members`);

    const transactionsToCreate = [];

    for (const member of members as Member[]) {
      // Check if membership is monthly
      const isMonthly = monthlyKeywords.some(keyword => 
        member.membership.toUpperCase().includes(keyword)
      );

      if (!isMonthly) {
        console.log(`Skipping ${member.name} - not a monthly membership (${member.membership})`);
        continue;
      }

      // Check if a transaction already exists for this month
      const { data: existingTransactions, error: checkError } = await supabase
        .from('accounting_transactions')
        .select('id')
        .eq('client_name', member.name)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .eq('transaction_type', 'revenue');

      if (checkError) {
        console.error(`Error checking existing transactions for ${member.name}:`, checkError);
        continue;
      }

      if (existingTransactions && existingTransactions.length > 0) {
        console.log(`Transaction already exists for ${member.name} in ${currentMonthName}`);
        continue;
      }

      // Map member type to product description
      let productDescription = "Revenu EFT Général";
      if (member.member_type === "Membres PT") {
        productDescription = "Revenu PT";
      } else if (member.member_type === "Membres PIF") {
        productDescription = "Revenu Fast Cash";
      }

      // Estimate monthly amount (this should be customizable by the user)
      // For now, we'll use 0 and let the user fill it in
      const estimatedAmount = 0;

      transactionsToCreate.push({
        transaction_date: now.toISOString().split('T')[0],
        transaction_type: 'revenue',
        category: member.membership,
        client_name: member.name,
        service_description: member.membership,
        product_description: productDescription,
        amount: estimatedAmount,
        amount_received: 0,
        payment_method: 'Prélèvement Automatique',
        notes: `Transaction récurrente générée automatiquement - ${currentMonthName} ${currentYear}`,
        year: currentYear,
        month: currentMonth,
        month_name: currentMonthName,
        is_auto_generated: true,
        is_validated: false,
      });

      console.log(`Prepared recurring transaction for ${member.name}`);
    }

    if (transactionsToCreate.length === 0) {
      console.log('No recurring transactions to create');
      return new Response(
        JSON.stringify({ message: 'No recurring transactions needed', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Insert all transactions
    const { data: insertedTransactions, error: insertError } = await supabase
      .from('accounting_transactions')
      .insert(transactionsToCreate)
      .select();

    if (insertError) {
      console.error('Error inserting transactions:', insertError);
      throw insertError;
    }

    console.log(`Successfully created ${insertedTransactions?.length || 0} recurring transactions`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Created ${insertedTransactions?.length || 0} recurring transactions`,
        count: insertedTransactions?.length || 0,
        transactions: insertedTransactions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in generate-recurring-transactions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});