/**
 * Configuration interface for MediaInfra stack template
 * This makes the stack reusable across different projects and environments
 */

/**
 * Context-based configuration interface matching cdk.context.json structure
 * This is used directly by the stack without complex transformations
 */
export interface ContextEnvironmentConfig {
  stackName: string;
  enableInsecurePorts: boolean;
  usePreBuiltImages: boolean;
  ecs: {
    taskCpu: number;
    taskMemory: number;
    desiredCount: number;
    enableDetailedLogging: boolean;
    enableEcsExec?: boolean;
  };
  general: {
    removalPolicy: string;
    enableDetailedLogging: boolean;
    enableContainerInsights: boolean;
  };
  ecr: {
    imageRetentionCount: number;
    scanOnPush: boolean;
  };
  docker?: {
    mediamtxImageTag?: string;
  };
  mediamtx?: {
    version: string;
    buildRevision: number;
  };
}