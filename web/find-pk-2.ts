import { ethers } from "ethers";
const pk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const wallet = new ethers.Wallet(pk);
console.log("Account 0: " + wallet.address);

const pk2 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const wallet2 = new ethers.Wallet(pk2);
console.log("Account 1: " + wallet2.address);

const pk3 = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const wallet3 = new ethers.Wallet(pk3);
console.log("Account 2: " + wallet3.address);

const pk4 = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";
const wallet4 = new ethers.Wallet(pk4);
console.log("Account (from env 116): " + wallet4.address);

