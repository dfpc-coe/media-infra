import { App } from 'aws-cdk-lib';
import { MediaInfraStack } from '../../lib/media-infra-stack';
import { mockDevConfig, mockProdConfig } from '../__fixtures__/mock-configs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { MediaSecurityGroups } from '../../lib/constructs/media-security-groups';
import { MediaNlb } from '../../lib/constructs/media-nlb';
import { MediaEcsService } from '../../lib/constructs/media-ecs-service';
import { MediaEfs } from '../../lib/constructs/media-efs';

// Mock all CDK services
jest.mock('aws-cdk-lib/aws-ec2');
jest.mock('aws-cdk-lib/aws-ecs');
jest.mock('aws-cdk-lib/aws-certificatemanager');
jest.mock('aws-cdk-lib/aws-route53');
jest.mock('aws-cdk-lib/aws-secretsmanager');
jest.mock('aws-cdk-lib/aws-kms');
jest.mock('../../lib/constructs/media-security-groups');
jest.mock('../../lib/constructs/media-nlb');
jest.mock('../../lib/constructs/media-ecs-service');
jest.mock('../../lib/constructs/media-efs');
jest.mock('../../lib/outputs');

const mockVpc = {
  vpcId: 'vpc-12345',
  availabilityZones: ['us-west-2a', 'us-west-2b'],
  publicSubnets: [{ subnetId: 'subnet-pub1' }, { subnetId: 'subnet-pub2' }],
  privateSubnets: [{ subnetId: 'subnet-priv1' }, { subnetId: 'subnet-priv2' }]
};

const mockEcsCluster = {
  clusterArn: 'arn:aws:ecs:us-west-2:123456789012:cluster/test-cluster',
  clusterName: 'test-cluster'
};

const mockCertificate = {
  certificateArn: 'arn:aws:acm:us-west-2:123456789012:certificate/test-cert'
};

const mockHostedZone = {
  hostedZoneId: 'Z123456789',
  zoneName: 'tak.nz'
};

const mockKmsKey = {
  keyArn: 'arn:aws:kms:us-west-2:123456789012:key/test-key'
};

const mockSecret = {
  secretArn: 'arn:aws:secretsmanager:us-west-2:123456789012:secret:test-secret'
};

const mockSecurityGroups = {
  nlb: { securityGroupId: 'sg-nlb' },
  mediaMtx: { securityGroupId: 'sg-mediamtx' },
  efs: { securityGroupId: 'sg-efs' }
};

const mockNlb = {
  loadBalancer: { loadBalancerDnsName: 'nlb-dns-name' },
  targetGroups: { rtmp: {}, rtsp: {}, api: {} }
};

const mockMediaService = {
  service: { serviceArn: 'arn:aws:ecs:service/test-service' }
};

const mockEfs = {
  fileSystem: { fileSystemId: 'fs-12345' },
  accessPoint: { accessPointId: 'fsap-12345' }
};

