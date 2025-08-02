import { registerOutputs, OutputsConfig } from '../../lib/outputs';
import { App, Stack } from 'aws-cdk-lib';

describe('Outputs', () => {
  describe('registerOutputs function', () => {
    it('creates stack outputs correctly', () => {
      const app = new App();
      const stack = new Stack(app, 'TestStack');
      
      const config: OutputsConfig = {
        stack,
        stackName: 'TAK-Dev-MediaInfra',
        nlbDnsName: 'test-nlb-123.elb.amazonaws.com',
        mediaUrl: 'https://media.dev.tak.nz:9997',
        ecsServiceArn: 'arn:aws:ecs:us-west-2:123456789012:service/test-service'
      };

      expect(() => registerOutputs(config)).not.toThrow();
    });

    it('validates OutputsConfig interface', () => {
      const app = new App();
      const stack = new Stack(app, 'TestStack');
      
      const config: OutputsConfig = {
        stack,
        stackName: 'test',
        nlbDnsName: 'test.com',
        mediaUrl: 'https://test.com',
        ecsServiceArn: 'arn:test'
      };

      expect(config.stack).toBeDefined();
      expect(config.stackName).toBe('test');
      expect(config.nlbDnsName).toBe('test.com');
      expect(config.mediaUrl).toBe('https://test.com');
      expect(config.ecsServiceArn).toBe('arn:test');
    });
  });
});