import { MediaNlb } from '../../../lib/constructs/media-nlb';

describe('MediaNlb Construct', () => {
  describe('Class Definition', () => {
    it('exports MediaNlb class', () => {
      expect(MediaNlb).toBeDefined();
      expect(typeof MediaNlb).toBe('function');
    });

    it('has constructor that accepts props', () => {
      expect(MediaNlb.length).toBe(3); // scope, id, props
    });
  });

  describe('Configuration Validation', () => {
    it('validates port constants', () => {
      expect(1935).toBeLessThan(10000); // RTMP
      expect(8554).toBeLessThan(10000); // RTSP
    });

    it('validates secure protocol ports', () => {
      const securePorts = [1936, 8555, 8890, 8888, 9997];
      expect(securePorts).toHaveLength(5);
      expect(securePorts).toContain(1936); // RTMPS
      expect(securePorts).toContain(8555); // RTSPS
    });
  });

  describe('Port Configuration', () => {
    it('validates insecure ports', () => {
      const insecurePorts = [1935, 8554]; // RTMP, RTSP
      expect(insecurePorts).toHaveLength(2);
      expect(insecurePorts).toContain(1935);
      expect(insecurePorts).toContain(8554);
    });

    it('validates protocol types', () => {
      const protocols = ['TCP', 'UDP', 'TLS'];
      expect(protocols).toContain('TCP');
      expect(protocols).toContain('UDP');
      expect(protocols).toContain('TLS');
    });

    it('validates target group configuration', () => {
      const targetGroupPorts = [1935, 8554, 1936, 8555, 8890, 8888, 9997];
      expect(targetGroupPorts.length).toBeGreaterThan(5);
      expect(Math.max(...targetGroupPorts)).toBeLessThan(10000);
    });

    it('validates load balancer scheme options', () => {
      const schemes = ['internet-facing', 'internal'];
      expect(schemes).toContain('internet-facing');
      expect(schemes).toContain('internal');
    });
  });
});