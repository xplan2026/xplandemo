# SSH Key 配置指南

本文档详细说明如何配�?SSH Key 以实现无密码登录 Ubuntu 服务器（182.254.180.26）�?

---

## 📋 目录

1. [本地生成 SSH Key](#1-本地生成-ssh-key)
2. [配置服务�?SSH Key](#2-配置服务�?ssh-key)
3. [配置 GitHub Actions SSH](#3-配置-github-actions-ssh)
4. [测试 SSH 连接](#4-测试-ssh-连接)
5. [安全配置](#5-安全配置)
6. [常见问题](#6-常见问题)

---

## 1. 本地生成 SSH Key

### 步骤 1.1：生成新�?SSH Key

在本�?Windows 机器上打开 PowerShell �?Git Bash�?

```bash
# 生成 ED25519 密钥（推荐）
ssh-keygen -t ed25519 -C "xplan2026@163.com" -f ~/.ssh/xplan_key

# 如果系统不支�?ED25519，使�?RSA
ssh-keygen -t rsa -b 4096 -C "xplan2026@163.com" -f ~/.ssh/xplan_key
```

**参数说明**:
- `-t`: 密钥类型（ed25519 �?rsa�?
- `-b`: 密钥位数（仅 RSA 需要，4096 位）
- `-C`: 注释（通常是邮箱）
- `-f`: 输出文件�?

### 步骤 1.2：设置密钥密码（可选）

系统会提示输入密码：
- **留空**：不设置密码，适合自动化部�?
- **输入密码**：需要密码才能使用密钥，更安�?

```
Enter passphrase (empty for no passphrase): [直接回车或输入密码]
Enter same passphrase again: [再次输入密码]
```

### 步骤 1.3：确认生成成�?

```bash
# 查看生成的密钥文�?
ls ~/.ssh/xplan_key*

# 应该看到�?
# xplan_key      # 私钥（保密！�?
# xplan_key.pub  # 公钥（可分享�?
```

---

## 2. 配置服务�?SSH Key

### 步骤 2.1：连接到服务�?

```bash
# 使用密码登录（首次）
ssh ubuntu@182.254.180.26
```

输入 root 用户密码后登录�?

### 步骤 2.2：在服务器上创建 .ssh 目录

```bash
# 创建 .ssh 目录（如果不存在�?
mkdir -p ~/.ssh

# 设置正确的权�?
chmod 700 ~/.ssh
```

### 步骤 2.3：复制公钥到服务�?

**方法 A：从本地复制（推荐）**

```bash
# 在本�?PowerShell �?Git Bash 中执�?
cat ~/.ssh/xplan_key.pub | ssh ubuntu@182.254.180.26 "cat >> ~/.ssh/authorized_keys"
```

**方法 B：手动添�?*

1. 在本地查看公钥内容：
   ```bash
   cat ~/.ssh/xplan_key.pub
   ```

2. 复制输出的内容（类似：`ssh-ed25519 AAAA... xplan2026@163.com`�?

3. 在服务器上编�?authorized_keys�?
   ```bash
   nano ~/.ssh/authorized_keys
   ```

4. 粘贴公钥内容，保存并退出（Ctrl+O, Enter, Ctrl+X�?

### 步骤 2.4：设置正确的权限

```bash
# 在服务器上执�?
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# 重启 SSH 服务
systemctl restart sshd
```

### 步骤 2.5：验�?SSH Key 配置

```bash
# 在服务器上检查公钥是否添加成�?
cat ~/.ssh/authorized_keys
```

---

## 3. 配置 GitHub Actions SSH

### 步骤 3.1：读取私钥内�?

**在本地机器上**�?

```bash
# Windows PowerShell
Get-Content $env:USERPROFILE\.ssh\xplan_key

# 或使�?cat
cat ~/.ssh/xplan_key
```

复制完整的私钥内容（包括 `-----BEGIN ...` �?`-----END ...` 行）�?

### 步骤 3.2：配�?GitHub Secrets

1. 访问 GitHub 仓库：https://github.com/xplan2026/xplandemo/settings/secrets/actions

2. 点击 "New repository secret"

3. 添加以下 Secrets�?

#### Secret 1: `SSH_PRIVATE_KEY`

```
Name: SSH_PRIVATE_KEY
Value: [粘贴完整的私钥内容]
```

**注意**�?
- 必须包含所有的换行�?
- 不要删除或修改任何内�?
- 私钥�?`-----BEGIN` 开头，`-----END` 结尾

#### Secret 2: `SSH_HOST`

```
Name: SSH_HOST
Value: 182.254.180.26
```

#### Secret 3: `SSH_USER`

```
Name: SSH_USER
Value: root
```

### 步骤 3.3：配置本�?SSH Config（可选）

为了更方便地连接服务器，可以在本地配�?SSH�?

```bash
# 编辑 SSH 配置文件
nano ~/.ssh/config
```

添加以下内容�?

```
Host xplan-server
    HostName 182.254.180.26
    User root
    IdentityFile ~/.ssh/xplan_key
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

现在可以使用简短的命令连接�?

```bash
ssh xplan-server
```

---

## 4. 测试 SSH 连接

### 测试 4.1：本地测�?SSH Key 登录

```bash
# 使用密钥登录（应该不需要密码）
ssh -i ~/.ssh/xplan_key root@182.254.180.26

# 或者如果配置了 SSH Config
ssh xplan-server
```

如果成功登录，说�?SSH Key 配置正确�?

### 测试 4.2：测�?GitHub Actions SSH

创建一个测试工作流�?

```yaml
name: Test SSH Connection

on:
  workflow_dispatch:

jobs:
  test-ssh:
    runs-on: ubuntu-latest
    steps:
      - name: Test SSH Connection
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            echo "SSH connection successful!"
            hostname
            whoami
            uptime
```

�?GitHub 仓库中：
1. 创建 `.github/workflows/test-ssh.yml`
2. 提交并推�?
3. �?Actions 标签页手动触发工作流
4. 查看是否成功连接到服务器

---

## 5. 安全配置

### 5.1：禁用密码登�?

**在服务器�?*�?

```bash
# 编辑 SSH 配置
nano /etc/ssh/sshd_config
```

修改以下配置�?

```
# 禁用密码登录
PasswordAuthentication no

# 禁用 root 密码登录
PermitRootLogin prohibit-password

# 只允许密钥认�?
PubkeyAuthentication yes
```

**重要**�?
- 确保 SSH Key 配置正确后再禁用密码登录
- 否则可能无法登录服务器！

重启 SSH 服务�?

```bash
systemctl restart sshd
```

### 5.2：配置防火墙

```bash
# 允许 SSH
ufw allow 22/tcp

# 启用防火�?
ufw enable

# 查看状�?
ufw status
```

### 5.3：定期更�?SSH Key

建议�?3-6 个月更换一�?SSH Key�?

```bash
# 生成新密�?
ssh-keygen -t ed25519 -C "xplan2026@163.com" -f ~/.ssh/xplan_key_new

# 添加到服务器
cat ~/.ssh/xplan_key_new.pub | ssh ubuntu@182.254.180.26 "cat >> ~/.ssh/authorized_keys"

# 测试新密�?
ssh -i ~/.ssh/xplan_key_new root@182.254.180.26

# 删除旧密�?
# 在服务器上：�?authorized_keys 中删除旧公钥
# 在本地上：删除旧密钥文件
rm ~/.ssh/xplan_key
```

---

## 6. 常见问题

### 问题 1：Permission denied (publickey)

**错误信息**�?
```
Permission denied (publickey).
```

**解决方案**�?

1. 检查私钥权限：
   ```bash
   chmod 600 ~/.ssh/xplan_key
   ```

2. 检查服务器上公钥是否存在：
   ```bash
   ssh ubuntu@182.254.180.26 "cat ~/.ssh/authorized_keys"
   ```

3. 检�?SSH 配置�?
   ```bash
   ssh -v root@182.254.180.26
   ```

4. 确认使用的私钥正确：
   ```bash
   ssh -i ~/.ssh/xplan_key root@182.254.180.26
   ```

### 问题 2：私钥格式错�?

**错误信息**�?
```
Load key "xplan_key": invalid format
```

**解决方案**�?

1. 确认私钥�?PEM 格式�?
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   ...
   -----END OPENSSH PRIVATE KEY-----
   ```

2. 如果�?RSA 密钥，格式应该是�?
   ```
   -----BEGIN RSA PRIVATE KEY-----
   ...
   -----END RSA PRIVATE KEY-----
   ```

3. 检查文件是否有换行符：
   ```bash
   cat ~/.ssh/xplan_key
   ```

### 问题 3：GitHub Actions 连接失败

**错误信息**�?
```
Error: Permission denied (publickey).
```

**解决方案**�?

1. 确认 GitHub Secrets 配置正确�?
   - 检�?`SSH_PRIVATE_KEY` 是否完整
   - 检�?`SSH_HOST` �?`SSH_USER` 是否正确

2. �?GitHub Actions 中测试连接：
   ```yaml
   - name: Test SSH
     run: |
       mkdir -p ~/.ssh
       echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_rsa
       chmod 600 ~/.ssh/id_rsa
       ssh -o StrictHostKeyChecking=no root@182.254.180.26 "hostname"
   ```

3. 检查服务器防火墙：
   ```bash
   ufw status
   ```

### 问题 4：无法禁用密码登�?

**错误信息**�?
```
Connection refused
```

**解决方案**�?

1. 在禁用密码登录前，确�?SSH Key 正常工作
2. 保留一个有效的 SSH Key 作为备用
3. 如果无法登录，可以通过云服务商控制台重置密�?

---

## 📝 配置清单

- [ ] 本地生成 SSH Key（ed25519 �?RSA 4096�?
- [ ] 公钥添加到服务器 `~/.ssh/authorized_keys`
- [ ] 设置正确的权限（700, 600�?
- [ ] 测试 SSH Key 登录成功
- [ ] 配置 GitHub Secrets（SSH_PRIVATE_KEY, SSH_HOST, SSH_USER�?
- [ ] 测试 GitHub Actions SSH 连接
- [ ] 禁用密码登录（可选，但推荐）
- [ ] 配置防火墙规�?
- [ ] 定期更换 SSH Key

---

## 🔐 安全最佳实�?

1. **使用强加密算�?*
   - 优先使用 ED25519
   - 如果使用 RSA，至�?4096 �?

2. **保护私钥**
   - 不要分享私钥
   - 设置私钥密码（可选）
   - 删除不需要的密钥

3. **定期更换密钥**
   - �?3-6 个月更换一�?
   - 删除不使用的旧密�?

4. **监控登录日志**
   ```bash
   # 查看最近的登录记录
   last -n 20

   # 查看 SSH 日志
   tail -f /var/log/auth.log
   ```

5. **使用防火�?*
   - 只开放必要的端口
   - 限制 IP 访问（如果可能）

---

**文档创建日期**: 2026-02-08
**服务�?IP**: 182.254.180.26
**适用系统**: Ubuntu 20.04, Windows 10/11
