/**
 * Derive Tron private key from mnemonic
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { TronWeb } = require('tronweb');

async function main() {
    const mnemonic = process.env.DEPLOYER_MNEMONIC;
    
    if (!mnemonic) {
        console.error('❌ DEPLOYER_MNEMONIC not found in .env');
        process.exit(1);
    }

    console.log('🔐 Deriving Tron account from mnemonic...\n');

    try {
        // TronWeb can create account from mnemonic
        const account = TronWeb.fromMnemonic(mnemonic);
        
        console.log('✅ Account derived successfully:');
        console.log(`📍 Address: ${account.address}`);
        console.log(`🔑 Private Key: ${account.privateKey}`);
        
        // Output for .env
        console.log('\n📋 Add this to your .env file:');
        console.log(`DEPLOYER_PRIVATE_KEY=${account.privateKey.replace('0x', '')}`);
        
        return account.privateKey.replace('0x', '');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
