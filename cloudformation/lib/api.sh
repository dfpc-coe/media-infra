#!/bin/bash
set -euxo pipefail

cat <<'EOF' > /etc/ecs/ecs.config
ECS_CLUSTER=${ClusterName}
ECS_ENABLE_CONTAINER_METADATA=true
ECS_ENABLE_SPOT_INSTANCE_DRAINING=true
EOF

systemctl enable --now docker
systemctl enable ecs

for attempt in {1..30}; do
    if systemctl restart ecs && systemctl is-active --quiet ecs; then
        echo "ECS agent successfully started and is active."
        break
    fi

    echo "Attempt $attempt: ECS agent not active yet. Retrying in 10 seconds..."
    sleep 10
done

if ! systemctl is-active --quiet ecs; then
    echo "ERROR: ECS agent failed to start after 30 attempts."

    # Print status and logs to help troubleshoot via /var/log/cloud-init-output.log
    systemctl status ecs --no-pager || true
    journalctl -u ecs -b --no-pager || true

    # Exit with a failure code to signal the deployment/Auto Scaling lifecycle hook
    exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
    yum install -y awscli || true
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "warning: awscli unavailable, skipping EIP association"
    exit 0
fi

TOKEN=$(curl --fail --silent --show-error --request PUT "http://169.254.169.254/latest/api/token" --header "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl --fail --silent --show-error --header "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/instance-id")

for attempt in {1..30}; do
    if aws ec2 associate-address --region ${AWS::Region} --instance-id "$INSTANCE_ID" --allocation-id ${AllocationId} --allow-reassociation; then
        exit 0
    fi

    sleep 10
done

echo "warning: failed to associate EIP after retries"
exit 0
