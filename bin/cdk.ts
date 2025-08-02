#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MediaInfraStack } from '../lib/media-infra-stack';
import { ContextEnvironmentConfig } from '../lib/stack-config';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev-test';
const envConfig = app.node.tryGetContext(environment) as ContextEnvironmentConfig;

if (!envConfig) {
    throw new Error(`No configuration found for environment: ${environment}`);
}

// Create the MediaInfra stack
new MediaInfraStack(app, `TAK-${envConfig.stackName}-MediaInfra`, {
    environment: environment as 'prod' | 'dev-test',
    envConfig,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
});