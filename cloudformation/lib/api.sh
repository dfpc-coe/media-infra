#!/bin/bash
set -euxo pipefail

cat > /etc/ecs/ecs.config <<'EOF'
ECS_CLUSTER=${ClusterName}
ECS_ENABLE_CONTAINER_METADATA=true
EOF

if ! command -v aws >/dev/null 2>&1; then
    yum install -y awscli
fi

systemctl enable --now ecs

TOKEN=$(curl --fail --silent --show-error --request PUT "http://169.254.169.254/latest/api/token" --header "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl --fail --silent --show-error --header "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/instance-id")

for attempt in {1..30}; do
    if aws ec2 associate-address --region ${AWS::Region} --instance-id "$INSTANCE_ID" --allocation-id ${AllocationId} --allow-reassociation; then
        exit 0
    fi

    sleep 10
done

exit 1
