import { createClient } from '@supabase/supabase-js';
import { buildAgentTools } from './lib/ai/agent-tools';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Service Role Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log('\n[WEBHOOK OUTBOUND] Test via Agent Tools Execution');
    console.log('='.repeat(60));

    try {
        // 1. Fetch an existing organization
        const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .limit(1)
            .single();

        if (orgError) throw new Error(`Could not fetch organization: ${orgError.message}`);
        const orgId = orgData.id;

        // Contact
        let contactId: string = '';
        let createdDummyContact = false;

        const { data: newContact, error: insertContactError } = await supabase
            .from('contacts')
            .insert({
                organization_id: orgId,
                name: 'E2E Dummy Contact ' + Date.now(),
                stage: 'LEAD'
            })
            .select('id')
            .single();

        if (insertContactError) throw new Error(insertContactError.message);
        contactId = newContact.id;
        createdDummyContact = true;

        // Board & Stage
        let boardId: string = '';
        let createdDummyBoard = false;
        const { data: boardData } = await supabase
            .from('boards')
            .select('id')
            .eq('organization_id', orgId)
            .limit(1)
            .single();

        if (boardData) {
            boardId = boardData.id;
        } else {
            const { data: newBoard, error: newBoardErr } = await supabase
                .from('boards')
                .insert({ organization_id: orgId, name: 'E2E Dummy Board' })
                .select('id')
                .single();
            if (newBoardErr) throw Error(newBoardErr.message);
            boardId = newBoard.id;
            createdDummyBoard = true;
        }

        let stageId: string = '';
        const { data: stageData } = await supabase
            .from('board_stages')
            .select('id')
            .eq('board_id', boardId)
            .limit(1)
            .single();

        if (stageData) {
            stageId = stageData.id;
        } else {
            const { data: newStage, error: stageErr } = await supabase
                .from('board_stages')
                .insert({ board_id: boardId, name: 'New', order: 1 })
                .select('id')
                .single();
            if (stageErr) throw Error(stageErr.message);
            stageId = newStage.id;
        }

        // Endpoint for Webhook trigger
        let endpointId: string = '';
        let createdDummyEndpoint = false;
        const { data: endpointData } = await supabase
            .from('integration_outbound_endpoints')
            .select('id')
            .eq('organization_id', orgId)
            .limit(1)
            .single();

        if (endpointData) {
            endpointId = endpointData.id;
            await supabase.from('integration_outbound_endpoints').update({
                active: true,
                events: ['deal.created']
            }).eq('id', endpointId);
        } else {
            const { data: newEndpoint, error: epErr } = await supabase
                .from('integration_outbound_endpoints')
                .insert({
                    organization_id: orgId,
                    name: 'E2E Dummy Endpoint',
                    url: 'https://webhook.site/e2e-dummy-1234',
                    secret: 'e2e-secret',
                    active: true,
                    events: ['deal.created']
                })
                .select('id')
                .single();
            if (epErr) throw Error('Could not create dummy outbound endpoint: ' + epErr.message);
            endpointId = newEndpoint.id;
            createdDummyEndpoint = true;
        }

        const text: string = ''; // stub
        // 2. Build the Agent Tools
        const tools = buildAgentTools({
            supabase,
            organizationId: orgId,
            conversationId: '00000000-0000-0000-0000-000000000000', // Dummy 
            agentConfig: {
                default_board_id: boardId,
                default_stage_id: stageId
            }
        });

        // 3. Execute the 'create_deal' tool exactly as the AI SDK would
        const dummyTitle = `E2E Tool Deal ${Date.now()}`;
        const result = await tools.create_deal.execute({
            title: dummyTitle,
            contact_id: contactId,
            value: 5000
        });

        if (!result.success || !result.deal_id) {
            throw new Error(`Tool create_deal failed: ${result.error}`);
        }
        const dealId = result.deal_id;
        console.log(`  [ OK ] Deal created via AI Tool: ${dealId}`);

        // Wait a moment
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Query webhook_events_out
        const { data: webhookEvents, error: webhookError } = await supabase
            .from('webhook_events_out')
            .select('*')
            .eq('deal_id', dealId)
            .eq('event_type', 'deal.created');

        if (webhookError) throw new Error(`Failed to query webhook_events_out: ${webhookError.message}`);

        if (webhookEvents && webhookEvents.length > 0) {
            console.log(`  [ OK ] Webhook Trigger Fired for event deal.created!`);
        } else {
            throw new Error(`Trigger did not fire for deal.created. No event found in webhook_events_out.`);
        }

        // Cleanup
        const { error: deleteError } = await supabase
            .from('deals')
            .delete()
            .eq('id', dealId);

        if (deleteError) {
            console.log(`  [WARN] Failed to clean up deal: ${deleteError.message}`);
        } else {
            console.log(`  [ OK ] Test deal cleaned up.`);
        }

        if (createdDummyContact) {
            await supabase.from('contacts').delete().eq('id', contactId);
        }
        if (createdDummyBoard) {
            await supabase.from('boards').delete().eq('id', boardId);
        }
        if (createdDummyEndpoint) {
            await supabase.from('integration_outbound_endpoints').delete().eq('id', endpointId);
        }

        console.log('\n[ RESULT ] 1 passed, 0 failed\n');
        process.exit(0);

    } catch (error: any) {
        console.error(`  [FAIL] Test aborted: ${error.message}`);
        console.log('\n[ RESULT ] 0 passed, 1 failed\n');
        process.exit(1);
    }
}

runTest();
