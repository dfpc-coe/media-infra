import cf from '@openaddresses/cloudfriend';

const PORTS = [{
    Port: 9997
},{
    Port: 8554
},{
    Port: 8322
},{
    Port: 1935
},{
    Port: 8888
},{
    Port: 8889
},{
    Port: 8890
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
                        Key: 'idle_timeout.timeout_seconds',
                        Value: 4000
                    },{
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
                    VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc'])),
                    Matcher: {
                        HttpCode: '200,202,302,304'
                    }
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
                    TaskDefinition: cf.ref('TaskDefinition'),
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
                            IpProtocol: 'tcp',
                            FromPort: port.Port,
                            ToPort: port.Port
                        };
                    })
                }
            }
        }
    }
);
