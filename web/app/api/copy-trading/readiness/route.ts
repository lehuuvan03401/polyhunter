import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ERC20_ABI, USDC_DECIMALS, PROXY_FACTORY_ABI } from '@/lib/contracts/abis';
import { GuardrailService } from '@/lib/services/guardrail-service';

export const dynamic = 'force-dynamic';

const MIN_WALLET_MATIC = Number(process.env.COPY_TRADING_MIN_WALLET_MATIC || '0.1');
const MIN_PROXY_USDC = Number(process.env.COPY_TRADING_MIN_PROXY_USDC || '1');

const getProvider = () => {
    // readiness 走只读链路：优先使用独立 COPY_TRADING_RPC_URL，避免挤占前端公用 RPC。
    const rpcUrl = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
    return new ethers.providers.JsonRpcProvider(rpcUrl);
};

const getChainId = () => Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || 137);

const getAddresses = (chainId: number) => (chainId === 137 || chainId === 31337 || chainId === 1337)
    ? CONTRACT_ADDRESSES.polygon
    : CONTRACT_ADDRESSES.amoy;

const parseAddress = (input: string | null) => {
    if (!input) return null;
    try {
        // 统一 checksum，后续合约调用/日志记录都使用规范地址格式。
        return ethers.utils.getAddress(input);
    } catch {
        // 地址非法时直接返回 null，让调用方走 400 响应而不是抛异常。
        return null;
    }
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const walletParam = searchParams.get('wallet');
    const walletAddress = parseAddress(walletParam);

    if (!walletAddress) {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const chainId = getChainId();
    const provider = getProvider();
    const addresses = getAddresses(chainId);

    const voidSigner = new ethers.VoidSigner(walletAddress, provider);

    // readiness 的职责是给前端一个“可执行清单”，而不是只返回布尔值。
    const requiredActions: string[] = [];
    // snapshots 用于前端展示“当前状态”，即便 ready=false 也能给出诊断上下文。
    const balanceSnapshots: Record<string, number> = {};
    const allowanceSnapshots: Record<string, any> = {};

    if (process.env.ENABLE_REAL_TRADING !== 'true') {
        requiredActions.push('ENABLE_REAL_TRADING');
        GuardrailService.recordGuardrailTrigger({
            reason: 'REAL_TRADING_DISABLED',
            source: 'readiness',
            walletAddress,
        });
    }

    if (!addresses.executor) {
        requiredActions.push('CONFIGURE_EXECUTOR');
    }
    const ctfAddress = addresses.ctfContract;
    if (!ctfAddress) {
        requiredActions.push('CONFIGURE_CTF');
    }

    try {
        const walletMatic = await provider.getBalance(walletAddress);
        balanceSnapshots.walletMatic = Number(ethers.utils.formatEther(walletMatic));
        if (balanceSnapshots.walletMatic < MIN_WALLET_MATIC) {
            requiredActions.push('TOP_UP_WALLET_MATIC');
            GuardrailService.recordGuardrailTrigger({
                reason: 'WALLET_MATIC_LOW',
                source: 'readiness',
                walletAddress,
            });
        }
    } catch (error) {
        // 读链失败时保持降级可用：不给 500，只把该字段标记为 0 供前端提示。
        balanceSnapshots.walletMatic = 0;
    }

    try {
        if (addresses.usdc) {
            const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, provider);
            const walletUsdc = await usdc.balanceOf(walletAddress);
            balanceSnapshots.walletUsdc = Number(ethers.utils.formatUnits(walletUsdc, USDC_DECIMALS));
        }
    } catch {
        // USDC 快照失败不影响其它 readiness 检查，继续输出可执行动作。
        balanceSnapshots.walletUsdc = 0;
    }

    let proxyAddress: string | null = null;
    if (addresses.proxyFactory) {
        try {
            const factory = new ethers.Contract(addresses.proxyFactory, PROXY_FACTORY_ABI, voidSigner);
            const candidate = await factory.getUserProxy(walletAddress);
            if (candidate && candidate !== ethers.constants.AddressZero) {
                proxyAddress = candidate;
            }
        } catch {
            // Factory 查询失败时按“未创建 proxy”处理，交由前端引导用户补齐。
            proxyAddress = null;
        }
    }

    if (!proxyAddress) {
        requiredActions.push('CREATE_PROXY');
    } else if (addresses.usdc) {
        try {
            const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, provider);
            const proxyBalance = await usdc.balanceOf(proxyAddress);
            balanceSnapshots.proxyUsdc = Number(ethers.utils.formatUnits(proxyBalance, USDC_DECIMALS));
            if (balanceSnapshots.proxyUsdc < MIN_PROXY_USDC) {
                requiredActions.push('DEPOSIT_PROXY_USDC');
                GuardrailService.recordGuardrailTrigger({
                    reason: 'PROXY_USDC_LOW',
                    source: 'readiness',
                    walletAddress,
                    amount: balanceSnapshots.proxyUsdc,
                });
            }
        } catch {
            // 余额读取失败仍允许返回动作清单，避免单点 RPC 抖动导致页面不可用。
            balanceSnapshots.proxyUsdc = 0;
        }
    }

    if (proxyAddress && addresses.executor && addresses.usdc) {
        try {
            const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, provider);
            const allowanceRaw = await usdc.allowance(proxyAddress, addresses.executor);
            const allowance = Number(allowanceRaw) / (10 ** USDC_DECIMALS);
            // allowance 阈值与最小执行金额保持同口径，避免“授权了但仍无法执行”。
            const allowed = allowance > 0 && allowance >= MIN_PROXY_USDC;
            allowanceSnapshots.usdc = { allowed, allowance, reason: allowed ? undefined : 'ALLOWANCE_MISSING_USDC' };
            if (!allowed) {
                requiredActions.push('APPROVE_USDC');
                GuardrailService.recordGuardrailTrigger({
                    reason: 'ALLOWANCE_MISSING_USDC',
                    source: 'readiness',
                    walletAddress,
                    amount: MIN_PROXY_USDC,
                });
            }
        } catch {
            allowanceSnapshots.usdc = { allowed: false, reason: 'ALLOWANCE_CHECK_FAILED' };
        }

        if (ctfAddress) {
            try {
                const ctf = new ethers.Contract(ctfAddress, CTF_APPROVAL_ABI, provider);
                const approved = await ctf.isApprovedForAll(proxyAddress, addresses.executor);
                allowanceSnapshots.ctf = { allowed: approved, reason: approved ? undefined : 'ALLOWANCE_MISSING_CTF' };
                if (!approved) {
                    requiredActions.push('APPROVE_CTF');
                    GuardrailService.recordGuardrailTrigger({
                        reason: 'ALLOWANCE_MISSING_CTF',
                        source: 'readiness',
                        walletAddress,
                    });
                }
            } catch {
                // CTF 授权读取失败默认视为未授权，交由动作清单引导修复。
                allowanceSnapshots.ctf = { allowed: false, reason: 'ALLOWANCE_CHECK_FAILED' };
            }
        }
    }

    const uniqueActions = Array.from(new Set(requiredActions));
    // 去重后 actions 为空即 ready=true，前端可直接打开自动执行。
    const ready = uniqueActions.length === 0;

    return NextResponse.json({
        walletAddress,
        proxyAddress,
        balances: balanceSnapshots,
        allowances: allowanceSnapshots,
        requiredActions: uniqueActions,
        ready,
        updatedAt: new Date().toISOString(),
    });
}

const CTF_APPROVAL_ABI = [
    'function isApprovedForAll(address owner, address operator) external view returns (bool)',
] as const;
