package watcher

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"strings"
	"sync"
	"time"

	tronclient "github.com/fbsobreira/gotron-sdk/pkg/client"
	"github.com/protocol-bank/event-indexer/internal/config"
	"github.com/rs/zerolog/log"
)

// TRC20 Transfer event signature (keccak256 of "Transfer(address,address,uint256)")
const trc20TransferSig = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// TronWatcher monitors TRC20 Transfer events on the TRON network
// using gotron-sdk's gRPC client with block polling.
type TronWatcher struct {
	chainID   uint64
	chainName string
	client    *tronclient.GrpcClient
	cfg       config.ChainConfig
	addresses map[string]bool // TRON Base58 addresses
	handlers  []EventHandler
	mu        sync.RWMutex
}

// NewTronWatcher creates a new TRON block watcher
func NewTronWatcher(ctx context.Context, cfg config.ChainConfig) (*TronWatcher, error) {
	client := tronclient.NewGrpcClient(cfg.RPCURL)
	if err := client.Start(); err != nil {
		return nil, err
	}

	log.Info().
		Uint64("chain_id", cfg.ChainID).
		Str("name", cfg.Name).
		Str("rpc", cfg.RPCURL).
		Msg("TRON watcher connected")

	return &TronWatcher{
		chainID:   cfg.ChainID,
		chainName: cfg.Name,
		client:    client,
		cfg:       cfg,
		addresses: make(map[string]bool),
		handlers:  []EventHandler{},
	}, nil
}

// AddTronAddress adds a TRON Base58 address to the watch list
func (w *TronWatcher) AddTronAddress(addr string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.addresses[addr] = true
	log.Info().Str("address", addr).Str("chain", w.chainName).Msg("TRON address added to watch list")
}

// RemoveTronAddress removes a TRON address from the watch list
func (w *TronWatcher) RemoveTronAddress(addr string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.addresses, addr)
}

// Start begins polling TRON blocks for TRC20 Transfer events.
// TRON doesn't support WebSocket subscriptions like EVM, so we poll every 3 seconds.
func (w *TronWatcher) Start(ctx context.Context) {
	log.Info().Str("chain", w.chainName).Msg("Starting TRON block watcher")

	ticker := time.NewTicker(3 * time.Second) // TRON block time is ~3 seconds
	defer ticker.Stop()

	var lastBlock int64

	for {
		select {
		case <-ctx.Done():
			log.Info().Str("chain", w.chainName).Msg("TRON watcher stopped")
			return
		case <-ticker.C:
			w.mu.RLock()
			addrCount := len(w.addresses)
			w.mu.RUnlock()

			if addrCount == 0 {
				continue
			}

			// Get latest block
			block, err := w.client.GetNowBlock()
			if err != nil {
				log.Error().Err(err).Str("chain", w.chainName).Msg("Failed to get TRON block")
				continue
			}

			if block == nil || block.GetBlockHeader() == nil {
				continue
			}

			currentBlock := block.GetBlockHeader().GetRawData().GetNumber()
			if lastBlock == 0 {
				lastBlock = currentBlock
				continue
			}

			// Process new blocks
			for blockNum := lastBlock + 1; blockNum <= currentBlock; blockNum++ {
				w.processBlock(ctx, blockNum, currentBlock)
			}
			lastBlock = currentBlock
		}
	}
}

