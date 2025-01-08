import cf from '@openaddresses/cloudfriend';

const PORTS = [{
    Name: 'API',
    Port: 9997,
    Protocol: 'tcp',
    Description: 'API Access - HTTP',
    Certificate: true,
    Enabled: true
},{
    Name: 'RTSP',
    Port: 8554,
    Protocol: 'tcp',
    Description: 'RTSP Protocol',
    Certificate: false,
    Enabled: true
},{
    Name: 'RTSPS',
    Port: 8322,
    Protocol: 'tcp',
    Description: 'RTSPS Protocol',
    Certificate: false,
    Enabled: false
},{
    Name: 'RTMP',
    Port: 1935,
    Protocol: 'tcp',
    Description: 'RTMP Protocol',
    Certificate: false,
    Enabled: true
},{
    Name: 'RTMPS',
    Port: 1936,
    Protocol: 'tcp',
    Description: 'RTMPS Protocol',
    Certificate: false,
    Enabled: false
},{
    Name: 'HLS',
    Port: 8888,
    Protocol: 'tcp',
    Description: 'HLS Protocol',
    Certificate: true,
    Enabled: true
},{
    Name: 'WEBRTC',
    Port: 8889,
    Protocol: 'tcp',
    Description: 'WebRTC Protocol',
    Certificate: false,
    Enabled: false
},{
    Name: 'SRT',
    Port: 8890,
    Protocol: 'udp',
    Description: 'SRT Protocol',
    Certificate: false,
    Enabled: true
}].filter((p) => {
    return p.Enabled;
});

const Resources = {
    SigningSecret: {
        Type: 'AWS::SecretsManager::Secret',
        Properties: {
            Description: cf.join([cf.stackName, ' API Password']),
            GenerateSecretString: {
                ExcludePunctuation: true,
                PasswordLength: 32
            },
            Name: cf.join([cf.stackName, '/api/secret']),
            KmsKeyId: cf.ref('KMS')
        }
    },
    Logs: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: cf.stackName,
            RetentionInDays: 7
        }
    },
    ELBEIPSubnetA: {
        Type: 'AWS::EC2::EIP',
        Properties: {
            Tags: [{
                Key: 'Name',
                Value: cf.join([cf.stackName, '-subnet-a'])
            }]
        }
    },
    ELBEIPSubnetB: {
        Type: 'AWS::EC2::EIP',
        Properties: {
            Tags: [{
                Key: 'Name',
                Value: cf.join([cf.stackName, '-subnet-b'])
            }]
        }
    },
    ELB: {
        Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        DependsOn: ['ELBEIPSubnetA', 'ELBEIPSubnetB'],
        Properties: {
            Name: cf.stackName,
            Type: 'network',
            Scheme: 'internet-facing',
            // Disabled as DualStack currently does not support IPv6 UDP
            // ref: https://docs.aws.amazon.com/whitepapers/latest/ipv6-on-aws/scaling-the-dual-stack-network-design-in-aws.html
            // EnablePrefixForIpv6SourceNat: 'on',
            // IpAddressType: 'dualstack',
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
            SubnetMappings: [{
                AllocationId: cf.getAtt('ELBEIPSubnetA', 'AllocationId'),
                SubnetId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-public-a']))
            },{
                AllocationId: cf.getAtt('ELBEIPSubnetB', 'AllocationId'),
                SubnetId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-subnet-public-b']))
            }]
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
                    IpProtocol: port.Protocol,
                    FromPort: port.Port,
                    ToPort: port.Port
                };
            }),
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
                    { Name: 'MANAGEMENT_PASSWORD', Value: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}') },
                    { Name: 'FORCE_NEW_CONFIG', Value: cf.ref('ForceNewConfig') },
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
                            'ssmmessages:CreateControlChannel',
                            'ssmmessages:CreateDataChannel',
                            'ssmmessages:OpenControlChannel',
                            'ssmmessages:OpenDataChannel'
                        ],
                        Resource: '*'
                    },{
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
        DependsOn: 'ELB',
        Properties: {
            ServiceName: cf.join('-', [cf.stackName, 'Service']),
            Cluster: cf.join(['coe-ecs-', cf.ref('Environment')]),
            TaskDefinition: cf.ref('ServiceTaskDefinition'),
            LaunchType: 'FARGATE',
            PropagateTags: 'SERVICE',
            EnableExecuteCommand: cf.ref('EnableExecute'),
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
            LoadBalancers: PORTS.map((p) => {
                return {
                    ContainerName: 'api',
                    ContainerPort: p.Port,
                    TargetGroupArn: cf.ref(`TargetGroup${p.Name}`)
                };
            })
        }
    },
    ServiceSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
            Tags: [{
                Key: 'Name',
                Value: cf.join('-', [cf.stackName, 'ec2-sg'])
            }],
            GroupDescription: 'Allow access to Media ports',
            VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc'])),
            SecurityGroupIngress: PORTS.map((port) => {
                return {
                    Description: 'ELB Traffic',
                    SourceSecurityGroupId: cf.ref('ELBSecurityGroup'),
                    IpProtocol: port.Protocol,
                    FromPort: port.Port,
                    ToPort: port.Port
                };
            })
        }
    }
};

