# Ship It 2026 — Deployment & Operations Guide

This document covers everything needed to deploy, manage, and maintain the Ship It 2026 app on AWS EC2.

---

## 1. GitHub Setup

The repo lives at **https://github.com/ryan65/shipit-2026**

### Visibility
- The repo is **public** — anyone can clone and read it
- Only invited collaborators can push changes

### Adding a Collaborator
1. Go to https://github.com/ryan65/shipit-2026/settings/access
2. Click **Add people**
3. Enter their GitHub username
4. Set role to **Collaborator**
5. They receive an email invite to accept

### Dedicated GitHub Account (SSH isolation)
The repo is managed under the `ryan65` GitHub account, isolated from other credentials via a dedicated SSH key and host alias:

```
# ~/.ssh/config entry
Host github-shipit
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_shipit2026
  IdentitiesOnly yes
```

Push/pull from your local machine using:
```bash
git push   # uses github-shipit alias automatically
git pull
```

---

## 2. AWS EC2 — Launching an Instance

### Recommended Settings
| Setting | Value |
|---------|-------|
| AMI | Ubuntu 24.04 LTS |
| Instance type | t2.micro (free tier eligible) |
| Key pair | Create new → ED25519 → `.pem` format |
| Allow HTTP | Yes |
| Allow HTTPS | Yes |

### Security Group — Inbound Rules
Restrict access to known IPs only. Find your IP with:
```bash
curl ifconfig.me
```

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | `<your-ip>/32` |
| Custom TCP | 3000 | `<your-ip>/32` (add team IPs as needed) |

> **Note:** Use `/32` after the IP to mean "exactly this one IP address".

---

## 3. Connecting to the Instance

### First time — protect the PEM key
```bash
mkdir -p ~/.ssh/aws
mv ~/Downloads/shipit-2026-key.pem ~/.ssh/aws/
chmod 400 ~/.ssh/aws/shipit-2026-key.pem
```

### SSH in
```bash
ssh -i ~/.ssh/aws/shipit-2026-key.pem ubuntu@<YOUR_EC2_PUBLIC_IP>
```

> **Important:** Ubuntu uses `ubuntu` as the default SSH user (not `ec2-user` or `root`)

---

## 4. Server Setup (First Time Only)

Run these commands once after connecting to a fresh EC2 instance.

### Install Node.js 22 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
```

### Install Git
```bash
sudo apt-get install -y git
```

### Clone the repo and install dependencies
```bash
git clone https://github.com/ryan65/shipit-2026.git
cd shipit-2026/aut
npm install
```

> **Note:** `data/tasks.json` is auto-created on first run — no manual setup needed.

---

## 5. PM2 — Running the App Persistently

### What is PM2 and why is it needed?

Without PM2:
```
You → SSH in → run "npm start" → app runs
You → close SSH → app dies
```

With PM2:
```
You → SSH in → run "pm2 start server.js" → PM2 takes ownership
You → close SSH → PM2 keeps running → app stays alive
```

PM2 is a process manager that runs independently of your SSH session and survives reboots.

### Initial Setup

```bash
# 1. Install PM2 globally
sudo npm install -g pm2

# 2. Start the app under PM2
pm2 start server.js --name shipit-2026

# 3. Generate the systemd startup script
pm2 startup
```

> After running `pm2 startup`, it prints a command — copy and run it. It looks like:
> ```
> sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
> ```

```bash
# 4. Save the process list so PM2 restores it after a reboot
pm2 save
```

### What each command does

| Command | What it does |
|---------|-------------|
| `sudo npm install -g pm2` | Installs PM2 on the machine |
| `pm2 start server.js --name shipit-2026` | Hands the app to PM2 to manage |
| `pm2 startup` | Registers PM2 as a systemd service so it starts on boot |
| `pm2 save` | Saves the current app list so PM2 restores it after reboot |

### How the OS knows to start PM2 on boot

`pm2 startup` creates a systemd service file at `/etc/systemd/system/pm2-ubuntu.service`. On every boot:

```
EC2 powers on
  → Ubuntu kernel loads
    → systemd starts (the OS process manager)
      → systemd reads pm2-ubuntu.service
        → systemd starts PM2
          → PM2 reads ~/.pm2/dump.pm2 (saved by pm2 save)
            → PM2 restarts your app
              → shipit-2026 is live ✅
```

---

## 6. Updating the App After Code Changes

### Full update (when package.json may have changed)
```bash
cd ~/shipit-2026/aut
git pull
npm install
pm2 restart shipit-2026
```

### Quick update (code/HTML changes only)
```bash
cd ~/shipit-2026/aut
git pull && pm2 restart shipit-2026
```

---

## 7. PM2 Command Reference

| Command | What it does |
|---------|-------------|
| `pm2 status` | Show all running processes and their status |
| `pm2 start shipit-2026` | Start the app |
| `pm2 stop shipit-2026` | Stop the app (PM2 still running) |
| `pm2 restart shipit-2026` | Stop then start |
| `pm2 reload shipit-2026` | Zero-downtime restart |
| `pm2 logs shipit-2026` | Live log tail |
| `pm2 logs shipit-2026 --lines 50` | Last 50 log lines |
| `pm2 save` | Save current process list for reboot persistence |

---

## 8. Security Notes

### Current setup
- Traffic runs over **HTTP on port 3000**
- Access is restricted to specific IPs via the EC2 Security Group
- This is suitable for internal/team use

### To enable HTTPS (future)
Full HTTPS requires:
1. A **domain name** (SSL certs cannot be issued for raw IPs)
2. **Nginx** as a reverse proxy (handles port 443, forwards to port 3000)
3. A **free SSL cert** via Let's Encrypt + Certbot

**Alternative for internal use:** A self-signed certificate — encrypts traffic but browsers show a one-time warning. Suitable for team tools without a public domain.
