/**
 * Stack outputs registration following TAK.NZ pattern
 */

import * as cdk from 'aws-cdk-lib';

export interface OutputsConfig {
  stack: cdk.Stack;
  stackName: string;
  nlbDnsName: string;
  mediaUrl: string;
  ecsServiceArn: string;
}

export function registerOutputs(config: OutputsConfig): void {
  const { stack, stackName, nlbDnsName, mediaUrl, ecsServiceArn } = config;

  // NLB DNS Name
  new cdk.CfnOutput(stack, 'NlbDnsNameOutput', {
    value: nlbDnsName,
    description: 'MediaMTX Network Load Balancer DNS name',
    exportName: `${stackName}-NlbDnsName`,
  });

  // Media Service URL
  new cdk.CfnOutput(stack, 'MediaUrlOutput', {
    value: mediaUrl,
    description: 'MediaMTX service URL',
    exportName: `${stackName}-MediaUrl`,
  });

  // ECS Service ARN
  new cdk.CfnOutput(stack, 'EcsServiceArnOutput', {
    value: ecsServiceArn,
    description: 'MediaMTX ECS service ARN',
    exportName: `${stackName}-EcsServiceArn`,
  });
}