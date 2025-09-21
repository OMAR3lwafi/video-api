#!/bin/bash

# ============================================
# Secret Generation Script for Video Generation Platform
# Generates secure random secrets for production environment
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to generate random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d '\n'
}

# Function to generate bcrypt password
generate_bcrypt() {
    local password=$1
    if command -v htpasswd &> /dev/null; then
        htpasswd -bnBC 10 "" "$password" | tr -d ':\n' | sed 's/^$//'
    else
        echo "htpasswd not found - please install apache2-utils or httpd-tools"
        echo "$password"
    fi
}

# Function to generate alphanumeric string
generate_alphanumeric() {
    local length=${1:-32}
    # Use openssl for consistent cross-platform behavior
    openssl rand -hex $((length * 2)) | head -c $length
}

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Video Generation Platform - Secret Generator${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if .env.production exists
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Warning: $ENV_FILE not found. Creating from template...${NC}"
    cp .env.example "$ENV_FILE" 2>/dev/null || echo -e "${RED}Error: .env.example not found${NC}"
fi

# Generate secrets
echo -e "${GREEN}Generating secure secrets...${NC}"
echo ""

# Database secrets
echo "# Database Secrets"
POSTGRES_PASSWORD=$(generate_secret 24)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo ""

# Redis password
echo "# Redis Secret"
REDIS_PASSWORD=$(generate_secret 24)
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo ""

# Session and JWT secrets
echo "# Authentication Secrets"
SESSION_SECRET=$(generate_secret 32)
JWT_SECRET=$(generate_secret 32)
JWT_REFRESH_SECRET=$(generate_secret 32)
WEBHOOK_SECRET=$(generate_secret 32)
echo "SESSION_SECRET=$SESSION_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET"
echo ""

# Encryption key
echo "# Encryption Key"
ENCRYPTION_KEY=$(generate_alphanumeric 32)
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

# API Keys
echo "# API Keys"
API_KEY_SECRET=$(generate_alphanumeric 32)
ADMIN_API_KEY=$(generate_alphanumeric 32)
SERVICE_API_KEY=$(generate_alphanumeric 32)
echo "API_KEY_SECRET=$API_KEY_SECRET"
echo "ADMIN_API_KEY=$ADMIN_API_KEY"
echo "SERVICE_API_KEY=$SERVICE_API_KEY"
echo ""

# Grafana secrets
echo "# Grafana Secrets"
GRAFANA_ADMIN_PASSWORD=$(generate_alphanumeric 16)
GRAFANA_SECRET_KEY=$(generate_secret 32)
echo "GRAFANA_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD"
echo "GRAFANA_SECRET_KEY=$GRAFANA_SECRET_KEY"
echo ""

# Traefik dashboard auth
echo "# Traefik Dashboard Auth (admin:password)"
TRAEFIK_ADMIN_PASSWORD=$(generate_alphanumeric 16)
TRAEFIK_DASHBOARD_AUTH="admin:$(generate_bcrypt $TRAEFIK_ADMIN_PASSWORD)"
echo "TRAEFIK_ADMIN_PASSWORD=$TRAEFIK_ADMIN_PASSWORD (save this!)"
echo "TRAEFIK_DASHBOARD_AUTH=$TRAEFIK_DASHBOARD_AUTH"
echo ""

# Generate secure database URL
echo "# Complete Database URL"
echo "DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@database:5432/videogen"
echo ""

# Generate Redis URL
echo "# Complete Redis URL"
echo "REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379"
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Secrets generated successfully!${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "1. Save these secrets securely - they cannot be recovered!"
echo "2. Update your .env.production file with these values"
echo "3. Never commit these secrets to version control"
echo "4. Consider using a secret management service in production"
echo ""
echo -e "${BLUE}To update .env.production automatically:${NC}"
echo "   ./scripts/generate-secrets.sh > .env.secrets"
echo "   Then manually copy the values to .env.production"
echo ""

# Option to create .env.secrets file
echo -e "${YELLOW}Do you want to save these secrets to .env.secrets? (y/N)${NC}"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    # Create backup of existing .env.secrets if it exists
    if [ -f ".env.secrets" ]; then
        mv .env.secrets .env.secrets.backup.$(date +%Y%m%d_%H%M%S)
        echo -e "${YELLOW}Existing .env.secrets backed up${NC}"
    fi

    # Write secrets to file
    cat > .env.secrets << EOF
# ============================================
# Generated Secrets - $(date)
# KEEP THIS FILE SECURE!
# ============================================

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgresql://postgres:$POSTGRES_PASSWORD@database:5432/videogen

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6379

# Authentication
SESSION_SECRET=$SESSION_SECRET
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
WEBHOOK_SECRET=$WEBHOOK_SECRET

# Encryption
ENCRYPTION_KEY=$ENCRYPTION_KEY

# API Keys
API_KEY_SECRET=$API_KEY_SECRET
ADMIN_API_KEY=$ADMIN_API_KEY
SERVICE_API_KEY=$SERVICE_API_KEY

# Grafana
GRAFANA_ADMIN_PASSWORD=$GRAFANA_ADMIN_PASSWORD
GRAFANA_SECRET_KEY=$GRAFANA_SECRET_KEY

# Traefik
TRAEFIK_ADMIN_PASSWORD=$TRAEFIK_ADMIN_PASSWORD
TRAEFIK_DASHBOARD_AUTH=$TRAEFIK_DASHBOARD_AUTH
EOF

    chmod 600 .env.secrets
    echo -e "${GREEN}Secrets saved to .env.secrets${NC}"
    echo -e "${YELLOW}File permissions set to 600 (owner read/write only)${NC}"
fi

echo ""
echo -e "${GREEN}Script completed!${NC}"
