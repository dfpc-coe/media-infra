import cf from '@openaddresses/cloudfriend';

const PORTS = [{
    Port: 9997,
    Protocol: 'tcp',
    Description: 'API Access'
},{
    Port: 8554,
    Protocol: 'tcp',
    Description: 'RTSP'
},{
    Port: 8322,
    Protocol: 'tcp',
    Description: ''
},{
    Port: 1935,
    Protocol: 'tcp',
    Description: ''
},{
    Port: 8888,
    Protocol: 'tcp',
    Description: ''
},{
    Port: 8889,
    Protocol: 'tcp',
    Description: ''
},{
    Port: 8890,
    Protocol: 'udp',
    Description: ''
}];

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
            ELB: {
                Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
                Properties: {
                    Name: cf.stackName,
                    Type: 'network',
                    SecurityGroups: [cf.ref('ELBSecurityGroup')],
                    LoadBalancerAttributes: [{
                        Key: 'access_logs.s3.enabled',
                        Value: true
                    },{
                        Key: 'access_logs.s3.bucket',
                        Value: cf.importValue(cf.join(['coe-elb-logs-', cf.ref('Environment'), '-bucket']))
                    },{
                        Key: 'access_logs.s3.prefix',
                        Value: cf.stackName
                    }],
                    Subnets:  [
                        cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                        cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-public-b']))
                    ]
                }
            },
            ELBSecurityGroup: {
                Type : 'AWS::EC2::SecurityGroup',
                Properties : {
                    Tags: [{
                        Key: 'Name',
                        Value: cf.join('-', [cf.stackName, 'elb-sg'])
                    }],
                    GroupName: cf.join('-', [cf.stackName, 'elb-sg']),
                    GroupDescription: 'Allow Access to ELB',
                    SecurityGroupIngress: PORTS.map((port) => {
                        return {
                            CidrIp: '0.0.0.0/0',
                            IpProtocol: 'tcp',
                            FromPort: port.Port,
                            ToPort: port.Port
                        };
                    }),
                    VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc']))
                }
            },
            ListenerAPI: {
                Type: 'AWS::ElasticLoadBalancingV2::Listener',
                Properties: {
                    DefaultActions: [{
                        Type: 'forward',
                        TargetGroupArn: cf.ref('TargetGroupAPI')
                    }],
                    LoadBalancerArn: cf.ref('ELB'),
                    Port: 9997,
                    Protocol: 'TCP'
                }
            },
            TargetGroupAPI: {
                Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
                DependsOn: 'ELB',
                Properties: {
                    Port: 9997,
                    Protocol: 'TCP',
                    TargetType: 'ip',
                    VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc']))
                }
            },
            ListenerRTSP: {
                Type: 'AWS::ElasticLoadBalancingV2::Listener',
                Properties: {
                    DefaultActions: [{
                        Type: 'forward',
                        TargetGroupArn: cf.ref('TargetGroupRTSP')
                    }],
                    LoadBalancerArn: cf.ref('ELB'),
                    Port: 8554,
                    Protocol: 'TCP'
                }
            },
            TargetGroupRTSP: {
                Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
                DependsOn: 'ELB',
                Properties: {
                    Port: 8554,
                    Protocol: 'TCP',
                    TargetType: 'ip',
                    VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc']))
                }
            },
            ServiceTaskDefinition: {
                Type: 'AWS::ECS::TaskDefinition',
                Properties: {
                    Family: cf.join([cf.stackName, '-service']),
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
                    Volumes: [{
                        Name: cf.stackName,
                        EFSVolumeConfiguration: {
                            FilesystemId: cf.ref('EFSFileSystem')
                        }
                    }],
                    ContainerDefinitions: [{
                        Name: 'api',
                        Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-media:', cf.ref('GitSha')]),
                        MountPoints: [{
                            ContainerPath: '/opt/mediamtx',
                            SourceVolume: cf.stackName
                        }],
                        PortMappings: PORTS.map((port) => {
                            return {
                                ContainerPort: port.Port,
                                Protocol: port.Protocol
                            };
                        }),
                        Environment: [
                            { Name: 'StackName', Value: cf.stackName },
                            { Name: 'AWS_DEFAULT_REGION', Value: cf.region }
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
            /**
             * Task Definitions can be started manually, these won't be part of the service,
             * won't be connected to EFS and will manage their own config
             */
            TaskDefinition: {
                Type: 'AWS::ECS::TaskDefinition',
                Properties: {
                    Family: cf.join([cf.stackName, '-task']),
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
                        Name: 'task',
                        Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/coe-ecr-media:', cf.ref('GitSha')]),
                        PortMappings: PORTS.map((port) => {
                            return {
                                ContainerPort: port.Port,
                                Protocol: port.Protocol
                            };
                        }),
                        Environment: [
                            { Name: 'StackName', Value: cf.stackName },
                            { Name: 'AWS_DEFAULT_REGION', Value: cf.region }
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
            Service: {
                Type: 'AWS::ECS::Service',
                Properties: {
                    ServiceName: cf.join('-', [cf.stackName, 'Service']),
                    Cluster: cf.join(['coe-ecs-', cf.ref('Environment')]),
                    TaskDefinition: cf.ref('ServiceTaskDefinition'),
                    LaunchType: 'FARGATE',
                    PropagateTags: 'SERVICE',
                    DesiredCount: 1,
                    NetworkConfiguration: {
                        AwsvpcConfiguration: {
                            AssignPublicIp: 'ENABLED',
                            SecurityGroups: [cf.ref('ServiceSecurityGroup')],
                            Subnets:  [
                                cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                                cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-public-b']))
                            ]
                        }
                    },
                    LoadBalancers: [{
                        ContainerName: 'api',
                        ContainerPort: 8554,
                        TargetGroupArn: cf.ref('TargetGroupRTSP')
                    },{
                        ContainerName: 'api',
                        ContainerPort: 9997,
                        TargetGroupArn: cf.ref('TargetGroupAPI')
                    }]
                }
            },
            ServiceSecurityGroup: {
                Type: 'AWS::EC2::SecurityGroup',
                Properties: {
                    Tags: [{
                        Key: 'Name',
                        Value: cf.join('-', [cf.stackName, 'ec2-sg'])
                    }],
                    GroupDescription: 'Allow access to TAK ports',
                    VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc'])),
                    SecurityGroupIngress: PORTS.map((port) => {
                        return {
                            CidrIp: '0.0.0.0/0',
                            IpProtocol: port.Protocol,
                            FromPort: port.Port,
                            ToPort: port.Port
                        };
                    })
                }
            }
        }
    }
);
