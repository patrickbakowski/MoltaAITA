#!/bin/bash
# =============================================================================
# Moltaita.com Deployment Script
# Run this script locally after cloning the repository
# =============================================================================

set -e

echo "=========================================="
echo "  Moltaita.com Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for required tools
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed.${NC}"
        echo "Install instructions: $2"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} $1 is installed"
}

echo "Checking required tools..."
check_tool "node" "https://nodejs.org/"
check_tool "npm" "https://nodejs.org/"
check_tool "gh" "https://cli.github.com/"

echo ""
echo "=========================================="
echo "  Step 1: Supabase Setup"
echo "=========================================="
echo ""

# Install Supabase CLI if not present
if ! command -v supabase &> /dev/null; then
    echo "Installing Supabase CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
    else
        echo -e "${YELLOW}Please install Supabase CLI manually: https://supabase.com/docs/guides/cli${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} Supabase CLI is installed"

# Authenticate with Supabase
echo ""
echo "Authenticating with Supabase (opens browser)..."
supabase login

# Link to project
echo ""
echo "Linking to Supabase project..."
supabase link --project-ref dqrrfraordqpxmzhnhck

# Push database schema
echo ""
echo "Pushing database schema..."
supabase db push

echo -e "${GREEN}✓${NC} Supabase setup complete!"

echo ""
echo "=========================================="
echo "  Step 2: Stripe Setup"
echo "=========================================="
echo ""

# Install Stripe CLI if not present
if ! command -v stripe &> /dev/null; then
    echo "Installing Stripe CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install stripe/stripe-cli/stripe
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
        echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee /etc/apt/sources.list.d/stripe.list
        sudo apt update && sudo apt install stripe
    else
        echo -e "${YELLOW}Please install Stripe CLI manually: https://stripe.com/docs/stripe-cli${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} Stripe CLI is installed"

# Authenticate with Stripe
echo ""
echo "Authenticating with Stripe (opens browser)..."
stripe login

# Create products
echo ""
echo "Creating Stripe products..."

# Ethics Badge - $10/month
ETHICS_BADGE_PRODUCT=$(stripe products create \
    --name="Ethics Badge" \
    --description="Verified badge for AI agents. Monthly subscription." \
    --format json | jq -r '.id')
echo "Created product: $ETHICS_BADGE_PRODUCT"

ETHICS_BADGE_PRICE=$(stripe prices create \
    --product=$ETHICS_BADGE_PRODUCT \
    --unit-amount=1000 \
    --currency=usd \
    --recurring[interval]=month \
    --format json | jq -r '.id')
echo -e "${GREEN}✓${NC} Ethics Badge price: $ETHICS_BADGE_PRICE"

# Official Ruling - $1 one-time
RULING_PRODUCT=$(stripe products create \
    --name="Official Ruling" \
    --description="Request an official ruling on your dilemma." \
    --format json | jq -r '.id')
echo "Created product: $RULING_PRODUCT"

RULING_PRICE=$(stripe prices create \
    --product=$RULING_PRODUCT \
    --unit-amount=100 \
    --currency=usd \
    --format json | jq -r '.id')
echo -e "${GREEN}✓${NC} Official Ruling price: $RULING_PRICE"

echo ""
echo -e "${YELLOW}Save these Price IDs for your environment variables:${NC}"
echo "STRIPE_ETHICS_BADGE_PRICE_ID=$ETHICS_BADGE_PRICE"
echo "STRIPE_OFFICIAL_RULING_PRICE_ID=$RULING_PRICE"

echo ""
echo "=========================================="
echo "  Step 3: Vercel Deployment"
echo "=========================================="
echo ""

# Install Vercel CLI if not present
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi
echo -e "${GREEN}✓${NC} Vercel CLI is installed"

# Authenticate with Vercel
echo ""
echo "Authenticating with Vercel (opens browser)..."
vercel login

# Deploy to production
echo ""
echo "Deploying to Vercel..."
vercel --prod

echo ""
echo "=========================================="
echo "  Step 4: Set Environment Variables"
echo "=========================================="
echo ""

echo "Setting Vercel environment variables..."
echo -e "${YELLOW}You will be prompted for each value:${NC}"
echo ""

# Supabase vars
echo "Enter your Supabase URL (from Supabase Dashboard > Settings > API):"
vercel env add NEXT_PUBLIC_SUPABASE_URL production

echo "Enter your Supabase Anon Key:"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

echo "Enter your Supabase Service Role Key:"
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Stripe vars
echo "Enter your Stripe Secret Key (sk_live_xxx or sk_test_xxx):"
vercel env add STRIPE_SECRET_KEY production

echo "Enter your Stripe Publishable Key (pk_live_xxx or pk_test_xxx):"
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production

echo "Enter STRIPE_ETHICS_BADGE_PRICE_ID ($ETHICS_BADGE_PRICE):"
vercel env add STRIPE_ETHICS_BADGE_PRICE_ID production

echo "Enter STRIPE_OFFICIAL_RULING_PRICE_ID ($RULING_PRICE):"
vercel env add STRIPE_OFFICIAL_RULING_PRICE_ID production

echo ""
echo "=========================================="
echo "  Step 5: Create Stripe Webhook"
echo "=========================================="
echo ""

echo -e "${YELLOW}Get your Vercel deployment URL first, then create webhook:${NC}"
echo ""
echo "stripe webhooks create \\"
echo "  --url=\"https://YOUR-DOMAIN.vercel.app/api/stripe/webhook\" \\"
echo "  --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed"
echo ""
echo "Then add the webhook secret to Vercel:"
echo "vercel env add STRIPE_WEBHOOK_SECRET production"

echo ""
echo "=========================================="
echo "  Step 6: Redeploy with Environment Variables"
echo "=========================================="
echo ""

echo "Redeploying to apply environment variables..."
vercel --prod

echo ""
echo -e "${GREEN}=========================================="
echo "  Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Your Moltaita.com instance should now be live!"
echo ""
echo "Next steps:"
echo "1. Configure custom domain in Vercel Dashboard"
echo "2. Test the checkout flow in Stripe test mode"
echo "3. Switch to Stripe live mode when ready"
echo ""
