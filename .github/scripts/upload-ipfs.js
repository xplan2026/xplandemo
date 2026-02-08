const fs = require('fs');
const path = require('path');
const { create } = require('@pinata/sdk');

async function uploadToIPFS() {
  try {
    const pinata = new create({
      pinataJwtKey: process.env.PINATA_JWT
    });

    console.log('开始上传到 IPFS...');

    // 上传整个 build 目录
    const uploadResponse = await pinata.pinFileToIPFS(
      path.join(__dirname, '../../build'),
      {
        pinataMetadata: {
          name: `xplan-demo-${process.env.GITHUB_SHA || 'latest'}`,
          keyvalues: {
            version: process.env.GITHUB_REF_NAME || 'unknown',
            commit: process.env.GITHUB_SHA || 'unknown',
            timestamp: new Date().toISOString()
          }
        },
        pinataOptions: {
          cidVersion: 1
        }
      }
    );

    console.log('✅ IPFS CID:', uploadResponse.IpfsHash);
    console.log('🌐 IPFS Gateway: https://gateway.pinata.cloud/ipfs/' + uploadResponse.IpfsHash);
    console.log('🔗 Dweb Link: https://ipfs.io/ipfs/' + uploadResponse.IpfsHash);

    // 保存 CID 到文件供后续步骤使用
    fs.writeFileSync('ipfs-cid.txt', uploadResponse.IpfsHash);

    // 输出到 GitHub Actions
    console.log(`::set-output name=ipfs_cid::${uploadResponse.IpfsHash}`);

    return uploadResponse.IpfsHash;

  } catch (error) {
    console.error('❌ 上传到 IPFS 失败:', error);
    process.exit(1);
  }
}

uploadToIPFS()
  .then(cid => {
    console.log('上传完成，CID:', cid);
    process.exit(0);
  })
  .catch(error => {
    console.error('错误:', error);
    process.exit(1);
  });
