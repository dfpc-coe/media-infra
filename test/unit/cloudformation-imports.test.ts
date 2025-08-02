import { 
  createBaseImportValue, 
  createAuthImportValue, 
  createTakImportValue,
  createCloudTakImportValue,
  BASE_EXPORT_NAMES,
  AUTH_EXPORT_NAMES,
  TAK_EXPORT_NAMES,
  CLOUDTAK_EXPORT_NAMES
} from '../../lib/cloudformation-imports';

describe('CloudFormation Imports', () => {
  describe('Import Value Functions', () => {
    it('creates base import values correctly', () => {
      expect(createBaseImportValue('Dev', 'VpcId')).toBe('TAK-Dev-BaseInfra-VpcId');
      expect(createBaseImportValue('Prod', 'EcsClusterArn')).toBe('TAK-Prod-BaseInfra-EcsClusterArn');
    });

    it('creates auth import values correctly', () => {
      expect(createAuthImportValue('Dev', 'AuthentikAdminTokenArn')).toBe('TAK-Dev-AuthInfra-AuthentikAdminTokenArn');
    });

    it('creates TAK import values correctly', () => {
      expect(createTakImportValue('Dev', 'TakServiceUrl')).toBe('TAK-Dev-TakInfra-TakServiceUrl');
    });

    it('creates CloudTAK import values correctly', () => {
      expect(createCloudTakImportValue('Dev', 'SigningSecret')).toBe('TAK-Dev-CloudTAK-SigningSecret');
    });
  });

  describe('Export Name Constants', () => {
    it('defines base export names', () => {
      expect(BASE_EXPORT_NAMES.VPC_ID).toBe('VpcId');
      expect(BASE_EXPORT_NAMES.ECS_CLUSTER).toBe('EcsClusterArn');
    });

    it('defines auth export names', () => {
      expect(AUTH_EXPORT_NAMES.AUTHENTIK_ADMIN_TOKEN).toBe('AuthentikAdminTokenArn');
    });

    it('defines TAK export names', () => {
      expect(TAK_EXPORT_NAMES.TAK_SERVICE_URL).toBe('TakServiceUrl');
    });

    it('defines CloudTAK export names', () => {
      expect(CLOUDTAK_EXPORT_NAMES.SIGNING_SECRET).toBe('SigningSecret');
      expect(CLOUDTAK_EXPORT_NAMES.SERVICE_URL).toBe('ServiceURL');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty stack name component', () => {
      expect(createBaseImportValue('', 'VpcId')).toBe('TAK--BaseInfra-VpcId');
    });

    it('handles special characters in export names', () => {
      expect(createBaseImportValue('Dev', 'Test-Export_Name')).toBe('TAK-Dev-BaseInfra-Test-Export_Name');
    });

    it('validates all export name constants are strings', () => {
      Object.values(BASE_EXPORT_NAMES).forEach(name => {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('validates import value format consistency', () => {
      const baseImport = createBaseImportValue('Test', 'Resource');
      const authImport = createAuthImportValue('Test', 'Resource');
      const takImport = createTakImportValue('Test', 'Resource');
      const cloudtakImport = createCloudTakImportValue('Test', 'Resource');
      
      expect(baseImport).toMatch(/^TAK-Test-\w+-Resource$/);
      expect(authImport).toMatch(/^TAK-Test-\w+-Resource$/);
      expect(takImport).toMatch(/^TAK-Test-\w+-Resource$/);
      expect(cloudtakImport).toMatch(/^TAK-Test-\w+-Resource$/);
    });
  });
});