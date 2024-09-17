import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        SigningSecret: {
            Type: 'AWS::SecretsManager::Secret',
            Properties: {
                Description: cf.join([cf.stackName, ' Management User Password']),
                GenerateSecretString: {
                    ExcludePunctuation: true,
                    PasswordLength: 32
                },
                Name: cf.join([cf.stackName, '/api/secret']),
                KmsKeyId: cf.ref('KMS')
            }
        }
    }
};
