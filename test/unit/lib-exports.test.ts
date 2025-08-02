// Test all library exports and imports
import * as CloudFormationImports from '../../lib/cloudformation-imports';
import * as StackConfig from '../../lib/stack-config';
import * as Outputs from '../../lib/outputs';

describe('Library Exports', () => {
  describe('CloudFormation Imports Module', () => {
    it('exports all required constants', () => {
      expect(CloudFormationImports.BASE_EXPORT_NAMES).toBeDefined();
      expect(CloudFormationImports.AUTH_EXPORT_NAMES).toBeDefined();
      expect(CloudFormationImports.TAK_EXPORT_NAMES).toBeDefined();
      expect(CloudFormationImports.CLOUDTAK_EXPORT_NAMES).toBeDefined();
    });

    it('exports all required functions', () => {
      expect(typeof CloudFormationImports.createBaseImportValue).toBe('function');
      expect(typeof CloudFormationImports.createAuthImportValue).toBe('function');
      expect(typeof CloudFormationImports.createTakImportValue).toBe('function');
      expect(typeof CloudFormationImports.createCloudTakImportValue).toBe('function');
    });

    it('validates constant values structure', () => {
      expect(Object.keys(CloudFormationImports.BASE_EXPORT_NAMES).length).toBeGreaterThan(0);
      expect(typeof CloudFormationImports.BASE_EXPORT_NAMES.VPC_ID).toBe('string');
    });
  });

  describe('Stack Config Module', () => {
    it('exports ContextEnvironmentConfig interface', () => {
      // Interface exists if we can create a type-compatible object
      const config: StackConfig.ContextEnvironmentConfig = {
        stackName: 'test',
        enableInsecurePorts: false,
        usePreBuiltImages: false,
        ecs: {
          taskCpu: 512,
          taskMemory: 1024,
          desiredCount: 1,
          enableDetailedLogging: true
        },
        general: {
          removalPolicy: 'DESTROY',
          enableDetailedLogging: true,
          enableContainerInsights: false
        },
        ecr: {
          imageRetentionCount: 5,
          scanOnPush: false
        }
      };
      
      expect(config.stackName).toBe('test');
    });
  });

  describe('Outputs Module', () => {
    it('exports OutputsConfig interface and registerOutputs function', () => {
      expect(typeof Outputs.registerOutputs).toBe('function');
      expect(Outputs.registerOutputs.length).toBe(1); // takes one parameter
    });
  });
});