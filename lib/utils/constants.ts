/**
 * Constants for MediaInfra infrastructure
 */

export const DEFAULT_AWS_REGION = 'ap-southeast-2';

export const MEDIAMTX_PORTS = {
  RTMP: 1935,
  RTSP: 8554,
  RTMPS: 1936,
  RTSPS: 8555,
  SRTS: 8890,
  HLS_HTTPS: 8888,
  API_HTTPS: 9997,
} as const;

