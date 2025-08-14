# TAK Media Infrastructure

<p align=center>Modern AWS CDK v2 media streaming infrastructure for Team Awareness Kit (TAK) deployments

## Overview

The [Team Awareness Kit (TAK)](https://tak.gov/solutions/emergency) provides Fire, Emergency Management, and First Responders an operationally agnostic tool for improved situational awareness and a common operational picture. 

This repository deploys the media streaming infrastructure layer for a complete TAK deployment, providing robust MediaMTX streaming server with advanced capabilities such as RTMP, RTSP, RTMPS, RTSPS, SRTS, and HLS protocols with CloudTAK API authentication integration - all while using [free and open source software](https://en.wikipedia.org/wiki/Free_and_open-source_software).

It is specifically targeted at the deployment of [TAK.NZ](https://tak.nz) via a CI/CD pipeline. Nevertheless others interested in deploying a similar infrastructure can do so by adapting the configuration items.

### Architecture Layers

This media infrastructure requires the base infrastructure, authentication infrastructure, TAK infrastructure, and CloudTAK layers. Layers can be deployed in multiple independent environments. As an example:

```
        PRODUCTION ENVIRONMENT                DEVELOPMENT ENVIRONMENT
        Domain: tak.nz                        Domain: dev.tak.nz

┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│        MediaInfra               │    │        MediaInfra               │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
│      (This Repository)          │    │      (This Repository)          │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│         CloudTAK                │    │         CloudTAK                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│         TakInfra                │    │         TakInfra                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│        AuthInfra                │    │        AuthInfra                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
                │                                        │
                ▼                                        ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│        BaseInfra                │    │        BaseInfra                │
│    CloudFormation Stack         │    │    CloudFormation Stack         │
└─────────────────────────────────┘    └─────────────────────────────────┘
```

| Layer | Repository | Description |
|-------|------------|-------------|
| **BaseInfra** | [`base-infra`](https://github.com/TAK-NZ/base-infra)  | Foundation: VPC, ECS, S3, KMS, ACM |
| **AuthInfra** | [`auth-infra`](https://github.com/TAK-NZ/auth-infra) | SSO via Authentik, LDAP |
| **TakInfra** | [`tak-infra`](https://github.com/TAK-NZ/tak-infra) | TAK Server |
| **CloudTAK** | [`CloudTAK`](https://github.com/TAK-NZ/CloudTAK) | CloudTAK web interface, ETL, and media services |
| **MediaInfra** | `media-infra` (this repo) | MediaMTX streaming server |

**Deployment Order**: BaseInfra must be deployed first, followed by AuthInfra, TakInfra, CloudTAK, and finally MediaInfra. Each layer imports outputs from layers below via CloudFormation exports.

## Quick Start

### Prerequisites
- [AWS Account](https://signin.aws.amazon.com/signup) with configured credentials
- Base infrastructure stack (`TAK-<n>-BaseInfra`) must be deployed first
- Authentication infrastructure stack (`TAK-<n>-AuthInfra`) must be deployed first
- TAK infrastructure stack (`TAK-<n>-TakInfra`) must be deployed first
- CloudTAK stack (`TAK-<n>-CloudTAK`) must be deployed first
- Public Route 53 hosted zone (e.g., `tak.nz`)
- [Node.js](https://nodejs.org/) and npm installed
- **For CI/CD deployment:** See [AWS & GitHub Setup Guide](docs/AWS_GITHUB_SETUP.md) for MediaInfra-specific GitHub Actions configuration

### Installation & Deployment

```bash
# 1. Install dependencies
npm install

# 2. Bootstrap CDK (first time only)
npx cdk bootstrap --profile your-aws-profile

# 3. Deploy development environment
npm run deploy:dev

# 4. Deploy production environment  
npm run deploy:prod
```

## Infrastructure Resources

### Compute & Services
- **ECS Service** - MediaMTX streaming server container
- **Network Load Balancer** - Layer 4 load balancing for streaming protocols
- **Target Groups** - RTMP, RTSP, RTMPS, RTSPS, SRTS, HLS, and API endpoints

### Security & DNS
- **Security Groups** - Fine-grained network access controls for streaming protocols
- **Route 53 Records** - MediaMTX endpoint DNS management
- **CloudTAK Integration** - Authentication via CloudTAK API

### CDK Utilities
- **Context Overrides** - Command-line parameter override system (`lib/utils/context-overrides.ts`)
- **Constants** - Centralized MediaMTX port and infrastructure constants (`lib/utils/constants.ts`)
- **Tag Helpers** - Standardized resource tagging utilities (`lib/utils/tag-helpers.ts`)

## Docker Image Strategy

This stack uses a **hybrid Docker image strategy** that supports both pre-built images from ECR and local Docker building for maximum flexibility.

- **Strategy**: See [Docker Image Strategy Guide](docs/DOCKER_IMAGE_STRATEGY.md) for details
- **CI/CD Mode**: Uses pre-built images for fast deployments
- **Development Mode**: Builds images locally for flexible development
- **Automatic Fallback**: Seamlessly switches between modes based on context parameters

### Docker Images Used

1. **MediaMTX Server**: Built from `docker/media-infra/Dockerfile` with MediaMTX and authentication integration

### Usage Modes

**CI/CD Deployments (Fast)**:
```bash
npm run deploy:dev -- --context usePreBuiltImages=true
npm run deploy:prod -- --context usePreBuiltImages=true
```

**Local Development (Flexible)**:
```bash
npm run deploy:local:dev    # Builds images locally
npm run deploy:local:prod   # Builds images locally
```

## Streaming Protocols & Ports

| Port | Protocol | Description | Security |
|------|----------|-------------|----------|
| 1935 | RTMP | RTMP streaming | Conditional (insecure) |
| 8554 | RTSP | RTSP streaming | Conditional (insecure) |
| 1936 | RTMPS | RTMP over TLS | Always enabled |
| 8555 | RTSPS | RTSP over TLS | Always enabled |
| 8890 | SRTS | SRT with encryption | Always enabled |
| 8888 | HTTPS | HLS over HTTPS | Always enabled |
| 9997 | HTTPS | MediaMTX API HTTPS | Always enabled |

**Security Note**: Insecure ports (1935, 8554) are only enabled when `enableInsecurePorts` is set to `true` in configuration.

## Available Environments

| Environment | Stack Name | Description | Domain | Monthly Cost* |
|-------------|------------|-------------|--------|---------------|
| `dev-test` | `TAK-Dev-MediaInfra` | Cost-optimized development | `media.dev.tak.nz` | ~$25 USD |
| `prod` | `TAK-Prod-MediaInfra` | High-availability production | `media.tak.nz` | ~$85 USD |

*Estimated AWS costs in USD for ap-southeast-2 region, excluding data transfer and streaming usage

## Development Workflow

### New NPM Scripts (Enhanced Developer Experience)
```bash
# Development and Testing
npm run dev                    # Build and test
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Generate coverage report

# Environment-Specific Deployment
npm run deploy:dev            # Deploy to dev-test
npm run deploy:prod           # Deploy to production
npm run synth:dev             # Preview dev infrastructure
npm run synth:prod            # Preview prod infrastructure

# Infrastructure Management
npm run cdk:diff:dev          # Show what would change in dev
npm run cdk:diff:prod         # Show what would change in prod
npm run cdk:bootstrap         # Bootstrap CDK in account
```

### Configuration System

The project uses **AWS CDK context-based configuration** for consistent deployments:

- **All settings** stored in [`cdk.json`](cdk.json) under `context` section
- **Version controlled** - consistent deployments across team members
- **Runtime overrides** - use `--context` flag for one-off changes
- **Environment-specific** - separate configs for dev-test and production

#### Configuration Override Examples
```bash
# Enable insecure ports for development
npm run deploy:dev -- --context enableInsecurePorts=true

# Use pre-built images for faster deployment
npm run deploy:prod -- --context usePreBuiltImages=true

# Override ECS configuration
npm run deploy:dev -- --context taskCpu=1024 --context taskMemory=2048 --context desiredCount=2

# Override ECR settings
npm run deploy:prod -- --context imageRetentionCount=10 --context scanOnPush=true

# Override MediaMTX version
npm run deploy:dev -- --context mediamtxVersion=v1.5.0 --context buildRevision=1
```

## 📚 Documentation

- **[🚀 Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Comprehensive deployment instructions and configuration options
- **[🏗️ Architecture Guide](docs/ARCHITECTURE.md)** - Technical architecture and design decisions  
- **[⚡ Quick Reference](docs/QUICK_REFERENCE.md)** - Fast deployment commands and environment comparison
- **[⚙️ Configuration Guide](docs/PARAMETERS.md)** - Complete configuration management reference
- **[🎥 Streaming Guide](docs/STREAMING_GUIDE.md)** - MediaMTX configuration and streaming protocols
- **[🐳 Docker Image Strategy](docs/DOCKER_IMAGE_STRATEGY.md)** - Hybrid image strategy for fast CI/CD and flexible development

## Security Features

### Enterprise-Grade Security
- **🔑 KMS Encryption** - All data encrypted with customer-managed keys
- **🛡️ Network Security** - Private subnets with controlled internet access
- **🔒 IAM Policies** - Least-privilege access patterns throughout
- **📋 Protocol Security** - TLS encryption for all production streaming protocols
- **🔐 Authentication** - CloudTAK API integration for stream authentication

## Getting Help

### Common Issues
- **Base Infrastructure** - Ensure base infrastructure stack is deployed first
- **Authentication Infrastructure** - Ensure authentication infrastructure stack is deployed first
- **TAK Infrastructure** - Ensure TAK infrastructure stack is deployed first
- **CloudTAK** - Ensure CloudTAK stack is deployed first
- **Route53 Hosted Zone** - Ensure your domain's hosted zone exists before deployment
- **AWS Permissions** - CDK requires broad permissions for CloudFormation operations
- **Docker Images** - CDK automatically handles Docker image building and ECR management
- **Stack Name Matching** - Ensure stackName parameter matches your infrastructure deployments

### Support Resources
- **AWS CDK Documentation** - https://docs.aws.amazon.com/cdk/
- **MediaMTX Documentation** - https://github.com/bluenviron/mediamtx
- **TAK-NZ Project** - https://github.com/TAK-NZ/
- **Issue Tracking** - Use GitHub Issues for bug reports and feature requests

## License

TAK.NZ is distributed under [AGPL-3.0-only](LICENSE)
Copyright (C) 2025 - Christian Elsen, Team Awareness Kit New Zealand (TAK.NZ)
Copyright (c) 2023 Public Safety TAK
