import { ContextEnvironmentConfig } from '../../lib/stack-config';
import { mockDevConfig, mockProdConfig } from '../__fixtures__/mock-configs';

describe('Stack Configuration', () => {
  describe('Configuration Interface', () => {
    it('validates dev config matches interface', () => {
      const config: ContextEnvironmentConfig = mockDevConfig;
      expect(config.stackName).toBe('Dev');
      expect(config.ecs.taskCpu).toBe(512);
      expect(config.ecs.taskMemory).toBe(1024);
      expect(config.general.removalPolicy).toBe('DESTROY');
    });

    it('validates prod config matches interface', () => {
      const config: ContextEnvironmentConfig = mockProdConfig;
      expect(config.stackName).toBe('Prod');
      expect(config.ecs.taskCpu).toBe(1024);
      expect(config.ecs.taskMemory).toBe(2048);
      expect(config.general.removalPolicy).toBe('RETAIN');
    });

    it('validates required properties exist', () => {
      const config: ContextEnvironmentConfig = mockDevConfig;
      expect(config.stackName).toBeDefined();
      expect(config.enableInsecurePorts).toBeDefined();
      expect(config.usePreBuiltImages).toBeDefined();
      expect(config.ecs).toBeDefined();
      expect(config.general).toBeDefined();
      expect(config.ecr).toBeDefined();
    });

    it('validates ECS configuration structure', () => {
      const config: ContextEnvironmentConfig = mockDevConfig;
      expect(typeof config.ecs.taskCpu).toBe('number');
      expect(typeof config.ecs.taskMemory).toBe('number');
      expect(typeof config.ecs.desiredCount).toBe('number');
      expect(typeof config.ecs.enableDetailedLogging).toBe('boolean');
    });

    it('validates optional properties', () => {
      const config: ContextEnvironmentConfig = {
        ...mockDevConfig,
        ecs: {
          ...mockDevConfig.ecs,
          enableEcsExec: true
        },
        docker: {
          mediamtxImageTag: 'latest'
        },
        mediamtx: {
          version: '1.0.0',
          buildRevision: 1
        }
      };
      
      expect(config.ecs.enableEcsExec).toBe(true);
      expect(config.docker?.mediamtxImageTag).toBe('latest');
      expect(config.mediamtx?.version).toBe('1.0.0');
      expect(config.mediamtx?.buildRevision).toBe(1);
    });

    it('validates configuration constraints', () => {
      expect(mockDevConfig.ecs.taskCpu).toBeGreaterThan(0);
      expect(mockDevConfig.ecs.taskMemory).toBeGreaterThan(0);
      expect(mockDevConfig.ecs.desiredCount).toBeGreaterThanOrEqual(1);
      expect(mockDevConfig.ecr.imageRetentionCount).toBeGreaterThan(0);
    });
  });
});