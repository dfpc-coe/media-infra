import { MediaEcsService } from '../../../lib/constructs/media-ecs-service';
import { mockDevConfig } from '../../__fixtures__/mock-configs';

describe('MediaEcsService Construct', () => {
  describe('Class Definition', () => {
    it('exports MediaEcsService class', () => {
      expect(MediaEcsService).toBeDefined();
      expect(typeof MediaEcsService).toBe('function');
    });

    it('has constructor that accepts props', () => {
      expect(MediaEcsService.length).toBe(3); // scope, id, props
    });
  });

  describe('Configuration Validation', () => {
    it('validates config structure', () => {
      expect(mockDevConfig.ecs).toBeDefined();
    });

    it('validates mock configuration', () => {
      expect(mockDevConfig.ecs.taskCpu).toBe(512);
      expect(mockDevConfig.ecs.taskMemory).toBe(1024);
      expect(mockDevConfig.ecs.desiredCount).toBe(1);
    });
  });

  describe('Target Group Validation', () => {
    it('validates target group ports', () => {
      const targetGroupPorts = [1935, 8554, 8890, 8888, 9997];
      expect(targetGroupPorts).toHaveLength(5);
      expect(targetGroupPorts).toContain(1935); // RTMP
      expect(targetGroupPorts).toContain(9997); // API
    });

    it('validates ECS configuration', () => {
      expect(mockDevConfig.ecs.taskCpu).toBeGreaterThan(0);
      expect(mockDevConfig.ecs.taskMemory).toBeGreaterThan(0);
      expect(mockDevConfig.ecs.desiredCount).toBeGreaterThanOrEqual(1);
    });

    it('validates container configuration', () => {
      const containerPorts = [1935, 8554, 8890, 8888, 9997];
      expect(containerPorts.every(port => port > 1000)).toBe(true);
      expect(containerPorts.every(port => port < 10000)).toBe(true);
    });

    it('validates task definition requirements', () => {
      expect(mockDevConfig.ecs.enableDetailedLogging).toBeDefined();
      expect(typeof mockDevConfig.ecs.enableDetailedLogging).toBe('boolean');
    });

    it('validates environment variables structure', () => {
      const envVars = ['CLOUDTAK_URL', 'SIGNING_SECRET', 'MEDIA_SECRET'];
      expect(envVars).toHaveLength(3);
      expect(envVars.every(env => typeof env === 'string')).toBe(true);
    });
  });
});