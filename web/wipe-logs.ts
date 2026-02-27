import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    console.log("Wiping CopyTrade and UserPosition...");
    const p1 = await prisma.copyTrade.deleteMany({});
    const p2 = await prisma.userPosition.deleteMany({});
    console.log(`Deleted ${p1.count} trades, ${p2.count} positions.`);
}
main().then(() => process.exit(0));
