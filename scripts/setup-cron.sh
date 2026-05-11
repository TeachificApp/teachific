#!/bin/bash

# Setup Cron Jobs for Teachific Replication
# 
# This script sets up automated sync jobs that run on a schedule.
# Run this once to enable continuous replication.
#
# Usage: bash scripts/setup-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/var/log/teachific"

echo "🔧 Setting up cron jobs for Teachific replication..."

# Create log directory
sudo mkdir -p "$LOG_DIR"
sudo chown "$USER:$USER" "$LOG_DIR"

# Create cron jobs file
CRON_FILE="/tmp/teachific-cron.txt"
cat > "$CRON_FILE" << EOF
# Teachific Replication Jobs
# Database sync every 5 minutes
*/5 * * * * cd $PROJECT_DIR && node scripts/migrate-to-railway.mjs >> $LOG_DIR/sync.log 2>&1

# Health check every 10 minutes
*/10 * * * * cd $PROJECT_DIR && node scripts/failover-monitor.mjs check >> $LOG_DIR/health.log 2>&1

# R2 bucket sync every 30 minutes
*/30 * * * * cd $PROJECT_DIR && node scripts/sync-r2-bucket.mjs >> $LOG_DIR/r2-sync.log 2>&1
EOF

# Install cron jobs
crontab "$CRON_FILE"

echo "✅ Cron jobs installed!"
echo ""
echo "📋 Installed jobs:"
echo "   • Database sync: Every 5 minutes"
echo "   • Health check: Every 10 minutes"
echo "   • R2 bucket sync: Every 30 minutes"
echo ""
echo "📍 Logs location: $LOG_DIR"
echo ""
echo "View installed cron jobs:"
echo "   crontab -l"
echo ""
echo "Edit cron jobs:"
echo "   crontab -e"
echo ""
echo "Remove cron jobs:"
echo "   crontab -r"

rm "$CRON_FILE"
