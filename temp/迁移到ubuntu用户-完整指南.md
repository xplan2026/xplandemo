# 迁移到 ubuntu 用户 - 完整指南

本文档提供将服务器从 `root` 用户迁移到 `ubuntu` 用户（带 sudo 权限）的完整步骤。

---

## 📋 已完成的本地文件修改

以下文件已自动修改，将 `root` 用户改为 `ubuntu` 用户：

### Skill 文件
- ✅ `.codebuddy/skills/ubuntu-server-manager/SKILL.md`
- ✅ `.codebuddy/skills/ubuntu-server-manager/README.md`
- ✅ `.codebuddy/skills/ubuntu-server-manager/references/server-architecture.md`
- ✅ `.codebuddy/skills/ubuntu-server-manager/references/troubleshooting-guide.md`

### 服务器脚本
- ✅ `server-configs/install-server-environment.sh`
- ✅ `server-configs/check-server-health.sh` (不存在，跳过)

### 文档
- ✅ `temp/SSH-Key-配置指南.md`

### GitHub Actions
- ✅ `.github/workflows/deploy-worker.yml`
- ✅ `.github/workflows/deploy-frontend.yml`
- ✅ `.github/workflows/build-and-deploy-ipfs.yml`

---

## 🚀 服务器端配置步骤

### 步骤 1：连接到服务器

```bash
ssh -i ~/.ssh/xplan_server_key ubuntu@182.254.180.26
```

### 步骤 2：配置 ubuntu 用户权限

**方案 A：使用配置脚本（推荐）**

```bash
cd /tmp
git clone https://github.com/xplan2026/xplandemo.git
cd xplandemo
sudo bash server-configs/configure-ubuntu-user.sh
```

**方案 B：手动配置**

```bash
# 1. 创建必要的目录
sudo mkdir -p /opt/xplan
sudo mkdir -p /var/log/xplan
sudo mkdir -p /var/www/xplan-official-site
sudo mkdir -p /var/www/xplan-demosite

# 2. 设置目录权限
sudo chown -R ubuntu:www-data /var/www/
sudo chown -R ubuntu:ubuntu /opt/xplan/
sudo chown -R ubuntu:ubuntu /var/log/xplan/

# 3. 配置 sudo 权限
sudo usermod -aG sudo ubuntu

# 4. 配置 systemctl 免密码
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl" | sudo tee /etc/sudoers > /dev/null

# 5. 配置 SSH
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 步骤 3：验证配置

```bash
# 测试 sudo 权限
sudo systemctl status nginx

# 检查目录权限
ls -la /var/www/
ls -la /opt/xplan/

