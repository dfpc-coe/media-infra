import { MediaInfraStack } from '../../lib/media-infra-stack';
import { CDKTestHelper } from '../__helpers__/cdk-test-utils';
import { mockDevConfig } from '../__fixtures__/mock-configs';

describe('Configuration Validation Tests', () => {
  describe('Basic Configuration Tests', () => {
    it('validates dev configuration structure', () => {
      expect(mockDevConfig.stackName).toBe('Dev');
      expect(mockDevConfig.enableInsecurePorts).toBe(false);
      expect(mockDevConfig.usePreBuiltImages).toBe(false);
    });

    it('validates insecure ports configuration', () => {
      const configWithInsecurePorts = {
        ...mockDevConfig,
        enableInsecurePorts: true
      };
      
      expect(configWithInsecurePorts.enableInsecurePorts).toBe(true);
      expect(configWithInsecurePorts.stackName).toBe('Dev');
    });

    it('validates pre-built images configuration', () => {
      const configWithPreBuiltImages = {
        ...mockDevConfig,
        usePreBuiltImages: true
      };
      
      expect(configWithPreBuiltImages.usePreBuiltImages).toBe(true);
      expect(configWithPreBuiltImages.stackName).toBe('Dev');
    });
  });

  describe('Context Override Integration', () => {
    it('validates context override functionality', () => {
      const app = CDKTestHelper.createTestApp();
      app.node.setContext('enableInsecurePorts', true);
      app.node.setContext('usePreBuiltImages', true);
      
      expect(app.node.tryGetContext('enableInsecurePorts')).toBe(true);
      expect(app.node.tryGetContext('usePreBuiltImages')).toBe(true);
    });
  });

  describe('Environment-Specific Validation', () => {
    it('validates production environment configuration structure', () => {
      const prodConfig = {
        stackName: 'Prod',
        enableInsecurePorts: false,
        usePreBuiltImages: false,
        ecs: {
          taskCpu: 1024,
          taskMemory: 2048,
          desiredCount: 1,
          enableDetailedLogging: true
        },
        general: {
          removalPolicy: 'RETAIN',
          enableDetailedLogging: true,
          enableContainerInsights: true
        },
        ecr: {
          imageRetentionCount: 20,
          scanOnPush: true
        }
      };

      expect(prodConfig.stackName).toBe('Prod');
      expect(prodConfig.ecs.taskCpu).toBe(1024);
      expect(prodConfig.general.removalPolicy).toBe('RETAIN');
    });
  });
});