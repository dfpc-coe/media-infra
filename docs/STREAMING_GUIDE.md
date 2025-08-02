# 🎥 MediaMTX Streaming Guide

## **Overview**

MediaMTX is a ready-to-use and zero-dependency real-time media server and media proxy that allows to publish, read and proxy video and audio streams. This guide covers the streaming protocols, configuration, and usage patterns for the TAK Media Infrastructure.

---

## **🔌 Supported Protocols**

### **Secure Protocols (Production Ready)**

#### **RTMPS - RTMP over TLS (Port 1936)**
- **Use Case**: Live streaming from OBS Studio, streaming software
- **Security**: TLS encryption, CloudTAK authentication
- **URL Format**: `rtmps://media.tak.nz:1936/{stream-id}`
- **Features**: Low latency, widely supported by streaming software

```bash
# Example OBS Studio configuration
Server: rtmps://media.tak.nz:1936/live
Stream Key: {your-authenticated-stream-key}
```

#### **RTSPS - RTSP over TLS (Port 8555)**
- **Use Case**: IP cameras, security systems, media players
- **Security**: TLS encryption, CloudTAK authentication
- **URL Format**: `rtsps://media.tak.nz:8555/{stream-id}`
- **Features**: Bidirectional communication, session management

```bash
# Example VLC playback
vlc rtsps://media.tak.nz:8555/{stream-id}
```

#### **SRTS - SRT with Encryption (Port 8890)**
- **Use Case**: Low-latency streaming with error correction
- **Security**: Built-in encryption, CloudTAK authentication
- **URL Format**: `srt://media.tak.nz:8890?streamid=read:{stream-id}`
- **Features**: Adaptive bitrate, packet recovery, ultra-low latency

```bash
# Example FFmpeg streaming
ffmpeg -i input.mp4 -c copy -f mpegts "srt://media.tak.nz:8890?streamid=read:{stream-id}"
```

#### **HLS - HTTP Live Streaming (Port 8888)**
- **Use Case**: Web browsers, mobile applications, adaptive streaming
- **Security**: HTTPS encryption, CloudTAK authentication
- **URL Format**: `https://media.tak.nz:8888/{stream-id}/index.m3u8`
- **Features**: Adaptive bitrate, wide client compatibility

```html
<!-- Example HTML5 video player -->
<video controls>
  <source src="https://media.tak.nz:8888/{stream-id}/index.m3u8" type="application/x-mpegURL">
</video>
```

### **Insecure Protocols (Development Only)**

#### **RTMP - Real-Time Messaging Protocol (Port 1935)**
- **Use Case**: Development and testing only
- **Security**: ⚠️ No encryption, authentication via CloudTAK
- **URL Format**: `rtmp://media.tak.nz:1935/{stream-id}`
- **Enable**: Set `enableInsecurePorts=true` in configuration

#### **RTSP - Real-Time Streaming Protocol (Port 8554)**
- **Use Case**: Development and testing only
- **Security**: ⚠️ No encryption, authentication via CloudTAK
- **URL Format**: `rtsp://media.tak.nz:8554/{stream-id}`
- **Enable**: Set `enableInsecurePorts=true` in configuration

---

## **🔐 Authentication & Authorization**

### **CloudTAK Integration**
All streaming protocols integrate with CloudTAK for user authentication:

1. **User Authentication**: Streams require valid CloudTAK user credentials
2. **Stream Authorization**: Users must have media streaming permissions
3. **Token Validation**: JWT tokens validated against CloudTAK API
4. **Session Management**: Active stream sessions tracked and managed

### **Authentication Flow**
```
1. Client requests stream access
2. MediaMTX validates credentials with CloudTAK API
3. CloudTAK returns user permissions and stream authorization
4. MediaMTX allows/denies stream based on authorization
5. Active streams monitored and logged
```

### **Stream Key Format**
```
{username}:{password}:{stream-name}
```

Example:
```
tactical-user:secure-password:field-camera-01
```

---

## **📡 Streaming Clients**

### **OBS Studio Configuration**

#### **RTMPS (Recommended)**
```
Settings → Stream
Service: Custom
Server: rtmps://media.tak.nz:1936/live
Stream Key: {username}:{password}:{stream-name}
```

#### **SRT (Low Latency)**
```
Settings → Stream
Service: Custom
Server: srt://media.tak.nz:8890?streamid={username}:{password}:{stream-name}
```

### **FFmpeg Examples**

#### **Stream to RTMPS**
```bash
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -f flv \
  "rtmps://media.tak.nz:1936/live/{username}:{password}:{stream-name}"
```

#### **Stream to SRT**
```bash
ffmpeg -i input.mp4 -c copy -f mpegts \
  "srt://media.tak.nz:8890?streamid={username}:{password}:{stream-name}"
```

#### **Receive from RTSPS**
```bash
ffmpeg -i "rtsps://media.tak.nz:8555/{stream-id}" \
  -c copy output.mp4
```

