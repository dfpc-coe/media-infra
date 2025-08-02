# ⚡ Quick Reference

## **🚀 Fast Deployment Commands**

### **Standard Deployments**
```bash
# Development environment
npm run deploy:dev

# Production environment  
npm run deploy:prod

# Local image building
npm run deploy:local:dev
npm run deploy:local:prod
```

### **Preview & Diff**
```bash
# Preview infrastructure
npm run synth:dev
npm run synth:prod

# Show changes
npm run cdk:diff:dev
npm run cdk:diff:prod
```

---

## **⚙️ Configuration Overrides**

### **Common Overrides**
```bash
# Enable insecure ports (development)
npm run deploy:dev -- --context enableInsecurePorts=true

# Use pre-built images (faster deployment)
npm run deploy:prod -- --context usePreBuiltImages=true

# Custom CloudTAK URL
npm run deploy:dev -- --context cloudtakUrl=https://custom.url
```

### **Environment Switching**
```bash
# Deploy with custom stack name
npx cdk deploy --context environment=dev-test --context stackName=Demo

# Custom domain
npm run deploy:dev -- --context r53ZoneName=custom.tak.nz
```

---

## **🎥 Streaming Endpoints**

### **Secure Protocols (Always Available)**
| Protocol | Port | URL Format | Use Case |
|----------|------|------------|----------|
| **RTMPS** | 1936 | `rtmps://media.tak.nz:1936/{stream-id}` | OBS, streaming software |
| **RTSPS** | 8555 | `rtsps://media.tak.nz:8555/{stream-id}` | IP cameras, media players |
| **SRTS** | 8890 | `srt://media.tak.nz:8890?streamid=read:{stream-id}` | Low-latency streaming |
| **HLS** | 8888 | `https://media.tak.nz:8888/{stream-id}/index.m3u8` | Web browsers, mobile |
| **API** | 9997 | `https://media.tak.nz:9997/v3/config` | Management API |

### **Insecure Protocols (Optional)**
| Protocol | Port | URL Format | Security Note |
|----------|------|------------|---------------|
| **RTMP** | 1935 | `rtmp://media.tak.nz:1935/{stream-id}` | Development only |
| **RTSP** | 8554 | `rtsp://media.tak.nz:8554/{stream-id}` | Development only |

---

## **🔧 Environment Comparison**

| Feature | dev-test | prod |
|---------|----------|------|
| **Stack Name** | `TAK-Dev-MediaInfra` | `TAK-Prod-MediaInfra` |
| **Domain** | `media.dev.tak.nz` | `media.tak.nz` |
| **Task Count** | 1 | 1 |
| **CPU/Memory** | 512/1024 | 1024/2048 |
| **Insecure Ports** | Optional | Disabled |
| **Cost/Month** | ~$25 USD | ~$85 USD |

---

## **🐳 Docker Image Commands**

### **Pre-built Images (Fast)**
```bash
# Check available images
aws ecr describe-images --repository-name tak-media-infra

# Deploy with pre-built
npm run deploy:dev -- --context usePreBuiltImages=true
```

### **Local Building (Flexible)**
```bash
# Build and deploy locally
npm run deploy:local:dev

# Force local build
npm run deploy:dev -- --context usePreBuiltImages=false
```

---

## **🛠️ Troubleshooting Commands**

### **Stack Status**
```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name TAK-Dev-MediaInfra

# View stack events
aws cloudformation describe-stack-events --stack-name TAK-Dev-MediaInfra
```

### **Service Health**
```bash
# Check ECS service
aws ecs describe-services --cluster TAK-Dev-ECSCluster --services TAK-Dev-MediaInfra-MediaMTX

# View container logs
aws logs tail /ecs/TAK-Dev-MediaInfra-MediaMTX --follow
```

### **Test Endpoints**
```bash
# Test MediaMTX API
curl -k https://media.dev.tak.nz:9997/v3/config/global/get

# Test HLS endpoint
curl -k https://media.dev.tak.nz:8888/

# Check NLB health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

---

## **📊 Monitoring Commands**

### **CloudWatch Metrics**
```bash
# View ECS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=TAK-Dev-MediaInfra-MediaMTX \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T01:00:00Z \
  --period 300 \
  --statistics Average
```

### **Log Analysis**
```bash
# Stream logs
aws logs tail /ecs/TAK-Dev-MediaInfra-MediaMTX --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /ecs/TAK-Dev-MediaInfra-MediaMTX \
  --filter-pattern "ERROR"
```

---

## **🔐 Security Commands**

### **Secrets Management**
```bash
# View CloudTAK secrets
aws secretsmanager describe-secret --secret-id TAK-Dev-CloudTAK-SigningSecret
aws secretsmanager describe-secret --secret-id TAK-Dev-CloudTAK-MediaSecret

# Get secret values (requires permissions)
aws secretsmanager get-secret-value --secret-id TAK-Dev-CloudTAK-SigningSecret
```

### **Security Groups**
```bash
# List security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*MediaInfra*"

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
```

---

## **🧹 Cleanup Commands**

### **Stack Cleanup**
```bash
# Destroy development
npx cdk destroy --context environment=dev-test

# Destroy production (careful!)
npx cdk destroy --context environment=prod
```

### **ECR Cleanup**
```bash
# List ECR repositories
aws ecr describe-repositories --repository-names tak-media-infra

# Delete old images
aws ecr batch-delete-image \
  --repository-name tak-media-infra \
  --image-ids imageTag=old-tag
```

---

## **📋 Prerequisites Checklist**

- [ ] AWS Account with configured credentials
- [ ] Base infrastructure deployed (`TAK-<n>-BaseInfra`)
- [ ] Auth infrastructure deployed (`TAK-<n>-AuthInfra`)
- [ ] TAK infrastructure deployed (`TAK-<n>-TakInfra`)
- [ ] CloudTAK deployed (`TAK-<n>-CloudTAK`)
- [ ] Route 53 hosted zone exists
- [ ] Node.js 18+ installed
- [ ] CDK bootstrapped in account

---

## **🔗 Quick Links**

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Detailed deployment instructions
- **[Architecture Guide](ARCHITECTURE.md)** - Technical architecture
- **[Configuration Guide](PARAMETERS.md)** - Configuration reference
- **[Streaming Guide](STREAMING_GUIDE.md)** - MediaMTX protocols
- **[Docker Strategy](DOCKER_IMAGE_STRATEGY.md)** - Image management