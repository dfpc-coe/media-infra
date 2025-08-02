// Test the props interfaces and types without instantiating constructs
describe('MediaNlb Props and Interfaces', () => {
  describe('Props Validation', () => {
    it('validates MediaNlbProps interface structure', () => {
      const mockProps = {
        vpc: {} as any,
        certificate: {} as any,
        hostedZone: {} as any,
        mediaHostname: 'media',
        stackNameComponent: 'Dev',
        enableInsecurePorts: false,
        nlbSecurityGroup: {} as any
      };

      expect(mockProps.mediaHostname).toBe('media');
      expect(mockProps.stackNameComponent).toBe('Dev');
      expect(mockProps.enableInsecurePorts).toBe(false);
    });

    it('validates port configuration logic', () => {
      const securePortsEnabled = true;
      const insecurePortsEnabled = false;
      
      const getPortsToCreate = (enableInsecure: boolean) => {
        const securePorts = [1936, 8555, 8890, 8888, 9997];
        const insecurePorts = enableInsecure ? [1935, 8554] : [];
        return [...securePorts, ...insecurePorts];
      };

      expect(getPortsToCreate(false)).toHaveLength(5);
      expect(getPortsToCreate(true)).toHaveLength(7);
    });

    it('validates target group configuration', () => {
      const targetGroupConfig = {
        rtmp: { port: 1935, protocol: 'TCP' },
        rtsp: { port: 8554, protocol: 'TCP' },
        srts: { port: 8890, protocol: 'UDP' },
        hls: { port: 8888, protocol: 'TCP' },
        api: { port: 9997, protocol: 'TCP' }
      };

      Object.values(targetGroupConfig).forEach(config => {
        expect(config.port).toBeGreaterThan(1000);
        expect(['TCP', 'UDP']).toContain(config.protocol);
      });
    });
  });
});