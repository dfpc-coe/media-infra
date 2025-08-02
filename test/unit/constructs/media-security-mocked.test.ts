jest.mock('aws-cdk-lib/aws-ec2', () => ({
  ...jest.requireActual('aws-cdk-lib/aws-ec2'),
  SecurityGroup: jest.fn().mockImplementation((scope, id, props) => ({
    securityGroupId: 'sg-12345678',
    addIngressRule: jest.fn(),
    addEgressRule: jest.fn()
  }))
}));

import { MediaSecurityGroups } from '../../../lib/constructs/media-security-groups';
import { App, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

describe('MediaSecurityGroups Construct (Mocked)', () => {
  let app: App;
  let stack: Stack;
  let vpc: ec2.IVpc;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    
    vpc = ec2.Vpc.fromVpcAttributes(stack, 'TestVpc', {
      vpcId: 'vpc-12345',
      vpcCidrBlock: '10.0.0.0/16',
      availabilityZones: ['us-west-2a', 'us-west-2b'],
      privateSubnetIds: ['subnet-1', 'subnet-2'],
      publicSubnetIds: ['subnet-3', 'subnet-4']
    });
  });

  it('creates MediaSecurityGroups construct successfully', () => {
    expect(() => {
      new MediaSecurityGroups(stack, 'TestMediaSecurityGroups', {
        vpc,
        enableInsecurePorts: false,
        stackNameComponent: 'Dev'
      });
    }).not.toThrow();
  });

  it('creates MediaSecurityGroups with insecure ports enabled', () => {
    expect(() => {
      new MediaSecurityGroups(stack, 'TestMediaSecurityGroups', {
        vpc,
        enableInsecurePorts: true,
        stackNameComponent: 'Dev'
      });
    }).not.toThrow();
  });
});