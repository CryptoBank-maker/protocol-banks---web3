package nonce

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestManager creates a Manager backed by miniredis for testing.
// It bypasses NewManager (which requires real Redis config + TLS) and
// directly constructs the struct.
func newTestManager(t *testing.T) (*Manager, func()) {
	mr, err := miniredis.Run()
	require.NoError(t, err)

	client := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	m := &Manager{
		redis:       client,
		clients:     make(map[uint64]*ethclient.Client),
		localNonces: make(map[string]uint64),
		lockTTL:     30 * time.Second,
	}

	cleanup := func() {
		client.Close()
		mr.Close()
	}

	return m, cleanup
}

func TestNonceManager_ResetNonce(t *testing.T) {
	nm, cleanup := newTestManager(t)
	defer cleanup()

	ctx := context.Background()
	addr := common.HexToAddress("0x1234567890123456789012345678901234567890")
	chainID := uint64(1)

	// Seed a cached nonce value in Redis
	key := fmt.Sprintf("nonce:%d:%s", chainID, addr.Hex())
	nm.redis.Set(ctx, key, 5, 10*time.Minute)

	// Verify it exists
	val, err := nm.redis.Get(ctx, key).Uint64()
	require.NoError(t, err)
	assert.Equal(t, uint64(5), val)

	// Reset should delete the key
	err = nm.ResetNonce(ctx, chainID, addr)
	require.NoError(t, err)

	// Key should be gone
	_, err = nm.redis.Get(ctx, key).Result()
	assert.ErrorIs(t, err, redis.Nil)
}

func TestNonceManager_IncrementNonce(t *testing.T) {
	nm, cleanup := newTestManager(t)
	defer cleanup()

	ctx := context.Background()
	addr := common.HexToAddress("0x1234567890123456789012345678901234567890")
	chainID := uint64(1)
	key := fmt.Sprintf("nonce:%d:%s", chainID, addr.Hex())

	// Seed initial value
	nm.redis.Set(ctx, key, 0, 10*time.Minute)

	// Increment 3 times
	nm.incrementNonce(ctx, key)
	nm.incrementNonce(ctx, key)
	nm.incrementNonce(ctx, key)

	val, err := nm.redis.Get(ctx, key).Uint64()
	require.NoError(t, err)
	assert.Equal(t, uint64(3), val)
}

func TestNonceManager_AcquireReleaseLock(t *testing.T) {
	nm, cleanup := newTestManager(t)
	defer cleanup()

	ctx := context.Background()
	lockKey := "lock:nonce:1:0x1234"

	// Should acquire successfully
	acquired, err := nm.acquireLock(ctx, lockKey)
	require.NoError(t, err)
	assert.True(t, acquired)

	// Release
	nm.releaseLock(ctx, lockKey)

	// Should be able to acquire again after release
	acquired2, err := nm.acquireLock(ctx, lockKey)
	require.NoError(t, err)
	assert.True(t, acquired2)

	nm.releaseLock(ctx, lockKey)
}

func TestNonceManager_MultipleAddresses(t *testing.T) {
	nm, cleanup := newTestManager(t)
	defer cleanup()

	ctx := context.Background()
	addr1 := common.HexToAddress("0x1111111111111111111111111111111111111111")
	addr2 := common.HexToAddress("0x2222222222222222222222222222222222222222")
	chainID := uint64(1)

	key1 := fmt.Sprintf("nonce:%d:%s", chainID, addr1.Hex())
	key2 := fmt.Sprintf("nonce:%d:%s", chainID, addr2.Hex())

	// Set different nonces
	nm.redis.Set(ctx, key1, 10, 10*time.Minute)
	nm.redis.Set(ctx, key2, 20, 10*time.Minute)

	val1, _ := nm.redis.Get(ctx, key1).Uint64()
	val2, _ := nm.redis.Get(ctx, key2).Uint64()

	assert.Equal(t, uint64(10), val1)
	assert.Equal(t, uint64(20), val2)

	// Increment addr1, addr2 should be unchanged
	nm.incrementNonce(ctx, key1)
	val1, _ = nm.redis.Get(ctx, key1).Uint64()
	val2, _ = nm.redis.Get(ctx, key2).Uint64()

	assert.Equal(t, uint64(11), val1)
	assert.Equal(t, uint64(20), val2)
}

func TestNonceManager_MultipleChains(t *testing.T) {
	nm, cleanup := newTestManager(t)
	defer cleanup()

	ctx := context.Background()
	addr := common.HexToAddress("0x1234567890123456789012345678901234567890")

	keyEth := fmt.Sprintf("nonce:%d:%s", 1, addr.Hex())
	keyPoly := fmt.Sprintf("nonce:%d:%s", 137, addr.Hex())

	// Set different nonces per chain
	nm.redis.Set(ctx, keyEth, 5, 10*time.Minute)
	nm.redis.Set(ctx, keyPoly, 15, 10*time.Minute)

	valEth, _ := nm.redis.Get(ctx, keyEth).Uint64()
	valPoly, _ := nm.redis.Get(ctx, keyPoly).Uint64()

	assert.Equal(t, uint64(5), valEth)
	assert.Equal(t, uint64(15), valPoly)
}

func TestNonceManager_ConcurrentIncrement(t *testing.T) {
	nm, cleanup := newTestManager(t)
	defer cleanup()

	ctx := context.Background()
	key := "nonce:1:0xConcurrent"
	nm.redis.Set(ctx, key, 0, 10*time.Minute)

	numGoroutines := 50
	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			nm.incrementNonce(ctx, key)
		}()
	}

	wg.Wait()

	val, err := nm.redis.Get(ctx, key).Uint64()
	require.NoError(t, err)
	assert.Equal(t, uint64(numGoroutines), val)
}