describe('MediaInfraStack', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
    jest.clearAllMocks();

    // Mock CDK service constructors
    (ec2.Vpc.fromVpcAttributes as jest.Mock).mockReturnValue(mockVpc);
    (ecs.Cluster.fromClusterAttributes as jest.Mock).mockReturnValue(mockEcsCluster);
    (acm.Certificate.fromCertificateArn as jest.Mock).mockReturnValue(mockCertificate);
    (route53.HostedZone.fromHostedZoneAttributes as jest.Mock).mockReturnValue(mockHostedZone);
    (kms.Key.fromKeyArn as jest.Mock).mockReturnValue(mockKmsKey);
    (secretsmanager.Secret.fromSecretCompleteArn as jest.Mock).mockReturnValue(mockSecret);

    // Mock construct constructors
    (MediaSecurityGroups as jest.MockedClass<typeof MediaSecurityGroups>).mockImplementation(() => mockSecurityGroups as any);
    (MediaNlb as jest.MockedClass<typeof MediaNlb>).mockImplementation(() => mockNlb as any);
    (MediaEcsService as jest.MockedClass<typeof MediaEcsService>).mockImplementation(() => mockMediaService as any);
    (MediaEfs as jest.MockedClass<typeof MediaEfs>).mockImplementation(() => mockEfs as any);
  });

  describe('Class Definition', () => {
    it('exports MediaInfraStack class', () => {
      expect(MediaInfraStack).toBeDefined();
      expect(typeof MediaInfraStack).toBe('function');
    });

    it('has constructor that accepts props', () => {
      expect(MediaInfraStack.length).toBe(3); // scope, id, props
    });
  });

  describe('Configuration Validation', () => {
    it('validates dev config structure', () => {
      expect(mockDevConfig.stackName).toBe('Dev');
      expect(mockDevConfig.ecs.taskCpu).toBe(512);
      expect(mockDevConfig.ecs.taskMemory).toBe(1024);
    });

    it('validates prod config structure', () => {
      expect(mockProdConfig.stackName).toBe('Prod');
      expect(mockProdConfig.ecs.taskCpu).toBe(1024);
      expect(mockProdConfig.ecs.taskMemory).toBe(2048);
    });
  });

  describe('Stack Construction', () => {
    it('creates stack with dev environment', () => {
      const stack = new MediaInfraStack(app, 'TestStack', {
        environment: 'dev-test',
        envConfig: mockDevConfig
      });

      expect(stack).toBeInstanceOf(MediaInfraStack);
      expect(stack.stackName).toBe('TestStack');
    });

    it('creates stack with prod environment', () => {
      const stack = new MediaInfraStack(app, 'TestStack', {
        environment: 'prod',
        envConfig: mockProdConfig
      });

      expect(stack).toBeInstanceOf(MediaInfraStack);
      expect(stack.stackName).toBe('TestStack');
    });

    it('imports AWS resources', () => {
      new MediaInfraStack(app, 'TestStack', {
        environment: 'dev-test',
        envConfig: mockDevConfig
      });

      expect(ec2.Vpc.fromVpcAttributes).toHaveBeenCalled();
      expect(ecs.Cluster.fromClusterAttributes).toHaveBeenCalled();
      expect(acm.Certificate.fromCertificateArn).toHaveBeenCalled();
      expect(route53.HostedZone.fromHostedZoneAttributes).toHaveBeenCalled();
      expect(kms.Key.fromKeyArn).toHaveBeenCalled();
      expect(secretsmanager.Secret.fromSecretCompleteArn).toHaveBeenCalledTimes(2);
    });

    it('creates all required constructs', () => {
      new MediaInfraStack(app, 'TestStack', {
        environment: 'dev-test',
        envConfig: mockDevConfig
      });

      expect(MediaSecurityGroups).toHaveBeenCalledWith(
        expect.anything(),
        'SecurityGroups',
        expect.objectContaining({
          stackNameComponent: 'Dev',
          enableInsecurePorts: false
        })
      );

      expect(MediaEfs).toHaveBeenCalledWith(
        expect.anything(),
        'MediaEfs',
        expect.objectContaining({
          stackNameComponent: 'Dev'
        })
      );

      expect(MediaNlb).toHaveBeenCalledWith(
        expect.anything(),
        'MediaNlb',
        expect.objectContaining({
          stackNameComponent: 'Dev',
          enableInsecurePorts: false
        })
      );

      expect(MediaEcsService).toHaveBeenCalledWith(
        expect.anything(),
        'MediaEcsService',
        expect.objectContaining({
          environment: 'dev-test',
          envConfig: mockDevConfig,
          stackNameComponent: 'Dev'
        })
      );
    });

    it('handles insecure ports configuration', () => {
      const configWithInsecurePorts = {
        ...mockDevConfig,
        enableInsecurePorts: true
      };

      new MediaInfraStack(app, 'TestStack', {
        environment: 'dev-test',
        envConfig: configWithInsecurePorts
      });

      expect(MediaSecurityGroups).toHaveBeenCalledWith(
        expect.anything(),
        'SecurityGroups',
        expect.objectContaining({
          enableInsecurePorts: true
        })
      );

      expect(MediaNlb).toHaveBeenCalledWith(
        expect.anything(),
        'MediaNlb',
        expect.objectContaining({
          enableInsecurePorts: true
        })
      );
    });

    it('passes correct environment to ECS service', () => {
      new MediaInfraStack(app, 'TestProdStack', {
        environment: 'prod',
        envConfig: mockProdConfig
      });

      expect(MediaEcsService).toHaveBeenCalledWith(
        expect.anything(),
        'MediaEcsService',
        expect.objectContaining({
          environment: 'prod',
          envConfig: mockProdConfig
        })
      );
    });
  });
});