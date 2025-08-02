jest.mock('aws-cdk-lib/aws-efs', () => ({
  FileSystem: jest.fn().mockImplementation(() => ({
    fileSystemId: 'fs-12345678'
  })),
  AccessPoint: jest.fn().mockImplementation(() => ({
    accessPointId: 'fsap-12345678'
  })),
  PerformanceMode: { GENERAL_PURPOSE: 'generalPurpose' }
}));

import { MediaEfs } from '../../../lib/constructs/media-efs';
import { App, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';

describe('MediaEfs Construct (Mocked)', () => {
  let app: App;
  let stack: Stack;
  let vpc: ec2.IVpc;
  let kmsKey: kms.IKey;
  let efsSecurityGroup: ec2.SecurityGroup;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    
    vpc = ec2.Vpc.fromVpcAttributes(stack, 'TestVpc', {
      vpcId: 'vpc-12345',
      availabilityZones: ['us-west-2a', 'us-west-2b'],
      privateSubnetIds: ['subnet-1', 'subnet-2'],
      publicSubnetIds: ['subnet-3', 'subnet-4']
    });

    kmsKey = kms.Key.fromKeyArn(stack, 'TestKey', 'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012');
    
    efsSecurityGroup = new ec2.SecurityGroup(stack, 'TestEfsSG', {
      vpc,
      description: 'Test EFS security group'
    });
  });

  it('creates MediaEfs construct successfully', () => {
    expect(() => {
      new MediaEfs(stack, 'TestMediaEfs', {
        vpc,
        kmsKey,
        stackNameComponent: 'Dev',
        efsSecurityGroup
      });
    }).not.toThrow();
  });
});