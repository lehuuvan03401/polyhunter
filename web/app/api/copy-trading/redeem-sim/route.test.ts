import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from './route';

describe('POST /api/copy-trading/redeem-sim', () => {
    it('returns gone because the endpoint is retired', async () => {
        const req = new NextRequest('http://localhost/api/copy-trading/redeem-sim', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(410);
        expect(body).toEqual({
            error: 'redeem-sim has been retired',
            code: 'REDEEM_SIM_DISABLED',
        });
    });
});
