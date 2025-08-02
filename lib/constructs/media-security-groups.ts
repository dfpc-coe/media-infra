import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface MediaSecurityGroupsProps {
  vpc: ec2.IVpc;
  stackNameComponent: string;
  enableInsecurePorts: boolean;
}

export class MediaSecurityGroups extends Construct {
  public readonly mediaMtx: ec2.SecurityGroup;
  public readonly nlb: ec2.SecurityGroup;
  public readonly efs: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: MediaSecurityGroupsProps) {
    super(scope, id);

    // MediaMTX Security Group
    this.mediaMtx = new ec2.SecurityGroup(this, 'MediaMtxSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for MediaMTX container',
      allowAllOutbound: true, // Required for SSM Session Manager
    });

    // NLB Security Group
    this.nlb = new ec2.SecurityGroup(this, 'NlbSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for MediaMTX Network Load Balancer',
      allowAllOutbound: false,
    });

    // EFS Security Group
    this.efs = new ec2.SecurityGroup(this, 'EfsSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for EFS access',
      allowAllOutbound: false,
    });

    const enableInsecurePorts = props.enableInsecurePorts;

    // NLB inbound rules
    if (enableInsecurePorts) {
      this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(1935), 'RTMP insecure');
      this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8554), 'RTSP insecure');
    }
    
    this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(1936), 'RTMPS secure');
    this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8555), 'RTSPS secure');
    this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(8890), 'SRTS');
    this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8888), 'HLS HTTPS');
    this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(9997), 'MediaMTX API HTTPS');
    this.nlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(9996), 'MediaMTX Playback HTTPS');

    // MediaMTX inbound rules from NLB
    this.mediaMtx.addIngressRule(ec2.Peer.securityGroupId(this.nlb.securityGroupId), ec2.Port.tcp(1935), 'RTMP from NLB');
    this.mediaMtx.addIngressRule(ec2.Peer.securityGroupId(this.nlb.securityGroupId), ec2.Port.tcp(8554), 'RTSP from NLB');
    this.mediaMtx.addIngressRule(ec2.Peer.securityGroupId(this.nlb.securityGroupId), ec2.Port.udp(8890), 'SRTS from NLB');
    this.mediaMtx.addIngressRule(ec2.Peer.securityGroupId(this.nlb.securityGroupId), ec2.Port.tcp(8888), 'HLS from NLB');
    this.mediaMtx.addIngressRule(ec2.Peer.securityGroupId(this.nlb.securityGroupId), ec2.Port.tcp(9997), 'API from NLB');
    this.mediaMtx.addIngressRule(ec2.Peer.securityGroupId(this.nlb.securityGroupId), ec2.Port.tcp(9996), 'Playback from NLB');

    // NLB outbound rules for health checks
    this.nlb.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(9997), 'Health check to VPC API');
    this.nlb.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(9996), 'Health check to VPC Playback');
    this.nlb.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(1935), 'Health check to VPC RTMP');
    this.nlb.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(8554), 'Health check to VPC RTSP');
    this.nlb.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.udp(8890), 'Health check to VPC SRTS');
    this.nlb.addEgressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(8888), 'Health check to VPC HLS');

    // EFS inbound rules from MediaMTX
    this.efs.addIngressRule(ec2.Peer.securityGroupId(this.mediaMtx.securityGroupId), ec2.Port.tcp(2049), 'NFS from MediaMTX');
  }
}