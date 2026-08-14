For the org-wide Manus → Railway process (every GitHub-synced app), see [docs/MANUS_TO_RAILWAY.md](docs/MANUS_TO_RAILWAY.md).

# Teachific Replication & Failover Setup

This document outlines the real-time replication system that keeps your Railway backup in sync with your primary Manus deployment.

## Overview

**Goal:** If Manus becomes unavailable, you can quickly failover to Railway with zero data loss.

**Architecture:**
- **Primary:** Manus (TiDB) + Manus S3 storage
- **Backup:** Railway (MySQL) + Cloudflare R2 storage
- **Sync:** Continuous real-time replication

## Credentials

Copy `replication-config.example.json` to `replication-config.json` (gitignored) or set:

- `MANUS_DB_HOST` / `MANUS_DB_PORT` / `MANUS_DB_USER` / `MANUS_DB_PASS` / `MANUS_DB_NAME`
- `RAILWAY_DB_HOST` / `RAILWAY_DB_PORT` / `RAILWAY_DB_USER` / `RAILWAY_DB_PASS` / `RAILWAY_DB_NAME`
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_R2_BUCKET` / `CLOUDFLARE_R2_ACCESS_KEY` / `CLOUDFLARE_R2_SECRET_KEY` / `CLOUDFLARE_R2_ENDPOINT`

Do not commit live passwords. Rotate any secret that was previously stored in git.

## Setup Steps

### Phase 1: Initial Data Migration (One-time)

**1. Install dependencies:**
```bash
cd /home/ubuntu/scorm-host
npm install mysql2
```

**2. Run initial migration:**
```bash
node scripts/migrate-to-railway.mjs
```

This will:
- Connect to Manus TiDB
- Dump all tables and data
- Create tables in Railway MySQL
- Copy all data to Railway

**Expected output:**
```
🔄 Starting data migration from Manus to Railway...

📊 Found 45 tables in Manus

🧹 Clearing Railway database...
📦 Migrating table: users
   ✓ Copied 5 rows
📦 Migrating table: courses
   ✓ Copied 12 rows
...

✅ Migration complete!
```

### Phase 2: Continuous Replication (Ongoing)

#### Option A: MySQL Replication (Binary Log)

For true real-time replication, set up MySQL binary log replication:

**On Manus (TiDB):**
1. Enable binary logging (usually already enabled on TiDB Cloud)
2. Create a replication user:
```sql
CREATE USER 'replication'@'%' IDENTIFIED BY 'replication_password';
GRANT REPLICATION SLAVE ON *.* TO 'replication'@'%';
FLUSH PRIVILEGES;
```

**On Railway (MySQL):**
1. Configure as replica:
```sql
CHANGE MASTER TO
  MASTER_HOST='gateway04.us-east-1.prod.aws.tidbcloud.com',
  MASTER_PORT=4000,
  MASTER_USER='replication',
  MASTER_PASSWORD='replication_password',
  MASTER_LOG_FILE='mysql-bin.000001',
  MASTER_LOG_POS=154;

START SLAVE;
SHOW SLAVE STATUS\G
```

#### Option B: Application-Level Sync (Recommended for simplicity)

Use the provided sync scripts to replicate data at the application level:

**1. Set up environment variables:**
```bash
export MANUS_S3_BUCKET="teachific"
export AWS_ACCESS_KEY_ID="your_manus_s3_key"
export AWS_SECRET_ACCESS_KEY="your_manus_s3_secret"
export CLOUDFLARE_R2_SECRET_KEY="your_r2_secret"
```

**2. Run continuous R2 sync:**
```bash
node scripts/sync-r2-bucket.mjs --watch
```

This monitors Manus S3 and syncs new/updated files to Cloudflare R2 every 5 minutes.

**3. Set up database sync (cron job):**
```bash
# Add to crontab (every 5 minutes)
*/5 * * * * cd /home/ubuntu/scorm-host && node scripts/migrate-to-railway.mjs >> /var/log/teachific-sync.log 2>&1
```

Or run as a systemd service:
```ini
[Unit]
Description=Teachific Database Replication
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /home/ubuntu/scorm-host/scripts/migrate-to-railway.mjs
Restart=always
RestartSec=300
User=ubuntu

[Install]
WantedBy=multi-user.target
```

### Phase 3: Failover Monitoring

**1. Run health checks:**
```bash
# Single check
node scripts/failover-monitor.mjs check

