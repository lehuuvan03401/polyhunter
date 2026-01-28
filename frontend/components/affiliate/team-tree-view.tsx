'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Users, Zap, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeMember {
    address: string;
    referralCode?: string;
    tier: string;
    volume: number;
    teamSize: number;
    depth: number;
    zeroLineEarned?: number;
    sunLineEarned?: number;
    children: TreeMember[];
}

interface TeamTreeViewProps {
    directReferrals: TreeMember[];
    className?: string;
}

const TIER_STYLES: Record<string, string> = {
    'ORDINARY': 'text-muted-foreground border-white/10',
    'VIP': 'text-white bg-white/5 border-white/20',
    'ELITE': 'text-yellow-200 bg-yellow-500/5 border-yellow-500/10',
    'PARTNER': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    'SUPER_PARTNER': 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30',
};

function TreeNode({ member, depth = 0 }: { member: TreeMember; depth?: number }) {
    const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels
    const hasChildren = member.children && member.children.length > 0;

    const tierStyle = TIER_STYLES[member.tier] || TIER_STYLES['ORDINARY'];
    const hasCommission = (member.zeroLineEarned || 0) > 0 || (member.sunLineEarned || 0) > 0;

    return (
        <div className="select-none">
            {/* Node Row */}
            <div
                className={cn(
                    "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors",
                    "hover:bg-white/5 cursor-pointer group",
                    depth === 0 && "bg-white/5 border border-white/10"
                )}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                style={{ marginLeft: depth * 24 }}
            >
                {/* Expand/Collapse Icon */}
                <div className="w-5 h-5 flex items-center justify-center">
                    {hasChildren ? (
                        isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                </div>

                {/* Avatar */}
                <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-mono text-muted-foreground">
                    {member.address?.slice(2, 4) || '??'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white/80 truncate">
                            {member.referralCode || `${member.address?.slice(0, 6)}...${member.address?.slice(-4)}`}
                        </span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded border", tierStyle)}>
                            {member.tier}
                        </span>
                    </div>
                </div>

                {/* Commission Breakdown */}
                {hasCommission && (
                    <div className="flex items-center gap-3">
                        {/* Zero Line (Direct Commission) */}
                        {(member.zeroLineEarned || 0) > 0 && (
                            <div className="flex items-center gap-1 text-green-400" title="Zero Line (Direct)">
                                <Zap className="h-3 w-3" />
                                <span className="text-xs font-mono">${member.zeroLineEarned?.toFixed(2)}</span>
                            </div>
                        )}
                        {/* Sun Line (Team Differential) */}
                        {(member.sunLineEarned || 0) > 0 && (
                            <div className="flex items-center gap-1 text-yellow-400" title="Sun Line (Team Diff)">
                                <Sun className="h-3 w-3" />
                                <span className="text-xs font-mono">${member.sunLineEarned?.toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Volume */}
                <div className="text-right min-w-[80px]">
                    <div className="text-sm font-mono text-white/60">
                        ${(member.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                </div>

                {/* Team Size */}
                {member.teamSize > 0 && (
                    <div className="flex items-center gap-1 text-yellow-500/80 min-w-[40px]">
                        <Users className="h-3 w-3" />
                        <span className="text-xs font-medium">{member.teamSize}</span>
                    </div>
                )}
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div className="border-l border-white/5 ml-6">
                    {member.children.map((child, idx) => (
                        <TreeNode key={child.address || idx} member={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function TeamTreeView({ directReferrals, className }: TeamTreeViewProps) {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    if (!directReferrals || directReferrals.length === 0) {
        return (
            <div className={cn("text-center py-12 rounded-xl border border-dashed border-white/10 bg-white/5", className)}>
                <div className="h-12 w-12 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-3 text-muted-foreground">
                    <Users className="h-6 w-6" />
                </div>
                <div className="font-medium text-white mb-1">Your team is empty</div>
                <p className="text-sm text-muted-foreground">Share your link to start building your organization.</p>
            </div>
        );
    }

    const totalPages = Math.ceil(directReferrals.length / pageSize);
    const paginatedMembers = directReferrals.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className={cn("space-y-1", className)}>
            {/* Legend & Pagination Info */}
            <div className="flex items-center justify-between px-3 mb-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Direct Referrals ({directReferrals.length})
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-green-400" />
                        <span>Direct</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Sun className="h-3 w-3 text-yellow-400" />
                        <span>Team Diff</span>
                    </div>
                </div>
            </div>

            {/* List */}
            {paginatedMembers.map((member, idx) => (
                <TreeNode key={member.address || idx} member={member} depth={0} />
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-3 mt-2 border-t border-white/5">
                    <div className="text-xs text-muted-foreground">
                        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, directReferrals.length)} of {directReferrals.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-2 py-1 text-xs font-medium rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground transition-colors"
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={cn(
                                        "w-6 h-6 flex items-center justify-center text-xs font-medium rounded transition-colors",
                                        page === p ? "bg-white/10 text-white" : "text-muted-foreground hover:bg-white/5"
                                    )}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-2 py-1 text-xs font-medium rounded hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-muted-foreground transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
