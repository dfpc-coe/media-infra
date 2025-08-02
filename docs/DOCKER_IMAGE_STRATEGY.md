# Docker Image Strategy

This document explains the hybrid Docker image strategy implemented in the MediaInfra stack, which supports both pre-built images from ECR and local Docker building for maximum flexibility.

## Overview

The stack uses a **fallback strategy** that:
1. **First tries to use pre-built images** from ECR (fast deployments)
2. **Falls back to building Docker images locally** if pre-built images aren't available

This provides the best of both worlds:
- **Fast CI/CD deployments** using pre-built images
- **Flexible local development** with on-demand building
- **MediaMTX integration** with CloudTAK authentication

## Configuration

### Context Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `usePreBuiltImages` | Enable/disable pre-built image usage | `true` or `false` |
| `mediamtxImageTag` | Tag for MediaMTX server image | `mediamtx-abc123` |

**Note**: The `mediamtxImageTag` is used for the MediaMTX streaming server container image.

### Default Behavior

- **CI/CD environments**: Uses pre-built images when available
- **Local development**: Builds images on-demand (default)
- **Manual override**: Can force either mode via context parameters

## Usage Examples

### GitHub Actions (Pre-built Images)
```bash
npm run deploy:dev -- \
  --context usePreBuiltImages=true \
  --context mediamtxImageTag=mediamtx-abc123
```

### Local Development (Build on Demand)
```bash
# Use NPM scripts for local builds (default behavior)
npm run deploy:dev     # Dev environment, build locally
npm run deploy:prod    # Prod environment, build locally

# Or explicitly disable pre-built images
npm run deploy:dev -- \
  --context usePreBuiltImages=false
```

## Image Repositories

The stack uses ECR repositories from BaseInfra:

- **MediaMTX Server**: Uses `ECR_ARTIFACTS_REPO` from BaseInfra
  - MediaMTX: `${ECR_REPO}:mediamtx-${SHA}`
- **Repository Names**: Dynamically retrieved from BaseInfra stack exports

## MediaMTX Integration
- **CloudTAK Authentication**: Integrated authentication with CloudTAK API
- **Streaming Protocols**: RTMP, RTSP, SRT, HLS support
- **Configuration Management**: Environment-based configuration

## Implementation Details

### Stack Logic
```typescript
// Determine image strategy
const usePreBuiltImages = this.node.tryGetContext('usePreBuiltImages') ?? false;
const mediamtxImageTag = this.node.tryGetContext('mediamtxImageTag');

if (usePreBuiltImages && mediamtxImageTag) {
  // Get ECR repository from BaseInfra and build image URI
  const ecrRepoArn = Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.ECR_REPO));
  const ecrRepoName = Fn.select(1, Fn.split('/', ecrRepoArn));
  const imageUri = `${account}.dkr.ecr.${region}.amazonaws.com/${Token.asString(ecrRepoName)}:${mediamtxImageTag}`;
  containerImage = ecs.ContainerImage.fromRegistry(imageUri);
} else {
  // Fall back to building Docker image asset
  const dockerImageAsset = new ecrAssets.DockerImageAsset(/* ... */);
  containerImage = ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset);
}
```

## Benefits

### Performance
- **Deployment time**: ~15 minutes → ~8 minutes (no Docker builds)
- **CI/CD efficiency**: Only builds when source code changes
- **Local flexibility**: Build on-demand for development

### Reliability
- **Separate concerns**: Image building vs infrastructure deployment
- **Retry capability**: Can retry deployments without rebuilding images
- **Error isolation**: Docker build failures don't affect infrastructure

### Flexibility
- **Environment-specific images**: Different image versions per environment
- **Easy rollbacks**: Change image tags without code changes
- **Independent lifecycle**: Manage images separately from infrastructure

## Troubleshooting

### Common Issues

**Image not found in ECR:**
```
Error: Repository does not exist or no permission to access
```
- Ensure ECR repositories exist
- Verify image tags are correct
- Check AWS permissions

**Build failures in local mode:**
```
Error: Docker build failed
```
- Ensure Docker is running locally
- Check Dockerfile syntax
- Verify build context and dependencies

### Debug Commands

```bash
# Test synthesis with pre-built images
npm run synth:dev -- \
  --context usePreBuiltImages=true \
  --context mediamtxImageTag=mediamtx-abc123

# Test synthesis with local building
npm run synth:dev -- \
  --context usePreBuiltImages=false

# Check available context
npm run cdk:context
```

## Future Enhancements

Potential improvements:
- **Automatic image discovery** from ECR latest tags
- **Image vulnerability scanning** integration
- **Multi-architecture support** (ARM64/AMD64)
- **Image caching strategies** for faster local builds