import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface MediaNlbProps {
  vpc: ec2.IVpc;
  certificate: acm.ICertificate;
  hostedZone: route53.IHostedZone;
  mediaHostname: string;
  stackNameComponent: string;
  enableInsecurePorts: boolean;
  nlbSecurityGroup: ec2.SecurityGroup;
}

export class MediaNlb extends Construct {
  public readonly loadBalancer: elbv2.NetworkLoadBalancer;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly targetGroups: {
    rtmp: elbv2.NetworkTargetGroup;
    rtsp: elbv2.NetworkTargetGroup;
    srts: elbv2.NetworkTargetGroup;
    hls: elbv2.NetworkTargetGroup;
    api: elbv2.NetworkTargetGroup;
  };

  constructor(scope: Construct, id: string, props: MediaNlbProps) {
    super(scope, id);

    // Use the provided security group
    this.securityGroup = props.nlbSecurityGroup;

    


    // Create Network Load Balancer
    this.loadBalancer = new elbv2.NetworkLoadBalancer(this, 'MediaNlb', {
      loadBalancerName: `tak-${props.stackNameComponent.toLowerCase()}-media`,
      vpc: props.vpc,
      internetFacing: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroups: [this.securityGroup]
    });

    // Create target groups (5 total - within AWS limit)
    this.targetGroups = {
      rtmp: new elbv2.NetworkTargetGroup(this, 'RtmpTargetGroup', {
        port: 1935,
        protocol: elbv2.Protocol.TCP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.TCP,
          port: '9997',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 5,
        },
      }),
      rtsp: new elbv2.NetworkTargetGroup(this, 'RtspTargetGroup', {
        port: 8554,
        protocol: elbv2.Protocol.TCP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.TCP,
          port: '9997',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 5,
        },
      }),
      srts: new elbv2.NetworkTargetGroup(this, 'SrtsTargetGroup', {
        port: 8890,
        protocol: elbv2.Protocol.UDP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.TCP,
          port: '9997',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 5,
        },
      }),
      hls: new elbv2.NetworkTargetGroup(this, 'HlsTargetGroup', {
        port: 8888,
        protocol: elbv2.Protocol.TCP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.TCP,
          port: '9997',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 5,
        },
      }),
      api: new elbv2.NetworkTargetGroup(this, 'ApiTargetGroup', {
        port: 9997,
        protocol: elbv2.Protocol.TCP,
        vpc: props.vpc,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.TCP,
          port: '9997',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 5,
        },
      }),
    };

    const enableInsecurePorts = props.enableInsecurePorts;

    // Create listeners
    if (enableInsecurePorts) {
      // Insecure RTMP listener
      this.loadBalancer.addListener('RtmpListener', {
        port: 1935,
        protocol: elbv2.Protocol.TCP,
        defaultTargetGroups: [this.targetGroups.rtmp],
      });

      // Insecure RTSP listener
      this.loadBalancer.addListener('RtspListener', {
        port: 8554,
        protocol: elbv2.Protocol.TCP,
        defaultTargetGroups: [this.targetGroups.rtsp],
      });
    }

    // Secure RTMPS listener (TLS terminated)
    this.loadBalancer.addListener('RtmpsListener', {
      port: 1936,
      protocol: elbv2.Protocol.TLS,
      certificates: [props.certificate],
      defaultTargetGroups: [this.targetGroups.rtmp], // Same target group as RTMP
    });

    // Secure RTSPS listener (TLS terminated)
    this.loadBalancer.addListener('RtspsListener', {
      port: 8555,
      protocol: elbv2.Protocol.TLS,
      certificates: [props.certificate],
      defaultTargetGroups: [this.targetGroups.rtsp], // Same target group as RTSP
    });

    // SRTS listener (built-in encryption)
    this.loadBalancer.addListener('SrtsListener', {
      port: 8890,
      protocol: elbv2.Protocol.UDP,
      defaultTargetGroups: [this.targetGroups.srts],
    });

    // HLS HTTPS listener
    this.loadBalancer.addListener('HlsListener', {
      port: 8888,
      protocol: elbv2.Protocol.TLS,
      certificates: [props.certificate],
      defaultTargetGroups: [this.targetGroups.hls],
    });

    // API HTTPS listener
    this.loadBalancer.addListener('ApiListener', {
      port: 9997,
      protocol: elbv2.Protocol.TLS,
      certificates: [props.certificate],
      defaultTargetGroups: [this.targetGroups.api],
    });

    // Playback HTTPS listener (uses same target group as API)
    this.loadBalancer.addListener('PlaybackListener', {
      port: 9996,
      protocol: elbv2.Protocol.TLS,
      certificates: [props.certificate],
      defaultTargetGroups: [this.targetGroups.api],
    });

    // Create Route53 A record
    new route53.ARecord(this, 'MediaARecord', {
      zone: props.hostedZone,
      recordName: props.mediaHostname,
      target: route53.RecordTarget.fromAlias(
        new route53targets.LoadBalancerTarget(this.loadBalancer)
      ),
    });
  }
}