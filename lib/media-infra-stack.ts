import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackProps, Fn, Token } from 'aws-cdk-lib';
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
import { MEDIAMTX_PORTS } from './utils/constants';

// Utility imports
import { registerOutputs } from './outputs';
import { ContextEnvironmentConfig } from './stack-config';
import { validateEnvType, validateStackName, validateMediaMtxConfig } from './utils/validation';
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
import type { InfrastructureConfig, NetworkConfig, SecretsConfig, StorageConfig } from './construct-configs';

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

    // Validate configuration early
    validateEnvType(props.environment);
    validateStackName(props.envConfig.stackName);
    validateMediaMtxConfig(props.envConfig);

    // Use environment configuration directly
    const { envConfig } = props;
    
    // Extract configuration values directly from envConfig
    const stackNameComponent = envConfig.stackName;
    
    const isHighAvailability = props.environment === 'prod';
    const environmentLabel = props.environment === 'prod' ? 'Prod' : 'Dev-Test';
    const resolvedStackName = id;
    const enableDetailedLogging = envConfig.general.enableDetailedLogging;

    // Get runtime CloudFormation values
    const stackName = Fn.ref('AWS::StackName');
    const region = cdk.Stack.of(this).region;

    // Configuration-based parameter resolution
    const mediaMtxVersion = envConfig.mediamtx?.version || '1.13.1';
    const enableInsecurePorts = envConfig.enableInsecurePorts;
    const usePreBuiltImages = envConfig.usePreBuiltImages;

    // =================
    // IMPORT BASE INFRASTRUCTURE RESOURCES
    // =================

    // Import VPC and networking from base infrastructure
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
      vpcId: Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.VPC_ID)),
      availabilityZones: [region + 'a', region + 'b'],
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
    // CONTAINER IMAGE STRATEGY
    // =================

    // Determine container image strategy
    let containerImageUri: string | undefined;
    if (usePreBuiltImages) {
      const mediamtxImageTag = this.node.tryGetContext('mediamtxImageTag') ?? envConfig.docker?.mediamtxImageTag ?? 'latest';
      // Get ECR repository ARN from BaseInfra and extract repository name
      const ecrRepoArn = Fn.importValue(createBaseImportValue(stackNameComponent, BASE_EXPORT_NAMES.ECR_REPO));
      // Extract repository name from ARN (format: arn:aws:ecr:region:account:repository/name)
      const ecrRepoName = Fn.select(1, Fn.split('/', ecrRepoArn));
      containerImageUri = `${this.account}.dkr.ecr.${this.region}.amazonaws.com/${cdk.Token.asString(ecrRepoName)}:${mediamtxImageTag}`;
    }

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
      enableInsecurePorts: enableInsecurePorts,
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
      enableInsecurePorts: enableInsecurePorts,
      nlbSecurityGroup: securityGroups.nlb,
    });

    // =================
    // STRUCTURED CONFIGURATION OBJECTS
    // =================

    // Infrastructure configuration
    const infrastructure: InfrastructureConfig = {
      vpc,
      ecsCluster,
      kmsKey,
      securityGroups: {
        mediaMtx: securityGroups.mediaMtx,
        nlb: securityGroups.nlb,
        efs: securityGroups.efs
      }
    };

    // Network configuration
    const network: NetworkConfig = {
      hostedZone,
      certificate,
      mediaHostname,
      hostedZoneName
    };

    // Secrets configuration
    const secrets: SecretsConfig = {
      signingSecret,
      mediaSecret,
      cloudTakUrl
    };

    // Storage configuration
    const storage: StorageConfig = {
      efs: {
        fileSystemId: mediaEfs.fileSystem.fileSystemId,
        accessPointId: mediaEfs.accessPoint.accessPointId
      }
    };

    // =================
    // CREATE MEDIAMTX ECS SERVICE
    // =================

    const mediaService = new MediaEcsService(this, 'MediaEcsService', {
      environment: props.environment,
      envConfig,
      infrastructure,
      network,
      secrets,
      storage,
      targetGroups: nlb.targetGroups,
      stackNameComponent,
      containerImageUri
    });

    // =================
    // STACK OUTPUTS
    // =================

    // MediaMTX Service URL
    new cdk.CfnOutput(this, 'MediaUrl', {
      value: `https://${mediaHostname}.${hostedZoneName}:${MEDIAMTX_PORTS.API_HTTPS}`,
      description: 'MediaMTX API HTTPS URL',
      exportName: `${resolvedStackName}-MediaUrl`
    });

    // Network Load Balancer DNS Name
    new cdk.CfnOutput(this, 'LoadBalancerDnsName', {
      value: nlb.loadBalancer.loadBalancerDnsName,
      description: 'Network Load Balancer DNS Name',
      exportName: `${resolvedStackName}-LoadBalancerDnsName`
    });

    // ECS Service ARN
    new cdk.CfnOutput(this, 'EcsServiceArn', {
      value: mediaService.service.serviceArn,
      description: 'MediaMTX ECS Service ARN',
      exportName: `${resolvedStackName}-EcsServiceArn`
    });

    // EFS File System ID
    new cdk.CfnOutput(this, 'EfsFileSystemId', {
      value: mediaEfs.fileSystem.fileSystemId,
      description: 'EFS File System ID for MediaMTX configuration',
      exportName: `${resolvedStackName}-EfsFileSystemId`
    });

    // MediaMTX hostname
    new cdk.CfnOutput(this, 'MediaHostname', {
      value: `${mediaHostname}.${hostedZoneName}`,
      description: 'MediaMTX fully qualified hostname',
      exportName: `${resolvedStackName}-MediaHostname`
    });
  }
}