'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';

// Chain configurations
const CHAINS = {
  ethereum: { id: 1, name: 'Ethereum', symbol: 'ETH', rpc: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth', 'https://ethereum.publicnode.com'], explorer: 'https://etherscan.io', flashbots: 'https://rpc.flashbots.net' },
  base: { id: 8453, name: 'Base', symbol: 'ETH', rpc: ['https://base.llamarpc.com', 'https://base.publicnode.com', 'https://mainnet.base.org'], explorer: 'https://basescan.org' },
  optimism: { id: 10, name: 'Optimism', symbol: 'ETH', rpc: ['https://optimism.llamarpc.com', 'https://optimism.publicnode.com', 'https://mainnet.optimism.io'], explorer: 'https://optimistic.etherscan.io' },
  megaeth: { id: 6342624, name: 'MegaETH', symbol: 'ETH', rpc: ['https://carrot.megaeth.com/rpc'], explorer: 'https://megaexplorer.xyz' },
  monad: { id: 10143, name: 'Monad Testnet', symbol: 'MON', rpc: ['https://testnet-rpc.monad.xyz'], explorer: 'https://testnet.monadexplorer.com' },
  solana: { id: 'solana', name: 'Solana', symbol: 'SOL', rpc: ['https://api.mainnet-beta.solana.com'], explorer: 'https://solscan.io', nonEvm: true }
};

// Common mint function signatures
const MINT_SIGNATURES = [
  { name: 'mint', sig: '0x1249c58b', params: [] },
  { name: 'mint(uint256)', sig: '0xa0712d68', params: ['quantity'] },
  { name: 'mint(address,uint256)', sig: '0x40c10f19', params: ['to', 'quantity'] },
  { name: 'publicMint', sig: '0x26092b83', params: [] },
  { name: 'publicMint(uint256)', sig: '0xf8e93ef9', params: ['quantity'] },
  { name: 'mintPublic(uint256)', sig: '0xb6a9d3e8', params: ['quantity'] },
  { name: 'claim', sig: '0x4e71d92d', params: [] },
  { name: 'claim(uint256)', sig: '0x379607f5', params: ['quantity'] },
  { name: 'freeMint', sig: '0x5b70ea9f', params: [] },
  { name: 'freeMint(uint256)', sig: '0x2ceff635', params: ['quantity'] },
  { name: 'mintNFT', sig: '0xd85d3d27', params: [] },
  { name: 'mintNFT(uint256)', sig: '0x3051cdd6', params: ['quantity'] },
  { name: 'purchase', sig: '0xefef39a1', params: ['quantity'] },
  { name: 'buy', sig: '0xd96a094a', params: ['quantity'] },
  { name: 'mintSeaDrop', sig: '0x64869dad', params: ['minter', 'quantity'] },
];

export default function Home() {
  // State
  const [chain, setChain] = useState('ethereum');
  const [mainWallet, setMainWallet] = useState(null);
  const [burnerWallets, setBurnerWallets] = useState([]);
  const [contract, setContract] = useState('');
  const [mintFunction, setMintFunction] = useState(null);
  const [detectedFunctions, setDetectedFunctions] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [mintPrice, setMintPrice] = useState('0');
  const [gasMode, setGasMode] = useState('turbo');
  const [scheduledTime, setScheduledTime] = useState('');
  const [mintMode, setMintMode] = useState('instant');
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isMinting, setIsMinting] = useState(false);
  const [fundAmount, setFundAmount] = useState('0.01');

  // Logging
  const log = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-100), { time, msg, type }]);
  }, []);

  // Load wallets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('buzzbot_wallets');
    if (saved) {
      setBurnerWallets(JSON.parse(saved));
      log(`Loaded ${JSON.parse(saved).length} wallets from storage`);
    }
  }, [log]);

  // Save wallets to localStorage
  const saveWallets = (wallets) => {
    localStorage.setItem('buzzbot_wallets', JSON.stringify(wallets));
    setBurnerWallets(wallets);
  };

  // Connect main wallet
  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      log('MetaMask not found!', 'error');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setMainWallet(accounts[0]);
      log(`Connected: ${accounts[0].slice(0, 8)}...${accounts[0].slice(-6)}`);
      
      // Switch to correct chain
      const chainConfig = CHAINS[chain];
      if (!chainConfig.nonEvm) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + chainConfig.id.toString(16) }],
          });
        } catch (e) {
          log(`Switch to ${chainConfig.name} in wallet`, 'warn');
        }
      }
    } catch (e) {
      log('Connection failed: ' + e.message, 'error');
    }
  };

  // Generate burner wallets
  const generateWallets = async (count) => {
    const { ethers } = await import('ethers');
    const newWallets = [];
    for (let i = 0; i < count; i++) {
      const wallet = ethers.Wallet.createRandom();
      newWallets.push({
        address: wallet.address,
        privateKey: wallet.privateKey,
        balance: '0',
        index: burnerWallets.length + i + 1
      });
    }
    const all = [...burnerWallets, ...newWallets];
    saveWallets(all);
    log(`Generated ${count} wallets. Total: ${all.length}`, 'success');
  };

  // Refresh wallet balances
  const refreshBalances = async () => {
    if (burnerWallets.length === 0) return;
    const { ethers } = await import('ethers');
    const chainConfig = CHAINS[chain];
    if (chainConfig.nonEvm) {
      log('Solana balance check not implemented yet', 'warn');
      return;
    }
    
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc[0]);
    log(`Refreshing balances on ${chainConfig.name}...`);
    
    const updated = await Promise.all(burnerWallets.map(async (w) => {
      try {
        const bal = await provider.getBalance(w.address);
        return { ...w, balance: ethers.formatEther(bal) };
      } catch {
        return w;
      }
    }));
    
    saveWallets(updated);
    log('Balances updated', 'success');
  };

  // Distribute funds from main wallet
  const distributeFunds = async () => {
    if (!mainWallet || selectedWallets.length === 0) {
      log('Connect wallet and select recipients', 'error');
      return;
    }
    const { ethers } = await import('ethers');
    const chainConfig = CHAINS[chain];
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const amount = ethers.parseEther(fundAmount);
    log(`Distributing ${fundAmount} ETH to ${selectedWallets.length} wallets...`);
    
    for (const addr of selectedWallets) {
      try {
        const tx = await signer.sendTransaction({ to: addr, value: amount });
        log(`Sent to ${addr.slice(0, 8)}... TX: ${tx.hash.slice(0, 16)}...`);
        await tx.wait();
      } catch (e) {
        log(`Failed ${addr.slice(0, 8)}...: ${e.message}`, 'error');
      }
    }
    log('Distribution complete!', 'success');
    refreshBalances();
  };

  // Detect mint functions from contract
  const detectMintFunctions = async () => {
    if (!contract || contract.length !== 42) {
      log('Enter valid contract address', 'error');
      return;
    }
    const { ethers } = await import('ethers');
    const chainConfig = CHAINS[chain];
    if (chainConfig.nonEvm) {
      log('Solana contract detection not implemented', 'warn');
      return;
    }
    
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc[0]);
    log(`Scanning contract on ${chainConfig.name}...`);
    
    const detected = [];
    const code = await provider.getCode(contract);
    
    if (code === '0x') {
      log('No contract at this address!', 'error');
      return;
    }
    
    for (const fn of MINT_SIGNATURES) {
      if (code.toLowerCase().includes(fn.sig.slice(2).toLowerCase())) {
        detected.push(fn);
      }
    }
    
    // Try to get ABI from Etherscan-like API
    try {
      const apiUrl = chain === 'ethereum' ? 'https://api.etherscan.io' :
                     chain === 'base' ? 'https://api.basescan.org' :
                     chain === 'optimism' ? 'https://api-optimistic.etherscan.io' : null;
      if (apiUrl) {
        const resp = await fetch(`${apiUrl}/api?module=contract&action=getabi&address=${contract}`);
        const data = await resp.json();
        if (data.status === '1') {
          const abi = JSON.parse(data.result);
          const writeFns = abi.filter(f => f.type === 'function' && f.stateMutability === 'payable');
          writeFns.forEach(f => {
            if (f.name.toLowerCase().includes('mint') || f.name.toLowerCase().includes('claim') || f.name.toLowerCase().includes('buy')) {
              const iface = new ethers.Interface([f]);
              const sig = iface.getFunction(f.name).selector;
              if (!detected.find(d => d.sig === sig)) {
                detected.push({ name: `${f.name}(${f.inputs.map(i => i.type).join(',')})`, sig, params: f.inputs.map(i => i.name), abi: f });
              }
            }
          });
        }
      }
    } catch (e) {
      log('Could not fetch ABI, using bytecode detection', 'warn');
    }
    
    setDetectedFunctions(detected);
    if (detected.length > 0) {
      setMintFunction(detected[0]);
      log(`Found ${detected.length} mint functions!`, 'success');
    } else {
      log('No common mint functions found. You can enter custom hex.', 'warn');
    }
  };

  // Build transaction
  const buildMintTx = async (wallet, provider) => {
    const { ethers } = await import('ethers');
    const chainConfig = CHAINS[chain];
    
    let data = mintFunction?.sig || '0x';
    if (mintFunction?.params.includes('quantity')) {
      data += ethers.zeroPadValue(ethers.toBeHex(quantity), 32).slice(2);
    }
    if (mintFunction?.params.includes('to') || mintFunction?.params.includes('minter')) {
      data = mintFunction.sig + ethers.zeroPadValue(wallet.address, 32).slice(2) + ethers.zeroPadValue(ethers.toBeHex(quantity), 32).slice(2);
    }
    
    const gasSettings = {
      slow: { maxPriorityFeePerGas: ethers.parseUnits('0.1', 'gwei') },
      normal: { maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei') },
      fast: { maxPriorityFeePerGas: ethers.parseUnits('3', 'gwei') },
      turbo: { maxPriorityFeePerGas: ethers.parseUnits('10', 'gwei') },
      insane: { maxPriorityFeePerGas: ethers.parseUnits('50', 'gwei') },
    };
    
    const feeData = await provider.getFeeData();
    const tx = {
      to: contract,
      data,
      value: ethers.parseEther(mintPrice),
      maxFeePerGas: feeData.maxFeePerGas * 2n,
      ...gasSettings[gasMode],
      type: 2,
    };
    
    // Estimate gas
    try {
      const gasEstimate = await provider.estimateGas({ ...tx, from: wallet.address });
      tx.gasLimit = gasEstimate * 120n / 100n; // 20% buffer
    } catch (e) {
      tx.gasLimit = 300000n;
      log(`Gas estimate failed, using 300k`, 'warn');
    }
    
    return tx;
  };

  // Execute mint with multi-RPC racing
  const executeMint = async () => {
    if (selectedWallets.length === 0) {
      log('Select wallets to mint with', 'error');
      return;
    }
    if (!contract) {
      log('Enter contract address', 'error');
      return;
    }
    
    const { ethers } = await import('ethers');
    const chainConfig = CHAINS[chain];
    setIsMinting(true);
    log(`🚀 MINTING on ${chainConfig.name} with ${selectedWallets.length} wallets...`, 'success');
    
    // Create providers for all RPCs (for racing)
    const providers = chainConfig.rpc.map(rpc => new ethers.JsonRpcProvider(rpc));
    if (chainConfig.flashbots) {
      providers.push(new ethers.JsonRpcProvider(chainConfig.flashbots));
    }
    
    const mintPromises = selectedWallets.map(async (addr) => {
      const walletData = burnerWallets.find(w => w.address === addr);
      if (!walletData) return;
      
      const wallet = new ethers.Wallet(walletData.privateKey);
      
      // Race all RPCs
      const racePromises = providers.map(async (provider, idx) => {
        try {
          const connectedWallet = wallet.connect(provider);
          const tx = await buildMintTx(walletData, provider);
          const sent = await connectedWallet.sendTransaction(tx);
          return { success: true, hash: sent.hash, rpc: idx };
        } catch (e) {
          throw e;
        }
      });
      
      try {
        const result = await Promise.any(racePromises);
        log(`✅ ${addr.slice(0, 8)}... TX: ${result.hash.slice(0, 20)}...`, 'success');
        return result;
      } catch (e) {
        log(`❌ ${addr.slice(0, 8)}... FAILED: ${e.message || e}`, 'error');
        return { success: false };
      }
    });
    
    const results = await Promise.all(mintPromises);
    const success = results.filter(r => r?.success).length;
    log(`🎯 Minting complete! ${success}/${selectedWallets.length} succeeded`, success > 0 ? 'success' : 'error');
    setIsMinting(false);
    refreshBalances();
  };

  // Schedule mint
  const scheduleMint = () => {
    if (!scheduledTime) {
      log('Set a time first', 'error');
      return;
    }
    const target = new Date(scheduledTime).getTime();
    const now = Date.now();
    const delay = target - now;
    
    if (delay < 0) {
      log('Time is in the past!', 'error');
      return;
    }
    
    log(`⏰ Mint scheduled for ${new Date(target).toLocaleString()}`, 'success');
    log(`Waiting ${Math.round(delay / 1000)}s...`);
    
    setTimeout(() => {
      log('⚡ SCHEDULED MINT EXECUTING!', 'success');
      executeMint();
    }, delay);
  };

  // Select all wallets with balance
  const selectFundedWallets = () => {
    const funded = burnerWallets.filter(w => parseFloat(w.balance) > 0).map(w => w.address);
    setSelectedWallets(funded);
    log(`Selected ${funded.length} funded wallets`);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🐝 BuzzBot</h1>
        <p>Lightning Fast NFT Minting</p>
      </header>

      <div className={styles.main}>
        {/* Chain & Wallet Section */}
        <section className={styles.section}>
          <h2>⛓️ Network & Wallet</h2>
          <div className={styles.row}>
            <select value={chain} onChange={e => setChain(e.target.value)} className={styles.select}>
              {Object.entries(CHAINS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
            {mainWallet ? (
              <div className={styles.connected}>
                ✅ {mainWallet.slice(0, 8)}...{mainWallet.slice(-6)}
              </div>
            ) : (
              <button onClick={connectWallet} className={styles.btn}>Connect Wallet</button>
            )}
          </div>
        </section>

        {/* Burner Wallets */}
        <section className={styles.section}>
          <h2>👛 Burner Wallets ({burnerWallets.length}/100)</h2>
          <div className={styles.row}>
            <button onClick={() => generateWallets(10)} className={styles.btn}>+10 Wallets</button>
            <button onClick={() => generateWallets(50)} className={styles.btn}>+50 Wallets</button>
            <button onClick={refreshBalances} className={styles.btnSecondary}>↻ Refresh</button>
            <button onClick={selectFundedWallets} className={styles.btnSecondary}>Select Funded</button>
          </div>
          <div className={styles.walletList}>
            {burnerWallets.slice(0, 20).map((w, i) => (
              <div 
                key={w.address} 
                className={`${styles.walletItem} ${selectedWallets.includes(w.address) ? styles.selected : ''}`}
                onClick={() => {
                  setSelectedWallets(prev => 
                    prev.includes(w.address) 
                      ? prev.filter(a => a !== w.address)
                      : [...prev, w.address]
                  );
                }}
              >
                <span>#{w.index} {w.address.slice(0, 10)}...</span>
                <span>{parseFloat(w.balance).toFixed(4)} {CHAINS[chain].symbol}</span>
              </div>
            ))}
            {burnerWallets.length > 20 && <div className={styles.more}>+{burnerWallets.length - 20} more wallets</div>}
          </div>
          <div className={styles.row}>
            <input 
              type="text" 
              value={fundAmount} 
              onChange={e => setFundAmount(e.target.value)}
              placeholder="Amount per wallet"
              className={styles.input}
            />
            <button onClick={distributeFunds} className={styles.btn} disabled={!mainWallet}>
              💸 Distribute to Selected ({selectedWallets.length})
            </button>
          </div>
        </section>

        {/* Contract Section */}
        <section className={styles.section}>
          <h2>📜 Contract</h2>
          <div className={styles.row}>
            <input 
              type="text" 
              value={contract} 
              onChange={e => setContract(e.target.value)}
              placeholder="0x... contract address"
              className={styles.inputLarge}
            />
            <button onClick={detectMintFunctions} className={styles.btn}>🔍 Detect</button>
          </div>
          {detectedFunctions.length > 0 && (
            <div className={styles.functions}>
              <label>Mint Function:</label>
              <select 
                value={mintFunction?.sig || ''} 
                onChange={e => setMintFunction(detectedFunctions.find(f => f.sig === e.target.value))}
                className={styles.select}
              >
                {detectedFunctions.map(f => (
                  <option key={f.sig} value={f.sig}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.row}>
            <div>
              <label>Quantity</label>
              <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className={styles.inputSmall} min="1" />
            </div>
            <div>
              <label>Price (ETH)</label>
              <input type="text" value={mintPrice} onChange={e => setMintPrice(e.target.value)} className={styles.inputSmall} />
            </div>
            <div>
              <label>Gas Mode</label>
              <select value={gasMode} onChange={e => setGasMode(e.target.value)} className={styles.select}>
                <option value="slow">🐢 Slow</option>
                <option value="normal">🚗 Normal</option>
                <option value="fast">🏎️ Fast</option>
                <option value="turbo">🚀 Turbo</option>
                <option value="insane">⚡ INSANE</option>
              </select>
            </div>
          </div>
        </section>

        {/* Mint Controls */}
        <section className={styles.section}>
          <h2>🎯 Mint</h2>
          <div className={styles.mintModes}>
            <button 
              className={`${styles.modeBtn} ${mintMode === 'instant' ? styles.active : ''}`}
              onClick={() => setMintMode('instant')}
            >
              ⚡ Instant
            </button>
            <button 
              className={`${styles.modeBtn} ${mintMode === 'scheduled' ? styles.active : ''}`}
              onClick={() => setMintMode('scheduled')}
            >
              ⏰ Scheduled
            </button>
          </div>
          
          {mintMode === 'scheduled' && (
            <div className={styles.row}>
              <input 
                type="datetime-local" 
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                className={styles.input}
              />
            </div>
          )}
          
          <button 
            onClick={mintMode === 'instant' ? executeMint : scheduleMint}
            disabled={isMinting || selectedWallets.length === 0}
            className={styles.mintBtn}
          >
            {isMinting ? '⏳ MINTING...' : mintMode === 'instant' ? '🚀 MINT NOW' : '⏰ SCHEDULE MINT'}
          </button>
        </section>

        {/* Logs */}
        <section className={styles.section}>
          <h2>📋 Activity Log</h2>
          <div className={styles.logs}>
            {logs.slice(-20).reverse().map((l, i) => (
              <div key={i} className={`${styles.log} ${styles[l.type]}`}>
                <span className={styles.time}>{l.time}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
