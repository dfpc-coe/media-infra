# ⚙️ Configuration Guide

## **Configuration System Overview**

The TAK Media Infrastructure uses **AWS CDK context-based configuration** for consistent, version-controlled deployments. All configuration is stored in [`cdk.json`](../cdk.json) under the `context` section.

---

## **📋 Environment Configurations**

### **Development Environment (`dev-test`)**
```json
{
  "dev-test": {
    "stackName": "Dev",
    "r53ZoneName": "dev.tak.nz",
    "enableInsecurePorts": false,
    "usePreBuiltImages": false,
    "mediamtx": {
      "desiredCount": 1,
      "cpu": 512,
      "memory": 1024
    },
    "general": {
      "removalPolicy": "DESTROY",
      "enableDetailedLogging": true
    }
  }
}
```

### **Production Environment (`prod`)**
```json
{
  "prod": {
    "stackName": "Prod", 
    "r53ZoneName": "tak.nz",
    "enableInsecurePorts": false,
    "usePreBuiltImages": false,
    "mediamtx": {
      "desiredCount": 1,
      "cpu": 1024,
      "memory": 2048
    },
    "general": {
      "removalPolicy": "RETAIN",
      "enableDetailedLogging": true
    }
  }
}
```

---

## **🔧 Configuration Parameters**

### **Core Infrastructure**

| Parameter | Type | Description | Default (dev-test) | Default (prod) |
|-----------|------|-------------|-------------------|----------------|
| `stackName` | string | CloudFormation stack name suffix | `"Dev"` | `"Prod"` |
| `environment` | string | Environment type (auto-detected) | `"dev-test"` | `"prod"` |

### **Streaming Configuration**

| Parameter | Type | Description | Default (dev-test) | Default (prod) |
|-----------|------|-------------|-------------------|----------------|
| `enableInsecurePorts` | boolean | Enable RTMP:1935 and RTSP:8554 | `false` | `false` |
| `usePreBuiltImages` | boolean | Use ECR images vs local build | `false` | `false` |

---

## **🚀 Runtime Configuration Overrides**

The MediaInfra CDK includes a comprehensive context override system that allows any configuration parameter to be overridden at deployment time via command-line arguments.

### **Basic Override Syntax**
```bash
npm run deploy:dev -- --context parameterName=value
```

### **Available Override Parameters**

#### **Top-Level Configuration**
```bash
# Stack naming
npm run deploy:dev -- --context stackName=CustomName

# Streaming protocol configuration
npm run deploy:dev -- --context enableInsecurePorts=true
npm run deploy:prod -- --context usePreBuiltImages=true
```

#### **ECS Configuration**
```bash
# Task resource allocation
npm run deploy:dev -- --context taskCpu=1024 --context taskMemory=2048

# Service scaling
npm run deploy:prod -- --context desiredCount=3

# Logging and debugging
npm run deploy:dev -- --context enableDetailedLogging=true --context enableEcsExec=true
```

#### **ECR Configuration**
```bash
# Image management
npm run deploy:prod -- --context imageRetentionCount=20 --context scanOnPush=true
```

#### **General Infrastructure**
```bash
# Resource lifecycle
npm run deploy:dev -- --context removalPolicy=DESTROY

# Monitoring
npm run deploy:prod -- --context enableContainerInsights=true
```

#### **Docker Image Configuration**
```bash
# MediaMTX image versioning
npm run deploy:dev -- --context mediamtxImageTag=v1.5.0-custom
```

#### **MediaMTX Application Configuration**
```bash
# Version management
npm run deploy:prod -- --context mediamtxVersion=v1.5.0 --context buildRevision=2
```

### **Multiple Parameter Overrides**
```bash
# Combine multiple overrides for comprehensive customization
npm run deploy:dev -- \
  --context enableInsecurePorts=true \
  --context taskCpu=1024 \
  --context taskMemory=2048 \
  --context desiredCount=2 \
  --context enableDetailedLogging=true
```

---

## **🔄 Environment Transformation**

### **Switching Environment Types**
You can transform deployed stacks between environment configurations:

