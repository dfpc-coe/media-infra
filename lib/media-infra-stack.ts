import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackProps, Fn } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';

// Construct imports
import { MediaSecurityGroups } from './constructs/media-security-groups';
import { MediaNlb } from './constructs/media-nlb';
import { MediaEcsService } from './constructs/media-ecs-service';
import { MediaEfs } from './constructs/media-efs';

// Utility imports
import { registerOutputs } from './outputs';
import { ContextEnvironmentConfig } from './stack-config';
import { 
  createBaseImportValue, 
  createAuthImportValue, 
  createTakImportValue,
  createCloudTakImportValue,
  BASE_EXPORT_NAMES,
  AUTH_EXPORT_NAMES,
  TAK_EXPORT_NAMES,
  CLOUDTAK_EXPORT_NAMES
} from './cloudformation-imports';

export interface MediaInfraStackProps extends StackProps {
  environment: 'prod' | 'dev-test';
  envConfig: ContextEnvironmentConfig;
}

/**
 * Main CDK stack for the TAK Media Infrastructure
 */
export class MediaInfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MediaInfraStackProps) {
    super(scope, id, {
      ...props,
      description: 'TAK Media Layer - MediaMTX Streaming Server with NLB',
    });

    const { envConfig } = props;
    const stackNameComponent = envConfig.stackName;

    // =================
    // IMPORT BASE INFRASTRUCTURE RESOURCES
    // =================

    // Import VPC and networking from base infrastructure
    const vpcAvailabilityZones = this.availabilityZones.slice(0, 2);
    
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
      vpcId: Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.VPC_ID)),
      availabilityZones: vpcAvailabilityZones,
      publicSubnetIds: [
        Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.SUBNET_PUBLIC_A)),
        Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.SUBNET_PUBLIC_B))
      ],
      privateSubnetIds: [
        Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.SUBNET_PRIVATE_A)),
        Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.SUBNET_PRIVATE_B))
      ],
      vpcCidrBlock: Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.VPC_CIDR_IPV4))
    });

    // ECS Cluster
    const ecsClusterArn = Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.ECS_CLUSTER));
    const ecsClusterName = Fn.select(1, Fn.split('/', ecsClusterArn));
    const ecsCluster = ecs.Cluster.fromClusterAttributes(this, 'ECSCluster', {
      clusterArn: ecsClusterArn,
      clusterName: ecsClusterName,
      vpc: vpc
    });

    // SSL Certificate
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate',
      Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.CERTIFICATE_ARN))
    );

    // Route53 Hosted Zone
    const hostedZoneId = Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.HOSTED_ZONE_ID));
    const hostedZoneName = Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.HOSTED_ZONE_NAME));
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: hostedZoneName,
    });

    // KMS Key for secrets encryption
    const kmsKey = kms.Key.fromKeyArn(this, 'KmsKey',
      Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.KMS_KEY))
    );

    // =================
    // IMPORT SECRETS FROM OTHER STACKS
    // =================

    // Signing secret from CloudTAK
    const signingSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'SigningSecret',
      Fn.importValue(createCloudTakImportValue(stackNameComponent, CLOUDTAK_EXPORT_NAMES.SIGNING_SECRET))
    );

    // Media secret from CloudTAK
    const mediaSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'MediaSecret',
      Fn.importValue(createCloudTakImportValue(stackNameComponent, CLOUDTAK_EXPORT_NAMES.MEDIA_SECRET))
    );

    // CloudTAK service URL
    const cloudTakUrl = Fn.importValue(createCloudTakImportValue(stackNameComponent, CLOUDTAK_EXPORT_NAMES.SERVICE_URL));

    // =================
    // EXTRACT MEDIA HOSTNAME FROM CLOUDTAK EXPORT
    // =================

    // Extract hostname from CloudTAK MediaUrl export
    const mediaUrl = Fn.importValue(createCloudTakImportValue(stackNameComponent, 'MediaUrl'));
    const mediaHostname = Fn.select(0, Fn.split('.', Fn.select(2, Fn.split('/', mediaUrl))));

    // =================
    // CREATE SECURITY GROUPS
    // =================

    const securityGroups = new MediaSecurityGroups(this, 'SecurityGroups', {
      vpc,
      stackNameComponent,
      enableInsecurePorts: envConfig.enableInsecurePorts,
    });

    // =================
    // CREATE EFS
    // =================

    const mediaEfs = new MediaEfs(this, 'MediaEfs', {
      vpc,
      kmsKey,
      stackNameComponent,
      efsSecurityGroup: securityGroups.efs,
    });

    // =================
    // CREATE NETWORK LOAD BALANCER
    // =================

    const nlb = new MediaNlb(this, 'MediaNlb', {
      vpc,
      certificate,
      hostedZone,
      mediaHostname,
      stackNameComponent,
      enableInsecurePorts: envConfig.enableInsecurePorts,
      nlbSecurityGroup: securityGroups.nlb,
    });

    // =================
    // CREATE MEDIAMTX ECS SERVICE
    // =================

    const mediaService = new MediaEcsService(this, 'MediaEcsService', {
      environment: props.environment,
      envConfig,
      vpc,
      ecsCluster,
      securityGroup: securityGroups.mediaMtx,
      targetGroups: nlb.targetGroups,
      signingSecret,
      mediaSecret,
      cloudTakUrl,
      stackNameComponent,
      kmsKey,
      efsFileSystemId: mediaEfs.fileSystem.fileSystemId,
      efsAccessPointId: mediaEfs.accessPoint.accessPointId,
    });

    // =================
    // STACK OUTPUTS
    // =================

    registerOutputs({
      stack: this,
      stackName: this.stackName,
      nlbDnsName: nlb.loadBalancer.loadBalancerDnsName,
      mediaUrl: `https://${mediaHostname}.${hostedZoneName}:9997`,
      ecsServiceArn: mediaService.service.serviceArn,
    });
  }
}