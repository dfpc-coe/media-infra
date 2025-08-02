# Test Organization Summary

## Test Suite Structure

### 📁 **test/unit/media-infra-stack.test.ts** - Main Stack Tests
- **Purpose**: Tests MediaInfraStack creation and resource generation
- **Coverage**: 
  - Stack creation with dev-test and prod configurations
  - ECS service, NLB, target groups, security groups creation
  - Route53 record creation
  - Configuration validation and resource allocation

### 📁 **test/unit/constructs/media-nlb.test.ts** - Network Load Balancer
- **Purpose**: Tests MediaNLB construct for streaming protocol load balancing
- **Coverage**:
  - NLB creation with internet-facing scheme
  - Target group creation for all streaming protocols (RTMPS, RTSPS, SRT, HLS, API)
  - Listener configuration with TLS/TCP/UDP protocols
  - Insecure port handling (RTMP, RTSP) based on configuration
  - Health check configuration

### 📁 **test/unit/constructs/media-ecs-service.test.ts** - ECS Service
- **Purpose**: Tests MediaEcsService construct for MediaMTX container deployment
- **Coverage**:
  - ECS service and task definition creation
  - Container configuration with port mappings
  - Environment variables and secrets integration
  - Pre-built vs local image handling
  - Resource scaling (CPU/memory allocation)
  - CloudWatch logging configuration

### 📁 **test/unit/constructs/media-security-groups.test.ts** - Security Groups
- **Purpose**: Tests MediaSecurityGroups construct for network access control
- **Coverage**:
  - Security group creation for MediaMTX and NLB
  - Ingress rules for secure protocols (RTMPS, RTSPS, SRT, HLS, API)
  - Conditional insecure port rules (RTMP, RTSP)
  - Internal communication between NLB and MediaMTX
  - Egress rules configuration

### 📁 **test/integration/media-infra-stack.test.ts** - Integration Tests
- **Purpose**: High-level integration testing of complete stack
- **Coverage**:
  - Stack synthesis without errors for both environments
  - Environment-specific deployment validation
  - CloudFormation export dependency handling
  - Context override integration testing
  - Insecure ports and pre-built images integration

### 📁 **test/validation/config-validation.test.ts** - Configuration Validation
- **Purpose**: Tests configuration validation and error handling
- **Coverage**:
  - Required configuration validation (stack name, Route53 zone)
  - MediaMTX configuration validation (desired count, CPU, memory)
  - Fargate CPU/memory combination validation
  - Boolean configuration type validation
  - Environment-specific security validation
  - Context override validation

### 📁 **test/__helpers__/cdk-test-utils.ts** - Test Utilities
- **Purpose**: Shared utilities and helpers for CDK testing
- **Coverage**:
  - Test app creation with MediaInfra context
  - Mock resource creation (VPC, ECS cluster, security groups)
  - CloudTAK secrets mocking
  - CloudFormation template analysis utilities

### 📁 **test/__fixtures__/mock-configs.ts** - Test Fixtures
- **Purpose**: Mock configurations and test data
- **Coverage**:
  - Dev and prod environment configurations
  - Invalid configuration examples
  - CloudFormation export mocks

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test suite
npm test -- media-infra-stack.test.ts
npm test -- media-nlb.test.ts
npm test -- media-ecs-service.test.ts
npm test -- media-security-groups.test.ts
npm test -- integration/
npm test -- validation/

# Run tests with specific pattern
npm test -- --testPathPattern="unit|integration|validation"
```

## Test Coverage Summary

- **Total Test Suites**: 6 main suites + 2 helper files
- **All Constructs Covered**: ✅ Yes (MediaNLB, MediaEcsService, MediaSecurityGroups)
- **Integration Tests**: ✅ Yes (Stack synthesis and environment testing)
- **Configuration Validation**: ✅ Yes (Input validation and error handling)
- **Utility Functions**: ✅ Yes (Test helpers and fixtures)

## MediaInfra-Specific Testing

### **Streaming Protocol Testing**
- Tests all supported protocols (RTMPS, RTSPS, SRT, HLS, API)
- Validates insecure protocol handling (RTMP, RTSP)
- Verifies port mappings and target group configurations

### **CloudTAK Integration Testing**
- Tests authentication secret integration
- Validates environment variable configuration
- Verifies CloudTAK URL configuration

### **Docker Image Strategy Testing**
- Tests pre-built image vs local building logic
- Validates image tag handling
- Verifies ECR integration patterns

### **Security Testing**
- Tests security group rule creation
- Validates protocol-specific access controls
- Verifies internal communication rules

### **Resource Allocation Testing**
- Tests CPU/memory configuration validation
- Validates Fargate compatibility
- Tests environment-specific resource scaling

## Test Organization Benefits

- **Comprehensive Coverage**: All constructs and integration points tested
- **Environment Validation**: Both dev-test and prod configurations tested
- **Error Handling**: Configuration validation and error scenarios covered
- **Maintainability**: Shared utilities and fixtures reduce code duplication
- **CI/CD Ready**: Test structure supports automated testing pipelines