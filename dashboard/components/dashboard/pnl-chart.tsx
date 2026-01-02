"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
    { day: "Mon", value: 4000 },
    { day: "Tue", value: 4500 },
    { day: "Wed", value: 4200 },
    { day: "Thu", value: 5100 },
    { day: "Fri", value: 4900 },
    { day: "Sat", value: 6200 },
    { day: "Sun", value: 6800 },
];

export function PnlChart() {
    return (
        <Card className="h-full bg-[#1a1d24] border-slate-800 shadow-none flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-slate-400 font-medium">Performance</CardTitle>
                    <div className="flex gap-2">
                        {['1D', '1W', '1M', 'ALL'].map((period) => (
                            <button
                                key={period}
                                className={`text-xs px-2 py-1 rounded ${period === '1W' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px] text-xs">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="day"
                            stroke="#475569"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#475569"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
