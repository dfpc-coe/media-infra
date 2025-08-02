# 🚀 TAK Media Infrastructure - Deployment Guide

## **Quick Start (Recommended)**

### **Prerequisites**
- AWS Account with configured credentials
- Base infrastructure stack (`TAK-<n>-BaseInfra`) deployed
- Authentication infrastructure stack (`TAK-<n>-AuthInfra`) deployed
- TAK infrastructure stack (`TAK-<n>-TakInfra`) deployed
- CloudTAK stack (`TAK-<n>-CloudTAK`) deployed
- Public Route 53 hosted zone for your domain in the same account
- Node.js 18+ and npm installed

### **One-Command Deployment**
```bash
# Install dependencies
npm install

# Deploy development environment
npm run deploy:dev

# Deploy production environment  
npm run deploy:prod
```

**That's it!** 🎉 The enhanced npm scripts handle building, context configuration, and deployment.

---

## **📋 Environment Configurations**

| Environment | Stack Name | Domain | Cost/Month* | Features |
|-------------|------------|--------|-------------|----------|
| **dev-test** | `TAK-Dev-MediaInfra` | `media.dev.tak.nz` | ~$25 | Cost-optimized, single task |
| **prod** | `TAK-Prod-MediaInfra` | `media.tak.nz` | ~$85 | High availability, single task |

*Estimated AWS costs in USD excluding data transfer and streaming usage.

---

## **🔧 Advanced Configuration**

### **Streaming Protocol Configuration**
```bash
# Enable insecure ports for development/testing
npm run deploy:dev -- --context enableInsecurePorts=true

# Disable insecure ports for production (default)
npm run deploy:prod -- --context enableInsecurePorts=false
```

### **Docker Image Strategy**
```bash
# Use pre-built images for faster deployment
npm run deploy:dev -- --context usePreBuiltImages=true
npm run deploy:prod -- --context usePreBuiltImages=true

# Build images locally for development
npm run deploy:local:dev    # Builds locally
npm run deploy:local:prod   # Builds locally
```

### **CloudTAK Integration**
```bash
# Override CloudTAK URL
npm run deploy:dev -- --context cloudtakUrl=https://custom.cloudtak.url

# Custom authentication secrets
npm run deploy:dev -- --context signingSecret=custom-secret
```

### **Infrastructure Preview**
```bash
# Preview changes before deployment
npm run synth:dev     # Development environment
npm run synth:prod    # Production environment

# Show what would change
npm run cdk:diff:dev  # Development diff
npm run cdk:diff:prod # Production diff
```

---

## **⚙️ Configuration System Deep Dive**

### **Environment Configuration Structure**
All settings are stored in [`cdk.json`](../cdk.json) under the `context` section:

```json
{
  "context": {
    "dev-test": {
      "stackName": "Dev",
      "r53ZoneName": "dev.tak.nz",
      "enableInsecurePorts": false,
      "usePreBuiltImages": false,
      "mediamtx": {
        "desiredCount": 1,
        "cpu": 512,
        "memory": 1024
      }
    }
  }
}
```

### **🔧 Available Configuration Parameters**

| Parameter | Description | Default (dev-test) | Default (prod) |
|-----------|-------------|-------------------|----------------|
| `stackName` | CloudFormation stack name | `Dev` | `Prod` |
| `enableInsecurePorts` | Enable RTMP:1935 and RTSP:8554 | `false` | `false` |
| `usePreBuiltImages` | Use ECR images vs local build | `false` | `false` |


---

## **🚀 First-Time Setup**

### **Prerequisites Verification**
```bash
# Verify required stacks are deployed
aws cloudformation describe-stacks --stack-name TAK-Dev-BaseInfra --profile your-profile
aws cloudformation describe-stacks --stack-name TAK-Dev-AuthInfra --profile your-profile
aws cloudformation describe-stacks --stack-name TAK-Dev-TakInfra --profile your-profile
aws cloudformation describe-stacks --stack-name TAK-Dev-CloudTAK --profile your-profile
```

