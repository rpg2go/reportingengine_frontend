#!/bin/bash
# macOS/Linux Deployment Script for Reporting Engine
# Can be run from any directory: ./scripts/deploy.sh or scripts/deploy.sh
#
# Default deployment region: europe-west3 (Frankfurt, Germany)
# Override by setting GCP_REGION in your .env file.

set -e

# Resolve the project root relative to this script file, regardless of CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Helper to load .env variables
if [ -f "$PROJECT_ROOT/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
      # Strip carriage returns if file has Windows line endings
      clean_line=$(echo "$line" | tr -d '\r')
      export "$clean_line"
    fi
  done < "$PROJECT_ROOT/.env"
else
  echo "Error: .env file not found at $PROJECT_ROOT/.env"
  exit 1
fi

# Default to Frankfurt (europe-west3) if not set in .env
GCP_REGION="${GCP_REGION:-europe-west3}"

# Validate required variables
required_vars=("GCP_PROJECT_ID" "BACKEND_SERVICE_NAME" "FRONTEND_SERVICE_NAME")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required environment variable $var is missing from .env"
    exit 1
  fi
done

echo "Deployment region: ${GCP_REGION}"

echo "Setting gcloud project to ${GCP_PROJECT_ID}..."
gcloud config set project ${GCP_PROJECT_ID}

echo "Fetching Backend URL from existing Cloud Run service (${BACKEND_SERVICE_NAME})..."
BACKEND_URL=$(gcloud run services describe ${BACKEND_SERVICE_NAME} --region ${GCP_REGION} --format "value(status.url)" 2>/dev/null)
if [ -z "${BACKEND_URL}" ]; then
  echo "Error: Could not find a deployed backend service named '${BACKEND_SERVICE_NAME}' in region '${GCP_REGION}'."
  echo "Deploy the backend first by running: scripts/deploy.sh from reportingengine_backend/"
  exit 1
fi
echo "Backend URL: ${BACKEND_URL}"

echo "Deploying Frontend Service (${FRONTEND_SERVICE_NAME}) to Cloud Run..."
gcloud run deploy ${FRONTEND_SERVICE_NAME} \
  --source "$PROJECT_ROOT" \
  --region ${GCP_REGION} \
  --set-env-vars="BACKEND_URL=${BACKEND_URL}" \
  --allow-unauthenticated \
  --quiet

echo "Retrieving Frontend URL..."
FRONTEND_URL=$(gcloud run services describe ${FRONTEND_SERVICE_NAME} --region ${GCP_REGION} --format "value(status.url)")

echo "=========================================="
echo "Deployment completed successfully!"
echo "Backend API URL: ${BACKEND_URL}"
echo "Frontend Web URL: ${FRONTEND_URL}"
echo "=========================================="
