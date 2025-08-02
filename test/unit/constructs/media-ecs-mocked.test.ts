jest.mock('aws-cdk-lib/aws-ecs', () => ({
  ...jest.requireActual('aws-cdk-lib/aws-ecs'),
  FargateTaskDefinition: jest.fn().mockImplementation(() => ({
    addContainer: jest.fn().mockReturnValue({
      addPortMappings: jest.fn(),
      addMountPoints: jest.fn()
    }),
    addVolume: jest.fn(),
    taskRole: {
      addToPrincipalOrResource: jest.fn()
    },
    executionRole: {
      addToPrincipalOrResource: jest.fn(),
      addToPolicy: jest.fn()
    }
  })),
  FargateService: jest.fn().mockImplementation(() => ({
    serviceArn: 'arn:aws:ecs:us-west-2:123456789012:service/test',
    loadBalancerTarget: jest.fn()
  })),
  LogDriver: {
    awsLogs: jest.fn()
  },
  Protocol: { TCP: 'tcp', UDP: 'udp' }
}));

jest.mock('aws-cdk-lib/aws-logs', () => ({
  LogGroup: jest.fn().mockImplementation(() => ({})),
  RetentionDays: { ONE_WEEK: 7 }
}));

jest.mock('aws-cdk-lib/aws-iam', () => ({
  Role: jest.fn().mockImplementation(() => ({
    addToPolicy: jest.fn()
  })),
  ServicePrincipal: jest.fn(),
  PolicyStatement: jest.fn().mockImplementation(() => ({
    addActions: jest.fn(),
    addResources: jest.fn()
  })),
  Effect: { ALLOW: 'Allow' }
}));

import { MediaEcsService } from '../../../lib/constructs/media-ecs-service';
import { App, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { mockDevConfig } from '../../__fixtures__/mock-configs';

describe('MediaEcsService Construct (Mocked)', () => {
  let app: App;
  let stack: Stack;
  let vpc: ec2.IVpc;
  let ecsCluster: ecs.ICluster;
  let securityGroup: ec2.SecurityGroup;
  let targetGroups: any;
  let signingSecret: secretsmanager.ISecret;
  let mediaSecret: secretsmanager.ISecret;
  let kmsKey: kms.IKey;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    
    vpc = ec2.Vpc.fromVpcAttributes(stack, 'TestVpc', {
      vpcId: 'vpc-12345',
      availabilityZones: ['us-west-2a', 'us-west-2b'],
      privateSubnetIds: ['subnet-1', 'subnet-2'],
      publicSubnetIds: ['subnet-3', 'subnet-4']
    });

    ecsCluster = ecs.Cluster.fromClusterAttributes(stack, 'TestCluster', {
      clusterName: 'test-cluster',
      vpc,
      securityGroups: []
    });

    securityGroup = new ec2.SecurityGroup(stack, 'TestSG', {
      vpc,
      description: 'Test security group'
    });

    targetGroups = {
      rtmp: { addTarget: jest.fn() } as any,
      rtsp: { addTarget: jest.fn() } as any,
      srts: { addTarget: jest.fn() } as any,
      hls: { addTarget: jest.fn() } as any,
      api: { addTarget: jest.fn() } as any
    };

    signingSecret = {
      grantRead: jest.fn()
    } as any;
    mediaSecret = {
      grantRead: jest.fn()
    } as any;
    kmsKey = {
      grantDecrypt: jest.fn()
    } as any;
  });

  it('creates MediaEcsService construct successfully', () => {
    expect(() => {
      new MediaEcsService(stack, 'TestMediaEcsService', {
        environment: 'dev-test',
        envConfig: mockDevConfig,
        infrastructure: {
          vpc,
          ecsCluster,
          kmsKey,
          securityGroups: {
            mediaMtx: securityGroup,
            nlb: securityGroup,
            efs: securityGroup
          }
        },
        network: {
          hostedZone: {} as any,
          certificate: {} as any,
          mediaHostname: 'media',
          hostedZoneName: 'test.com'
        },
        secrets: {
          signingSecret,
          mediaSecret,
          cloudTakUrl: 'https://cloudtak.test.com'
        },
        storage: {
          efs: {
            fileSystemId: 'fs-12345678',
            accessPointId: 'fsap-12345678'
          }
        },
        targetGroups,
        stackNameComponent: 'Dev'
      });
    }).not.toThrow();
  });
});