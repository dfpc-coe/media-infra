# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### Pending Release

### v8.3.1 - 2025-12-16

- :arrow_up: Update MediaMTX to v1.15.5
- :tada: Add complete Node.js API server with Express
- :tada: Add HLS manifest proxying and rewriting
- :tada: Add JWT-based signed URL generation
- :rocket: Migrate from CLOUDTAK_URL to API_URL environment variable
- :rocket: Enhanced persistence logic with better error handling
- :rocket: Add MediaMTX API proxying routes
- :rocket: Add authentication middleware
- :rocket: Improved sync frequency (every 10 seconds)

### v8.3.0 - 2025-12-15

- :rocket: Migrate Signing to use JsonWebTokens
- :white_check_mark: Add automated CI tests for manifest generation

### v8.2.0 - 2025-12-12

- :bug: Proxy all HLS requests to ensure Authentication data isn't lost on redirects

### v8.1.0 - 2025-12-10

- :bug: Resilient Startup
- :arrow_up: MediaMTX@1.15.5

### v8.0.1 - 2025-11-25

- :rocket: Add additional logging on API Failures

### v8.0.0 - 2025-11-25

> ![!WARNING]
> This version introduces breaking changes to the API_URL environment variable.
> Previously the Media Server expected the full URL including the `/api` prefix.
> From this version onwards, only the base URL should be provided.

- :rocket: Don't expect `/api` prefix in the API_URL

### v7.2.0 - 2025-11-20

- :arrow_up: Update to MediaMTX@1.15.4

### v7.1.0 - 2025-11-18

- :tada: Support additional HLS Streams in proxy

### v7.0.2 - 2025-11-13

- :bug: Fix circular API dependency

### v7.0.0 - 2025-11-13

> [!WARNING]
> This version introduces breaking changes to the Proxy API and HLS Proxying support.
> CloudTAK@12 and above is required to use this version.

- :rocket: Complete NodeJS Proxy API as well as HLS Proxying support

### v6.1.0 - 2025-11-06

- :rocket: Introduce NodeJS Proxy API to intercept and trigage config updates in a future version

### v6.0.0 - 2025-09-22

> [!WARNING]
> The `CLOUDTAK_URL` Env Var is now called `API_URL` for consistency across all CloudTAK services.

### v5.2.0 - 2025-09-22

- :arrow_up: Update MediaMTX@1.15.0

### v5.1.0 - 2025-08-10

- :rocket: Support removing expired leases from the config

### v5.0.0 - 2025-08-10

- :tada: Remove all on disk config in favour of API based sync with the upstream CloudTAK service

### v4.5.0 - 2025-08-09

- :rocket: Change to RunOnInit

### v4.4.0 - 2025-08-09

- :rocket: Allow overriding Health Check Ports/Protocols

### v4.3.0 - 2025-08-08

- :rocket: Use `runOnDemand` with `ffmpeg` for more reliable external stream ingestion

### v4.2.0 - 2025-08-04

- :arrow_up: Update `mediamtx@1.13.1`
  
### v4.1.0 - 2025-07-07

- :arrow_up: Update `mediamtx@1.13.0`

### v4.0.3 - 2025-06-24

- :rocket: Fix diff generation for config

### v4.0.2 - 2025-06-24

- :rocket: Use unified limit value

### v4.0.1 - 2025-06-24

- :rocket: Fix paging bug in config

### v4.0.0 - 2025-06-12

- :rocket: Migrate to VPC-2.0

### v3.4.0 - 2025-06-09

- :arrow_up: Update to MediaMTX@1.12.3

### v3.3.4 - 2025-04-29

- :bug: Remove process.env.Environment requirement from persist

### v3.3.3 - 2025-04-17

- :tada: Second GHR test

### v3.3.2 - 2025-04-17

- :tada: Second GHR test

### v3.3.1 - 2025-04-17

- :tada: Initial GHR test

### v3.3.0 - 2025-04-14

- :tada: Update MediaMTX@1.12

### v3.2.0

- :tada: Enable Playback API by default

### v3.1.0

- :bug: Small bugs in path generation & diff comparison

### v3.0.0

- :tada: Reverse the management of state, instead checking CloudTAK for a list of Video Leases

### v2.21.0

- :rocket: Add Playback List

### v2.20.1

- :arrow_up: Update Core Deps

### v2.20.0

- :rocket: Ensure `management` User is retained

### v2.19.0

- :arrow_up: Update `mediamtx@1.11.2`

### v2.18.0

- :white_check_mark: Add basic tests of persist script
- :tada: Explicitly add path names to `any` user if there is not another user controlling their access

### v2.17.0

- :arrow_up: Update MediaMTX to `v1.11.1`
- :bug: Fix Lints

### v2.16.0

- :bug: Change DependsOn Strategy

### v2.15.0

- :rocket: Lock to SubnetA for time being to ensure a single EIP can be used for access

### v2.14.0

- :arrow_up: Update `MediaMTX@1.10.0`

### v2.13.1

- :bug: UDP Ports health check on alternate service

### v2.13.0

- :tada: Perform JSON Diff before writing config file if a diff has been detected.
- :rocket: Setup TS Build step and enable in GH Actions
- :rocket: Health Check each individual port/protocol
- :tada: Enable SRT by default

### v2.12.0

- :rocket: Finish persistance script

### v2.11.0

- :rocket: Add persistance script

### v2.10.0

- :rocket: Add KMS Key Alias

### v2.9.1

- :bug: Flip Resource name

### v2.9.0

- :rocket: Remove unused AWS Secret

### v2.8.0

- :rocket: Add RTMP

### v2.7.1

- :bug: Fix bug in password setting

### v2.7.0

- :rocket: Use password from Secret Store

### v2.6.0

- :rocket: Support for proxying HLS Streams

### v2.5.0

- :rocket: Consistent API responses

### v2.4.0

- :rocket: Expose all ports dynamically via PORTS array

### v2.3.0

- :tada: Load Initial Config if one doesn't exist otherwise load from volume

### v2.2.0

- :tada: Add Secret for future API Access

### v2.1.0

- :tada: Add TLS Certificate for API

### v2.0.0

- :rocket: Build out ECS Service
- :tada: **Breaking** Seperate TaskDefinition between `-task` & `-service`

### v1.4.0

- :rocket: Expose API Port
- :tada: Setup EFS for persisant config

### v1.3.0

- :rocket: Deploy behind ELB as ECS Service

### v1.2.0

- :rocket: Cut down config table

### v1.1.0

- :rocket: Add Custom Config File

### v1.0.1

- :rocket: Add releaser

### v1.0.0

- :rocket: Initial Release

