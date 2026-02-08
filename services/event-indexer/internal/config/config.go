package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Environment string
	GRPCPort    int

	// Database
	Database DatabaseConfig

	// Redis
	Redis RedisConfig

	// Chains to watch
	Chains map[uint64]ChainConfig

	// Watched addresses (comma-separated in env)
	WatchedAddresses []string
}

type DatabaseConfig struct {
	URL string
}

type RedisConfig struct {
	URL        string
	Password   string
	DB         int
	TLSEnabled bool
}

type ChainConfig struct {
	ChainID       uint64
	Name          string
	RPCURL        string
	WSURL         string // WebSocket URL for subscriptions (EVM only)
	ExplorerURL   string
	StartBlock    uint64
	Confirmations uint64
	Type          string // "evm" or "tron"
}

func Load() (*Config, error) {
	port, _ := strconv.Atoi(getEnv("GRPC_PORT", "50052"))
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	// Parse watched addresses
	watchedAddrs := []string{}
	if addrs := getEnv("WATCHED_ADDRESSES", ""); addrs != "" {
		watchedAddrs = strings.Split(addrs, ",")
	}

	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		GRPCPort:    port,
		Database: DatabaseConfig{
			URL: getEnv("DATABASE_URL", ""),
		},
		Redis: RedisConfig{
			URL:        getEnv("REDIS_URL", "localhost:6379"),
			Password:   getEnv("REDIS_PASSWORD", ""),
			DB:         redisDB,
			TLSEnabled: getEnv("REDIS_TLS_ENABLED", "false") == "true",
		},
		WatchedAddresses: watchedAddrs,
		Chains: map[uint64]ChainConfig{
			// ——— EVM Chains ———
			1: {
				ChainID:       1,
				Name:          "Ethereum",
				RPCURL:        getEnv("ETH_RPC_URL", "https://eth.llamarpc.com"),
				WSURL:         getEnv("ETH_WS_URL", "wss://eth.llamarpc.com"),
				ExplorerURL:   "https://etherscan.io",
				StartBlock:    0, // 0 = latest
				Confirmations: 12,
				Type:          "evm",
			},
			137: {
				ChainID:       137,
				Name:          "Polygon",
				RPCURL:        getEnv("POLYGON_RPC_URL", "https://polygon-rpc.com"),
				WSURL:         getEnv("POLYGON_WS_URL", "wss://polygon-rpc.com"),
				ExplorerURL:   "https://polygonscan.com",
				StartBlock:    0,
				Confirmations: 128,
				Type:          "evm",
			},
			8453: {
				ChainID:       8453,
				Name:          "Base",
				RPCURL:        getEnv("BASE_RPC_URL", "https://mainnet.base.org"),
				WSURL:         getEnv("BASE_WS_URL", "wss://mainnet.base.org"),
				ExplorerURL:   "https://basescan.org",
				StartBlock:    0,
				Confirmations: 12,
				Type:          "evm",
			},
			42161: {
				ChainID:       42161,
				Name:          "Arbitrum",
				RPCURL:        getEnv("ARBITRUM_RPC_URL", "https://arb1.arbitrum.io/rpc"),
				WSURL:         getEnv("ARBITRUM_WS_URL", "wss://arb1.arbitrum.io/rpc"),
				ExplorerURL:   "https://arbiscan.io",
				StartBlock:    0,
				Confirmations: 12,
				Type:          "evm",
			},
			// ——— TRON Chains ———
			728126428: {
				ChainID:       728126428,
				Name:          "TRON Mainnet",
				RPCURL:        getEnv("TRON_RPC_URL", "grpc.trongrid.io:50051"),
				ExplorerURL:   "https://tronscan.org",
				StartBlock:    0,
				Confirmations: 19, // ~57 seconds (3s blocks)
				Type:          "tron",
			},
			3448148188: {
				ChainID:       3448148188,
				Name:          "TRON Nile Testnet",
				RPCURL:        getEnv("TRON_TESTNET_RPC_URL", "grpc.nile.trongrid.io:50051"),
				ExplorerURL:   "https://nile.tronscan.org",
				StartBlock:    0,
				Confirmations: 19,
				Type:          "tron",
			},
		},
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
