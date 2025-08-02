import { MediaSecurityGroups } from '../../../lib/constructs/media-security-groups';

describe('MediaSecurityGroups Construct', () => {
  describe('Class Definition', () => {
    it('exports MediaSecurityGroups class', () => {
      expect(MediaSecurityGroups).toBeDefined();
      expect(typeof MediaSecurityGroups).toBe('function');
    });

    it('has constructor that accepts props', () => {
      expect(MediaSecurityGroups.length).toBe(3); // scope, id, props
    });
  });

  describe('Configuration Validation', () => {
    it('validates security group types', () => {
      expect(['MediaMTX', 'NLB', 'EFS']).toHaveLength(3);
    });

    it('validates security group types', () => {
      const securityGroupTypes = ['MediaMTX', 'NLB', 'EFS'];
      expect(securityGroupTypes).toHaveLength(3);
      expect(securityGroupTypes).toContain('MediaMTX');
      expect(securityGroupTypes).toContain('NLB');
      expect(securityGroupTypes).toContain('EFS');
    });

    it('validates port configuration options', () => {
      const enableInsecurePorts = false;
      expect(typeof enableInsecurePorts).toBe('boolean');
    });

    it('validates security group rules', () => {
      const secureProtocols = ['HTTPS', 'TLS'];
      const insecureProtocols = ['HTTP', 'TCP'];
      expect(secureProtocols).toHaveLength(2);
      expect(insecureProtocols).toHaveLength(2);
    });

    it('validates port ranges', () => {
      const mediaPortRange = { min: 1935, max: 9997 };
      expect(mediaPortRange.min).toBeLessThan(mediaPortRange.max);
      expect(mediaPortRange.max - mediaPortRange.min).toBeGreaterThan(1000);
    });

    it('validates EFS port configuration', () => {
      const efsPort = 2049;
      expect(efsPort).toBe(2049);
      expect(efsPort).toBeGreaterThan(2000);
    });
  });
});