# Continuous monitoring (every 60 seconds)
node scripts/failover-monitor.mjs monitor

# View last status
node scripts/failover-monitor.mjs status
```

**2. Set up monitoring alerts:**
```bash
# Run as background service
nohup node scripts/failover-monitor.mjs monitor > /var/log/teachific-monitor.log 2>&1 &
```

## Failover Process

### If Manus Goes Down

**Step 1: Verify Railway is in sync**
```bash
node scripts/failover-monitor.mjs check
```

**Step 2: Update DNS (Cloudflare)**

Point your domain to Railway:
```
CNAME www → railway-app.railway.app
CNAME * → railway-app.railway.app
```

**Step 3: Update environment variables**

On Railway, ensure these are set:
- `DATABASE_URL`: Railway MySQL connection string
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- All other secrets (see GitHub Actions secrets)

**Step 4: Test application**

Visit your domain and verify:
- ✅ Login works
- ✅ Courses load
- ✅ Media files display
- ✅ Payments work

**Step 5: Investigate Manus**

While Railway is serving traffic:
- Contact Manus support
- Check Manus status page
- Prepare to migrate back when Manus recovers

### Switching Back to Manus

Once Manus is recovered:

**Step 1: Verify Manus is healthy**
```bash
node scripts/failover-monitor.mjs check
```

**Step 2: Sync any new data from Railway to Manus**
```bash
# Manual backup of Railway data
mysqldump -h roundhouse.proxy.rlwy.net -u root -p railway > railway-backup.sql
```

**Step 3: Update DNS back to Manus**
```
CNAME www → teachific.app
CNAME * → teachific.app
```

**Step 4: Verify Manus is serving traffic**

## Monitoring & Alerts

### Health Check Endpoints

Both systems expose health endpoints:
- **Manus:** `https://scormhost-fjxmsdmk.manus.space/api/health`
- **Railway:** `https://teachific-app.railway.app/api/health`

### Sync Status

Check replication lag:
```bash
# On Railway
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_courses FROM courses;

# Compare with Manus
```

### Logs

- **Migration logs:** `/var/log/teachific-sync.log`
- **Monitor logs:** `/var/log/teachific-monitor.log`
- **Railway logs:** Railway dashboard → Deployments → Logs

## Troubleshooting

### Migration Fails

**Error: "Connection refused"**
- Verify network connectivity to Manus TiDB
- Check firewall rules
- Verify credentials in `replication-config.json`

**Error: "Foreign key constraint fails"**
- Disable foreign key checks during migration:
```sql
SET FOREIGN_KEY_CHECKS = 0;
```

### Replication Lag

If Railway falls behind:
1. Check network connectivity
2. Verify S3/R2 sync is running
3. Increase sync frequency
4. Monitor CPU/memory on Railway

### DNS Not Updating

If Cloudflare DNS doesn't update:
1. Clear Cloudflare cache
2. Wait for TTL (usually 5 minutes)
3. Verify CNAME records are correct
4. Check DNS propagation: `nslookup teachific.app`

## Best Practices

1. **Test failover regularly** - Don't wait for an emergency
2. **Monitor replication lag** - Set up alerts if lag exceeds 5 minutes
3. **Keep credentials secure** - Don't commit `replication-config.json` to Git
4. **Document changes** - When you add tables, update migration scripts
5. **Backup before migration** - Always backup Railway before running migration
6. **Test on staging first** - Verify scripts work before production failover

## Automation (Optional)

### GitHub Actions Workflow

Add this to `.github/workflows/sync-replica.yml`:

```yaml
name: Sync Railway Replica

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm install mysql2
      
      - name: Sync database
        run: node scripts/migrate-to-railway.mjs
        env:
          MANUS_DB_HOST: ${{ secrets.MANUS_DB_HOST }}
          MANUS_DB_USER: ${{ secrets.MANUS_DB_USER }}
          MANUS_DB_PASS: ${{ secrets.MANUS_DB_PASS }}
          RAILWAY_DB_HOST: ${{ secrets.RAILWAY_DB_HOST }}
          RAILWAY_DB_USER: ${{ secrets.RAILWAY_DB_USER }}
          RAILWAY_DB_PASS: ${{ secrets.RAILWAY_DB_PASS }}
```

## Support

For issues or questions:
1. Check logs: `tail -f /var/log/teachific-*.log`
2. Run health check: `node scripts/failover-monitor.mjs check`
3. Review this documentation
4. Contact support with logs attached
