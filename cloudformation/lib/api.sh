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

if ! command -v aws >/dev/null 2>&1; then
    if command -v dnf >/dev/null 2>&1; then
        dnf install -y awscli || true
    elif command -v yum >/dev/null 2>&1; then
        yum install -y awscli || true
    fi
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "warning: awscli unavailable, skipping EIP association"
    exit 0
fi

cat <<'EOF' > /usr/local/bin/media-eip-association.sh
#!/bin/bash
set -euo pipefail

wait_for_tcp_port() {
    timeout 1 bash -c 'exec 3<>"/dev/tcp/$1/$2"' _ "$1" "$2" >/dev/null 2>&1
}

token=$(curl --fail --silent --show-error --request PUT "http://169.254.169.254/latest/api/token" --header "X-aws-ec2-metadata-token-ttl-seconds: 21600")
instance_id=$(curl --fail --silent --show-error --header "X-aws-ec2-metadata-token: $token" "http://169.254.169.254/latest/meta-data/instance-id")

for attempt in {1..60}; do
    if ! wait_for_tcp_port 127.0.0.1 9997; then
        echo "Attempt $attempt: waiting for media API listener on 127.0.0.1:9997"
        sleep 10
        continue
    fi

    if aws ec2 associate-address --region "$1" --instance-id "$instance_id" --allocation-id "$2" --allow-reassociation; then
        exit 0
    fi

    sleep 10
done

echo "warning: failed to associate EIP after retries"
exit 1
EOF

chmod 755 /usr/local/bin/media-eip-association.sh

cat <<'EOF' > /etc/systemd/system/media-eip-association.service
[Unit]
Description=Associate media EIP after local task readiness
Wants=network-online.target docker.service ecs.service
After=network-online.target docker.service ecs.service

[Service]
Type=simple
ExecStart=/usr/local/bin/media-eip-association.sh ${AWS::Region} ${AllocationId}
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable media-eip-association.service
systemctl start --no-block media-eip-association.service
echo "Media EIP association service queued; user-data can exit while it waits for port 9997."
