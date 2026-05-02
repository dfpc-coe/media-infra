import fs from 'node:fs';
import { URL } from 'node:url';
import cf from '@openaddresses/cloudfriend';

const PORTS = [{
    Name: 'API',
    Port: 9997,
    Protocol: 'tcp',
    Description: 'HTTP API/HLS',
    Enabled: true
},{
    Name: 'Playback',
    Port: 9996,
    Protocol: 'tcp',
    Description: 'Playback Protocol',
    Enabled: true
},{
    Name: 'RTSP',
    Port: 8554,
    Protocol: 'tcp',
    Description: 'RTSP Protocol',
    Enabled: true
},{
    Name: 'RTSPS',
    Port: 8322,
    Protocol: 'tcp',
    Description: 'RTSPS Protocol',
    Enabled: false
},{
    Name: 'RTMP',
    Port: 1935,
    Protocol: 'tcp',
    Description: 'RTMP Protocol',
    Enabled: true
},{
    Name: 'RTMPS',
    Port: 1936,
    Protocol: 'tcp',
    Description: 'RTMPS Protocol',
    Enabled: false
},{
    Name: 'HLS',
    Port: 8888,
    Protocol: 'tcp',
    Description: 'HLS Protocol',
    Enabled: true
},{
    Name: 'WEBRTC',
    Port: 8889,
    Protocol: 'tcp',
    Description: 'WebRTC Protocol',
    Enabled: true
},{
    Name: 'WEBRTC-ICE',
    Port: 8189,
    Protocol: 'udp',
    Description: 'WebRTC ICE UDP Protocol',
    Enabled: true
},{
    Name: 'WEBRTC-ICE-TCP',
    Port: 8189,
    Protocol: 'tcp',
    Description: 'WebRTC ICE TCP fallback Protocol',
    Enabled: true
},{
    Name: 'SRT',
    Port: 8890,
    Protocol: 'udp',
    Description: 'SRT Protocol',
    Enabled: true
}].filter((p) => {
    return p.Enabled;
});

