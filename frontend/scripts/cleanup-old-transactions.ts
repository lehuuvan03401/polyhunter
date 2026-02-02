import { config } from 'dotenv';
config({ path: '.env.local' });
import { prisma } from '../lib/prisma';

async function main() {
    // 获取所有交易记录，按时间倒序
    const transactions = await prisma.proxyTransaction.findMany({
        orderBy: { createdAt: 'desc' }
    });

    console.log('当前交易记录数:', transactions.length);

    if (transactions.length <= 1) {
        console.log('没有需要删除的记录');
        return;
    }

    // 显示所有记录
    console.log('\n所有记录:');
    transactions.forEach((t, i) => {
        console.log(`${i + 1}. ${t.type} - $${t.amount} - ${t.createdAt} ${i === 0 ? '(保留)' : '(删除)'}`);
    });

    // 保留第一条（最新的），删除其余的
    const toDelete = transactions.slice(1).map(t => t.id);
    console.log('\n将删除', toDelete.length, '条旧记录');

    const result = await prisma.proxyTransaction.deleteMany({
        where: { id: { in: toDelete } }
    });

    console.log('✅ 已删除', result.count, '条记录');
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
