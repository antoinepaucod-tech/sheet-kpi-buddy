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
  subscription_end_date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize admin client for database operations
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

    // Current date for comparison (start of today)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate start and end of current month for comparison
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0); // Last day of current month

    // Membership type keywords for recurring payments
    const monthlyKeywords = ['MENSUEL', 'PAIEMENT MENSUEL', 'THE COACH PASS MENSUEL'];
    
    // PIF/Annual memberships - appear each month but with 0 amount after first payment
    const pifKeywords = ['PIF', '6 WEEKS', 'CHALLENGE', 'X1', 'ANNUEL', 'PAIEMENT ANNUEL'];

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from('customer_members')
      .select('*');

    if (membersError) {
      console.error('Error fetching members:', membersError);
      throw membersError;
    }

    console.log(`Found ${members?.length || 0} total members`);

    const transactionsToCreate = [];

    for (const member of members as Member[]) {
      // RULE 1: Member must have a contract_signed_date
      if (!member.contract_signed_date) {
        console.log(`Skipping ${member.name} - no contract signed date`);
        continue;
      }

      const contractSignedDate = new Date(member.contract_signed_date);
      
      // RULE 2: Contract must have started before or during the current month
      if (contractSignedDate > currentMonthEnd) {
        console.log(`Skipping ${member.name} - contract starts in the future (${member.contract_signed_date})`);
        continue;
      }

      // RULE 3: Check subscription_end_date for ALL members (not just PIF)
      // A member should NOT have a transaction generated for a month that starts AFTER their subscription ends
      if (member.subscription_end_date) {
        const subscriptionEndDate = new Date(member.subscription_end_date);
        // Skip if subscription ended before the current month started
        // This means if subscription_end_date is 2025-12-25, no transaction for January 2026
        if (subscriptionEndDate < currentMonthStart) {
          console.log(`Skipping ${member.name} - subscription ended before this month started (end: ${member.subscription_end_date}, month start: ${currentMonthStart.toISOString().split('T')[0]})`);
          continue;
        }
      }

      // RULE 4: Check exit_date (if member left the gym entirely)
      if (member.exit_date) {
        const exitDate = new Date(member.exit_date);
        // Skip if exited before the current month started
        if (exitDate < currentMonthStart) {
          console.log(`Skipping ${member.name} - exited before this month (${member.exit_date})`);
          continue;
        }
      }

      // Check if a transaction already exists for this month with this membership
      const { data: existingTransactions, error: checkError } = await supabase
        .from('accounting_transactions')
        .select('id')
        .eq('client_name', member.name)
        .eq('year', currentYear)
        .eq('month', currentMonth)
        .eq('transaction_type', 'revenue')
        .eq('category', member.membership);

      if (checkError) {
        console.error(`Error checking existing transactions for ${member.name}:`, checkError);
        continue;
      }

      if (existingTransactions && existingTransactions.length > 0) {
        console.log(`Transaction already exists for ${member.name} in ${currentMonthName} (${member.membership})`);
        continue;
      }

      // Determine if this is a PIF/limited membership or monthly recurring
      const isPIF = pifKeywords.some(keyword => 
        member.membership.toUpperCase().includes(keyword)
      ) || member.member_type === "Membres PIF";

      const isMonthly = monthlyKeywords.some(keyword => 
        member.membership.toUpperCase().includes(keyword)
      );

      // Determine the amount
      let estimatedAmount = 0;
      
      if (isPIF) {
        // PIF members: 0 amount for recurring entries (they already paid in full)
        estimatedAmount = 0;
        console.log(`Creating 0 amount transaction for PIF member: ${member.name} (${member.membership})`);
      } else if (isMonthly) {
        // Monthly members: get previous month's amount
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        const { data: previousTransactions, error: prevError } = await supabase
          .from('accounting_transactions')
          .select('amount')
          .eq('client_name', member.name)
          .eq('year', previousYear)
          .eq('month', previousMonth)
          .eq('transaction_type', 'revenue')
          .eq('category', member.membership)
          .order('created_at', { ascending: false })
          .limit(1);

        if (prevError) {
          console.error(`Error fetching previous transaction for ${member.name}:`, prevError);
        }

        if (previousTransactions && previousTransactions.length > 0) {
          estimatedAmount = previousTransactions[0].amount;
        }
        console.log(`Creating monthly transaction for ${member.name} with amount: ${estimatedAmount}`);
      } else {
        // Unknown membership type - default to 0 but still create the transaction
        estimatedAmount = 0;
        console.log(`Creating transaction for unrecognized membership type: ${member.name} (${member.membership})`);
      }

      // Map member type to product description
      let productDescription = "Revenu EFT Général";
      if (member.member_type === "Membres PT") {
        productDescription = "Revenu PT";
      } else if (member.member_type === "Membres PIF") {
        productDescription = "Membre PIF";
      }

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

      console.log(`Prepared transaction for ${member.name} (${member.membership}) - Amount: ${estimatedAmount}`);
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
