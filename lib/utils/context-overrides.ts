/**
 * Dynamic context override utilities for MediaInfra
 * Simplified flat parameter system for command-line context overrides
 */

import * as cdk from 'aws-cdk-lib';
import { ContextEnvironmentConfig } from '../stack-config';

export function applyContextOverrides(
  app: cdk.App, 
  baseConfig: ContextEnvironmentConfig
): ContextEnvironmentConfig {
  const topLevelOverrides = {
    stackName: app.node.tryGetContext('stackName'),
    enableInsecurePorts: parseContextBoolean(app.node.tryGetContext('enableInsecurePorts')),
    usePreBuiltImages: parseContextBoolean(app.node.tryGetContext('usePreBuiltImages')),
  };

  return {
    ...baseConfig,
    ...Object.fromEntries(Object.entries(topLevelOverrides).filter(([_, v]) => v !== undefined)),
    ecs: {
      ...baseConfig.ecs,
      taskCpu: parseContextNumber(app.node.tryGetContext('taskCpu')) ?? baseConfig.ecs.taskCpu,
      taskMemory: parseContextNumber(app.node.tryGetContext('taskMemory')) ?? baseConfig.ecs.taskMemory,
      desiredCount: parseContextNumber(app.node.tryGetContext('desiredCount')) ?? baseConfig.ecs.desiredCount,
      enableDetailedLogging: parseContextBoolean(app.node.tryGetContext('enableDetailedLogging')) ?? baseConfig.ecs.enableDetailedLogging,
      enableEcsExec: parseContextBoolean(app.node.tryGetContext('enableEcsExec')) ?? baseConfig.ecs.enableEcsExec,
    },
    general: {
      ...baseConfig.general,
      removalPolicy: app.node.tryGetContext('removalPolicy') || baseConfig.general.removalPolicy,
      enableDetailedLogging: parseContextBoolean(app.node.tryGetContext('enableDetailedLogging')) ?? baseConfig.general.enableDetailedLogging,
      enableContainerInsights: parseContextBoolean(app.node.tryGetContext('enableContainerInsights')) ?? baseConfig.general.enableContainerInsights,
    },
    ecr: {
      ...baseConfig.ecr,
      imageRetentionCount: parseContextNumber(app.node.tryGetContext('imageRetentionCount')) ?? baseConfig.ecr.imageRetentionCount,
      scanOnPush: parseContextBoolean(app.node.tryGetContext('scanOnPush')) ?? baseConfig.ecr.scanOnPush,
    },
    docker: {
      ...baseConfig.docker,
      mediamtxImageTag: app.node.tryGetContext('mediamtxImageTag') ?? baseConfig.docker?.mediamtxImageTag,
    },
    mediamtx: {
      ...baseConfig.mediamtx,
      version: app.node.tryGetContext('mediamtxVersion') ?? baseConfig.mediamtx?.version,
      buildRevision: parseContextNumber(app.node.tryGetContext('buildRevision')) ?? baseConfig.mediamtx?.buildRevision ?? 1,
    },
  };
}

/**
 * Parse context value to number, handling string inputs from CLI
 */
function parseContextNumber(value: any): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === 'string' ? parseInt(value, 10) : value;
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse context value to boolean, handling string inputs from CLI
 */
function parseContextBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return undefined;
}