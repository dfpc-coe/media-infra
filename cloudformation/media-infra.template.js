import cf from '@openaddresses/cloudfriend';
import API from './lib/api.js';
import EFS from './lib/efs.js';
import KMS from './lib/kms.js';
import Secret from './lib/secret.js';

export default cf.merge(
    API, EFS, KMS, Secret,
    {
        Description: 'Template for @tak-ps/media-infra',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            },
            Environment: {
                Description: 'VPC/ECS Stack to deploy into',
                Type: 'String',
                Default: 'prod'
            }
        }
    }
);
