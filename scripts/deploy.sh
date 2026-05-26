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
required_vars=("GCP_PROJECT_ID" "BACKEND_SERVICE_NAME" "FRONTEND_SERVICE_NAME" "SPRING_DATASOURCE_URL" "SPRING_DATASOURCE_USERNAME" "SPRING_DATASOURCE_PASSWORD")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required environment variable $var is missing from .env"
    exit 1
  fi
done

echo "Deployment region: ${GCP_REGION}"

echo "Setting gcloud project to ${GCP_PROJECT_ID}..."
gcloud config set project ${GCP_PROJECT_ID}

echo "Deploying Backend Service (${BACKEND_SERVICE_NAME}) to Cloud Run..."
gcloud run deploy ${BACKEND_SERVICE_NAME} \
  --source "$(cd "$PROJECT_ROOT/../ReportTemplate_BackEnd" && pwd)" \
  --region ${GCP_REGION} \
  --set-env-vars="SPRING_DATASOURCE_URL=${SPRING_DATASOURCE_URL},SPRING_DATASOURCE_USERNAME=${SPRING_DATASOURCE_USERNAME},SPRING_DATASOURCE_PASSWORD=${SPRING_DATASOURCE_PASSWORD}" \
  --allow-unauthenticated \
  --quiet

echo "Retrieving Backend URL..."
BACKEND_URL=$(gcloud run services describe ${BACKEND_SERVICE_NAME} --region ${GCP_REGION} --format "value(status.url)")
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
