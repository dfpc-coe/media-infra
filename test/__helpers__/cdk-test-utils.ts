/**
 * CDK testing utilities and helpers for MediaInfra
 */
import { App, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class CDKTestHelper {
  /**
   * Create a test CDK app with MediaInfra context
   */
  static createTestApp(): App {
    const app = new App();
    
    // Mock CloudFormation imports by setting them as context
    app.node.setContext('aws:cdk:enable-stack-name-duplicates', true);
    
    return app;
  }

  /**
   * Create a test CDK app and stack
   */
  static createTestStack(stackName = 'TestStack'): { app: App; stack: Stack } {
    const app = new App();
    const stack = new Stack(app, stackName);
    return { app, stack };
  }

  /**
   * Create mock VPC for testing
   */
  static createMockVpc(stack: Stack, id = 'TestVpc'): ec2.IVpc {
    return ec2.Vpc.fromVpcAttributes(stack, id, {
      vpcId: 'vpc-12345678',
      vpcCidrBlock: '10.0.0.0/16',
      availabilityZones: ['us-west-2a', 'us-west-2b'],
      privateSubnetIds: ['subnet-12345678', 'subnet-87654321'],
      publicSubnetIds: ['subnet-11111111', 'subnet-22222222']
    });
  }

  /**
   * Create mock ECS cluster
   */
  static createMockEcsCluster(stack: Stack, vpc: ec2.IVpc): ecs.ICluster {
    return ecs.Cluster.fromClusterAttributes(stack, 'TestCluster', {
      clusterName: 'test-cluster',
      vpc,
      securityGroups: []
    });
  }

  /**
   * Create mock KMS key
   */
  static createMockKmsKey(stack: Stack): kms.IKey {
    return kms.Key.fromKeyArn(
      stack, 'TestKey',
      'arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012'
    );
  }

  /**
   * Create mock CloudTAK secrets
   */
  static createMockCloudTakSecrets(stack: Stack) {
    return {
      signingSecret: secretsmanager.Secret.fromSecretCompleteArn(
        stack, 'SigningSecret',
        'arn:aws:secretsmanager:us-west-2:123456789012:secret:signing-secret-AbCdEf'
      ),
      mediaSecret: secretsmanager.Secret.fromSecretCompleteArn(
        stack, 'MediaSecret',
        'arn:aws:secretsmanager:us-west-2:123456789012:secret:media-secret-AbCdEf'
      )
    };
  }

  /**
   * Create mock security group
   */
  static createMockSecurityGroup(stack: Stack, vpc: ec2.IVpc): ec2.SecurityGroup {
    return new ec2.SecurityGroup(stack, 'TestSG', {
      vpc,
      description: 'Test security group',
      allowAllOutbound: true
    });
  }
}

export interface CloudFormationResource {
  Type: string;
  Properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CloudFormationOutput {
  Value: unknown;
  Description?: string;
  Export?: { Name: string };
  [key: string]: unknown;
}

export interface CloudFormationTemplate {
  Resources?: Record<string, CloudFormationResource>;
  Outputs?: Record<string, CloudFormationOutput>;
  Parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export function getResourceByType(template: CloudFormationTemplate, type: string): CloudFormationResource[] {
  return Object.values(template.Resources || {}).filter((r: CloudFormationResource) => r.Type === type);
}

export function getOutputByName(template: CloudFormationTemplate, name: string): CloudFormationOutput | undefined {
  return template.Outputs?.[name];
}