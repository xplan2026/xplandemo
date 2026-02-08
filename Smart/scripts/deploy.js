const hre = require("hardhat");

async function main() {
  console.log("开始部署 AntiTheft 合约...");

  // 获取部署账户
  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户地址:", deployer.address);

  // 部署合约
  const AntiTheft = await hre.ethers.getContractFactory("AntiTheft");

  // 设置监护人地址（可以是 Worker 地址或管理地址）
  const guardianAddress = "0x2a71e200d13558631831c3e78e88afde8464f761"; // 安全地址B

  console.log("监护人地址:", guardianAddress);
  const antiTheft = await AntiTheft.deploy(guardianAddress);
  await antiTheft.deployed();

  console.log("AntiTheft 合约已部署到:", antiTheft.address);

  // 验证部署
  console.log("\n验证部署参数:");
  console.log("- Owner:", await antiTheft.owner());
  console.log("- Guardian:", await antiTheft.guardian());
  console.log("- Paused:", await antiTheft.paused());
  console.log("- Emergency Mode:", await antiTheft.emergencyMode());

  // 保存部署信息
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: antiTheft.address,
    deployer: deployer.address,
    guardian: guardianAddress,
    deployTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  console.log("\n部署信息:", JSON.stringify(deploymentInfo, null, 2));

  return antiTheft;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
