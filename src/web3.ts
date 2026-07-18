import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import { Platform } from 'react-native';

export const MONAD_TESTNET = {
  chainId: '0x279f',
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: [process.env.EXPO_PUBLIC_MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: [process.env.EXPO_PUBLIC_MONAD_EXPLORER_URL ?? 'https://testnet.monadexplorer.com'],
};

export const CONTRACT_ADDRESS = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS ?? '';

export const ABI = [
  'function createChallenge(string title,uint64 startsAt,uint64 endsAt,uint16 maxParticipants) payable returns (uint256)',
  'function joinChallenge(uint256 challengeId) payable',
  'function submitProof(uint256 challengeId,string proofUri)',
  'function verifyProof(uint256 challengeId,address participant,bool approved)',
  'function settleChallenge(uint256 challengeId)',
  'function challengeCount() view returns (uint256)',
  'function getChallenge(uint256 challengeId) view returns (address creator,string title,uint96 stake,uint64 startsAt,uint64 endsAt,uint16 maxParticipants,uint16 participantCount,uint8 status)',
  'event ChallengeCreated(uint256 indexed challengeId,address indexed creator,string title,uint256 stake)',
];

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

declare global {
  interface Window { ethereum?: EthereumProvider }
}

function injected(): EthereumProvider {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Open NoCap on web with MetaMask or another EVM wallet installed.');
  }
  return window.ethereum;
}

export async function connectWallet() {
  const ethereum = injected();
  await ethereum.request({ method: 'eth_requestAccounts' });
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: MONAD_TESTNET.chainId }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await ethereum.request({ method: 'wallet_addEthereumChain', params: [MONAD_TESTNET] });
  }
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balance = formatEther(await provider.getBalance(address));
  return { address, balance: Number(balance).toFixed(2) };
}

export async function createOnchainChallenge(input: {
  title: string;
  stake: string;
  durationDays: number;
  maxParticipants: number;
}) {
  if (!CONTRACT_ADDRESS) throw new Error('Contract address is not configured yet.');
  const provider = new BrowserProvider(injected());
  const contract = new Contract(CONTRACT_ADDRESS, ABI, await provider.getSigner());
  // Leave enough room for wallet confirmation and block inclusion.
  const startsAt = Math.floor(Date.now() / 1000) + 60;
  const endsAt = startsAt + input.durationDays * 86_400;
  const createChallenge = contract.getFunction('createChallenge');
  const tx = await createChallenge(input.title, startsAt, endsAt, input.maxParticipants, {
    value: parseEther(input.stake),
  });
  return tx.wait();
}