# 检查用户组
groups ubuntu
```

---

## ⚙️ GitHub Actions 配置

### 步骤 1：更新 GitHub Secrets

访问：https://github.com/xplan2026/xplandemo/settings/secrets/actions

更新以下 Secret：

```
SSH_USER 从 "root" 改为 "ubuntu"
```

**注意**：`SSH_PRIVATE_KEY` 保持不变（使用现有的私钥）

### 步骤 2：验证 Secrets 配置

确认以下 Secrets 已配置：

| Secret 名称 | 值 |
|-------------|-----|
| `SSH_PRIVATE_KEY` | [私钥内容，保持不变] |
| `SSH_HOST` | `182.254.180.26` |
| `SSH_USER` | `ubuntu` ⬅️ **修改** |
| `CLOUDFLARE_API_TOKEN` | [你的 Token] |
| `CLOUDFLARE_ACCOUNT_ID` | [你的 Account ID] |
| `PINATA_API_KEY` | [你的 Key] |
| `PINATA_API_SECRET` | [你的 Secret] |
| `PINATA_JWT` | [你的 JWT] |

---

## 🧪 测试部署

### 测试 1：手动部署

```bash
# 在服务器上
cd /tmp/xplandemo
bash server-configs/deploy-frontend.sh
```

如果成功，说明服务器配置正确。

### 测试 2：GitHub Actions 自动部署

```bash
# 在本地推送代码
git add .
git commit -m "测试 ubuntu 用户部署"
git push origin master
```

在 GitHub Actions 中查看部署是否成功。

---

## ✅ 验证清单

### 服务器配置

- [ ] ubuntu 用户有 sudo 权限
- [ ] ubuntu 用户可以免密码执行 `systemctl`
- [ ] Web 目录权限：`ubuntu:www-data`
- [ ] 项目目录权限：`ubuntu:ubuntu`
- [ ] 日志目录权限：`ubuntu:ubuntu`

### GitHub Actions

- [ ] SSH_USER 已更新为 `ubuntu`
- [ ] SSH_PRIVATE_KEY 保持不变
- [ ] 其他 Secrets 配置正确

### 部署测试

- [ ] 手动部署成功
- [ ] GitHub Actions 自动部署成功
- [ ] 前端可以访问

---

## 🔍 故障排查

### 问题 1：sudo 权限不足

**错误信息**：
```
sudo: no tty present and no askpass program specified
```

**解决方案**：
```bash
# 配置免密码 sudo
echo "ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl" | sudo tee /etc/sudoers > /dev/null
```

### 问题 2：目录权限错误

**错误信息**：
```
Permission denied
```

**解决方案**：
```bash
sudo chown -R ubuntu:www-data /var/www/
sudo chown -R ubuntu:ubuntu /opt/xplan/
sudo chown -R ubuntu:ubuntu /var/log/xplan/
```

### 问题 3：GitHub Actions 部署失败

**错误信息**：
```
Permission denied (publickey)
```

**解决方案**：
1. 确认 GitHub Secrets 中的 `SSH_USER` 是 `ubuntu`
2. 确认 `SSH_PRIVATE_KEY` 正确
3. 测试 SSH 连接：
   ```bash
   ssh -i ~/.ssh/xplan_server_key ubuntu@182.254.180.26
   ```

---

## 📊 权限对比

### 迁移前（root 用户）

| 路径 | 所有者 | 权限 |
|------|--------|--------|
| `/var/www/` | root:www-data | 755 |
| `/opt/xplan/` | root:root | 755 |
| `/var/log/xplan/` | root:root | 755 |

### 迁移后（ubuntu 用户）

| 路径 | 所有者 | 权限 |
|------|--------|--------|
| `/var/www/` | ubuntu:www-data | 755 |
| `/opt/xplan/` | ubuntu:ubuntu | 755 |
| `/var/log/xplan/` | ubuntu:ubuntu | 755 |

---

## 🎯 快速命令

### 在服务器上执行

```bash
# 1. 克隆仓库
cd /tmp
git clone https://github.com/xplan2026/xplandemo.git
cd xplandemo

# 2. 配置 ubuntu 用户
sudo bash server-configs/configure-ubuntu-user.sh

# 3. 验证配置
sudo systemctl status nginx
ls -la /var/www/
```

### 在本地执行

```bash
# 1. 测试 SSH 连接
ssh -i ~/.ssh/xplan_server_key ubuntu@182.254.180.26 "echo 'OK'"

# 2. 推送代码测试 GitHub Actions
git add .
git commit -m "迁移到 ubuntu 用户"
git push origin master
```

---

## 📚 相关文档

- **Ubuntu Server Manager Skill**: `.codebuddy/skills/ubuntu-server-manager/`
- **SSH Key 配置指南**: `temp/SSH-Key-配置指南.md`
- **服务器环境安装指南**: `temp/服务器环境安装-快速开始.md`

---

## 🎉 迁移完成！

完成以上步骤后：

1. ✅ 所有本地文件已更新为 `ubuntu` 用户
2. ✅ 服务器权限已配置
3. ✅ GitHub Actions 已更新
4. ✅ 部署可以正常工作

现在可以使用 `ubuntu` 用户进行所有操作，既安全又方便！

---

**文档创建日期**: 2026-02-08
**服务器 IP**: 182.254.180.26
**操作系统**: Ubuntu 20.04
**目标用户**: ubuntu (with sudo)
