import cf from '@openaddresses/cloudfriend';

export default cf.merge(
    {
        Resources: {
            Logs: {
                Type: 'AWS::Logs::LogGroup',
                Properties: {
                    LogGroupName: cf.stackName,
                    RetentionInDays: 7
                }
            },
            TaskDefinition: {
                Type: 'AWS::ECS::TaskDefinition',
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
                            ContainerPort: 8554,
                            Protocol: 'tcp'
                        },{
                            ContainerPort: 8890,
                            Protocol: 'udp'
                        },{
                            ContainerPort: 8889,
                            Protocol: 'tcp'
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
            ExecRole: {
                Type: 'AWS::IAM::Role',
                Properties: {
                    AssumeRolePolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Principal: {
                                Service: 'ecs-tasks.amazonaws.com'
                            },
                            Action: 'sts:AssumeRole'
                        }]
                    },
                    Policies: [{
                        PolicyName: cf.join([cf.stackName, '-api-logging']),
                        PolicyDocument: {
                            Statement: [{
                                Effect: 'Allow',
                                Action: [
                                    'logs:CreateLogGroup',
                                    'logs:CreateLogStream',
                                    'logs:PutLogEvents',
                                    'logs:DescribeLogStreams'
                                ],
                                Resource: [cf.join(['arn:', cf.partition, ':logs:*:*:*'])]
                            }]
                        }
                    }],
                    ManagedPolicyArns: [
                        cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'])
                    ],
                    Path: '/service-role/'
                }
            },
            TaskRole: {
                Type: 'AWS::IAM::Role',
                Properties: {
                    AssumeRolePolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Principal: {
                                Service: 'ecs-tasks.amazonaws.com'
                            },
                            Action: 'sts:AssumeRole'
                        }]
                    },
                    Policies: [{
                        PolicyName: cf.join('-', [cf.stackName, 'api-policy']),
                        PolicyDocument: {
                            Statement: [{
                                Effect: 'Allow',
                                Action: [
                                    'logs:CreateLogGroup',
                                    'logs:CreateLogStream',
                                    'logs:PutLogEvents',
                                    'logs:DescribeLogStreams'
                                ],
                                Resource: [cf.join(['arn:', cf.partition, ':logs:*:*:*'])]
                            }]
                        }
                    }]
                }
            },
        },
    },
);
