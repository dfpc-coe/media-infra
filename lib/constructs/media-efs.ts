import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface MediaEfsProps {
  vpc: ec2.IVpc;
  kmsKey: kms.IKey;
  stackNameComponent: string;
  efsSecurityGroup: ec2.SecurityGroup;
}

export class MediaEfs extends Construct {
  public readonly fileSystem: efs.FileSystem;
  public readonly accessPoint: efs.AccessPoint;

  constructor(scope: Construct, id: string, props: MediaEfsProps) {
    super(scope, id);

    // Create EFS file system with mount targets in private subnets (where ECS containers run)
    this.fileSystem = new efs.FileSystem(this, 'MediaEfsFileSystem', {
      vpc: props.vpc,
      encrypted: true,
      kmsKey: props.kmsKey,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroup: props.efsSecurityGroup,
    });

    // Create access point for MediaMTX configuration
    this.accessPoint = new efs.AccessPoint(this, 'MediaMtxAccessPoint', {
      fileSystem: this.fileSystem,
      path: '/mediamtx',
      createAcl: {
        ownerUid: '1000',
        ownerGid: '1000',
        permissions: '755',
      },
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    });
  }
}