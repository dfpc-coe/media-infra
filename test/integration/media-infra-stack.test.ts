import { MediaInfraStack } from '../../lib/media-infra-stack';
import { CDKTestHelper } from '../__helpers__/cdk-test-utils';
import { mockDevConfig, mockProdConfig } from '../__fixtures__/mock-configs';

describe('MediaInfra Integration Tests', () => {
  describe('Configuration Integration', () => {
    it('validates dev-test environment configuration', () => {
      expect(mockDevConfig.stackName).toBe('Dev');
      expect(mockDevConfig.ecs.taskCpu).toBe(512);
      expect(mockDevConfig.enableInsecurePorts).toBe(false);
    });

    it('validates prod environment configuration', () => {
      expect(mockProdConfig.stackName).toBe('Prod');
      expect(mockProdConfig.ecs.taskCpu).toBe(1024);
      expect(mockProdConfig.general.removalPolicy).toBe('RETAIN');
    });
  });
});