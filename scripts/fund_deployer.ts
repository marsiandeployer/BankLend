import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  const helperKey = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'string'],
      [process.env.DEPLOYER_PRIVATE_KEY || '0x' + '1'.repeat(64), 'helper']
    )
  );
  const helper = new ethers.Wallet(helperKey, provider);
  
  console.log("Deployer:", deployer.address, "bal:", ethers.formatEther(await provider.getBalance(deployer.address)));
  console.log("Helper:", helper.address, "bal:", ethers.formatEther(await provider.getBalance(helper.address)));
  
  const helperBal = await provider.getBalance(helper.address);
  const sendAmt = helperBal - ethers.parseEther("0.001"); // keep 0.001 for gas
  
  if (sendAmt > 0n) {
    const tx = await helper.sendTransaction({ to: deployer.address, value: sendAmt });
    await tx.wait();
    console.log("Transferred", ethers.formatEther(sendAmt), "tBNB to deployer");
    console.log("Deployer new bal:", ethers.formatEther(await provider.getBalance(deployer.address)));
  }
}

main().catch(console.error);
