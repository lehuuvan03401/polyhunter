// # 仅模型
// npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/supervisor-load-model.ts

// # 合成模拟（可改参数）
// SUPERVISOR_LOAD_SIMULATE=true \
// SUPERVISOR_LOAD_SIM_EVENTS=200 \
// SUPERVISOR_LOAD_SIM_EVENTS_PER_SEC=20 \
// SUPERVISOR_LOAD_SIM_FOLLOWERS=100 \
// SUPERVISOR_LOAD_SIM_EXEC_LATENCY_MS=30 \
// SUPERVISOR_LOAD_SIM_WORKERS=20 \
// npx tsx --tsconfig frontend/tsconfig.json frontend/scripts/verify/supervisor-load-model.ts

import 'dotenv/config';

const USERS = Number(process.env.SUPERVISOR_LOAD_USERS || '10000');
const FOLLOWS_PER_USER = Number(process.env.SUPERVISOR_LOAD_FOLLOWS || '10');
const UNIQUE_TRADERS = Number(process.env.SUPERVISOR_LOAD_TRADERS || '1000');
const TRADES_PER_USER_PER_DAY = Number(process.env.SUPERVISOR_LOAD_TRADES_PER_USER || '5000');
const WORKERS_PER_INSTANCE = Number(process.env.SUPERVISOR_LOAD_WORKERS || '20');
const EXEC_LATENCY_MS = Number(process.env.SUPERVISOR_LOAD_EXEC_LATENCY_MS || '1000');
const TARGET_HEADROOM = Number(process.env.SUPERVISOR_LOAD_HEADROOM || '2');

const SIMULATE = process.env.SUPERVISOR_LOAD_SIMULATE === 'true';
const SIM_EVENTS = Number(process.env.SUPERVISOR_LOAD_SIM_EVENTS || '100');
const SIM_EVENTS_PER_SEC = Number(process.env.SUPERVISOR_LOAD_SIM_EVENTS_PER_SEC || '20');
const SIM_FOLLOWERS_PER_TRADER = Number(process.env.SUPERVISOR_LOAD_SIM_FOLLOWERS || '100');
const SIM_EXEC_LATENCY_MS = Number(process.env.SUPERVISOR_LOAD_SIM_EXEC_LATENCY_MS || '50');
const SIM_WORKERS = Number(process.env.SUPERVISOR_LOAD_SIM_WORKERS || '20');

function fmt(num: number, digits = 2) {
    return Number.isFinite(num) ? num.toFixed(digits) : 'n/a';
}

function model() {
    const totalCopyTradesPerDay = USERS * TRADES_PER_USER_PER_DAY;
    const avgCopyTradesPerSec = totalCopyTradesPerDay / 86400;

    const totalFollowEdges = USERS * FOLLOWS_PER_USER;
    const avgFollowersPerTrader = totalFollowEdges / UNIQUE_TRADERS;
    const leaderTradesPerDay = avgFollowersPerTrader > 0 ? totalCopyTradesPerDay / avgFollowersPerTrader : 0;
    const leaderTradesPerSec = leaderTradesPerDay / 86400;

    const workerThroughputPerSec = EXEC_LATENCY_MS > 0 ? 1000 / EXEC_LATENCY_MS : 0;
    const instanceThroughputPerSec = workerThroughputPerSec * WORKERS_PER_INSTANCE;
    const instancesNeeded = instanceThroughputPerSec > 0 ? avgCopyTradesPerSec / instanceThroughputPerSec : 0;
    const instancesWithHeadroom = Math.ceil(instancesNeeded * TARGET_HEADROOM);

    console.log('[LoadModel] Inputs');
    console.log(`  Users:                ${USERS}`);
    console.log(`  Follows per user:     ${FOLLOWS_PER_USER}`);
    console.log(`  Unique traders:       ${UNIQUE_TRADERS}`);
    console.log(`  Trades/user/day:      ${TRADES_PER_USER_PER_DAY}`);
    console.log(`  Workers/instance:     ${WORKERS_PER_INSTANCE}`);
    console.log(`  Exec latency (ms):    ${EXEC_LATENCY_MS}`);
    console.log(`  Headroom factor:      ${TARGET_HEADROOM}`);

    console.log('\n[LoadModel] Derived');
    console.log(`  Total copy trades/day: ${totalCopyTradesPerDay.toLocaleString()}`);
    console.log(`  Avg copy trades/sec:   ${fmt(avgCopyTradesPerSec, 2)}`);
    console.log(`  Avg followers/trader:  ${fmt(avgFollowersPerTrader, 2)}`);
    console.log(`  Leader trades/day:     ${leaderTradesPerDay.toLocaleString()}`);
    console.log(`  Leader trades/sec:     ${fmt(leaderTradesPerSec, 3)}`);
    console.log(`  Worker throughput/sec: ${fmt(workerThroughputPerSec, 2)}`);
    console.log(`  Instance throughput:   ${fmt(instanceThroughputPerSec, 2)} trades/sec`);
    console.log(`  Instances needed:      ${fmt(instancesNeeded, 2)} (avg)`);
    console.log(`  Instances w/ headroom: ${instancesWithHeadroom}`);
}

