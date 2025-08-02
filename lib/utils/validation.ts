/**
 * Validation utilities for MediaInfra stack
 */

import { ContextEnvironmentConfig } from '../stack-config';

/**
 * Validate environment type
 */
export function validateEnvType(environment: string): void {
  const validEnvironments = ['prod', 'dev-test'];
  if (!validEnvironments.includes(environment)) {
    throw new Error(`Invalid environment type: ${environment}. Must be one of: ${validEnvironments.join(', ')}`);
  }
}

/**
 * Validate stack name
 */
export function validateStackName(stackName: string): void {
  if (!stackName || stackName.trim().length === 0) {
    throw new Error('Stack name cannot be empty');
  }
  
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(stackName)) {
    throw new Error(`Invalid stack name: ${stackName}. Must start with letter and contain only letters, numbers, and hyphens`);
  }
}

/**
 * Validate MediaMTX configuration
 */
export function validateMediaMtxConfig(config: ContextEnvironmentConfig): void {
  // Validate ECS configuration
  if (config.ecs.taskCpu <= 0) {
    throw new Error('ECS task CPU must be greater than 0');
  }
  
  if (config.ecs.taskMemory <= 0) {
    throw new Error('ECS task memory must be greater than 0');
  }
  
  if (config.ecs.desiredCount < 0) {
    throw new Error('ECS desired count cannot be negative');
  }
  
  // Validate ECR configuration
  if (config.ecr.imageRetentionCount <= 0) {
    throw new Error('ECR image retention count must be greater than 0');
  }
  
  // Validate MediaMTX version if specified
  if (config.mediamtx?.version && !/^v?\d+\.\d+\.\d+/.test(config.mediamtx.version)) {
    throw new Error(`Invalid MediaMTX version format: ${config.mediamtx.version}`);
  }
}