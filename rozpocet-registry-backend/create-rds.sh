#!/bin/bash
# AWS RDS PostgreSQL Creation Script
# Run: bash create-rds.sh

set -e

echo "🚀 Creating AWS RDS PostgreSQL for Registry Backend..."

# Configuration
DB_INSTANCE_ID="stavagent-registry-db"
DB_NAME="registry"
DB_USERNAME="postgres"
DB_PASSWORD="StavAgent2024!Secure"  # Change this!
DB_CLASS="db.t3.micro"
STORAGE_SIZE=20
REGION="eu-central-1"  # Frankfurt (change if needed)

echo "📋 Configuration:"
echo "  Instance ID: $DB_INSTANCE_ID"
echo "  Database: $DB_NAME"
echo "  Username: $DB_USERNAME"
echo "  Region: $REGION"
echo "  Instance: $DB_CLASS (Free Tier)"
echo ""

# Step 1: Create RDS instance
echo "1️⃣ Creating RDS instance..."
aws rds create-db-instance \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --db-instance-class "$DB_CLASS" \
  --engine postgres \
  --engine-version 15.4 \
  --master-username "$DB_USERNAME" \
  --master-user-password "$DB_PASSWORD" \
  --allocated-storage "$STORAGE_SIZE" \
  --storage-type gp2 \
  --db-name "$DB_NAME" \
  --publicly-accessible \
  --backup-retention-period 7 \
  --no-multi-az \
  --region "$REGION" \
  --tags Key=Project,Value=StavAgent Key=Service,Value=Registry

echo "✅ RDS instance creation initiated"
echo ""

# Step 2: Wait for instance to be available
echo "2️⃣ Waiting for instance to be available (5-10 minutes)..."
aws rds wait db-instance-available \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$REGION"

echo "✅ Instance is available"
echo ""

# Step 3: Get endpoint
echo "3️⃣ Getting endpoint..."
ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$REGION" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "✅ Endpoint: $ENDPOINT"
echo ""

# Step 4: Get security group
echo "4️⃣ Getting security group..."
SG_ID=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$REGION" \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

echo "✅ Security Group: $SG_ID"
echo ""

# Step 5: Open port 5432
echo "5️⃣ Opening port 5432 for public access..."
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region "$REGION" 2>/dev/null || echo "⚠️  Port already open"

echo "✅ Port 5432 is open"
echo ""

# Step 6: Generate DATABASE_URL
DATABASE_URL="postgresql://$DB_USERNAME:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME"

echo "🎉 RDS PostgreSQL Created Successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Connection Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Endpoint:     $ENDPOINT"
echo "Port:         5432"
echo "Database:     $DB_NAME"
echo "Username:     $DB_USERNAME"
echo "Password:     $DB_PASSWORD"
echo ""
echo "DATABASE_URL:"
echo "$DATABASE_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "1. Copy DATABASE_URL to Render environment variables"
echo "2. Deploy backend: https://dashboard.render.com/"
echo "3. Test: curl https://rozpocet-registry-backend.onrender.com/health"
echo ""
echo "💰 Cost: FREE for 12 months (750 hours/month)"
echo ""
