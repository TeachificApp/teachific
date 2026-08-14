# Teachific Failover Testing Guide

This guide walks you through testing the failover system to ensure it works when you need it.

## Pre-Test Checklist

Before running any tests:

- [ ] All replication scripts are installed (`scripts/migrate-to-railway.mjs`, etc.)
- [ ] Initial data migration completed: `node scripts/migrate-to-railway.mjs`
- [ ] Cloudflare R2 bucket is created and accessible
- [ ] Railway MySQL database is running
- [ ] Both Manus and Railway are healthy: `node scripts/failover-monitor.mjs check`
- [ ] GitHub Actions secrets are configured
- [ ] DNS is currently pointing to Manus (primary)

## Test 1: Verify Data Sync

**Objective:** Ensure data is being replicated from Manus to Railway

**Steps:**

1. **Check current row counts:**
   ```bash
   # On Manus
   mysql -h "$MANUS_DB_HOST" -P "${MANUS_DB_PORT:-4000}" -u "$MANUS_DB_USER" -p"$MANUS_DB_PASS" "$MANUS_DB_NAME" \
     -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM courses;"
   
   # On Railway
   mysql -h "$RAILWAY_DB_HOST" -P "$RAILWAY_DB_PORT" -u "$RAILWAY_DB_USER" -p"$RAILWAY_DB_PASS" "$RAILWAY_DB_NAME" \
     -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM courses;"
   ```

2. **Run manual sync:**
   ```bash
   node scripts/migrate-to-railway.mjs
   ```

3. **Verify counts match:**
   - Row counts should be identical
   - Check multiple tables (users, courses, organizations, etc.)

**Expected Result:**
- ✅ Data is identical on both systems
- ✅ No errors during sync

---

## Test 2: Verify File Sync (R2)

**Objective:** Ensure files are being replicated to Cloudflare R2

**Steps:**

1. **Check current files in Manus S3:**
   ```bash
   aws s3 ls s3://teachific --recursive | wc -l
   ```

2. **Run R2 sync:**
   ```bash
   export AWS_ACCESS_KEY_ID="your_manus_s3_key"
   export AWS_SECRET_ACCESS_KEY="your_manus_s3_secret"
   export CLOUDFLARE_R2_SECRET_KEY="your_r2_secret"
   
   node scripts/sync-r2-bucket.mjs
   ```

3. **Verify files in Cloudflare R2:**
   ```bash
   # List files in R2 (via Cloudflare API or S3-compatible tools)
   aws s3 ls s3://teachific --recursive --endpoint-url https://926e046281eccc776864fd105e322ac8.r2.cloudflarestorage.com | wc -l
   ```

**Expected Result:**
- ✅ File counts match between Manus S3 and Cloudflare R2
- ✅ All media files are accessible

---

## Test 3: Health Check System

**Objective:** Verify monitoring detects system health correctly

**Steps:**

1. **Run single health check:**
   ```bash
   node scripts/failover-monitor.mjs check
   ```

2. **Verify output shows:**
   - Manus database: ✅ healthy
   - Manus app: ✅ healthy
   - Railway database: ✅ healthy
   - Railway app: ✅ healthy

3. **Start continuous monitoring:**
   ```bash
   node scripts/failover-monitor.mjs monitor
   # Press Ctrl+C after 5 checks
   ```

**Expected Result:**
- ✅ All systems show as healthy
- ✅ Monitoring runs without errors

---

## Test 4: Simulate Manus Failure

**Objective:** Test that the system detects when Manus is down

**Steps:**

1. **Temporarily block Manus connection:**
   ```bash
   # Add firewall rule to block Manus (requires sudo)
   sudo iptables -A OUTPUT -d gateway04.us-east-1.prod.aws.tidbcloud.com -j DROP
   ```

2. **Run health check:**
   ```bash
   node scripts/failover-monitor.mjs check
   ```

3. **Verify output shows:**
   - Manus database: ❌ unhealthy
   - Railway database: ✅ healthy
   - Status: "failover_needed"

4. **Remove firewall rule:**
   ```bash
   sudo iptables -D OUTPUT -d gateway04.us-east-1.prod.aws.tidbcloud.com -j DROP
   ```

5. **Verify Manus recovers:**
   ```bash
   node scripts/failover-monitor.mjs check
   ```

**Expected Result:**
- ✅ System correctly detects Manus failure
- ✅ Railway remains healthy
- ✅ System recovers when Manus comes back online

---

## Test 5: Manual Failover to Railway

**Objective:** Test the complete failover process

**Prerequisites:**
- [ ] Data is synced to Railway
- [ ] Files are synced to Cloudflare R2
- [ ] Railway app is deployed and running
- [ ] You have access to Cloudflare DNS

**Steps:**

1. **Verify Railway is ready:**
   ```bash
   curl https://teachific-app.railway.app/api/health
   ```

2. **Update Cloudflare DNS:**
   - Go to Cloudflare dashboard
   - Update CNAME records:
     - `www` → `teachific-app.railway.app`
     - `*` → `teachific-app.railway.app`
   - Wait for DNS to propagate (5-10 minutes)