for (const p of PORTS) {
    Resources[`Listener${p.Name}`] = {
        Type: 'AWS::ElasticLoadBalancingV2::Listener',
        Properties: {
            Certificates: p.Certificate ? [{
                CertificateArn: cf.join(['arn:', cf.partition, ':acm:', cf.region, ':', cf.accountId, ':certificate/', cf.ref('SSLCertificateIdentifier')])
            }] : [],
            DefaultActions: [{
                Type: 'forward',
                TargetGroupArn: cf.ref(`TargetGroup${p.Name}`)
            }],
            LoadBalancerArn: cf.ref('ELB'),
            Port: p.Port,
            Protocol: p.Certificate && p.Protocol === 'tcp' ? 'TLS' : p.Protocol.toUpperCase()
        }
    };

    Resources[`TargetGroup${p.Name}`] = {
        Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
        DependsOn: 'ELB',
        Properties: {
            Port: p.Port,
            Protocol: p.Protocol.toUpperCase(),
            TargetType: 'ip',
            VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc'])),

            HealthCheckEnabled: true,
            HealthCheckIntervalSeconds: 30,
            // UDP Health checks fallback to TCP
            HealthCheckPort: p.Protocol.toUpperCase() === 'UDP' ? '9997' : p.Port,
            HealthCheckProtocol: p.Protocol.toUpperCase() === 'UDP' ? 'TCP' : p.Protocol.toUpperCase(),
            HealthCheckTimeoutSeconds: 10,
            HealthyThresholdCount: 5
        }
    };
}

export default cf.merge({
    Parameters: {
        EnableExecute: {
            Description: 'Allow SSH into docker container - should only be enabled for limited debugging',
            Type: 'String',
            AllowedValues: ['true', 'false'],
            Default: 'false'
        },
        ForceNewConfig: {
            Description: 'Force a blank config file - permanently deleting current config',
            Type: 'String',
            AllowedValues: ['true', 'false'],
            Default: 'false'
        },
        SSLCertificateIdentifier: {
            Description: 'ACM SSL Certificate for HTTP Protocol',
            Type: 'String'
        }
    },
    Outputs: {
        SubnetAIP: {
            Description: 'NLB EIP for Subnet A',
            Value: cf.ref('ELBEIPSubnetA')
        },
        SubnetBIP: {
            Description: 'NLB EIP for Subnet B',
            Value: cf.ref('ELBEIPSubnetB')
        },
        ManagementPassword: {
            Description: 'Video Server Management Password',
            Value: cf.sub('{{resolve:secretsmanager:${AWS::StackName}/api/secret:SecretString::AWSCURRENT}}')
        }
    },
    Resources
});
