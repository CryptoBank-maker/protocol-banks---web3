# Protocol Banks Microservices

This directory contains the Go microservices and Protobuf definitions for the Protocol Banks hybrid architecture.

## Architecture

![Architecture](https://via.placeholder.com/800x400?text=Go+Microservices+Architecture)

The system is composed of several microservices orchestrated by the TypeScript frontend/API Gateway.

### Services

- **payout-engine**: Validates and executes batch blockchain payments with high throughput.
- **event-indexer**: Listens to blockchain events (payments) and indexes them for analytics.
- **webhook-handler**: Receives callbacks from external systems and relays them to the platform.

### Structure

```
services/
├── payout-engine/      # Go Payout Service
├── event-indexer/      # Go Indexer Service
├── webhook-handler/    # Go Webhook Service
├── proto/             # gRPC Protobuf Definitions
└── docker-compose.yml # Orchestration
```

## Running the Services

You need Go 1.22+ and Docker installed.

### Development

Start all services:

```bash
docker-compose up -d
```

### Protocol Buffers

If you modify the `.proto` files in `proto/`, you need to regenerate the Go and TypeScript code.

```bash
# Generate Go
protoc --go_out=. --go-grpc_out=. proto/*.proto

# (TypeScript is loaded dynamically at runtime via proto-loader)
```