### **VLC Media Player**

#### **Play HLS Stream**
```
Media → Open Network Stream
URL: https://media.tak.nz:8888/{stream-id}/index.m3u8
```

#### **Play RTSPS Stream**
```
Media → Open Network Stream  
URL: rtsps://media.tak.nz:8555/{stream-id}
```

---

## **🎛️ MediaMTX API**

### **API Endpoint**
- **URL**: `https://media.tak.nz:9997/v3/`
- **Security**: HTTPS with authentication
- **Documentation**: OpenAPI/Swagger interface available

### **Common API Operations**

#### **Get Global Configuration**
```bash
curl -k "https://media.tak.nz:9997/v3/config/global/get"
```

#### **List Active Streams**
```bash
curl -k "https://media.tak.nz:9997/v3/paths/list"
```

#### **Get Stream Statistics**
```bash
curl -k "https://media.tak.nz:9997/v3/paths/get/{stream-name}"
```

#### **Terminate Stream**
```bash
curl -k -X POST "https://media.tak.nz:9997/v3/paths/kick/{stream-name}"
```

---

## **📊 Stream Monitoring**

### **CloudWatch Metrics**
- **Active Streams**: Number of concurrent streams
- **Connection Count**: Total client connections
- **Bandwidth Usage**: Ingress/egress data transfer
- **Error Rates**: Authentication failures, connection errors

### **Log Analysis**
```bash
# View MediaMTX logs
aws logs tail /ecs/TAK-Dev-MediaInfra-MediaMTX --follow

# Filter for authentication events
aws logs filter-log-events \
  --log-group-name /ecs/TAK-Dev-MediaInfra-MediaMTX \
  --filter-pattern "auth"

# Monitor stream connections
aws logs filter-log-events \
  --log-group-name /ecs/TAK-Dev-MediaInfra-MediaMTX \
  --filter-pattern "connected"
```

---

## **🔧 Configuration Examples**

### **Development Environment**
```bash
# Enable insecure protocols for testing
npm run deploy:dev -- --context enableInsecurePorts=true

# Test with RTMP (insecure)
ffmpeg -i test.mp4 -c copy -f flv \
  "rtmp://media.dev.tak.nz:1935/live/test-user:test-pass:test-stream"
```

### **Production Environment**
```bash
# Production deployment (secure protocols only)
npm run deploy:prod

# Stream with RTMPS (secure)
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -f flv \
  "rtmps://media.tak.nz:1936/live/user:password:stream"
```

---

## **🚨 Troubleshooting**

### **Common Issues**

#### **Authentication Failures**
```
Error: Authentication failed
```
**Solutions:**
- Verify CloudTAK user credentials
- Check user has media streaming permissions
- Ensure CloudTAK API is accessible
- Validate stream key format

#### **Connection Refused**
```
Error: Connection refused
```
**Solutions:**
- Check if insecure ports are enabled for RTMP/RTSP
- Verify security group allows traffic on streaming ports
- Confirm MediaMTX service is running
- Test with secure protocols (RTMPS/RTSPS)

#### **Stream Not Found**
```
Error: Stream not found
```
**Solutions:**
- Verify stream name is correct
- Check if stream is active
- Ensure proper authentication
- Use MediaMTX API to list active streams

### **Debug Commands**

#### **Test Protocol Connectivity**
```bash
# Test RTMPS port
telnet media.tak.nz 1936

# Test RTSPS port  
telnet media.tak.nz 8555

# Test API endpoint
curl -k https://media.tak.nz:9997/v3/config/global/get
```

#### **Check Service Health**
```bash
# ECS service status
aws ecs describe-services \
  --cluster TAK-Dev-ECSCluster \
  --services TAK-Dev-MediaInfra-MediaMTX

# Load balancer health
aws elbv2 describe-target-health \
  --target-group-arn {target-group-arn}
```

---

## **📈 Performance Optimization**

### **Streaming Best Practices**
- **Use SRT for low-latency applications**
- **Use HLS for web-based playback**
- **Configure appropriate bitrates for network conditions**
- **Monitor bandwidth usage and adjust resources accordingly**

### **Resource Scaling**
```bash
# Increase resources for high-load scenarios
npm run deploy:prod -- \
  --context mediamtx.cpu=2048 \
  --context mediamtx.memory=4096
```

### **Network Optimization**
- **Use CloudFront for HLS distribution** (future enhancement)
- **Configure regional endpoints** for global deployments
- **Monitor latency and adjust protocols** accordingly

---

## **🔗 Related Documentation**

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Infrastructure deployment
- **[Architecture Guide](ARCHITECTURE.md)** - Technical architecture
- **[Configuration Guide](PARAMETERS.md)** - Configuration parameters
- **[Quick Reference](QUICK_REFERENCE.md)** - Fast commands and endpoints
- **[MediaMTX Documentation](https://github.com/bluenviron/mediamtx)** - Official MediaMTX docs