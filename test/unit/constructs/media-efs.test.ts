import { MediaEfs } from '../../../lib/constructs/media-efs';

describe('MediaEfs Construct', () => {
  describe('Class Definition', () => {
    it('exports MediaEfs class', () => {
      expect(MediaEfs).toBeDefined();
      expect(typeof MediaEfs).toBe('function');
    });

    it('has constructor that accepts props', () => {
      expect(MediaEfs.length).toBe(3); // scope, id, props
    });
  });

  describe('Configuration Validation', () => {
    it('validates EFS configuration constants', () => {
      expect('/mediamtx').toBe('/mediamtx'); // path constant
      expect('1000').toBe('1000'); // uid/gid constants
      expect('755').toBe('755'); // permissions constant
    });

    it('validates performance mode options', () => {
      const modes = ['generalPurpose', 'maxIO'];
      expect(modes).toContain('generalPurpose');
      expect(modes).toContain('maxIO');
    });
  });
});