### **Initial Setup Steps**
```bash
# 1. Clone and install
git clone <repository-url>
cd media-infra
npm install

# 2. Set environment variables (if using AWS profiles)
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text --profile your-profile)
export CDK_DEFAULT_REGION=$(aws configure get region --profile your-profile)

# 3. Bootstrap CDK (first time only)
npx cdk bootstrap --profile your-profile

# 4. Deploy media infrastructure
npm run deploy:dev    # Development environment
npm run deploy:prod   # Production environment
```

---

## **🎥 Streaming Protocols**

### **Secure Protocols (Always Available)**
- **RTMPS (1936)**: RTMP over TLS encryption
- **RTSPS (8555)**: RTSP over TLS encryption  
- **SRTS (8890)**: SRT with encryption
- **HLS (8888)**: HTTP Live Streaming over HTTPS
- **API (9997)**: MediaMTX API over HTTPS

### **Insecure Protocols (Optional)**
- **RTMP (1935)**: Unencrypted RTMP (development only)
- **RTSP (8554)**: Unencrypted RTSP (development only)

**Security Note**: Insecure protocols are disabled by default and should only be enabled for development/testing purposes.

---

## **🐳 Docker Image Management**

### **Pre-built Images (CI/CD)**
```bash
# Fast deployment using ECR images
npm run deploy:dev -- --context usePreBuiltImages=true
npm run deploy:prod -- --context usePreBuiltImages=true
```

### **Local Building (Development)**
```bash
# Build images locally for development
npm run deploy:local:dev
npm run deploy:local:prod

# Or use context override
npm run deploy:dev -- --context usePreBuiltImages=false
```

### **Image Strategy Benefits**
- **CI/CD**: ~5 minute deployments with pre-built images
- **Development**: Flexible local building for customization
- **Automatic Fallback**: Uses best available strategy

---

## **🛠️ Troubleshooting**

### **Common Issues**

#### **Missing Prerequisite Stacks**
```
Error: Cannot find CloudFormation export
```
**Solution:** Ensure all prerequisite stacks are deployed in order:
1. BaseInfra
2. AuthInfra  
3. TakInfra
4. CloudTAK
5. MediaInfra (this stack)

#### **CloudTAK Integration Issues**
```
Error: Cannot retrieve CloudTAK secrets
```
**Solution:** Verify CloudTAK stack is deployed and secrets are available:
```bash
aws secretsmanager describe-secret --secret-id TAK-<env>-CloudTAK-SigningSecret
```

#### **Docker Build Issues**
```
Error: Docker build failed
```
**Solution:** Try using pre-built images:
```bash
npm run deploy:dev -- --context usePreBuiltImages=true
```

#### **Port Conflicts**
```
Error: Port already in use
```
**Solution:** Check if insecure ports are needed:
```bash
npm run deploy:dev -- --context enableInsecurePorts=false
```

### **Debug Commands**
```bash
# Check what would be deployed
npm run synth:dev
npm run synth:prod

# See differences from current state
npm run cdk:diff:dev
npm run cdk:diff:prod

# View CloudFormation events
aws cloudformation describe-stack-events --stack-name TAK-Dev-MediaInfra --profile your-profile
```

---

## **📊 Post-Deployment**

### **Verify Deployment**
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name TAK-Dev-MediaInfra --profile your-profile

# View outputs
aws cloudformation describe-stacks --stack-name TAK-Dev-MediaInfra \
  --query 'Stacks[0].Outputs' --profile your-profile
```

### **Test Streaming Endpoints**
```bash
# Test MediaMTX API
curl -k https://media.dev.tak.nz:9997/v3/config/global/get

# Test HLS endpoint
curl -k https://media.dev.tak.nz:8888/
```

### **Cleanup**
```bash
# Destroy development environment
npx cdk destroy --context environment=dev-test --profile your-profile

# Destroy production environment (use with caution!)
npx cdk destroy --context environment=prod --profile your-profile
```

---

## **🔗 Related Documentation**

- **[Main README](../README.md)** - Project overview and quick start
- **[Architecture Guide](ARCHITECTURE.md)** - Technical architecture details
- **[Configuration Guide](PARAMETERS.md)** - Complete configuration reference
- **[Streaming Guide](STREAMING_GUIDE.md)** - MediaMTX streaming protocols
- **[Docker Image Strategy](DOCKER_IMAGE_STRATEGY.md)** - Image building and deployment
- **[Quick Reference](QUICK_REFERENCE.md)** - Fast deployment commands