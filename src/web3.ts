import { BrowserProvider, Contract, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { Platform } from 'react-native';
import type { Challenge, ReviewPolicy } from './types';

export const MONAD_TESTNET = {
  chainId: '0x279f',
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: [process.env.EXPO_PUBLIC_MONAD_RPC_URL ?? 'https://rpc-testnet.monadinfra.com'],
  blockExplorerUrls: [process.env.EXPO_PUBLIC_MONAD_EXPLORER_URL ?? 'https://testnet.monadvision.com'],
};

export const CONTRACT_ADDRESS = process.env.EXPO_PUBLIC_CONTRACT_ADDRESS ?? '';
export const EXPLORER_URL = MONAD_TESTNET.blockExplorerUrls[0];

export const ABI = [
  'function createChallenge(string title,uint64 startsAt,uint64 endsAt,uint16 maxParticipants,uint8 reviewPolicy) payable returns (uint256)',
  'function joinChallenge(uint256 challengeId) payable',
  'function submitProof(uint256 challengeId,string uri)',
  'function verifyProof(uint256 challengeId,address participant,bool approved)',
  'function settleChallenge(uint256 challengeId)',
  'function claim(uint256 challengeId)',
  'function challengeCount() view returns (uint256)',
  'function getChallenge(uint256 challengeId) view returns ((address creator,string title,uint96 stake,uint64 startsAt,uint64 endsAt,uint16 maxParticipants,uint16 participantCount,uint16 approvedCount,uint8 reviewPolicy,uint8 status))',
  'function getParticipants(uint256 challengeId) view returns (address[])',
  'function hasJoined(uint256 challengeId,address participant) view returns (bool)',
  'function proofUri(uint256 challengeId,address participant) view returns (string)',
  'function proofApproved(uint256 challengeId,address participant) view returns (bool)',
  'function proofResolved(uint256 challengeId,address participant) view returns (bool)',
  'function claimable(uint256 challengeId,address participant) view returns (uint256)',
  'event ChallengeCreated(uint256 indexed challengeId,address indexed creator,string title,uint256 stake)',
];

type EthereumProvider = { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }
let connectedProvider: BrowserProvider | null = null;

function injected(): EthereumProvider {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Open NoCap in a browser with MetaMask or another EVM wallet.');
  }
  return window.ethereum;
}

async function signerContract() {
  if (!CONTRACT_ADDRESS) throw new Error('NoCap contract address is not configured.');
  const provider = new BrowserProvider(injected());
  return new Contract(CONTRACT_ADDRESS, ABI, await provider.getSigner());
}

function readonlyContract() {
  if (!CONTRACT_ADDRESS) throw new Error('NoCap contract address is not configured.');
  const publicRpc = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')
    ? `${window.location.origin}/api/rpc`
    : MONAD_TESTNET.rpcUrls[0];
  const provider = connectedProvider ?? new JsonRpcProvider(
    publicRpc,
    { chainId: Number.parseInt(MONAD_TESTNET.chainId, 16), name: 'monad-testnet' },
    { staticNetwork: true },
  );
  return new Contract(CONTRACT_ADDRESS, ABI, provider);
}

export function disconnectWallet() {
  connectedProvider = null;
}

export async function connectWallet() {
  const ethereum = injected();
  await ethereum.request({ method: 'eth_requestAccounts' });
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: MONAD_TESTNET.chainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await ethereum.request({ method: 'wallet_addEthereumChain', params: [MONAD_TESTNET] });
  }
  const provider = new BrowserProvider(ethereum);
  connectedProvider = provider;
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { address, balance: Number(formatEther(await provider.getBalance(address))).toFixed(2) };
}

export async function loadChallenges(): Promise<Challenge[]> {
  if (!CONTRACT_ADDRESS) return [];
  const contract = readonlyContract();
  const count = Number(await contract.getFunction('challengeCount')());
  const ids = Array.from({ length: Math.min(count, 30) }, (_, index) => count - index);
  return Promise.all(ids.map(async id => {
    const raw = await contract.getFunction('getChallenge')(id);
    const startsAt = Number(raw.startsAt);
    const endsAt = Number(raw.endsAt);
    const durationDays = Math.max(1, Math.ceil((endsAt - startsAt) / 86_400));
    const elapsed = Math.max(0, Math.floor((Date.now() / 1000 - startsAt) / 86_400) + 1);
    return {
      id: String(id), title: raw.title, description: 'A real pact secured on Monad.', emoji: '⚡',
      stake: Number(formatEther(raw.stake)).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''),
      durationDays, participantCount: Number(raw.participantCount), maxParticipants: Number(raw.maxParticipants),
      currentDay: Math.min(durationDays, elapsed), status: Number(raw.status) === 0 ? (Date.now() / 1000 < endsAt ? 'active' : 'verifying') : 'settled',
      creator: raw.creator, category: 'Live', endsAt,
      reviewPolicy: (['host', 'majority', 'unanimous'][Number(raw.reviewPolicy)] ?? 'host') as ReviewPolicy,
    } as Challenge;
  }));
}

export async function loadChallengeMembers(challengeId: string) {
  const contract = readonlyContract();
  const addresses: string[] = await contract.getFunction('getParticipants')(challengeId);
  return Promise.all(addresses.map(async address => ({
    address,
    proof: await contract.getFunction('proofUri')(challengeId, address) as string,
    approved: await contract.getFunction('proofApproved')(challengeId, address) as boolean,
    resolved: await contract.getFunction('proofResolved')(challengeId, address) as boolean,
    claimable: formatEther(await contract.getFunction('claimable')(challengeId, address)),
  })));
}

async function send(method: string, args: unknown[] = [], value?: string) {
  const contract = await signerContract();
  const tx = await contract.getFunction(method)(...args, ...(value ? [{ value: parseEther(value) }] : []));
  return tx.wait();
}

export async function createOnchainChallenge(input: { title: string; stake: string; durationDays: number; maxParticipants: number; reviewPolicy: ReviewPolicy; demo?: boolean }) {
  const startsAt = Math.floor(Date.now() / 1000) + 30;
  const endsAt = startsAt + (input.demo ? 180 : input.durationDays * 86_400);
  const policy = { host: 0, majority: 1, unanimous: 2 }[input.reviewPolicy];
  return send('createChallenge', [input.title, startsAt, endsAt, input.maxParticipants, policy], input.stake);
}
export const joinOnchainChallenge = (id: string, stake: string) => send('joinChallenge', [id], stake);
export const submitOnchainProof = (id: string, proof: string) => send('submitProof', [id, proof]);
export const verifyOnchainProof = (id: string, participant: string, approved: boolean) => send('verifyProof', [id, participant, approved]);
export const settleOnchainChallenge = (id: string) => send('settleChallenge', [id]);
export const claimOnchainPayout = (id: string) => send('claim', [id]);
