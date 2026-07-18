import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { colors, radius } from './src/theme';
import {
  CONTRACT_ADDRESS,
  EXPLORER_URL,
  claimOnchainPayout,
  connectWallet,
  createOnchainChallenge,
  disconnectWallet,
  joinOnchainChallenge,
  loadChallengeMembers,
  loadChallenges,
  settleOnchainChallenge,
  submitOnchainProof,
  verifyOnchainProof,
} from './src/web3';
import type { Challenge } from './src/types';

type Screen = 'home' | 'create' | 'detail' | 'proof';

const FEATURED: Challenge = {
  id: '1', title: '7-Day Lock In', description: 'One focused hour. Every day. No excuses.', emoji: '⚡',
  stake: '0.10', durationDays: 7, participantCount: 18, maxParticipants: 24, currentDay: 4,
  status: 'active', creator: '0x71A4…2F90', category: 'Build',
};

const CHALLENGES: Challenge[] = [
  FEATURED,
  { id: '2', title: 'Academic Comeback', description: 'Study 45 minutes daily.', emoji: '📚', stake: '0.05', durationDays: 5, participantCount: 31, maxParticipants: 40, currentDay: 2, status: 'active', creator: '0x12B…809', category: 'Study' },
  { id: '3', title: 'Post or Perish', description: 'Ship one piece of content a day.', emoji: '🎬', stake: '0.08', durationDays: 7, participantCount: 9, maxParticipants: 12, currentDay: 0, status: 'open', creator: '0x89C…114', category: 'Create' },
];

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

function Logo() {
  return <View style={styles.logoRow}><View style={styles.logoMark}><Text style={styles.logoBang}>!</Text></View><Text style={styles.logo}>nocap</Text></View>;
}

