/**
 * Configuration interfaces for MediaInfra constructs
 */

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

/**
 * Infrastructure configuration
 */
export interface InfrastructureConfig {
  vpc: ec2.IVpc;
  ecsCluster: ecs.ICluster;
  kmsKey: kms.IKey;
  securityGroups: {
    mediaMtx: ec2.SecurityGroup;
    nlb: ec2.SecurityGroup;
    efs: ec2.SecurityGroup;
  };
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  hostedZone: route53.IHostedZone;
  certificate: acm.ICertificate;
  mediaHostname: string;
  hostedZoneName: string;
}

/**
 * Secrets configuration
 */
export interface SecretsConfig {
  signingSecret: secretsmanager.ISecret;
  mediaSecret: secretsmanager.ISecret;
  cloudTakUrl: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  efs: {
    fileSystemId: string;
    accessPointId: string;
  };
}