3. **Test application on Railway:**
   ```bash
   # Test login
   curl -X POST https://www.teachific.app/api/oauth/callback
   
   # Test course access
   curl https://www.teachific.app/api/trpc/courses.getAll
   
   # Test media access
   curl https://www.teachific.app/api/media/sample.mp4
   ```

4. **Verify functionality:**
   - [ ] Login works
   - [ ] Courses load
   - [ ] Media files display
   - [ ] Payments work (test with Stripe test card)
   - [ ] Email notifications send

5. **Switch back to Manus:**
   - Update Cloudflare DNS back to Manus
   - Wait for DNS propagation
   - Verify Manus is serving traffic

**Expected Result:**
- ✅ All functionality works on Railway
- ✅ DNS failover is seamless
- ✅ Users experience minimal downtime

---

## Test 6: Automated Failover (GitHub Actions)

**Objective:** Verify GitHub Actions workflows run correctly

**Steps:**

1. **Manually trigger sync workflow:**
   - Go to GitHub repository
   - Actions → "Sync Railway Replica"
   - Click "Run workflow"

2. **Monitor workflow execution:**
   - Check logs for any errors
   - Verify all steps complete successfully

3. **Check sync results:**
   ```bash
   # Verify data was synced
   node scripts/migrate-to-railway.mjs
   
   # Verify health check passed
   node scripts/failover-monitor.mjs check
   ```

**Expected Result:**
- ✅ GitHub Actions workflow completes successfully
- ✅ All sync steps pass
- ✅ No errors in logs

---

## Test 7: Replication Lag Measurement

**Objective:** Measure how quickly changes replicate to Railway

**Steps:**

1. **Create test data on Manus:**
   ```sql
   INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');
   ```

2. **Record timestamp:**
   ```bash
   START_TIME=$(date +%s%N)
   ```

3. **Run sync:**
   ```bash
   node scripts/migrate-to-railway.mjs
   ```

4. **Measure replication lag:**
   ```bash
   END_TIME=$(date +%s%N)
   LAG_MS=$(( (END_TIME - START_TIME) / 1000000 ))
   echo "Replication lag: ${LAG_MS}ms"
   ```

5. **Verify data on Railway:**
   ```sql
   SELECT * FROM users WHERE email = 'test@example.com';
   ```

**Expected Result:**
- ✅ Replication lag < 5 seconds
- ✅ Data appears on Railway after sync
- ✅ No data loss

---

## Test 8: Load Testing

**Objective:** Verify system handles load during replication

**Steps:**

1. **Generate test load on Manus:**
   ```bash
   # Using Apache Bench
   ab -n 1000 -c 10 https://scormhost-fjxmsdmk.manus.space/
   ```

2. **Run sync during load:**
   ```bash
   node scripts/migrate-to-railway.mjs
   ```

3. **Monitor performance:**
   - Check sync completion time
   - Verify no timeouts
   - Check error rates

**Expected Result:**
- ✅ Sync completes even under load
- ✅ No errors or timeouts
- ✅ Performance is acceptable

---

## Troubleshooting Failed Tests

### Test fails: "Connection refused"
- Verify network connectivity to Manus/Railway
- Check firewall rules
- Verify credentials in `replication-config.json`

### Test fails: "Data mismatch"
- Check for concurrent writes during sync
- Verify no foreign key violations
- Run sync again to catch up

### Test fails: "DNS not updating"
- Clear Cloudflare cache
- Wait for TTL (usually 5 minutes)
- Verify CNAME records are correct

### Test fails: "Railway app not responding"
- Check Railway deployment logs
- Verify environment variables are set
- Restart Railway app

---

## Post-Test Checklist

After completing all tests:

- [ ] All tests passed
- [ ] Data is in sync between Manus and Railway
- [ ] Files are synced to Cloudflare R2
- [ ] Health monitoring is working
- [ ] GitHub Actions workflows are configured
- [ ] DNS is back pointing to Manus
- [ ] Failover documentation is complete
- [ ] Team is trained on failover procedure

---

## Failover Runbook (Quick Reference)

If Manus actually goes down:

1. **Verify failure:**
   ```bash
   node scripts/failover-monitor.mjs check
   ```

2. **Check Railway is ready:**
   ```bash
   curl https://teachific-app.railway.app/api/health
   ```

3. **Update DNS (Cloudflare):**
   - `www` → `teachific-app.railway.app`
   - `*` → `teachific-app.railway.app`

4. **Test application:**
   - Login: ✅
   - Courses: ✅
   - Media: ✅
   - Payments: ✅

5. **Notify users (optional):**
   - Post status update
   - Provide ETA for resolution

6. **Investigate Manus issue:**
   - Contact Manus support
   - Check status page
   - Review logs

7. **Switch back when ready:**
   - Update DNS back to Manus
   - Verify all systems
   - Document incident

---

## Support

For issues or questions:
- Review `REPLICATION_SETUP.md` for detailed setup
- Check logs: `tail -f /var/log/teachific-*.log`
- Run health check: `node scripts/failover-monitor.mjs check`
- Contact support with logs and test results