async function simulate() {
    const totalTasks = SIM_EVENTS * SIM_FOLLOWERS_PER_TRADER;
    const eventIntervalMs = SIM_EVENTS_PER_SEC > 0 ? Math.floor(1000 / SIM_EVENTS_PER_SEC) : 0;

    const queue: Array<{ enqueuedAt: number }> = [];
    let produced = 0;
    let processed = 0;
    let inFlight = 0;
    let maxQueue = 0;
    let lagSumMs = 0;

    const start = Date.now();

    const maybeStart = () => {
        while (inFlight < SIM_WORKERS && queue.length > 0) {
            const task = queue.shift();
            if (!task) break;
            const lag = Date.now() - task.enqueuedAt;
            lagSumMs += lag;
            inFlight += 1;
            setTimeout(() => {
                inFlight -= 1;
                processed += 1;
                if (processed === totalTasks && produced === totalTasks) {
                    const elapsedMs = Date.now() - start;
                    const throughput = (processed / (elapsedMs / 1000));
                    const avgLag = processed > 0 ? lagSumMs / processed : 0;
                    console.log('\n[LoadSim] Result');
                    console.log(`  Events:         ${SIM_EVENTS}`);
                    console.log(`  Followers/event:${SIM_FOLLOWERS_PER_TRADER}`);
                    console.log(`  Total tasks:    ${totalTasks}`);
                    console.log(`  Workers:        ${SIM_WORKERS}`);
                    console.log(`  Exec latency:   ${SIM_EXEC_LATENCY_MS}ms`);
                    console.log(`  Elapsed:        ${elapsedMs}ms`);
                    console.log(`  Throughput:     ${fmt(throughput, 2)} tasks/sec`);
                    console.log(`  Avg queue lag:  ${fmt(avgLag, 2)}ms`);
                    console.log(`  Max queue depth:${maxQueue}`);
                } else {
                    maybeStart();
                }
            }, SIM_EXEC_LATENCY_MS);
        }
    };

    if (eventIntervalMs <= 0) {
        for (let i = 0; i < SIM_EVENTS; i++) {
            for (let j = 0; j < SIM_FOLLOWERS_PER_TRADER; j++) {
                queue.push({ enqueuedAt: Date.now() });
                produced += 1;
            }
            maxQueue = Math.max(maxQueue, queue.length);
        }
        maybeStart();
        return;
    }

    const timer = setInterval(() => {
        if (produced >= totalTasks) {
            clearInterval(timer);
            return;
        }
        for (let j = 0; j < SIM_FOLLOWERS_PER_TRADER; j++) {
            queue.push({ enqueuedAt: Date.now() });
            produced += 1;
        }
        maxQueue = Math.max(maxQueue, queue.length);
        maybeStart();
        if (produced >= totalTasks) {
            clearInterval(timer);
        }
    }, eventIntervalMs);
}

model();
if (SIMULATE) {
    simulate().catch((err) => {
        console.error('Load simulation failed:', err);
        process.exit(1);
    });
}
