import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { ContextEnvironmentConfig } from '../stack-config';
import { MEDIAMTX_PORTS } from '../utils/constants';
import type { InfrastructureConfig, NetworkConfig, SecretsConfig, StorageConfig } from '../construct-configs';

export interface MediaEcsServiceProps {
  environment: 'prod' | 'dev-test';
  envConfig: ContextEnvironmentConfig;
  infrastructure: InfrastructureConfig;
  network: NetworkConfig;
  secrets: SecretsConfig;
  storage: StorageConfig;
  targetGroups: {
    rtmp: elbv2.NetworkTargetGroup;
    rtsp: elbv2.NetworkTargetGroup;
    srts: elbv2.NetworkTargetGroup;
    hls: elbv2.NetworkTargetGroup;
    api: elbv2.NetworkTargetGroup;
  };
  stackNameComponent: string;
  containerImageUri?: string;
}

export class MediaEcsService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: MediaEcsServiceProps) {
    super(scope, id);

    // Create log group
    const logGroup = new logs.LogGroup(this, 'MediaMtxLogGroup', {
      logGroupName: `/aws/ecs/TAK-${props.stackNameComponent}-MediaMTX`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create task role with EFS permissions
    const taskRole = new iam.Role(this, 'MediaMtxTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add EFS permissions
    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticfilesystem:ClientMount',
        'elasticfilesystem:ClientWrite',
        'elasticfilesystem:ClientRootAccess',
        'elasticfilesystem:DescribeMountTargets',
        'elasticfilesystem:DescribeFileSystems'
      ],
      resources: [
        `arn:aws:elasticfilesystem:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.storage.efs.fileSystemId}`,
        `arn:aws:elasticfilesystem:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:access-point/${props.storage.efs.accessPointId}`
      ]
    }));

    // Create execution role (following tak-infra pattern)
    const executionRole = new iam.Role(this, 'MediaMtxExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });

    // Create task definition
    this.taskDefinition = new ecs.FargateTaskDefinition(this, 'MediaMtxTaskDef', {
      memoryLimitMiB: props.envConfig.ecs.taskMemory,
      cpu: props.envConfig.ecs.taskCpu,
      taskRole: taskRole,
      executionRole: executionRole,
    });

    // Add EFS volume
    this.taskDefinition.addVolume({
      name: 'mediamtx-config',
      efsVolumeConfiguration: {
        fileSystemId: props.storage.efs.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: props.storage.efs.accessPointId,
          iam: 'ENABLED'
        }
      }
    });

    // Determine container image strategy
    let containerImage: ecs.ContainerImage;
    
    if (props.containerImageUri) {
      // Use pre-built image from ECR
      containerImage = ecs.ContainerImage.fromRegistry(props.containerImageUri);
    } else {
      // Build image locally
      const dockerAsset = new ecrAssets.DockerImageAsset(this, 'MediaMtxDockerAsset', {
        directory: '.',
        file: 'docker/media-infra/Dockerfile',
        buildArgs: {
          MEDIAMTX_VERSION: props.envConfig.mediamtx?.version || '1.13.1',
        },
        exclude: [
          'node_modules/**',
          'cdk.out/**',
          '.cdk.staging/**',
          '**/*.log',
          '**/*.tmp',
          '.git/**',
          '.vscode/**',
          '.idea/**',
          'test/**',
          'docs/**',
          'lib/**/*.js',
          'lib/**/*.d.ts',
          'lib/**/*.js.map',
          'bin/**/*.js',
          'bin/**/*.d.ts',
          '**/.DS_Store',
          '**/Thumbs.db'
        ]
      });
      containerImage = ecs.ContainerImage.fromDockerImageAsset(dockerAsset);
    }

    // Add container to task definition
    const container = this.taskDefinition.addContainer('MediaMtxContainer', {
      image: containerImage,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'mediamtx',
        logGroup: logGroup,
      }),
      environment: {
        API_URL: props.secrets.cloudTakUrl,
        CLOUDTAK_Config_media_url: props.secrets.cloudTakUrl,
      },
      secrets: {
        SigningSecret: ecs.Secret.fromSecretsManager(props.secrets.signingSecret),
        MediaSecret: ecs.Secret.fromSecretsManager(props.secrets.mediaSecret),
      },
      healthCheck: {
        command: ['CMD-SHELL', `nc -z localhost ${MEDIAMTX_PORTS.API_HTTPS} || exit 1`],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Add EFS mount point
    container.addMountPoints({
      containerPath: '/config',
      sourceVolume: 'mediamtx-config',
      readOnly: false
    });

    // Add port mappings
    container.addPortMappings(
      { containerPort: MEDIAMTX_PORTS.RTMP, protocol: ecs.Protocol.TCP }, // RTMP
      { containerPort: MEDIAMTX_PORTS.RTSP, protocol: ecs.Protocol.TCP }, // RTSP
      { containerPort: MEDIAMTX_PORTS.SRTS, protocol: ecs.Protocol.UDP }, // SRTS
      { containerPort: MEDIAMTX_PORTS.HLS_HTTPS, protocol: ecs.Protocol.TCP }, // HLS
      { containerPort: MEDIAMTX_PORTS.API_HTTPS, protocol: ecs.Protocol.TCP }, // API + Playback
    );

    // Grant secrets access
    props.secrets.signingSecret.grantRead(this.taskDefinition.taskRole);
    props.secrets.mediaSecret.grantRead(this.taskDefinition.taskRole);

    // Grant KMS permissions for secrets decryption (following TAK infrastructure pattern)
    props.infrastructure.kmsKey.grantDecrypt(this.taskDefinition.taskRole);
    props.infrastructure.kmsKey.grantDecrypt(executionRole);

    // Add ECS Exec permissions if enabled
    if (props.envConfig.ecs.enableEcsExec) {
      this.taskDefinition.taskRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      );
      
      (this.taskDefinition.taskRole as iam.Role).addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:OpenDataChannel'
        ],
        resources: ['*']
      }));


    }

    // Create ECS service
    this.service = new ecs.FargateService(this, 'MediaMtxService', {
      cluster: props.infrastructure.ecsCluster,
      taskDefinition: this.taskDefinition,
      desiredCount: props.envConfig.ecs.desiredCount,
      securityGroups: [props.infrastructure.securityGroups.mediaMtx],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      enableExecuteCommand: props.envConfig.ecs.enableEcsExec ?? false,
    });

    // Register with target groups
    props.targetGroups.rtmp.addTarget(this.service.loadBalancerTarget({
      containerName: 'MediaMtxContainer',
      containerPort: MEDIAMTX_PORTS.RTMP,
    }));
    props.targetGroups.rtsp.addTarget(this.service.loadBalancerTarget({
      containerName: 'MediaMtxContainer',
      containerPort: MEDIAMTX_PORTS.RTSP,
    }));
    props.targetGroups.srts.addTarget(this.service.loadBalancerTarget({
      containerName: 'MediaMtxContainer',
      containerPort: MEDIAMTX_PORTS.SRTS,
      protocol: ecs.Protocol.UDP,
    }));
    props.targetGroups.hls.addTarget(this.service.loadBalancerTarget({
      containerName: 'MediaMtxContainer',
      containerPort: MEDIAMTX_PORTS.HLS_HTTPS,
    }));
    props.targetGroups.api.addTarget(this.service.loadBalancerTarget({
      containerName: 'MediaMtxContainer',
      containerPort: MEDIAMTX_PORTS.API_HTTPS,
    }));
  }
}