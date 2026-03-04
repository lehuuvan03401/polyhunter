import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    void request;
    return NextResponse.json(
        {
            error: 'redeem-sim has been retired',
            code: 'REDEEM_SIM_DISABLED',
        },
        { status: 410 }
    );
}
