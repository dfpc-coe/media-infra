# Architecture Documentation

## System Architecture

The TAK Media Infrastructure provides MediaMTX streaming server capabilities for TAK deployments, supporting multiple streaming protocols with CloudTAK authentication integration. This CDK-based infrastructure creates a secure, scalable media streaming foundation.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Streaming     │────│  Network Load    │────│   Route 53      │
│   Clients       │    │  Balancer        │    │ DNS Records     │
│ (ATAK/iTAK/OBS) │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                         │
                        ┌───────┴─────────┐               │
                        │                 │               │ DNS Resolution
                ┌───────▼────────┐ ┌──────▼────────┐      │
                │  Target Group  │ │ Target Group  │      │
                │   RTMPS:1936   │ │  RTSPS:8555   │      ▼
                │   RTMP:1935*   │ │  RTSP:8554*   │ ┌─────────────┐
                │                │ │               │ │   ACM SSL   │
                │ ┌─────────────┐│ │┌─────────────┐│ │ Certificate │
                │ │   Health    ││ ││   Health    ││ │   (Shared)  │
                │ │   Checks    ││ ││   Checks    ││ └─────────────┘
                │ └─────────────┘│ │└─────────────┘│
                └───────┬────────┘ └───────┬───────┘
                        │                  │
                ┌───────▼────────┐ ┌──────▼────────┐
                │ Target Group   │ │Target Group   │
                │  SRTS:8890     │ │  HLS:8888     │
                │                │ │  API:9997     │
                └───────┬────────┘ └──────┬────────┘
                        │                 │
                        ▼                 ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │                    ECS Service (Fargate)                         │
        │                                                                  │
        │  ┌─────────────────────────────────────────────────────────────┐ │
        │  │                  MediaMTX Container                         │ │
        │  │                                                             │ │
        │  │  ┌─────────────┐     ┌─────────────────────────────────────┐│ │
        │  │  │   MediaMTX  │     │        Authentication               ││ │
        │  │  │   Server    │────▶│         Integration                 ││ │
        │  │  │             │     │                                     ││ │
        │  │  │ ┌─────────┐ │     │ ┌─────────┐ ┌─────────┐ ┌──────────┐││ │
        │  │  │ │ RTMP(S) │ │     │ │CloudTAK │ │Signing  │ │  Media   │││ │
        │  │  │ │ Server  │ │     │ │   API   │ │ Secret  │ │ Secret   │││ │
        │  │  │ └─────────┘ │     │ └─────────┘ └─────────┘ └──────────┘││ │
        │  │  │             │     │                                     ││ │
        │  │  │ ┌─────────┐ │     │ ┌─────────────────────────────────┐ ││ │
        │  │  │ │ RTSP(S) │ │     │ │       Stream Authentication     │ ││ │
        │  │  │ │ Server  │ │     │ │      via CloudTAK API           │ ││ │
        │  │  │ └─────────┘ │     │ └─────────────────────────────────┘ ││ │
        │  │  │             │     └─────────────────────────────────────┘│ │
        │  │  │ ┌─────────┐ │                                            │ │
        │  │  │ │   SRT   │ │                                            │ │
        │  │  │ │ Server  │ │                                            │ │
        │  │  │ └─────────┘ │                                            │ │
        │  │  │             │                                            │ │
        │  │  │ ┌─────────┐ │                                            │ │
        │  │  │ │   HLS   │ │                                            │ │
        │  │  │ │ Server  │ │                                            │ │
        │  │  │ └─────────┘ │                                            │ │
        │  │  └─────────────┘                                            │ │
        │  └─────────────────────────────────────────────────────────────┘ │
        └──────────────────────────────────────────────────────────────────┘

