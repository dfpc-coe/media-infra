// Mock CDK modules to test construct logic without synthesis
jest.mock('aws-cdk-lib/aws-elasticloadbalancingv2', () => ({
  NetworkLoadBalancer: jest.fn().mockImplementation(() => ({
    loadBalancerDnsName: 'mock-nlb.elb.amazonaws.com',
    addListener: jest.fn()
  })),
  NetworkTargetGroup: jest.fn().mockImplementation(() => ({})),
  NetworkListener: jest.fn().mockImplementation(() => ({})),
  Protocol: { TCP: 'TCP', UDP: 'UDP', TLS: 'TLS' },
  TargetType: { IP: 'ip' },
  IpAddressType: { IPV4: 'ipv4' }
}));

jest.mock('aws-cdk-lib/aws-route53', () => ({
  ...jest.requireActual('aws-cdk-lib/aws-route53'),
  ARecord: jest.fn().mockImplementation(() => ({})),
  RecordTarget: {
    fromAlias: jest.fn()
  }
}));

jest.mock('aws-cdk-lib/aws-route53-targets', () => ({
  LoadBalancerTarget: jest.fn()
}));

import { MediaNlb } from '../../../lib/constructs/media-nlb';
import { App, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

describe('MediaNlb Construct (Mocked)', () => {
  let app: App;
  let stack: Stack;
  let vpc: ec2.IVpc;
  let certificate: acm.ICertificate;
  let hostedZone: route53.IHostedZone;
  let securityGroup: ec2.SecurityGroup;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    
    vpc = ec2.Vpc.fromVpcAttributes(stack, 'TestVpc', {
      vpcId: 'vpc-12345',
      availabilityZones: ['us-west-2a', 'us-west-2b'],
      privateSubnetIds: ['subnet-1', 'subnet-2'],
      publicSubnetIds: ['subnet-3', 'subnet-4']
    });

    certificate = acm.Certificate.fromCertificateArn(stack, 'TestCert', 'arn:aws:acm:us-west-2:123456789012:certificate/test');
    hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'TestZone', {
      hostedZoneId: 'Z123456789',
      zoneName: 'test.com'
    });
    securityGroup = new ec2.SecurityGroup(stack, 'TestSG', {
      vpc,
      description: 'Test security group'
    });
  });

  it('creates MediaNlb construct successfully', () => {
    expect(() => {
      new MediaNlb(stack, 'TestMediaNlb', {
        vpc,
        certificate,
        hostedZone,
        mediaHostname: 'media',
        stackNameComponent: 'Dev',
        enableInsecurePorts: false,
        nlbSecurityGroup: securityGroup
      });
    }).not.toThrow();
  });

  it('creates MediaNlb with insecure ports enabled', () => {
    expect(() => {
      new MediaNlb(stack, 'TestMediaNlb', {
        vpc,
        certificate,
        hostedZone,
        mediaHostname: 'media',
        stackNameComponent: 'Dev',
        enableInsecurePorts: true,
        nlbSecurityGroup: securityGroup
      });
    }).not.toThrow();
  });
});