# Teachific Replication - Quick Start Guide

Get your failover system running in 5 minutes.

## 🚀 Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
cd /home/ubuntu/scorm-host
npm install mysql2 @aws-sdk/client-s3
```

### Step 2: Initial Data Migration
```bash
node scripts/migrate-to-railway.mjs
```

**Expected output:**
```
🔄 Starting data migration from Manus to Railway...
📊 Found 45 tables in Manus
📦 Migrating table: users
   ✓ Copied 5 rows
...
✅ Migration complete!
```

### Step 3: Verify Health
```bash
node scripts/failover-monitor.mjs check
```

**Expected output:**
```
📊 Health Check: 2026-05-11T12:00:00.000Z
─────────────────────────────────────────
🔍 Checking Manus...
   Database: ✅ healthy
   App: ✅ healthy

🔍 Checking Railway...
   Database: ✅ healthy
   App: ✅ healthy

✅ All systems operational
```

### Step 4: Enable Automated Sync (Choose One)

#### Option A: GitHub Actions (Recommended)
1. Add these secrets to GitHub repository:
   - `MANUS_DB_USER`: `2mhhtxpXA9Esras.7d3251b537d6`
   - `MANUS_DB_PASS`: `ps2dxQvK5a32w3zvii4v`
   - `MANUS_DB_NAME`: `fJXMsdmk8vcb8V4GDt37f6`
   - `RAILWAY_DB_HOST`: `roundhouse.proxy.rlwy.net`
   - `RAILWAY_DB_PORT`: `25456`
   - `RAILWAY_DB_USER`: `root`
   - `RAILWAY_DB_PASS`: `sLDKCIPwEFYclujJlwXfKtJSzXHBulcV`
   - `RAILWAY_DB_NAME`: `railway`
   - `CLOUDFLARE_ACCOUNT_ID`: `926e046281eccc776864fd105e322ac8`
   - `CLOUDFLARE_R2_BUCKET`: `teachific`
   - `CLOUDFLARE_R2_ACCESS_KEY`: `cfat_fbBYg0l4UlQGBEfT6PrBebZh3VPjUGKgsgDQ2Xy0f1e6f4af`
   - `MANUS_S3_ACCESS_KEY`: (your Manus S3 key)
   - `MANUS_S3_SECRET_KEY`: (your Manus S3 secret)

2. Workflow will run automatically every 5 minutes

#### Option B: Cron Jobs (Local)
```bash
bash scripts/setup-cron.sh
```

This sets up:
- Database sync every 5 minutes
- Health check every 10 minutes
- R2 bucket sync every 30 minutes

#### Option C: Systemd Services (Local)
```bash
sudo cp scripts/teachific-sync.service /etc/systemd/system/
sudo cp scripts/teachific-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable teachific-sync.service
sudo systemctl enable teachific-monitor.service
sudo systemctl start teachific-sync.service
sudo systemctl start teachific-monitor.service
```

### Step 5: Test Failover
```bash
# Run the failover test
bash FAILOVER_TEST.md
```

---

## 📊 Monitoring

### Check sync status
```bash
node scripts/failover-monitor.mjs check
```

### View logs
```bash
# GitHub Actions
# Go to: https://github.com/TeachificApp/teachificapp/actions

# Cron jobs
tail -f /var/log/teachific/sync.log

# Systemd services
journalctl -u teachific-sync -f
journalctl -u teachific-monitor -f
```

### Manual sync (if needed)
```bash
node scripts/migrate-to-railway.mjs
```

---

## 🚨 If Manus Goes Down

1. **Verify failure:**
   ```bash
   node scripts/failover-monitor.mjs check
   ```

2. **Check Railway is ready:**
   ```bash
   curl https://teachific-app.railway.app/api/health
   ```

3. **Update Cloudflare DNS:**
   - Go to Cloudflare dashboard
   - Change CNAME records to point to Railway
   - Wait 5-10 minutes for propagation

4. **Test application:**
   - Login: ✅
   - Courses: ✅
   - Media: ✅

5. **Switch back when Manus recovers:**
   - Update DNS back to Manus
   - Verify all systems

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `replication-config.json` | Database & R2 credentials |
| `scripts/migrate-to-railway.mjs` | One-time data migration |
| `scripts/setup-replication.mjs` | MySQL binary log replication setup |
| `scripts/sync-r2-bucket.mjs` | Continuous R2 bucket sync |
| `scripts/failover-monitor.mjs` | Health checks & monitoring |
| `scripts/setup-cron.sh` | Cron job setup |
| `scripts/teachific-sync.service` | Systemd sync service |
| `scripts/teachific-monitor.service` | Systemd monitor service |
| `.github/workflows/sync-replica.yml` | GitHub Actions workflow |
| `REPLICATION_SETUP.md` | Detailed setup guide |
| `FAILOVER_TEST.md` | Testing procedures |

---

## ⚠️ Important Notes

1. **Keep credentials secure:**
   - Don't commit `replication-config.json` to Git
   - Use GitHub Actions secrets for automation
   - Rotate credentials regularly

2. **Monitor replication lag:**
   - Lag should be < 5 seconds
   - Check health status regularly
   - Alert if lag exceeds 1 minute

3. **Test regularly:**
   - Run failover tests monthly
   - Verify data consistency
   - Test DNS failover process

4. **Document changes:**
   - When you add new tables, update migration scripts
   - Keep this guide up to date
   - Document any customizations

---

## 🆘 Troubleshooting

### "Connection refused" error
```bash
# Verify network connectivity
ping gateway04.us-east-1.prod.aws.tidbcloud.com
ping roundhouse.proxy.rlwy.net

# Check credentials in replication-config.json
cat replication-config.json
```

### "Data mismatch" error
```bash
# Run sync again
node scripts/migrate-to-railway.mjs

# Compare row counts
mysql -h gateway04.us-east-1.prod.aws.tidbcloud.com -u 2mhhtxpXA9Esras.7d3251b537d6 -p fJXMsdmk8vcb8V4GDt37f6 \
  -e "SELECT COUNT(*) FROM users;"

mysql -h roundhouse.proxy.rlwy.net -u root -p railway \
  -e "SELECT COUNT(*) FROM users;"
```

### "Health check failed" error
```bash
# Check Manus
curl https://scormhost-fjxmsdmk.manus.space/api/health

# Check Railway
curl https://teachific-app.railway.app/api/health

# View detailed logs
node scripts/failover-monitor.mjs check
```

---

## 📚 Full Documentation

For detailed setup and troubleshooting:
- See `REPLICATION_SETUP.md` for complete guide
- See `FAILOVER_TEST.md` for testing procedures
- Check logs in `/var/log/teachific/`

---

## ✅ Verification Checklist

- [ ] Dependencies installed
- [ ] Initial migration completed
- [ ] Health check passes
- [ ] Automated sync enabled (GitHub Actions or Cron)
- [ ] Monitoring is running
- [ ] Failover tests pass
- [ ] Team trained on failover procedure
- [ ] Documentation reviewed

---

**You're all set!** Your Teachific instance now has automatic failover protection. 🎉