```bash
# Deploy initially as dev-test
npx cdk deploy --context environment=dev-test --context stackName=Demo

# Later upgrade to production configuration
npx cdk deploy --context environment=prod --context stackName=Demo
```

### **Custom Environment Configurations**
```bash
# Create a demo environment with custom settings
npx cdk deploy \
  --context environment=dev-test \
  --context stackName=Demo
```

---

## **📊 Configuration Validation**

### **Preview Configuration Changes**
```bash
# Preview what would be deployed
npm run synth:dev
npm run synth:prod

# Show differences from current deployment
npm run cdk:diff:dev
npm run cdk:diff:prod
```

### **Validate Configuration**
```bash
# Check configuration syntax
npx cdk synth --context environment=dev-test --quiet

# Validate with overrides
npx cdk synth \
  --context environment=dev-test \
  --context enableInsecurePorts=true \
  --quiet
```

---

## **🔐 Security Configuration**

### **Secure Defaults**
- **Insecure Protocols**: Disabled by default (`enableInsecurePorts=false`)
- **TLS Encryption**: All production protocols use TLS
- **Authentication**: CloudTAK API integration required
- **Network Security**: Private subnets with security groups

### **Development Security Overrides**
```bash
# Enable insecure protocols for testing (development only)
npm run deploy:dev -- --context enableInsecurePorts=true

# Use custom authentication for isolated testing
npm run deploy:dev -- \
  --context signingSecret=dev-test-secret \
  --context mediaSecret=dev-test-media-secret
```

### **Production Security Best Practices**
- Keep `enableInsecurePorts=false` in production
- Use CloudTAK-managed authentication secrets
- Enable detailed logging for security monitoring
- Use `RETAIN` removal policy for data protection

---

## **💰 Cost Optimization**

### **Development Cost Optimization**
```bash
# Minimal resource allocation
npm run deploy:dev -- \
  --context mediamtx.cpu=256 \
  --context mediamtx.memory=512
```

### **Production Cost Considerations**
- Single task deployment for cost efficiency
- Higher resource allocation improves performance
- Consider regional data transfer costs

---

## **🛠️ Troubleshooting Configuration**

### **Common Configuration Issues**

#### **Missing Prerequisites**
```bash
# Error: Cannot find CloudFormation export
# Solution: Ensure prerequisite stacks are deployed
aws cloudformation describe-stacks --stack-name TAK-Dev-CloudTAK
```

#### **Domain Configuration Issues**
```bash
# Error: Cannot find hosted zone
# Solution: Verify Route 53 hosted zone exists
aws route53 list-hosted-zones --query 'HostedZones[?Name==`dev.tak.nz.`]'
```

### **Configuration Debugging**
```bash
# View effective configuration
npx cdk context --clear  # Clear cached context
npx cdk synth --context environment=dev-test > template.yaml

# Check parameter resolution
grep -A 10 -B 10 "enableInsecurePorts" template.yaml
```

---

## **🛠️ CDK Utilities**

The MediaInfra CDK includes several utility modules that enhance configuration management:

### **Context Override System (`lib/utils/context-overrides.ts`)**
- Enables command-line parameter overrides for all configuration values
- Handles type conversion (string to number/boolean) from CLI inputs
- Maintains configuration hierarchy with base config + overrides

### **Constants (`lib/utils/constants.ts`)**
- Centralized MediaMTX streaming protocol ports
- Infrastructure constants (EFS ports, AWS regions)
- Type-safe constant definitions

### **Tag Helpers (`lib/utils/tag-helpers.ts`)**
- Standardized resource tagging across all MediaInfra resources
- Environment-aware tag generation
- Consistent project identification tags

---

## **📚 Related Documentation**

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Step-by-step deployment instructions
- **[Architecture Guide](ARCHITECTURE.md)** - Technical architecture details
- **[Quick Reference](QUICK_REFERENCE.md)** - Fast deployment commands
- **[Streaming Guide](STREAMING_GUIDE.md)** - MediaMTX protocol configuration
- **[Docker Strategy](DOCKER_IMAGE_STRATEGY.md)** - Image building and deployment