* Insecure protocols (RTMP:1935, RTSP:8554) only enabled when enableInsecurePorts=true
```

## Component Details

### Core Infrastructure

#### 1. MediaMTX Streaming Server
- **Technology**: MediaMTX (formerly rtsp-simple-server) containerized application
- **Purpose**: Multi-protocol streaming server supporting RTMP, RTSP, SRT, HLS
- **Container Platform**: AWS ECS Fargate for serverless container execution
- **Scaling**: Fixed desired count (1 task)
- **Configuration**: Dynamic configuration via environment variables

#### 2. Network Load Balancer (NLB)
- **Technology**: AWS Network Load Balancer (Layer 4)
- **Purpose**: High-performance load balancing for streaming protocols
- **Protocol Support**: TCP and UDP load balancing for all streaming protocols
- **Health Checks**: Protocol-specific health checks for service availability
- **SSL Termination**: TLS termination for secure protocols (RTMPS, RTSPS)

#### 3. Target Groups
- **RTMP/RTMPS**: Real-Time Messaging Protocol for live streaming
- **RTSP/RTSPS**: Real-Time Streaming Protocol for media streaming
- **SRT/SRTS**: Secure Reliable Transport for low-latency streaming
- **HLS**: HTTP Live Streaming for adaptive bitrate streaming
- **API**: MediaMTX management API for configuration and monitoring

### Security Architecture

#### 1. Protocol Security
- **Secure by Default**: All production deployments use encrypted protocols
- **TLS Encryption**: RTMPS, RTSPS, SRTS, HLS over HTTPS
- **Optional Insecure**: RTMP and RTSP available for development only
- **Certificate Management**: Shared ACM certificate from base infrastructure

#### 2. Authentication Integration
- **CloudTAK API**: Stream authentication via CloudTAK user management
- **Signing Secret**: JWT token validation for stream access
- **Media Secret**: Additional authentication layer for media streams
- **AWS Secrets Manager**: Secure storage of authentication credentials

#### 3. Network Security
- **Security Groups**: Fine-grained access control for streaming ports
- **Private Networking**: ECS tasks run in private subnets
- **VPC Integration**: Leverages base infrastructure VPC and security

### Streaming Protocols

#### 1. RTMP/RTMPS (Real-Time Messaging Protocol)
- **Port**: 1935 (RTMP), 1936 (RTMPS)
- **Use Case**: Live streaming from OBS, streaming software
- **Security**: TLS encryption for RTMPS
- **Authentication**: CloudTAK API integration

#### 2. RTSP/RTSPS (Real-Time Streaming Protocol)
- **Port**: 8554 (RTSP), 8555 (RTSPS)
- **Use Case**: IP camera streams, media players
- **Security**: TLS encryption for RTSPS
- **Features**: Bidirectional communication, session management

#### 3. SRT/SRTS (Secure Reliable Transport)
- **Port**: 8890
- **Use Case**: Low-latency streaming with error correction
- **Security**: Built-in encryption and authentication
- **Features**: Adaptive bitrate, packet recovery

#### 4. HLS (HTTP Live Streaming)
- **Port**: 8888 (HTTPS)
- **Use Case**: Adaptive streaming for web browsers, mobile apps
- **Security**: HTTPS encryption
- **Features**: Adaptive bitrate, wide client compatibility

#### 5. MediaMTX API
- **Port**: 9997 (HTTPS)
- **Use Case**: Server configuration, monitoring, stream management
- **Security**: HTTPS with authentication
- **Features**: RESTful API, real-time metrics

### Container Architecture

#### 1. MediaMTX Container
- **Base Image**: Alpine Linux for minimal attack surface
- **MediaMTX Version**: Latest stable release with security patches
- **Configuration**: Environment variable-driven configuration
- **Logging**: Structured logging to CloudWatch
- **Health Checks**: Multi-protocol health monitoring

#### 2. Authentication Integration
- **CloudTAK API Client**: HTTP client for user authentication
- **Token Validation**: JWT token verification for stream access
- **User Management**: Integration with CloudTAK user database
- **Session Management**: Stream session tracking and management

### Deployment Architecture

#### 1. Docker Image Strategy
- **Hybrid Approach**: Pre-built ECR images for CI/CD, local building for development
- **CI/CD Optimization**: Fast deployments using pre-built images (~5 minutes)
- **Development Flexibility**: Local image building for customization
- **Automatic Fallback**: Context-driven image selection

#### 2. Environment Configuration
- **dev-test**: Cost-optimized with basic scaling (1 task)
- **prod**: High-availability with auto-scaling (2+ tasks)
- **Context-Driven**: Environment-specific configuration via CDK context
- **Override Capability**: Runtime configuration overrides

### Integration Points

#### 1. Base Infrastructure Dependencies
- **VPC**: Shared networking infrastructure
- **ECS Cluster**: Shared container orchestration platform
- **KMS**: Encryption keys for secrets and storage
- **ACM Certificate**: SSL/TLS certificates for secure protocols

#### 2. CloudTAK Dependencies
- **Authentication API**: User authentication and authorization
- **Signing Secret**: JWT token signing and validation
- **Media Secret**: Additional authentication layer
- **User Database**: Stream access control

#### 3. DNS and Service Discovery
- **Route 53**: DNS records for streaming endpoints
- **Service Discovery**: ECS service registration
- **Health Monitoring**: CloudWatch metrics and alarms
- **Load Balancer Integration**: Automatic target registration

### Monitoring and Observability

#### 1. CloudWatch Integration
- **Container Metrics**: CPU, memory, network utilization
- **Application Logs**: MediaMTX server logs and access logs
- **Custom Metrics**: Stream count, connection metrics
- **Alarms**: Automated alerting for service health

#### 2. Health Checks
- **NLB Health Checks**: Protocol-specific availability monitoring
- **ECS Health Checks**: Container health and restart policies
- **Application Health**: MediaMTX API health endpoints
- **Stream Health**: Active stream monitoring and metrics