const containerEnvironment = [
    { Name: 'StackName', Value: cf.stackName },
    { Name: 'LOG_LEVEL', Value: cf.ref('LogLevel') },
    { Name: 'Environment', Value: cf.ref('Environment') },
    { Name: 'SigningSecret', Value: cf.sub('{{resolve:secretsmanager:tak-cloudtak-${Environment}/api/secret:SecretString::AWSCURRENT}}') },
    { Name: 'API_URL', Value: cf.join(['https://map.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]) },
    { Name: 'CLOUDTAK_Config_media_url', Value: cf.join(['https://', 'video', '.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]) },
    { Name: 'ACM_CERTIFICATE_ARN', Value: cf.ref('MediaCertificate') },
    { Name: 'AWS_DEFAULT_REGION', Value: cf.region },
    { Name: 'AWS_REGION', Value: cf.region }
];

const portMappings = PORTS.map((port) => {
    return {
        ContainerPort: port.Port,
        HostPort: port.Port,
        Protocol: port.Protocol
    };
});

function containerDefinition(name) {
    return {
        Name: name,
        Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/tak-vpc-', cf.ref('Environment'), '-cloudtak-media:', cf.ref('GitSha')]),
        MountPoints: [{
            ContainerPath: '/opt/mediamtx',
            SourceVolume: cf.stackName
        }],
        PortMappings: portMappings,
        Environment: containerEnvironment,
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
    };
}

const Resources = {
    MediaCertificate: {
        Type: 'AWS::CertificateManager::Certificate',
        Properties: {
            DomainName: cf.join(['video', '.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
            CertificateExport: 'ENABLED',
            ValidationMethod: 'DNS',
            DomainValidationOptions: [{
                DomainName: cf.join(['video', '.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
                HostedZoneId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-id']))
            }],
            Tags: [{
                Key: 'Name',
                Value: cf.stackName
            }]
        }
    },
    MediaDNSRecord: {
        Type: 'AWS::Route53::RecordSet',
        Properties: {
            HostedZoneId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-id'])),
            Type : 'A',
            Name: cf.join(['video', '.', cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-hosted-zone-name']))]),
            Comment: cf.join(' ', [cf.stackName, 'DNS Entry']),
            TTL: '60',
            ResourceRecords: [cf.ref('ELBEIPSubnetA')]
        }
    },
    Logs: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: cf.stackName,
            RetentionInDays: 7
        }
    },
    MediaCluster: {
        Type: 'AWS::ECS::Cluster',
        Properties: {
            ClusterName: cf.join(['tak-vpc-', cf.ref('Environment'), '-media']),
            ClusterSettings: [{
                Name: 'containerInsights',
                Value: 'enhanced'
            }]
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
    ServiceSecurityGroup: {
        Type: 'AWS::EC2::SecurityGroup',
        Properties: {
            Tags: [{
                Key: 'Name',
                Value: cf.join('-', [cf.stackName, 'ec2-sg'])
            }],
            GroupName: cf.join('-', [cf.stackName, 'ec2-sg']),
            GroupDescription: 'Allow direct access to Media ports',
            SecurityGroupIngress: PORTS.map((port) => {
                return {
                    Description: port.Description,
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: port.Protocol,
                    FromPort: port.Port,
                    ToPort: port.Port
                };
            }),
            VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc']))
        }
    },
    ContainerInstanceRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
            AssumeRolePolicyDocument: {
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Principal: {
                        Service: 'ec2.amazonaws.com'
                    },
                    Action: 'sts:AssumeRole'
                }]
            },
            Policies: [{
                PolicyName: cf.join('-', [cf.stackName, 'eip-association']),
                PolicyDocument: {
                    Statement: [{
                        Effect: 'Allow',
                        Action: [
                            'ec2:AssociateAddress',
                            'ec2:DescribeAddresses',
                            'ec2:DescribeInstances'
                        ],
                        Resource: '*'
                    }]
                }
            }],
            ManagedPolicyArns: [
                cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role']),
                cf.join(['arn:', cf.partition, ':iam::aws:policy/AmazonSSMManagedInstanceCore'])
            ],
            Path: '/service-role/'
        }
    },
    ContainerInstanceProfile: {
        Type: 'AWS::IAM::InstanceProfile',
        Properties: {
            Path: '/service-role/',
            Roles: [cf.ref('ContainerInstanceRole')]
        }
    },
    MediaLaunchTemplate: {
        Type: 'AWS::EC2::LaunchTemplate',
        Properties: {
            LaunchTemplateName: cf.stackName,
            LaunchTemplateData: {
                ImageId: cf.ref('ECSOptimizedAMI'),
                InstanceType: cf.ref('InstanceType'),
                IamInstanceProfile: {
                    Arn: cf.getAtt('ContainerInstanceProfile', 'Arn')
                },
                MetadataOptions: {
                    HttpEndpoint: 'enabled',
                    HttpTokens: 'required'
                },
                NetworkInterfaces: [{
                    DeviceIndex: 0,
                    AssociatePublicIpAddress: true,
                    Groups: [cf.ref('ServiceSecurityGroup')]
                }],
                UserData: {
                    'Fn::Base64': {
                        'Fn::Sub': [
                            fs.readFileSync(new URL('./api.sh', import.meta.url), 'utf8'),
                            {
                                AllocationId: cf.getAtt('ELBEIPSubnetA', 'AllocationId'),
                                ClusterName: cf.join(['tak-vpc-', cf.ref('Environment'), '-media'])
                            }
                        ]
                    }
                },
                TagSpecifications: [{
                    ResourceType: 'instance',
                    Tags: [{
                        Key: 'Name',
                        Value: cf.stackName
                    }]
                },{
                    ResourceType: 'volume',
                    Tags: [{
                        Key: 'Name',
                        Value: cf.stackName
                    }]
                }]
            }
        }
    },
    MediaAutoScalingGroup: {
        Type: 'AWS::AutoScaling::AutoScalingGroup',
        Properties: {
            AutoScalingGroupName: cf.stackName,
            DesiredCapacity: '1',
            MinSize: '1',
            MaxSize: '2',
            HealthCheckGracePeriod: 300,
            HealthCheckType: 'EC2',
            VPCZoneIdentifier: [
                cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-a'])),
                cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-subnet-public-b']))
            ],
            LaunchTemplate: {
                LaunchTemplateId: cf.ref('MediaLaunchTemplate'),
                Version: cf.getAtt('MediaLaunchTemplate', 'LatestVersionNumber')
            },
            Tags: [{
                Key: 'Name',
                Value: cf.stackName,
                PropagateAtLaunch: true
            },{
                Key: 'AmazonECSManaged',
                Value: 'true',
                PropagateAtLaunch: true
            }]
        }
    },
    MediaCapacityProvider: {
        Type: 'AWS::ECS::CapacityProvider',
        Properties: {
            Name: cf.stackName,
            AutoScalingGroupProvider: {
                AutoScalingGroupArn: cf.ref('MediaAutoScalingGroup'),
                ManagedScaling: {
                    Status: 'ENABLED',
                    TargetCapacity: 100,
                    MinimumScalingStepSize: 1,
                    MaximumScalingStepSize: 1,
                    InstanceWarmupPeriod: 300
                },
                ManagedTerminationProtection: 'DISABLED'
            },
            Tags: [{
                Key: 'Name',
                Value: cf.stackName
            }]
        }
    },
    MediaClusterCapacityProviderAssociation: {
        Type: 'AWS::ECS::ClusterCapacityProviderAssociations',
        Properties: {
            Cluster: cf.ref('MediaCluster'),
            CapacityProviders: [
                cf.ref('MediaCapacityProvider')
            ],
            DefaultCapacityProviderStrategy: [{
                CapacityProvider: cf.ref('MediaCapacityProvider'),
                Weight: 1
            }]
        }
    },
    ServiceTaskDefinition: {
        Type: 'AWS::ECS::TaskDefinition',
        Properties: {
            Family: cf.join([cf.stackName, '-service']),
            Cpu: cf.ref('ComputeCpus'),
            Memory: cf.ref('ComputeMemory'),
            NetworkMode: 'host',
            RequiresCompatibilities: ['EC2'],
            RuntimePlatform: {
                CpuArchitecture: 'ARM64',
                OperatingSystemFamily: 'LINUX'
            },
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
            ContainerDefinitions: [containerDefinition('api')]
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
            NetworkMode: 'host',
            RequiresCompatibilities: ['EC2'],
            RuntimePlatform: {
                CpuArchitecture: 'ARM64',
                OperatingSystemFamily: 'LINUX'
            },
            Tags: [{
                Key: 'Name',
                Value: cf.join('-', [cf.stackName, 'api'])
            }],
            ExecutionRoleArn: cf.getAtt('ExecRole', 'Arn'),
            TaskRoleArn: cf.getAtt('TaskRole', 'Arn'),
            ContainerDefinitions: [{
                Name: 'task',
                Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/tak-vpc-', cf.ref('Environment'), '-cloudtak-media:', cf.ref('GitSha')]),
                PortMappings: portMappings,
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
                            'acm:DescribeCertificate',
                            'acm:ExportCertificate',
                            'acm:GetCertificate'
                        ],
                        Resource: cf.ref('MediaCertificate')
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
        DependsOn: [
            'MediaClusterCapacityProviderAssociation',
            'EFSMountTargetSubnetA',
            'EFSMountTargetSubnetB'
        ],
        Properties: {
            ServiceName: cf.stackName,
            Cluster: cf.ref('MediaCluster'),
            TaskDefinition: cf.ref('ServiceTaskDefinition'),
            CapacityProviderStrategy: [{
                CapacityProvider: cf.ref('MediaCapacityProvider'),
                Weight: 1
            }],
            PropagateTags: 'SERVICE',
            EnableExecuteCommand: cf.ref('EnableExecute'),
            DesiredCount: 1,
            DeploymentConfiguration: {
                MinimumHealthyPercent: 100,
                MaximumPercent: 200
            }
        }
    }
};

export default cf.merge({
    Parameters: {
        ComputeCpus: {
            Description: 'ECS task CPU units',
            Type: 'Number',
            Default: 1024
        },
        ComputeMemory: {
            Description: 'ECS task memory in MB',
            Type: 'Number',
            Default: 8192
        },
        InstanceType: {
            Description: 'EC2 instance type for the media ECS capacity provider',
            Type: 'String',
            Default: 't4g.xlarge'
        },
        ECSOptimizedAMI: {
            Description: 'ARM64 ECS-optimized Amazon Linux 2023 AMI ID',
            Type: 'AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>',
            Default: '/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended/image_id'
        },
        LogLevel: {
            Description: 'Log Level for MediaMTX',
            Type: 'String',
            AllowedValues: ['debug', 'info', 'warn', 'error'],
            Default: 'warn'
        },
        EnableExecute: {
            Description: 'Allow SSH into docker container - should only be enabled for limited debugging',
            Type: 'String',
            AllowedValues: ['true', 'false'],
            Default: 'false'
        }
    },
    Outputs: {
        MediaIP: {
            Description: 'Static EIP for the media EC2 instance',
            Value: cf.ref('ELBEIPSubnetA')
        },
        SubnetAIP: {
            Description: 'Retained EIP originally used by the media NLB subnet A mapping',
            Value: cf.ref('ELBEIPSubnetA')
        },
        CapacityProvider: {
            Description: 'ECS capacity provider used by the media service',
            Value: cf.ref('MediaCapacityProvider')
        },
        MediaCertificateArn: {
            Description: 'Exportable ACM certificate ARN used by the media service',
            Value: cf.ref('MediaCertificate')
        }
    },
    Resources
});
