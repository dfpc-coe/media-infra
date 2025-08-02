/**
 * CloudFormation import utilities for cross-stack references
 * Following TAK.NZ pattern for importing resources from other stacks
 */

export const BASE_EXPORT_NAMES = {
  VPC_ID: 'VpcId',
  VPC_CIDR_IPV4: 'VpcCidrIpv4',
  SUBNET_PUBLIC_A: 'SubnetPublicA',
  SUBNET_PUBLIC_B: 'SubnetPublicB',
  SUBNET_PRIVATE_A: 'SubnetPrivateA',
  SUBNET_PRIVATE_B: 'SubnetPrivateB',
  ECS_CLUSTER: 'EcsClusterArn',
  KMS_KEY: 'KmsKeyArn',
  CERTIFICATE_ARN: 'CertificateArn',
  HOSTED_ZONE_ID: 'HostedZoneId',
  HOSTED_ZONE_NAME: 'HostedZoneName',
  ECR_REPO: 'EcrArtifactsRepoArn',
} as const;

export const AUTH_EXPORT_NAMES = {
  AUTHENTIK_ADMIN_TOKEN: 'AuthentikAdminTokenArn',
  AUTHENTIK_LDAP_SERVICE_USER: 'AuthentikLdapServiceUserArn',
} as const;

export const TAK_EXPORT_NAMES = {
  TAK_ADMIN_CERT: 'TakAdminCertSecretArn',
  TAK_FEDERATE_CA_CERT: 'TakFederateCACertSecretArn',
  TAK_SERVICE_URL: 'TakServiceUrl',
} as const;

export function createBaseImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-BaseInfra-${exportName}`;
}

export function createAuthImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-AuthInfra-${exportName}`;
}

export function createTakImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-TakInfra-${exportName}`;
}

export const CLOUDTAK_EXPORT_NAMES = {
  SIGNING_SECRET: 'SigningSecret',
  MEDIA_SECRET: 'MediaSecret',
  SERVICE_URL: 'ServiceURL',
} as const;

export function createCloudTakImportValue(stackNameComponent: string, exportName: string): string {
  return `TAK-${stackNameComponent}-CloudTAK-${exportName}`;
}