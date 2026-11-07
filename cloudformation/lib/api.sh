#!/bin/bash
set -euxo pipefail

cat <<'EOF' > /etc/ecs/ecs.config
ECS_CLUSTER=${ClusterName}
ECS_ENABLE_CONTAINER_METADATA=true
ECS_ENABLE_SPOT_INSTANCE_DRAINING=true
EOF

systemctl enable --now docker
systemctl enable ecs
systemctl start --no-block ecs
echo "ECS agent start queued; ecs.service will run after cloud-final.service completes."

cat <<'EOF' > /etc/sysctl.d/99-media-webrtc.conf
net.core.rmem_max = 8388608
net.core.rmem_default = 4194304
net.core.wmem_max = 8388608
net.core.wmem_default = 4194304
EOF

sysctl --system || true