function AppContent() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selected, setSelected] = useState(FEATURED);
  const [wallet, setWallet] = useState<{ address: string; balance: string } | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', stake: '0.05', duration: '7', max: '12' });
  const [busy, setBusy] = useState(false);
  const [liveChallenges, setLiveChallenges] = useState<Challenge[]>([]);
  const handledSharedPact = useRef(false);
  const { width } = useWindowDimensions();
  const desktop = width >= 760;

  const shortAddress = useMemo(() => wallet ? `${wallet.address.slice(0, 5)}…${wallet.address.slice(-4)}` : '', [wallet]);

  const refresh = async () => {
    try {
      const next = await loadChallenges();
      setLiveChallenges(next);
      if (!handledSharedPact.current && Platform.OS === 'web' && typeof window !== 'undefined') {
        const sharedId = new URLSearchParams(window.location.search).get('pact');
        const sharedPact = next.find(item => item.id === sharedId);
        if (sharedPact) { handledSharedPact.current = true; setSelected(sharedPact); setScreen('detail'); }
      }
      if (next.length && selected.id !== '1') setSelected(current => next.find(item => item.id === current.id) ?? current);
    } catch (error) { console.warn('Could not refresh contract state', error); }
  };
  useEffect(() => { refresh(); const timer = setInterval(refresh, 8_000); return () => clearInterval(timer); }, []);

  const go = (next: Screen) => { tap(); setScreen(next); };
  const selectChallenge = (item: Challenge) => { setSelected(item); go('detail'); };

  const handleConnect = async () => {
    setBusy(true);
    try { const nextWallet = await connectWallet(); setWallet(nextWallet); await refresh(); }
    catch (error) { Alert.alert('Could not connect', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const handleWalletPress = async () => {
    if (!wallet) return handleConnect();
    disconnectWallet();
    setWallet(null);
    setScreen('home');
    await refresh();
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return Alert.alert('Name your challenge', 'Give the squad something to rally around.');
    setBusy(true);
    try {
      const receipt = await createOnchainChallenge({ title: form.title.trim(), stake: form.stake, durationDays: Math.max(1, Number(form.duration)), maxParticipants: Number(form.max), demo: Number(form.duration) === 0 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Challenge is live', `Confirmed in block ${receipt?.blockNumber ?? '—'}.`);
      setScreen('home');
    } catch (error) { Alert.alert('Challenge not created', error instanceof Error ? error.message : 'Transaction failed.'); }
    finally { setBusy(false); }
  };

  const pickProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access needed', 'Choose a photo that proves you showed up today.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.8 });
    if (!result.canceled) { setProof(result.assets[0]?.uri ?? null); tap(); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={[styles.shell, desktop && styles.desktopShell]}>
        <View style={styles.header}>
          <Pressable onPress={() => go('home')}><Logo /></Pressable>
          <Pressable style={[styles.wallet, wallet && styles.walletConnected]} onPress={handleWalletPress} disabled={busy} accessibilityLabel={wallet ? 'Disconnect wallet' : 'Connect wallet'}>
            <View style={[styles.walletDot, wallet && styles.walletDotLive]} />
            <Text style={styles.walletText}>{wallet ? shortAddress : busy ? 'Connecting…' : 'Connect wallet'}</Text>
            {wallet && <Ionicons name="log-out-outline" size={14} color={colors.muted} />}
          </Pressable>
        </View>

        {screen === 'home' && <Home wallet={wallet} challenges={liveChallenges} onCreate={() => go('create')} onConnect={handleConnect} onSelect={selectChallenge} />}
        {screen === 'create' && <Create form={form} setForm={setForm} onBack={() => go('home')} onSubmit={handleCreate} busy={busy} wallet={wallet} onConnect={handleConnect} />}
        {screen === 'detail' && <Detail challenge={selected} wallet={wallet} busy={busy} setBusy={setBusy} refresh={refresh} onBack={() => go('home')} onProof={() => go('proof')} />}
        {screen === 'proof' && <Proof challenge={selected} proof={proof} wallet={wallet} busy={busy} setBusy={setBusy} onPick={pickProof} onBack={() => go('detail')} />}
      </View>
    </SafeAreaView>
  );
}

function Home({ wallet, challenges, onCreate, onConnect, onSelect }: { wallet: { address: string; balance: string } | null; challenges: Challenge[]; onCreate(): void; onConnect(): void; onSelect(item: Challenge): void }) {
  const featured = challenges[0];
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
    <View style={styles.dashboardIntro}>
      <Text style={styles.eyebrow}>{wallet ? 'YOUR PACT DESK' : 'ACCOUNTABILITY, WITH RECEIPTS'}</Text>
      <Text style={styles.dashboardTitle}>{wallet ? 'Commitments worth keeping.' : 'Make the promise.\nProve the work.'}</Text>
      <Text style={styles.dashboardCopy}>{wallet ? 'Every pact below is live on Monad—not a private score someone can edit.' : 'NoCap gives your group goals a deadline, equal commitment, and a settlement everyone can verify.'}</Text>
      <Pressable style={styles.createPactButton} onPress={onCreate}>
        <View style={styles.createPactIcon}><FontAwesome5 name="handshake" size={18} color={colors.acid} /></View>
        <Text style={styles.createPactText}>Start a new pact</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.ink} />
      </Pressable>
    </View>

    {!wallet && <View style={styles.manifestoCard}>
      <View style={styles.manifestoTop}><Text style={styles.manifestoLabel}>HOW IT WORKS</Text><Text style={styles.manifestoNumber}>01—03</Text></View>
      {[
        { key:'commit', title:'Commit', copy:'Set the outcome, deadline, and equal commitment.', button:'Create a pact', stepIcon:'handshake' as const, icon:'handshake' as const, action:onCreate },
        { key:'proof', title:'Show up', copy:'Connect your wallet and submit an honest receipt of the work.', button:'Connect wallet', stepIcon:'camera' as const, icon:'wallet-outline' as const, action:onConnect },
        { key:'settle', title:'Settle', copy:'Finishers reclaim their commitment through the verified contract.', button:'View contract', stepIcon:'check-circle' as const, icon:'open-outline' as const, action:() => Linking.openURL(`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`) },
      ].map(item => <View key={item.key} style={styles.manifestoRow}><View style={styles.manifestoStep}><FontAwesome5 name={item.stepIcon} size={15} color={colors.acid} /></View><View style={styles.manifestoCopy}><Text style={styles.manifestoTitle}>{item.title}</Text><Text style={styles.manifestoText}>{item.copy}</Text><Pressable style={styles.manifestoAction} onPress={item.action}><Text style={styles.manifestoActionText}>{item.button}</Text>{item.icon === 'handshake' ? <FontAwesome5 name="handshake" size={13} color={colors.acid} /> : <Ionicons name={item.icon} size={14} color={colors.acid} />}</Pressable></View></View>)}
      <Text style={styles.manifestoFoot}>Every action is visible and verifiable on Monad Testnet.</Text>
    </View>}

    {wallet && !featured && <View style={styles.emptyPacts}>
      <View style={styles.emptyStamp}><Text style={styles.emptyStampText}>NO OPEN PACTS</Text></View>
      <Text style={styles.emptyTitle}>The ledger is clean.</Text>
      <Text style={styles.emptyText}>Start with one outcome your squad can finish and verify today.</Text>
      <Pressable style={styles.outlineButton} onPress={onCreate}><Text style={styles.outlineButtonText}>Create the first pact</Text><Ionicons name="arrow-forward" size={17} color={colors.acid} /></Pressable>
    </View>}

    {featured && <>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Live now</Text><Text style={styles.sectionMeta}>{challenges.length} ON-CHAIN</Text></View>
      <Pressable onPress={() => onSelect(featured)} style={styles.livePact}>
        <View style={styles.livePactHead}><View style={styles.liveIndicator}><View style={styles.liveDot} /><Text style={styles.liveIndicatorText}>{featured.status.toUpperCase()}</Text></View><Text style={styles.liveId}>PACT #{featured.id}</Text></View>
        <Text style={styles.livePactTitle}>{featured.title}</Text>
        <View style={styles.livePactRule} />
        <View style={styles.livePactMeta}><View><Text style={styles.metaLabel}>COMMITMENT</Text><Text style={styles.metaValue}>{featured.stake} MON</Text></View><View><Text style={styles.metaLabel}>SQUAD</Text><Text style={styles.metaValue}>{featured.participantCount}/{featured.maxParticipants}</Text></View><View><Text style={styles.metaLabel}>RUN</Text><Text style={styles.metaValue}>{featured.currentDay}/{featured.durationDays} days</Text></View><Ionicons name="arrow-forward-circle" size={31} color={colors.acid} /></View>
      </Pressable>
      {challenges.slice(1).map(item => <ChallengeCard key={item.id} item={item} onPress={() => onSelect(item)} />)}
    </>}

    <View style={styles.balanceBar}><View><Text style={styles.balanceLabel}>CONNECTED BALANCE</Text><Text style={styles.balanceValue}>{wallet ? wallet.balance : '—'} <Text style={styles.balanceUnit}>MON</Text></Text></View><View style={styles.networkPill}><View style={styles.walletDotLive} /><Text style={styles.networkText}>Monad Testnet</Text></View></View>
  </ScrollView>;
}

function ChallengeCard({ item, onPress }: { item: Challenge; onPress(): void }) {
  return <Pressable style={styles.card} onPress={onPress}><View style={styles.cardEmoji}><FontAwesome5 name="handshake" size={20} color={colors.acid} /></View><View style={styles.cardCopy}><View style={styles.cardTitleRow}><Text style={styles.cardTitle}>{item.title}</Text><View style={styles.miniStake}><Text style={styles.miniStakeText}>{item.stake} MON</Text></View></View><Text style={styles.cardDesc}>{item.description}</Text><Text style={styles.cardMeta}>{item.participantCount}/{item.maxParticipants} people · {item.durationDays} days</Text></View></Pressable>;
}

function Create({ form, setForm, onBack, onSubmit, busy, wallet, onConnect }: { form: Record<string, string>; setForm(value: any): void; onBack(): void; onSubmit(): void; busy: boolean; wallet: unknown; onConnect(): void }) {
  const update = (key: string, value: string) => setForm((old: Record<string, string>) => ({ ...old, [key]: value }));
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><Back onPress={onBack} /><Text style={styles.pageKicker}>NEW PACT</Text><Text style={styles.pageTitle}>Define one clear{`\n`}outcome.</Text><Text style={styles.formIntro}>Set the terms once. Your squad joins, submits proof, and settles the result on Monad.</Text>
    <Label text="PACT NAME" /><TextInput value={form.title} onChangeText={v => update('title', v)} placeholder="e.g. Ship every day for a week" placeholderTextColor={colors.muted} style={styles.input} maxLength={48} />
    <Label text="SUCCESS CRITERIA" /><TextInput value={form.description} onChangeText={v => update('description', v)} placeholder="Describe exactly what counts as showing up." placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} multiline maxLength={160} />
    <View style={styles.formRow}><View style={styles.formHalf}><Label text="DURATION (DAYS)" /><TextInput value={form.duration} onChangeText={v => update('duration', v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input} /></View><View style={styles.formHalf}><Label text="SQUAD LIMIT" /><TextInput value={form.max} onChangeText={v => update('max', v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input} /></View></View><Text style={styles.demoHelper}>For a live demo, enter 0 to use a three-minute settlement window.</Text>
    <Label text="REFUNDABLE COMMITMENT" /><View style={styles.stakeInput}><TextInput value={form.stake} onChangeText={v => update('stake', v)} keyboardType="decimal-pad" style={styles.stakeText} /><Text style={styles.stakeUnit}>MON</Text></View><Text style={styles.helper}>Finish the pact and your commitment comes back. NoCap never holds it.</Text>
    <Pressable style={styles.faucetLink} onPress={() => Linking.openURL('https://faucet.monad.xyz/')}><Ionicons name="water" size={17} color={colors.acid} /><View><Text style={styles.faucetTitle}>New to Web3? Get free test MON</Text><Text style={styles.faucetSub}>Opens Monad’s official Testnet faucet · test tokens have no cash value</Text></View><Ionicons name="open-outline" size={16} color={colors.muted} /></Pressable>
    <Pressable style={styles.primary} onPress={wallet ? onSubmit : onConnect} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Publishing pact…' : wallet ? 'Publish pact on Monad' : 'Connect wallet to publish'}</Text><Ionicons name={wallet ? 'arrow-forward' : 'wallet-outline'} size={20} color={colors.ink} /></Pressable>
  </ScrollView>;
}

function Detail({ challenge, wallet, busy, setBusy, refresh, onBack, onProof }: { challenge: Challenge; wallet: { address: string; balance: string } | null; busy: boolean; setBusy(value: boolean): void; refresh(): Promise<void>; onBack(): void; onProof(): void }) {
  const [members, setMembers] = useState<Array<{ address: string; proof: string; approved: boolean; claimable: string }>>([]);
  const reloadMembers = async () => { if (CONTRACT_ADDRESS && !Number.isNaN(Number(challenge.id))) setMembers(await loadChallengeMembers(challenge.id)); };
  useEffect(() => { reloadMembers().catch(console.warn); }, [challenge.id, wallet?.address]);
  const mine = members.find(item => item.address.toLowerCase() === wallet?.address.toLowerCase());
  const isCreator = wallet?.address.toLowerCase() === challenge.creator.toLowerCase();
  const sharePact = async () => {
    const url = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?pact=${challenge.id}` : `https://nocap-nine.vercel.app/?pact=${challenge.id}`;
    const message = `Join my NoCap pact: ${challenge.title}\n${url}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: challenge.title, text: message, url });
      else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(url); Alert.alert('Pact link copied', 'Share it with the people you want in your squad.'); }
      else await Share.share({ title: challenge.title, message, url });
    } catch (error) { if ((error as Error).name !== 'AbortError') Alert.alert('Could not share', 'Copy the pact URL from your browser and try again.'); }
  };
  const transact = async (label: string, action: () => Promise<unknown>) => {
    if (!wallet) return Alert.alert('Connect wallet', 'Connect the wallet you want to use for this pact.');
    setBusy(true);
    try { await action(); await refresh(); await reloadMembers(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); Alert.alert('Confirmed on Monad', label); }
    catch (error) { Alert.alert('Transaction failed', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  const progress = Math.max(8, challenge.currentDay / challenge.durationDays * 100);
  return <ScrollView contentContainerStyle={styles.scroll}><Back onPress={onBack} /><View style={styles.detailHero}><View style={styles.detailPactIcon}><FontAwesome5 name="handshake" size={23} color={colors.acid} /></View><View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>{challenge.status.toUpperCase()}</Text></View><Text style={styles.detailTitle}>{challenge.title}</Text><Text style={styles.detailDesc}>{challenge.description}</Text></View>
    {isCreator && <Pressable style={styles.sharePactButton} onPress={sharePact}><Ionicons name="share-social-outline" size={17} color={colors.acid} /><View style={styles.sharePactCopy}><Text style={styles.sharePactTitle}>Share this pact</Text><Text style={styles.sharePactText}>Invite your squad with a direct link.</Text></View><Ionicons name="copy-outline" size={16} color={colors.muted} /></Pressable>}
    <View style={styles.progressHeader}><Text style={styles.progressLabel}>YOUR RUN</Text><Text style={styles.progressDay}>Day {challenge.currentDay}/{challenge.durationDays}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
    <View style={styles.commitment}><Text style={styles.commitmentLabel}>YOUR COMMITMENT</Text><Text style={styles.commitmentValue}>{challenge.stake} <Text style={styles.commitmentUnit}>MON</Text></Text><Text style={styles.commitmentNote}>Locked by the pact · returned when you finish</Text></View>
    <Text style={styles.sectionTitle}>The squad</Text>
    {members.length ? members.map(member => <View key={member.address} style={styles.memberRow}><View><Text style={styles.memberAddress}>{member.address.slice(0, 6)}…{member.address.slice(-4)} {member.address.toLowerCase() === challenge.creator.toLowerCase() ? '· HOST' : ''}</Text><Text style={styles.memberProof}>{member.proof ? member.approved ? '✓ Proof approved' : 'Proof awaiting review' : 'No proof yet'}</Text></View>{isCreator && member.proof && !member.approved && <Pressable style={styles.approveButton} onPress={() => transact('Proof approved.', () => verifyOnchainProof(challenge.id, member.address, true))}><Text style={styles.approveText}>Approve</Text></Pressable>}</View>) : <View style={styles.squadRow}>{['T', 'A', 'K', 'M'].map((name, index) => <View key={name} style={[styles.avatar, { marginLeft: index ? -10 : 0 }]}><Text style={styles.avatarText}>{name}</Text></View>)}</View>}
    {!mine && <Pressable style={styles.primary} disabled={busy} onPress={() => transact('You are locked in.', () => joinOnchainChallenge(challenge.id, challenge.stake))}><Text style={styles.primaryText}>{busy ? 'Confirming…' : `Join with ${challenge.stake} MON`}</Text><Ionicons name="lock-closed" size={20} color={colors.ink} /></Pressable>}
    {mine && challenge.status !== 'settled' && <Pressable style={styles.primary} onPress={onProof}><Text style={styles.primaryText}>{mine.proof ? 'Update today’s proof' : 'Drop today’s proof'}</Text><Ionicons name="camera" size={20} color={colors.ink} /></Pressable>}
    {challenge.status === 'verifying' && <Pressable style={styles.secondaryAction} disabled={busy} onPress={() => transact('Payouts calculated.', () => settleOnchainChallenge(challenge.id))}><Text style={styles.secondaryActionText}>Settle this pact</Text></Pressable>}
    {mine && Number(mine.claimable) > 0 && <Pressable style={styles.primary} disabled={busy} onPress={() => transact('Your payout was claimed.', () => claimOnchainPayout(challenge.id))}><Text style={styles.primaryText}>Claim {Number(mine.claimable).toFixed(3)} MON</Text><Ionicons name="wallet" size={20} color={colors.ink} /></Pressable>}
    <Text style={styles.onchainNote}>Challenge #{challenge.id} · Verified on Monad</Text>
  </ScrollView>;
}

function Proof({ challenge, proof, wallet, busy, setBusy, onPick, onBack }: { challenge: Challenge; proof: string | null; wallet: { address: string; balance: string } | null; busy: boolean; setBusy(value: boolean): void; onPick(): void; onBack(): void }) {
  const submit = async () => {
    if (!wallet || !proof) return;
    setBusy(true);
    try {
      const proofRef = `nocap://photo/${Date.now()}-${proof.split('/').pop() ?? 'proof'}`;
      await submitOnchainProof(challenge.id, proofRef);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Alert.alert('Proof is on-chain', 'Your squad can now review it.'); onBack();
    } catch (error) { Alert.alert('Proof failed', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  return <ScrollView contentContainerStyle={styles.scroll}><Back onPress={onBack} /><Text style={styles.pageKicker}>DAY {challenge.currentDay} CHECK-IN</Text><Text style={styles.pageTitle}>Receipts,{`\n`}not promises.</Text><Text style={styles.heroSub}>Show your squad what you got done today.</Text>
    <Pressable style={[styles.proofBox, proof && styles.proofBoxFilled]} onPress={onPick}>{proof ? <Image source={{ uri: proof }} style={styles.proofImage} /> : <><View style={styles.cameraCircle}><Ionicons name="camera" size={28} color={colors.ink} /></View><Text style={styles.proofTitle}>Add your proof</Text><Text style={styles.proofSub}>Photo, screenshot or progress snap</Text></>}</Pressable>
    <TextInput placeholder="What did you get done?" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} multiline />
    <View style={styles.proofRule}><Ionicons name="people" size={19} color={colors.acid} /><Text style={styles.proofRuleText}>Your squad verifies this before it counts.</Text></View>
    <Pressable style={[styles.primary, (!proof || busy) && styles.primaryDisabled]} disabled={!proof || busy} onPress={submit}><Text style={styles.primaryText}>{busy ? 'Confirming…' : 'Submit on Monad'}</Text><Ionicons name="sparkles" size={20} color={colors.ink} /></Pressable>
  </ScrollView>;
}

function Back({ onPress }: { onPress(): void }) { return <Pressable style={styles.back} onPress={onPress}><Ionicons name="arrow-back" size={20} color={colors.cream} /><Text style={styles.backText}>Back</Text></Pressable>; }
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }

export default function App() {
  // Never block the product on a font request. GitHub Pages, privacy extensions,
  // and slow mobile networks can delay font assets while the app itself is ready.
  useFonts({ SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const font = { regular: 'SpaceGrotesk_400Regular', medium: 'SpaceGrotesk_500Medium', semibold: 'SpaceGrotesk_600SemiBold', bold: 'SpaceGrotesk_700Bold' };
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.ink},shell:{flex:1,width:'100%',alignSelf:'center'},desktopShell:{maxWidth:620,borderLeftWidth:1,borderRightWidth:1,borderColor:colors.line},header:{height:74,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logoRow:{flexDirection:'row',alignItems:'center',gap:8},logoMark:{width:25,height:25,borderRadius:8,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center',transform:[{rotate:'-7deg'}]},logoBang:{fontFamily:font.bold,fontSize:18,color:colors.ink},logo:{fontFamily:font.bold,fontSize:24,color:colors.cream,letterSpacing:-1.5},wallet:{height:38,paddingHorizontal:13,borderRadius:radius.pill,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:8},walletConnected:{backgroundColor:colors.raised},walletDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.muted},walletDotLive:{backgroundColor:colors.green},walletText:{fontFamily:font.semibold,fontSize:12,color:colors.cream},scroll:{paddingHorizontal:20,paddingBottom:48},heroRow:{marginTop:24,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},eyebrow:{fontFamily:font.bold,fontSize:11,color:colors.acid,letterSpacing:1.8,marginBottom:8},hero:{fontFamily:font.bold,fontSize:48,lineHeight:48,color:colors.cream,letterSpacing:-2.6},createRound:{width:50,height:50,borderRadius:25,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center',marginBottom:4},heroSub:{fontFamily:font.regular,fontSize:16,lineHeight:23,color:colors.muted,maxWidth:410,marginTop:16,marginBottom:26},featureWrap:{borderRadius:radius.lg,shadowColor:colors.acid,shadowOpacity:.14,shadowRadius:24,shadowOffset:{width:0,height:10}},feature:{borderRadius:radius.lg,padding:22,minHeight:260,justifyContent:'space-between'},featureTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},darkPill:{backgroundColor:colors.ink,borderRadius:radius.pill,paddingHorizontal:12,paddingVertical:7},darkPillText:{fontFamily:font.bold,color:colors.acid,fontSize:10,letterSpacing:1.2},bigEmoji:{fontSize:35},featureTitle:{fontFamily:font.bold,color:colors.ink,fontSize:37,letterSpacing:-1.8,marginTop:34},featureDesc:{fontFamily:font.medium,color:'#3C451B',fontSize:15,marginTop:3},featureBottom:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:26},featureMeta:{fontFamily:font.semibold,fontSize:13,color:colors.ink},arrowCircle:{width:38,height:38,borderRadius:19,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center'},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:34,marginBottom:14},sectionTitle:{fontFamily:font.bold,fontSize:20,color:colors.cream,letterSpacing:-.6},sectionLink:{fontFamily:font.semibold,fontSize:12,color:colors.acid},card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:14,flexDirection:'row',gap:13,marginBottom:10},cardEmoji:{width:52,height:58,borderRadius:14,backgroundColor:colors.raised,alignItems:'center',justifyContent:'center'},cardEmojiText:{fontSize:25},cardCopy:{flex:1},cardTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},cardTitle:{fontFamily:font.bold,fontSize:16,color:colors.cream,flex:1},miniStake:{backgroundColor:'#28301A',borderRadius:radius.pill,paddingHorizontal:8,paddingVertical:4},miniStakeText:{fontFamily:font.bold,fontSize:9,color:colors.acid},cardDesc:{fontFamily:font.regular,fontSize:12,color:colors.muted,marginTop:3},cardMeta:{fontFamily:font.medium,fontSize:10,color:'#6F746A',marginTop:8},statStrip:{marginTop:20,paddingVertical:18,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.line,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},statBig:{fontFamily:font.bold,fontSize:18,color:colors.cream,textAlign:'center'},statLabel:{fontFamily:font.bold,fontSize:7,color:colors.muted,letterSpacing:.9,marginTop:4},statRule:{width:1,height:30,backgroundColor:colors.line},back:{alignSelf:'flex-start',marginTop:12,marginBottom:30,flexDirection:'row',gap:8,alignItems:'center'},backText:{fontFamily:font.semibold,color:colors.cream,fontSize:13},pageKicker:{fontFamily:font.bold,fontSize:11,color:colors.acid,letterSpacing:1.7},pageTitle:{fontFamily:font.bold,fontSize:42,lineHeight:44,color:colors.cream,letterSpacing:-2,marginTop:7,marginBottom:28},label:{fontFamily:font.bold,fontSize:10,color:colors.muted,letterSpacing:1.3,marginBottom:8,marginTop:16},input:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,minHeight:56,paddingHorizontal:16,color:colors.cream,fontFamily:font.medium,fontSize:15},textarea:{minHeight:96,paddingTop:16,textAlignVertical:'top'},formRow:{flexDirection:'row',gap:12},formHalf:{flex:1},stakeInput:{height:74,borderRadius:radius.md,backgroundColor:colors.acid,flexDirection:'row',alignItems:'center',paddingHorizontal:18},stakeText:{flex:1,fontFamily:font.bold,fontSize:31,color:colors.ink},stakeUnit:{fontFamily:font.bold,fontSize:15,color:colors.ink},helper:{fontFamily:font.regular,fontSize:11,lineHeight:16,color:colors.muted,marginTop:9},primary:{height:58,borderRadius:radius.md,backgroundColor:colors.acid,marginTop:26,paddingHorizontal:19,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryDisabled:{opacity:.35},primaryText:{fontFamily:font.bold,fontSize:15,color:colors.ink},detailHero:{alignItems:'center',paddingVertical:16},detailEmoji:{fontSize:54},liveBadge:{flexDirection:'row',alignItems:'center',gap:7,marginTop:18},liveDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.green},liveText:{fontFamily:font.bold,fontSize:10,letterSpacing:1.4,color:colors.green},detailTitle:{fontFamily:font.bold,fontSize:38,color:colors.cream,letterSpacing:-1.8,marginTop:10,textAlign:'center'},detailDesc:{fontFamily:font.regular,fontSize:15,color:colors.muted,marginTop:7,textAlign:'center'},progressHeader:{marginTop:25,flexDirection:'row',justifyContent:'space-between'},progressLabel:{fontFamily:font.bold,fontSize:10,color:colors.muted,letterSpacing:1.4},progressDay:{fontFamily:font.bold,fontSize:12,color:colors.acid},progressTrack:{height:8,borderRadius:4,backgroundColor:colors.raised,marginTop:10,overflow:'hidden'},progressFill:{height:'100%',borderRadius:4,backgroundColor:colors.acid},commitment:{backgroundColor:colors.panel,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,padding:19,marginVertical:28},commitmentLabel:{fontFamily:font.bold,fontSize:9,color:colors.muted,letterSpacing:1.3},commitmentValue:{fontFamily:font.bold,fontSize:31,color:colors.cream,marginTop:5},commitmentUnit:{fontSize:14,color:colors.acid},commitmentNote:{fontFamily:font.regular,fontSize:11,color:colors.muted,marginTop:4},squadRow:{flexDirection:'row',marginTop:16,marginBottom:6},avatar:{width:43,height:43,borderRadius:22,backgroundColor:colors.raised,borderWidth:2,borderColor:colors.ink,alignItems:'center',justifyContent:'center'},avatarText:{fontFamily:font.bold,color:colors.cream,fontSize:12},onchainNote:{fontFamily:font.medium,fontSize:10,color:colors.muted,textAlign:'center',marginTop:14},proofBox:{height:320,borderRadius:radius.lg,borderWidth:1.5,borderStyle:'dashed',borderColor:'#4C5146',backgroundColor:colors.panel,alignItems:'center',justifyContent:'center',overflow:'hidden'},proofBoxFilled:{borderStyle:'solid',borderColor:colors.acid},proofImage:{width:'100%',height:'100%'},cameraCircle:{width:62,height:62,borderRadius:31,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center'},proofTitle:{fontFamily:font.bold,fontSize:18,color:colors.cream,marginTop:15},proofSub:{fontFamily:font.regular,fontSize:12,color:colors.muted,marginTop:4},proofRule:{flexDirection:'row',gap:9,alignItems:'center',marginTop:16},proofRuleText:{fontFamily:font.medium,fontSize:12,color:colors.muted},
  dashboardIntro:{marginTop:22,paddingTop:10},dashboardTitle:{fontFamily:font.bold,fontSize:46,lineHeight:48,color:colors.cream,letterSpacing:-2.4,maxWidth:500},dashboardCopy:{fontFamily:font.regular,fontSize:15,lineHeight:22,color:colors.muted,maxWidth:470,marginTop:14},createPactButton:{height:58,borderRadius:radius.md,backgroundColor:colors.acid,marginTop:24,paddingHorizontal:8,flexDirection:'row',alignItems:'center'},createPactIcon:{width:42,height:42,borderRadius:12,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center'},createPactText:{fontFamily:font.bold,fontSize:15,color:colors.ink,marginLeft:13},manifestoCard:{marginTop:32,borderWidth:1,borderColor:colors.line,borderRadius:radius.lg,backgroundColor:colors.panel,padding:20},manifestoTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:18,borderBottomWidth:1,borderColor:colors.line},manifestoLabel:{fontFamily:font.bold,fontSize:10,color:colors.acid,letterSpacing:1.6},manifestoNumber:{fontFamily:font.medium,fontSize:10,color:colors.muted},manifestoRow:{flexDirection:'row',gap:14,paddingVertical:17,borderBottomWidth:1,borderColor:colors.line},manifestoStep:{width:38,height:38,borderRadius:12,borderWidth:1,borderColor:'#3B4625',backgroundColor:'#252C1C',alignItems:'center',justifyContent:'center'},manifestoCopy:{flex:1,paddingTop:2},manifestoTitle:{fontFamily:font.bold,fontSize:14,color:colors.cream},manifestoText:{fontFamily:font.regular,fontSize:12,lineHeight:18,color:colors.muted,marginTop:4},manifestoAction:{alignSelf:'flex-start',height:34,borderRadius:radius.pill,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,marginTop:12},manifestoActionText:{fontFamily:font.bold,fontSize:10,color:colors.cream},manifestoFoot:{fontFamily:font.medium,fontSize:10,lineHeight:15,color:colors.muted,marginTop:17},emptyPacts:{borderWidth:1,borderColor:colors.line,borderRadius:radius.lg,backgroundColor:colors.panel,padding:24,alignItems:'flex-start'},emptyStamp:{borderWidth:1,borderColor:colors.acid,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:5},emptyStampText:{fontFamily:font.bold,fontSize:9,color:colors.acid,letterSpacing:1.1},emptyTitle:{fontFamily:font.bold,fontSize:24,color:colors.cream,letterSpacing:-.8,marginTop:20},emptyText:{fontFamily:font.regular,fontSize:13,lineHeight:20,color:colors.muted,marginTop:7,maxWidth:400},outlineButton:{height:44,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,paddingHorizontal:15,alignItems:'center',justifyContent:'center',marginTop:20},outlineButtonText:{fontFamily:font.bold,fontSize:12,color:colors.cream},sectionMeta:{fontFamily:font.bold,fontSize:9,color:colors.green,letterSpacing:1.1},livePact:{borderWidth:1,borderColor:colors.line,borderRadius:radius.lg,backgroundColor:colors.panel,padding:19},livePactHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},liveIndicator:{flexDirection:'row',alignItems:'center',gap:7},liveIndicatorText:{fontFamily:font.bold,fontSize:9,color:colors.green,letterSpacing:1.2},liveId:{fontFamily:font.medium,fontSize:10,color:colors.muted},livePactTitle:{fontFamily:font.bold,fontSize:25,color:colors.cream,letterSpacing:-.8,marginTop:24},livePactRule:{fontFamily:font.regular,fontSize:13,lineHeight:19,color:colors.muted,marginTop:6},livePactMeta:{flexDirection:'row',justifyContent:'space-between',marginTop:23,paddingTop:17,borderTopWidth:1,borderColor:colors.line},metaLabel:{fontFamily:font.bold,fontSize:8,color:colors.muted,letterSpacing:1},metaValue:{fontFamily:font.bold,fontSize:13,color:colors.cream,marginTop:4},balanceBar:{marginTop:22,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.line,paddingVertical:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},balanceLabel:{fontFamily:font.bold,fontSize:9,color:colors.muted,letterSpacing:1.1},balanceValue:{fontFamily:font.bold,fontSize:18,color:colors.cream,marginTop:4},balanceUnit:{fontSize:10,color:colors.acid},networkPill:{borderRadius:radius.pill,backgroundColor:colors.raised,paddingHorizontal:10,paddingVertical:7},networkText:{fontFamily:font.bold,fontSize:9,color:colors.green},formIntro:{fontFamily:font.regular,fontSize:14,lineHeight:21,color:colors.muted,marginTop:-16,marginBottom:8,maxWidth:470},demoHelper:{fontFamily:font.regular,fontSize:10,lineHeight:15,color:colors.muted,marginTop:8},
  previewNote:{fontFamily:font.medium,fontSize:11,color:colors.orange,textAlign:'center',marginTop:10},memberRow:{minHeight:62,borderBottomWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},memberAddress:{fontFamily:font.semibold,fontSize:12,color:colors.cream},memberProof:{fontFamily:font.regular,fontSize:10,color:colors.muted,marginTop:3},approveButton:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.acid},approveText:{fontFamily:font.bold,fontSize:10,color:colors.ink},secondaryAction:{height:52,borderRadius:radius.md,borderWidth:1,borderColor:colors.acid,marginTop:12,alignItems:'center',justifyContent:'center'},secondaryActionText:{fontFamily:font.bold,fontSize:14,color:colors.acid},
  faucetLink:{marginTop:15,padding:14,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.panel,flexDirection:'row',alignItems:'center',gap:10},faucetTitle:{fontFamily:font.semibold,fontSize:12,color:colors.cream},faucetSub:{fontFamily:font.regular,fontSize:9,color:colors.muted,marginTop:2,maxWidth:330},
  sharePactButton:{minHeight:62,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.panel,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:11,marginBottom:24},sharePactCopy:{flex:1},sharePactTitle:{fontFamily:font.bold,fontSize:12,color:colors.cream},sharePactText:{fontFamily:font.regular,fontSize:10,color:colors.muted,marginTop:2},
  detailPactIcon:{width:58,height:58,borderRadius:18,borderWidth:1,borderColor:'#3B4625',backgroundColor:'#252C1C',alignItems:'center',justifyContent:'center',transform:[{rotate:'-3deg'}]},
});
