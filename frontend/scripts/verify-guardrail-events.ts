import './env-setup';
import { GuardrailService } from '../lib/services/guardrail-service';
import { prisma } from '../lib/prisma';

async function main() {
    GuardrailService.recordGuardrailTrigger({
        reason: 'VERIFY_GUARDRAIL_EVENT',
        source: 'verify',
        walletAddress: '0x0000000000000000000000000000000000000000',
        amount: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const latest = await prisma.guardrailEvent.findFirst({
        orderBy: { createdAt: 'desc' },
    });

    console.log('[Verify] Latest guardrail event:', latest);
}

main()
    .catch((error) => {
        console.error('[Verify] Failed to fetch guardrail events:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
