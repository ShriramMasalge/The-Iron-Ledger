import { createConfig, http } from 'wagmi';
import { hardhat, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const projectId = '8e7877fa5bc74c9a2d51e58450a544d7'; // from cloud.walletconnect.com

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
  },
});