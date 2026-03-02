import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY')!;

serve(async (req: Request) => {
    // CORS headers
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const { contact_id } = await req.json();

        if (!contact_id) {
            return new Response(JSON.stringify({ error: 'contact_id is required' }), { status: 400 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get contact details
        const { data: contact, error: fetchError } = await supabase
            .from('contacts')
            .select('id, email, company_name, name')
            .eq('id', contact_id)
            .single();

        if (fetchError || !contact) {
            return new Response(JSON.stringify({ error: 'Contact not found' }), { status: 404 });
        }

        // Mock Enrichment (replace with actual Apollo/Clearbit call in production)
        // e.g. await fetch(`https://api.apollo.io/v1/people/match`, { ... })
        const enrichedData = {
            role: 'Diretor / C-Level',
            companyName: contact.company_name || 'Tech Solutions Corp',
            linkedin: `https://linkedin.com/in/${contact.name.replace(/\s+/g, '').toLowerCase()}`,
            enriched_at: new Date().toISOString()
        };

        // Update contact
        const { error: updateError } = await supabase
            .from('contacts')
            .update({
                role: enrichedData.role,
                company_name: enrichedData.companyName,
                // store additional inside a metadata jsonb if we had it, but for now just update existing
                custom_fields: {
                    linkedin: enrichedData.linkedin,
                    last_enriched: enrichedData.enriched_at
                }
            })
            .eq('id', contact.id);

        if (updateError) {
            throw new Error('Failed to update contact');
        }

        return new Response(JSON.stringify({ success: true, enrichedData }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
});
