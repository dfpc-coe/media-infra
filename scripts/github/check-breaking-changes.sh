#!/bin/bash
# Breaking change detection for infrastructure deployments

STACK_TYPE=${1:-"media"}
CONTEXT_ENV=${2:-"prod"}
OVERRIDE_CHECK=${3:-"false"}

# MediaInfra-specific breaking change patterns
PATTERNS=(
  "NetworkLoadBalancer.*will be destroyed"
  "ECSService.*will be destroyed"
  "TaskDefinition.*will be destroyed"
  "TargetGroup.*will be destroyed"
  "SecurityGroup.*will be destroyed"
  "Route53.*will be destroyed"
)

echo "🔍 Checking for breaking changes in $STACK_TYPE stack..."

# Generate CDK diff
npm run cdk diff -- --context environment=$CONTEXT_ENV --context stackName=Demo > stack-diff.txt 2>&1

# Check for breaking patterns
BREAKING_FOUND=false
for pattern in "${PATTERNS[@]}"; do
  if grep -q "$pattern" stack-diff.txt; then
    echo "❌ Breaking change detected: $pattern"
    BREAKING_FOUND=true
  fi
done

if [ "$BREAKING_FOUND" = true ]; then
  if [ "$OVERRIDE_CHECK" = "true" ]; then
    echo "🚨 Breaking changes detected but override enabled - proceeding"
    exit 0
  else
    echo ""
    echo "💡 To override this check, use commit message containing '[force-deploy]'"
    echo "📋 Review the full diff above to understand the impact"
    exit 1
  fi
else
  echo "✅ No breaking changes detected"
fi