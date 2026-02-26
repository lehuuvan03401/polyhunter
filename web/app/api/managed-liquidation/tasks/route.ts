import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/participation-program/partner-program';

export const dynamic = 'force-dynamic';

const LIQUIDATION_STATUSES = ['PENDING', 'RETRYING', 'BLOCKED', 'COMPLETED', 'FAILED'] as const;
type LiquidationStatus = (typeof LIQUIDATION_STATUSES)[number];

const RETRYABLE_STATUSES: LiquidationStatus[] = ['PENDING', 'RETRYING', 'BLOCKED', 'FAILED'];
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_TASK_IDS = 100;

const LIST_QUERY_SCHEMA = z.object({
    statuses: z.string().optional(),
    subscriptionId: z.string().optional(),
    walletAddress: z.string().optional(),
    dueOnly: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(MAX_LIMIT).optional(),
});

const ACTION_SCHEMA = z.object({
    action: z.enum(['retry', 'requeue', 'fail']),
    taskIds: z.array(z.string().min(1)).min(1).max(MAX_TASK_IDS),
    delaySeconds: z.coerce.number().int().min(0).max(24 * 60 * 60).optional(),
    reason: z.string().trim().max(240).optional(),
});

function parseStatusFilter(raw?: string): LiquidationStatus[] | undefined {
    if (!raw) return undefined;
    const tokens = raw
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);
    if (tokens.length === 0) return undefined;

    const normalized = Array.from(new Set(tokens));
    const invalid = normalized.filter((item) => !LIQUIDATION_STATUSES.includes(item as LiquidationStatus));
    if (invalid.length > 0) {
        throw new Error(`Invalid liquidation status: ${invalid.join(', ')}`);
    }
    return normalized as LiquidationStatus[];
}

function getDueClause(now: Date): Prisma.ManagedLiquidationTaskWhereInput {
    return {
        OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: now } },
        ],
    };
}

export async function GET(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const params = Object.fromEntries(request.nextUrl.searchParams.entries());
        const parsed = LIST_QUERY_SCHEMA.safeParse(params);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid query params', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const now = new Date();
        const statusFilter = parseStatusFilter(parsed.data.statuses);
        const limit = parsed.data.limit ?? DEFAULT_LIMIT;

        const where: Prisma.ManagedLiquidationTaskWhereInput = {
            ...(statusFilter ? { status: { in: statusFilter } } : {}),
            ...(parsed.data.subscriptionId ? { subscriptionId: parsed.data.subscriptionId } : {}),
            ...(parsed.data.walletAddress ? { walletAddress: parsed.data.walletAddress.toLowerCase() } : {}),
            ...(parsed.data.dueOnly ? getDueClause(now) : {}),
        };

        const [totalCount, dueCount, byStatus, tasks] = await Promise.all([
            prisma.managedLiquidationTask.count({ where }),
            prisma.managedLiquidationTask.count({
                where: {
                    ...where,
                    ...getDueClause(now),
                },
            }),
            prisma.managedLiquidationTask.groupBy({
                by: ['status'],
                where,
                _count: {
                    _all: true,
                },
            }),
            prisma.managedLiquidationTask.findMany({
                where,
                orderBy: [
                    { updatedAt: 'desc' },
                    { createdAt: 'desc' },
                ],
                take: limit,
            }),
        ]);

        const byStatusMap: Record<string, number> = {};
        for (const row of byStatus) {
            byStatusMap[row.status] = row._count._all;
        }

        return NextResponse.json({
            generatedAt: now.toISOString(),
            filters: {
                statuses: statusFilter ?? LIQUIDATION_STATUSES,
                subscriptionId: parsed.data.subscriptionId ?? null,
                walletAddress: parsed.data.walletAddress?.toLowerCase() ?? null,
                dueOnly: parsed.data.dueOnly ?? false,
                limit,
            },
            summary: {
                totalCount,
                dueCount,
                byStatus: {
                    pending: byStatusMap.PENDING ?? 0,
                    retrying: byStatusMap.RETRYING ?? 0,
                    blocked: byStatusMap.BLOCKED ?? 0,
                    completed: byStatusMap.COMPLETED ?? 0,
                    failed: byStatusMap.FAILED ?? 0,
                },
            },
            tasks: tasks.map((task) => ({
                ...task,
                isDue: task.nextRetryAt ? task.nextRetryAt <= now : true,
            })),
        });
    } catch (error) {
        console.error('[ManagedLiquidationTasks] Failed to list tasks:', error);
        const message = error instanceof Error ? error.message : 'Failed to list managed liquidation tasks';
        const status = message.startsWith('Invalid liquidation status') ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isAdminRequest(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isDatabaseEnabled) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = ACTION_SCHEMA.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.format() },
                { status: 400 }
            );
        }

        const now = new Date();
        const reason = parsed.data.reason || null;
        const taskIds = Array.from(new Set(parsed.data.taskIds));
        const delaySeconds = parsed.data.delaySeconds ?? 0;
        const nextRetryAt = new Date(now.getTime() + delaySeconds * 1000);
        const actionWhere: Prisma.ManagedLiquidationTaskWhereInput = {
            id: { in: taskIds },
            status: { in: RETRYABLE_STATUSES },
        };

        let updateData: Prisma.ManagedLiquidationTaskUpdateManyMutationInput;
        if (parsed.data.action === 'retry') {
            updateData = {
                status: 'RETRYING',
                attemptCount: { increment: 1 },
                lastAttemptAt: now,
                nextRetryAt,
                errorCode: 'MANUAL_RETRY',
                errorMessage: reason ?? 'Manual retry requested by admin',
            };
        } else if (parsed.data.action === 'requeue') {
            updateData = {
                status: 'PENDING',
                nextRetryAt: null,
                errorCode: 'MANUAL_REQUEUE',
                errorMessage: reason ?? 'Manually requeued by admin',
            };
        } else {
            updateData = {
                status: 'FAILED',
                nextRetryAt: null,
                errorCode: 'MANUAL_FAIL',
                errorMessage: reason ?? 'Manually marked as failed by admin',
                lastAttemptAt: now,
            };
        }

        const result = await prisma.managedLiquidationTask.updateMany({
            where: actionWhere,
            data: updateData,
        });

        const updatedTasks = await prisma.managedLiquidationTask.findMany({
            where: { id: { in: taskIds } },
            orderBy: { updatedAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            action: parsed.data.action,
            requestedCount: taskIds.length,
            updatedCount: result.count,
            tasks: updatedTasks,
        });
    } catch (error) {
        console.error('[ManagedLiquidationTasks] Failed to mutate tasks:', error);
        return NextResponse.json(
            { error: 'Failed to mutate managed liquidation tasks' },
            { status: 500 }
        );
    }
}
