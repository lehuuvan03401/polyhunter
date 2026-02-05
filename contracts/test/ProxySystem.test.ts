import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Treasury, ProxyFactory, PolyHunterProxy, MockERC20 } from "../typechain-types";

describe("Horus Proxy System", function () {
    let owner: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;

    let usdc: MockERC20;
    let treasury: Treasury;
    let proxyFactory: ProxyFactory;
    let executor: any;

    const INITIAL_BALANCE = ethers.parseUnits("10000", 6); // 10,000 USDC

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // Deploy Mock USDC
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        usdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
        await usdc.waitForDeployment();

        // Deploy Treasury
        const Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.deploy(await usdc.getAddress(), owner.address);
        await treasury.waitForDeployment();

        // Deploy Executor
        const Executor = await ethers.getContractFactory("PolyHunterExecutor");
        executor = await Executor.deploy();
        await executor.waitForDeployment();

        // Deploy ProxyFactory
        const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
        proxyFactory = await ProxyFactory.deploy(
            await usdc.getAddress(),
            owner.address, // Mock CTF exchange
            await treasury.getAddress(),
            await executor.getAddress(),
            owner.address
        );
        await proxyFactory.waitForDeployment();

        // Mint USDC to users
        await usdc.mint(user1.address, INITIAL_BALANCE);
        await usdc.mint(user2.address, INITIAL_BALANCE);
    });

    describe("Treasury", function () {
        it("should have correct USDC address", async function () {
            expect(await treasury.usdc()).to.equal(await usdc.getAddress());
        });

        it("should allow owner to withdraw", async function () {
            // Send some USDC to treasury
            await usdc.mint(await treasury.getAddress(), ethers.parseUnits("100", 6));

            const initialBalance = await usdc.balanceOf(owner.address);
            await treasury.withdraw(ethers.parseUnits("100", 6));
            const finalBalance = await usdc.balanceOf(owner.address);

            expect(finalBalance - initialBalance).to.equal(ethers.parseUnits("100", 6));
        });

        it("should reject withdrawal from non-owner", async function () {
            await usdc.mint(await treasury.getAddress(), ethers.parseUnits("100", 6));

            await expect(
                treasury.connect(user1).withdraw(ethers.parseUnits("100", 6))
            ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
        });
    });

    describe("ProxyFactory", function () {
        it("should create proxy for user", async function () {
            // User1 creates a proxy with STARTER tier
            await proxyFactory.connect(user1).createProxy(0);

            const proxyAddress = await proxyFactory.getUserProxy(user1.address);
            expect(proxyAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("should not allow duplicate proxies", async function () {
            await proxyFactory.connect(user1).createProxy(0);

            await expect(
                proxyFactory.connect(user1).createProxy(0)
            ).to.be.revertedWith("Proxy already exists");
        });

        it("should set correct tier fees", async function () {
            expect(await proxyFactory.getTierFee(0)).to.equal(1000); // STARTER 10%
            expect(await proxyFactory.getTierFee(1)).to.equal(500);  // PRO 5%
            expect(await proxyFactory.getTierFee(2)).to.equal(200);  // WHALE 2%
        });

        it("should track total proxies", async function () {
            await proxyFactory.connect(user1).createProxy(0);
            await proxyFactory.connect(user2).createProxy(1);

            expect(await proxyFactory.getTotalProxies()).to.equal(2);
        });

        it("should bind executor and allowlist defaults on new proxy", async function () {
            await proxyFactory.connect(user1).createProxy(0);
            const proxyAddress = await proxyFactory.getUserProxy(user1.address);
            const proxy = await ethers.getContractAt("PolyHunterProxy", proxyAddress);

            expect(await proxy.executor()).to.equal(await executor.getAddress());
            expect(await proxy.allowedTargets(await usdc.getAddress())).to.equal(true);
            expect(await proxy.allowedTargets(owner.address)).to.equal(true); // Mock CTF exchange
        });
    });

    describe("PolyHunterProxy", function () {
        let proxy: PolyHunterProxy;

        beforeEach(async function () {
            // User1 creates a STARTER tier proxy (10% fee)
            await proxyFactory.connect(user1).createProxy(0);
            const proxyAddress = await proxyFactory.getUserProxy(user1.address);
            proxy = await ethers.getContractAt("PolyHunterProxy", proxyAddress);
        });

        it("should allow deposit from owner", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);

            await usdc.connect(user1).approve(await proxy.getAddress(), depositAmount);
            await proxy.connect(user1).deposit(depositAmount);

            expect(await proxy.getBalance()).to.equal(depositAmount);
            expect(await proxy.totalDeposited()).to.equal(depositAmount);
        });

        it("should reject deposit from non-owner", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);
            await usdc.connect(user2).approve(await proxy.getAddress(), depositAmount);

            await expect(
                proxy.connect(user2).deposit(depositAmount)
            ).to.be.revertedWith("Only owner");
        });

        it("should withdraw without fee when no profit", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);

            // Deposit
            await usdc.connect(user1).approve(await proxy.getAddress(), depositAmount);
            await proxy.connect(user1).deposit(depositAmount);

            // Withdraw (no profit, no fee)
            const initialBalance = await usdc.balanceOf(user1.address);
            await proxy.connect(user1).withdraw(depositAmount);
            const finalBalance = await usdc.balanceOf(user1.address);

            expect(finalBalance - initialBalance).to.equal(depositAmount);
            expect(await proxy.totalFeesPaid()).to.equal(0);
        });

        it("should charge 10% fee on profit", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);
            const profit = ethers.parseUnits("100", 6); // 100 USDC profit

            // Deposit
            await usdc.connect(user1).approve(await proxy.getAddress(), depositAmount);
            await proxy.connect(user1).deposit(depositAmount);

            // Simulate profit (someone sends USDC to proxy)
            await usdc.mint(await proxy.getAddress(), profit);

            // Verify profit calculation
            const proxyProfit = await proxy.getProfit();
            expect(proxyProfit).to.equal(profit);

            // Withdraw all - should charge 10% of profit (10 USDC)
            const treasuryBalanceBefore = await treasury.getBalance();
            await proxy.connect(user1).withdrawAll();
            const treasuryBalanceAfter = await treasury.getBalance();

            // Treasury should receive 10 USDC (10% of 100 profit)
            const expectedFee = profit * 1000n / 10000n; // 10%
            expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedFee);
            expect(await proxy.totalFeesPaid()).to.equal(expectedFee);
        });

        it("should return correct stats", async function () {
            const depositAmount = ethers.parseUnits("1000", 6);

            await usdc.connect(user1).approve(await proxy.getAddress(), depositAmount);
            await proxy.connect(user1).deposit(depositAmount);

            const stats = await proxy.getStats();
            expect(stats.balance).to.equal(depositAmount);
            expect(stats.deposited).to.equal(depositAmount);
            expect(stats.withdrawn).to.equal(0);
            expect(stats.feesPaid).to.equal(0);
            expect(stats.profit).to.equal(0);
            expect(stats.currentFeePercent).to.equal(1000); // 10%
        });

        it("should block execution for non-allowlisted targets", async function () {
            await expect(
                proxy.connect(user1).execute(user2.address, "0x")
            ).to.be.revertedWith("Target not allowed");
        });

        it("should block execution when paused", async function () {
            const data = usdc.interface.encodeFunctionData("balanceOf", [user1.address]);
            await proxyFactory.pauseProxy(await proxy.getAddress());

            await expect(
                proxy.connect(user1).execute(await usdc.getAddress(), data)
            ).to.be.revertedWith("Execution paused");
        });
    });

    describe("PolyHunterExecutor", function () {
        it("should enforce allowlist and pause", async function () {
            await proxyFactory.connect(user1).createProxy(0);
            const proxyAddress = await proxyFactory.getUserProxy(user1.address);

            await executor.addWorker(user2.address);

            const data = usdc.interface.encodeFunctionData("balanceOf", [user1.address]);

            await expect(
                executor.connect(user2).executeOnProxy(proxyAddress, await usdc.getAddress(), data)
            ).to.be.revertedWith("Horus: Target not allowed");

            await executor.setAllowedTargets([await usdc.getAddress()], true);

            await executor.pauseExecution();
            await expect(
                executor.connect(user2).executeOnProxy(proxyAddress, await usdc.getAddress(), data)
            ).to.be.revertedWith("Horus: Paused");

            await executor.unpauseExecution();
            await executor.connect(user2).executeOnProxy(proxyAddress, await usdc.getAddress(), data);
        });
    });

    describe("Tier Upgrades", function () {
        it("should allow admin to upgrade user tier", async function () {
            // Create STARTER proxy
            await proxyFactory.connect(user1).createProxy(0);
            const proxyAddress = await proxyFactory.getUserProxy(user1.address);
            const proxy = await ethers.getContractAt("PolyHunterProxy", proxyAddress);

            // Initially 10% fee
            expect(await proxy.feePercent()).to.equal(1000);

            // Admin upgrades to PRO (5%)
            await proxyFactory.updateProxyTier(user1.address, 1);
            expect(await proxy.feePercent()).to.equal(500);

            // Admin upgrades to WHALE (2%)
            await proxyFactory.updateProxyTier(user1.address, 2);
            expect(await proxy.feePercent()).to.equal(200);
        });
    });
});