// processBlock fetches a TRON block and scans its transactions for TRC20 transfers
func (w *TronWatcher) processBlock(ctx context.Context, blockNum int64, currentBlock int64) {
	block, err := w.client.GetBlockByNum(blockNum)
	if err != nil {
		log.Error().Err(err).Int64("block", blockNum).Str("chain", w.chainName).Msg("Failed to get TRON block")
		return
	}

	if block == nil {
		return
	}

	for _, tx := range block.GetTransactions() {
		if tx == nil || tx.GetTransaction() == nil {
			continue
		}

		txID := hex.EncodeToString(tx.GetTxid())

		// Get transaction info for TRC20 event logs
		txInfo, err := w.client.GetTransactionInfoByID(txID)
		if err != nil {
			continue
		}
		if txInfo == nil {
			continue
		}

		// Scan logs for TRC20 Transfer events
		for _, eventLog := range txInfo.GetLog() {
			if eventLog == nil || len(eventLog.GetTopics()) < 3 {
				continue
			}

			// Check Transfer event signature
			topicSig := hex.EncodeToString(eventLog.GetTopics()[0])
			if topicSig != trc20TransferSig {
				continue
			}

			// Parse from/to addresses (32-byte topic → TRON Base58)
			fromAddr := hexTopicToTronAddress(eventLog.GetTopics()[1])
			toAddr := hexTopicToTronAddress(eventLog.GetTopics()[2])

			// Check if either address is watched
			w.mu.RLock()
			isRelevant := w.addresses[fromAddr] || w.addresses[toAddr]
			w.mu.RUnlock()

			if !isRelevant {
				continue
			}

			// Parse value from data
			value := new(big.Int).SetBytes(eventLog.GetData())

			// Token contract address (hex → Base58)
			tokenAddr := hexBytesToTronAddress(eventLog.GetAddress())

			// Calculate confirmations
			confirmations := currentBlock - blockNum
			confirmed := uint64(confirmations) >= w.cfg.Confirmations

			event := &ChainEvent{
				ChainID:      w.chainID,
				ChainName:    w.chainName,
				EventType:    "trc20_transfer",
				TxHash:       txID,
				BlockNumber:  uint64(blockNum),
				FromAddress:  fromAddr,
				ToAddress:    toAddr,
				Value:        value.String(),
				TokenAddress: tokenAddr,
				Timestamp:    time.Unix(block.GetBlockHeader().GetRawData().GetTimestamp()/1000, 0),
				Confirmed:    confirmed,
			}

			log.Info().
				Str("chain", w.chainName).
				Str("tx", txID).
				Str("from", fromAddr).
				Str("to", toAddr).
				Str("value", value.String()).
				Bool("confirmed", confirmed).
				Msg("TRC20 Transfer event detected")

			for _, handler := range w.handlers {
				go handler(event)
			}
		}
	}
}

// hexTopicToTronAddress converts a 32-byte event topic to a TRON Base58Check address.
// Topics contain the 20-byte address left-padded to 32 bytes.
func hexTopicToTronAddress(topic []byte) string {
	if len(topic) < 20 {
		return ""
	}
	// Extract last 20 bytes
	addrBytes := topic[len(topic)-20:]
	return rawBytesToTronAddress(addrBytes)
}

// hexBytesToTronAddress converts raw address bytes to TRON Base58Check
func hexBytesToTronAddress(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	// If already 21 bytes with 0x41 prefix, use directly
	if len(raw) == 21 && raw[0] == 0x41 {
		return base58CheckEncode(raw)
	}
	// Otherwise treat as 20-byte address
	if len(raw) >= 20 {
		return rawBytesToTronAddress(raw[len(raw)-20:])
	}
	return ""
}

// rawBytesToTronAddress prepends TRON mainnet prefix (0x41) and encodes to Base58Check
func rawBytesToTronAddress(addrBytes []byte) string {
	fullAddr := make([]byte, 21)
	fullAddr[0] = 0x41 // TRON mainnet prefix
	copy(fullAddr[1:], addrBytes)
	return base58CheckEncode(fullAddr)
}

// base58CheckEncode encodes bytes to TRON Base58Check format (data + 4-byte checksum)
func base58CheckEncode(input []byte) string {
	checksum := doubleSHA256(input)[:4]
	payload := append(input, checksum...)
	return base58Encode(payload)
}

// doubleSHA256 computes SHA256(SHA256(data))
func doubleSHA256(data []byte) []byte {
	first := sha256.Sum256(data)
	second := sha256.Sum256(first[:])
	return second[:]
}

// base58Encode encodes bytes using the Base58 alphabet (Bitcoin/TRON style)
func base58Encode(input []byte) string {
	const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

	result := make([]byte, 0, len(input)*2)
	x := new(big.Int).SetBytes(input)
	base := big.NewInt(58)
	zero := big.NewInt(0)
	mod := new(big.Int)

	for x.Cmp(zero) > 0 {
		x.DivMod(x, base, mod)
		result = append(result, alphabet[mod.Int64()])
	}

	// Add leading '1's for each leading zero byte
	for _, b := range input {
		if b != 0 {
			break
		}
		result = append(result, alphabet[0])
	}

	// Reverse
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return string(result)
}

// isTronChain checks if a chain config is for TRON
func isTronChain(cfg config.ChainConfig) bool {
	return cfg.Type == "tron" || strings.HasPrefix(strings.ToLower(cfg.Name), "tron")
}
