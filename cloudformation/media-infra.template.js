import cf from '@openaddresses/cloudfriend';

export default cf.merge(
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
            },
        },
        Resources: {
            TaskDefinition: {
                Type: 'AWS::ECS::TaskDefinition',
                DependsOn: ['LDAPMasterSecret'],
                Properties: {
                    Family: cf.stackName,
                    Cpu: 1024,
                    Memory: 4096 * 2,
                    NetworkMode: 'awsvpc',
                    RequiresCompatibilities: ['FARGATE'],
                    Tags: [{
                        Key: 'Name',
                        Value: cf.join('-', [cf.stackName, 'api'])
                    }],
                    ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
                    TaskRoleArn: cf.getAtt('TaskRole', 'Arn'),
                    ContainerDefinitions: [{
                        Name: 'api',
                        Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-media:', cf.ref('GitSha')]),
                        PortMappings: [{
                            ContainerPort: 389
                        }],
                        Environment: [
                            { Name: 'StackName', Value: cf.stackName },
                            { Name: 'AWS_DEFAULT_REGION', Value: cf.region },
                        ],
                        LogConfiguration: {
                            LogDriver: 'awslogs',
                            Options: {
                                'awslogs-group': cf.stackName,
                                'awslogs-region': cf.region,
                                'awslogs-stream-prefix': cf.stackName,
                                'awslogs-create-group': true
                            }
                        },
                        Essential: true
                    }]
                }
            },
        },
    },
);
