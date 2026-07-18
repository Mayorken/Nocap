import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
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
import { Ionicons } from '@expo/vector-icons';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { colors, radius } from './src/theme';
import { connectWallet, createOnchainChallenge } from './src/web3';
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
  const { width } = useWindowDimensions();
  const desktop = width >= 760;

  const shortAddress = useMemo(() => wallet ? `${wallet.address.slice(0, 5)}…${wallet.address.slice(-4)}` : '', [wallet]);

  const go = (next: Screen) => { tap(); setScreen(next); };
  const selectChallenge = (item: Challenge) => { setSelected(item); go('detail'); };

  const handleConnect = async () => {
    setBusy(true);
    try { setWallet(await connectWallet()); }
    catch (error) { Alert.alert('Could not connect', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return Alert.alert('Name your challenge', 'Give the squad something to rally around.');
    setBusy(true);
    try {
      const receipt = await createOnchainChallenge({ title: form.title.trim(), stake: form.stake, durationDays: Number(form.duration), maxParticipants: Number(form.max) });
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
          <Pressable style={[styles.wallet, wallet && styles.walletConnected]} onPress={wallet ? undefined : handleConnect} disabled={busy}>
            <View style={[styles.walletDot, wallet && styles.walletDotLive]} />
            <Text style={styles.walletText}>{wallet ? shortAddress : busy ? 'Connecting…' : 'Connect wallet'}</Text>
          </Pressable>
        </View>

        {screen === 'home' && <Home wallet={wallet} onCreate={() => go('create')} onSelect={selectChallenge} />}
        {screen === 'create' && <Create form={form} setForm={setForm} onBack={() => go('home')} onSubmit={handleCreate} busy={busy} wallet={wallet} onConnect={handleConnect} />}
        {screen === 'detail' && <Detail challenge={selected} onBack={() => go('home')} onProof={() => go('proof')} />}
        {screen === 'proof' && <Proof challenge={selected} proof={proof} onPick={pickProof} onBack={() => go('detail')} />}
      </View>
    </SafeAreaView>
  );
}

function Home({ wallet, onCreate, onSelect }: { wallet: { address: string; balance: string } | null; onCreate(): void; onSelect(item: Challenge): void }) {
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
    <View style={styles.heroRow}>
      <View><Text style={styles.eyebrow}>SOCIAL ACCOUNTABILITY</Text><Text style={styles.hero}>Less talk.{`\n`}More proof.</Text></View>
      <Pressable style={styles.createRound} onPress={onCreate}><Ionicons name="add" size={30} color={colors.ink} /></Pressable>
    </View>
    <Text style={styles.heroSub}>Lock in with your people. Show up daily. Get your stake back.</Text>

    <Pressable onPress={() => onSelect(FEATURED)} style={styles.featureWrap}>
      <LinearGradient colors={['#D9FF43', '#A8E935']} style={styles.feature}>
        <View style={styles.featureTop}><View style={styles.darkPill}><Text style={styles.darkPillText}>DAY {FEATURED.currentDay} OF {FEATURED.durationDays}</Text></View><Text style={styles.bigEmoji}>{FEATURED.emoji}</Text></View>
        <Text style={styles.featureTitle}>{FEATURED.title}</Text><Text style={styles.featureDesc}>{FEATURED.description}</Text>
        <View style={styles.featureBottom}><Text style={styles.featureMeta}>{FEATURED.participantCount} locked in</Text><View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={18} color={colors.cream} /></View></View>
      </LinearGradient>
    </Pressable>

    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Open challenges</Text><Text style={styles.sectionLink}>See all</Text></View>
    {CHALLENGES.slice(1).map(item => <ChallengeCard key={item.id} item={item} onPress={() => onSelect(item)} />)}

    <View style={styles.statStrip}><View><Text style={styles.statBig}>{wallet ? wallet.balance : '—'}</Text><Text style={styles.statLabel}>MON AVAILABLE</Text></View><View style={styles.statRule} /><View><Text style={styles.statBig}>0</Text><Text style={styles.statLabel}>STREAK DAYS</Text></View><View style={styles.statRule} /><View><Text style={styles.statBig}>100%</Text><Text style={styles.statLabel}>SHOW-UP RATE</Text></View></View>
  </ScrollView>;
}

function ChallengeCard({ item, onPress }: { item: Challenge; onPress(): void }) {
  return <Pressable style={styles.card} onPress={onPress}><View style={styles.cardEmoji}><Text style={styles.cardEmojiText}>{item.emoji}</Text></View><View style={styles.cardCopy}><View style={styles.cardTitleRow}><Text style={styles.cardTitle}>{item.title}</Text><View style={styles.miniStake}><Text style={styles.miniStakeText}>{item.stake} MON</Text></View></View><Text style={styles.cardDesc}>{item.description}</Text><Text style={styles.cardMeta}>{item.participantCount}/{item.maxParticipants} people · {item.durationDays} days</Text></View></Pressable>;
}

function Create({ form, setForm, onBack, onSubmit, busy, wallet, onConnect }: { form: Record<string, string>; setForm(value: any): void; onBack(): void; onSubmit(): void; busy: boolean; wallet: unknown; onConnect(): void }) {
  const update = (key: string, value: string) => setForm((old: Record<string, string>) => ({ ...old, [key]: value }));
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><Back onPress={onBack} /><Text style={styles.pageKicker}>MAKE IT OFFICIAL</Text><Text style={styles.pageTitle}>What are we{`\n`}locking in for?</Text>
    <Label text="CHALLENGE NAME" /><TextInput value={form.title} onChangeText={v => update('title', v)} placeholder="e.g. Ship for 7 days" placeholderTextColor={colors.muted} style={styles.input} maxLength={48} />
    <Label text="THE PACT" /><TextInput value={form.description} onChangeText={v => update('description', v)} placeholder="What counts as showing up?" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} multiline maxLength={160} />
    <View style={styles.formRow}><View style={styles.formHalf}><Label text="DAYS" /><TextInput value={form.duration} onChangeText={v => update('duration', v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input} /></View><View style={styles.formHalf}><Label text="SQUAD SIZE" /><TextInput value={form.max} onChangeText={v => update('max', v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.input} /></View></View>
    <Label text="REFUNDABLE COMMITMENT" /><View style={styles.stakeInput}><TextInput value={form.stake} onChangeText={v => update('stake', v)} keyboardType="decimal-pad" style={styles.stakeText} /><Text style={styles.stakeUnit}>MON</Text></View><Text style={styles.helper}>Finish the pact and your commitment comes back. NoCap never holds it.</Text>
    <Pressable style={styles.primary} onPress={wallet ? onSubmit : onConnect} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Hold tight…' : wallet ? 'Create on Monad' : 'Connect wallet first'}</Text><Ionicons name="arrow-forward" size={20} color={colors.ink} /></Pressable>
  </ScrollView>;
}

function Detail({ challenge, onBack, onProof }: { challenge: Challenge; onBack(): void; onProof(): void }) {
  const progress = Math.max(8, challenge.currentDay / challenge.durationDays * 100);
  return <ScrollView contentContainerStyle={styles.scroll}><Back onPress={onBack} /><View style={styles.detailHero}><Text style={styles.detailEmoji}>{challenge.emoji}</Text><View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>{challenge.status.toUpperCase()}</Text></View><Text style={styles.detailTitle}>{challenge.title}</Text><Text style={styles.detailDesc}>{challenge.description}</Text></View>
    <View style={styles.progressHeader}><Text style={styles.progressLabel}>YOUR RUN</Text><Text style={styles.progressDay}>Day {challenge.currentDay}/{challenge.durationDays}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
    <View style={styles.commitment}><Text style={styles.commitmentLabel}>YOUR COMMITMENT</Text><Text style={styles.commitmentValue}>{challenge.stake} <Text style={styles.commitmentUnit}>MON</Text></Text><Text style={styles.commitmentNote}>Locked by the pact · returned when you finish</Text></View>
    <Text style={styles.sectionTitle}>The squad</Text><View style={styles.squadRow}>{['T', 'A', 'K', 'M', '+14'].map((name, index) => <View key={name} style={[styles.avatar, { marginLeft: index ? -10 : 0 }]}><Text style={styles.avatarText}>{name}</Text></View>)}</View>
    <Pressable style={styles.primary} onPress={onProof}><Text style={styles.primaryText}>Drop today’s proof</Text><Ionicons name="camera" size={20} color={colors.ink} /></Pressable>
    <Text style={styles.onchainNote}>Challenge #{challenge.id} · Verified on Monad</Text>
  </ScrollView>;
}

function Proof({ challenge, proof, onPick, onBack }: { challenge: Challenge; proof: string | null; onPick(): void; onBack(): void }) {
  return <ScrollView contentContainerStyle={styles.scroll}><Back onPress={onBack} /><Text style={styles.pageKicker}>DAY {challenge.currentDay} CHECK-IN</Text><Text style={styles.pageTitle}>Receipts,{`\n`}not promises.</Text><Text style={styles.heroSub}>Show your squad what you got done today.</Text>
    <Pressable style={[styles.proofBox, proof && styles.proofBoxFilled]} onPress={onPick}>{proof ? <Image source={{ uri: proof }} style={styles.proofImage} /> : <><View style={styles.cameraCircle}><Ionicons name="camera" size={28} color={colors.ink} /></View><Text style={styles.proofTitle}>Add your proof</Text><Text style={styles.proofSub}>Photo, screenshot or progress snap</Text></>}</Pressable>
    <TextInput placeholder="What did you get done?" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} multiline />
    <View style={styles.proofRule}><Ionicons name="people" size={19} color={colors.acid} /><Text style={styles.proofRuleText}>Your squad verifies this before it counts.</Text></View>
    <Pressable style={[styles.primary, !proof && styles.primaryDisabled]} disabled={!proof} onPress={() => Alert.alert('Proof ready', 'The storage and on-chain proof transaction are the next integration step.')}><Text style={styles.primaryText}>Submit proof</Text><Ionicons name="sparkles" size={20} color={colors.ink} /></Pressable>
  </ScrollView>;
}

function Back({ onPress }: { onPress(): void }) { return <Pressable style={styles.back} onPress={onPress}><Ionicons name="arrow-back" size={20} color={colors.cream} /><Text style={styles.backText}>Back</Text></Pressable>; }
function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.ink }} />;
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

const font = { regular: 'SpaceGrotesk_400Regular', medium: 'SpaceGrotesk_500Medium', semibold: 'SpaceGrotesk_600SemiBold', bold: 'SpaceGrotesk_700Bold' };
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.ink},shell:{flex:1,width:'100%',alignSelf:'center'},desktopShell:{maxWidth:620,borderLeftWidth:1,borderRightWidth:1,borderColor:colors.line},header:{height:74,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logoRow:{flexDirection:'row',alignItems:'center',gap:8},logoMark:{width:25,height:25,borderRadius:8,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center',transform:[{rotate:'-7deg'}]},logoBang:{fontFamily:font.bold,fontSize:18,color:colors.ink},logo:{fontFamily:font.bold,fontSize:24,color:colors.cream,letterSpacing:-1.5},wallet:{height:38,paddingHorizontal:13,borderRadius:radius.pill,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:8},walletConnected:{backgroundColor:colors.raised},walletDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.muted},walletDotLive:{backgroundColor:colors.green},walletText:{fontFamily:font.semibold,fontSize:12,color:colors.cream},scroll:{paddingHorizontal:20,paddingBottom:48},heroRow:{marginTop:24,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},eyebrow:{fontFamily:font.bold,fontSize:11,color:colors.acid,letterSpacing:1.8,marginBottom:8},hero:{fontFamily:font.bold,fontSize:48,lineHeight:48,color:colors.cream,letterSpacing:-2.6},createRound:{width:50,height:50,borderRadius:25,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center',marginBottom:4},heroSub:{fontFamily:font.regular,fontSize:16,lineHeight:23,color:colors.muted,maxWidth:410,marginTop:16,marginBottom:26},featureWrap:{borderRadius:radius.lg,shadowColor:colors.acid,shadowOpacity:.14,shadowRadius:24,shadowOffset:{width:0,height:10}},feature:{borderRadius:radius.lg,padding:22,minHeight:260,justifyContent:'space-between'},featureTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},darkPill:{backgroundColor:colors.ink,borderRadius:radius.pill,paddingHorizontal:12,paddingVertical:7},darkPillText:{fontFamily:font.bold,color:colors.acid,fontSize:10,letterSpacing:1.2},bigEmoji:{fontSize:35},featureTitle:{fontFamily:font.bold,color:colors.ink,fontSize:37,letterSpacing:-1.8,marginTop:34},featureDesc:{fontFamily:font.medium,color:'#3C451B',fontSize:15,marginTop:3},featureBottom:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:26},featureMeta:{fontFamily:font.semibold,fontSize:13,color:colors.ink},arrowCircle:{width:38,height:38,borderRadius:19,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center'},sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:34,marginBottom:14},sectionTitle:{fontFamily:font.bold,fontSize:20,color:colors.cream,letterSpacing:-.6},sectionLink:{fontFamily:font.semibold,fontSize:12,color:colors.acid},card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,padding:14,flexDirection:'row',gap:13,marginBottom:10},cardEmoji:{width:52,height:58,borderRadius:14,backgroundColor:colors.raised,alignItems:'center',justifyContent:'center'},cardEmojiText:{fontSize:25},cardCopy:{flex:1},cardTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},cardTitle:{fontFamily:font.bold,fontSize:16,color:colors.cream,flex:1},miniStake:{backgroundColor:'#28301A',borderRadius:radius.pill,paddingHorizontal:8,paddingVertical:4},miniStakeText:{fontFamily:font.bold,fontSize:9,color:colors.acid},cardDesc:{fontFamily:font.regular,fontSize:12,color:colors.muted,marginTop:3},cardMeta:{fontFamily:font.medium,fontSize:10,color:'#6F746A',marginTop:8},statStrip:{marginTop:20,paddingVertical:18,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.line,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},statBig:{fontFamily:font.bold,fontSize:18,color:colors.cream,textAlign:'center'},statLabel:{fontFamily:font.bold,fontSize:7,color:colors.muted,letterSpacing:.9,marginTop:4},statRule:{width:1,height:30,backgroundColor:colors.line},back:{alignSelf:'flex-start',marginTop:12,marginBottom:30,flexDirection:'row',gap:8,alignItems:'center'},backText:{fontFamily:font.semibold,color:colors.cream,fontSize:13},pageKicker:{fontFamily:font.bold,fontSize:11,color:colors.acid,letterSpacing:1.7},pageTitle:{fontFamily:font.bold,fontSize:42,lineHeight:44,color:colors.cream,letterSpacing:-2,marginTop:7,marginBottom:28},label:{fontFamily:font.bold,fontSize:10,color:colors.muted,letterSpacing:1.3,marginBottom:8,marginTop:16},input:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line,borderRadius:radius.md,minHeight:56,paddingHorizontal:16,color:colors.cream,fontFamily:font.medium,fontSize:15},textarea:{minHeight:96,paddingTop:16,textAlignVertical:'top'},formRow:{flexDirection:'row',gap:12},formHalf:{flex:1},stakeInput:{height:74,borderRadius:radius.md,backgroundColor:colors.acid,flexDirection:'row',alignItems:'center',paddingHorizontal:18},stakeText:{flex:1,fontFamily:font.bold,fontSize:31,color:colors.ink},stakeUnit:{fontFamily:font.bold,fontSize:15,color:colors.ink},helper:{fontFamily:font.regular,fontSize:11,lineHeight:16,color:colors.muted,marginTop:9},primary:{height:58,borderRadius:radius.md,backgroundColor:colors.acid,marginTop:26,paddingHorizontal:19,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryDisabled:{opacity:.35},primaryText:{fontFamily:font.bold,fontSize:15,color:colors.ink},detailHero:{alignItems:'center',paddingVertical:16},detailEmoji:{fontSize:54},liveBadge:{flexDirection:'row',alignItems:'center',gap:7,marginTop:18},liveDot:{width:7,height:7,borderRadius:4,backgroundColor:colors.green},liveText:{fontFamily:font.bold,fontSize:10,letterSpacing:1.4,color:colors.green},detailTitle:{fontFamily:font.bold,fontSize:38,color:colors.cream,letterSpacing:-1.8,marginTop:10,textAlign:'center'},detailDesc:{fontFamily:font.regular,fontSize:15,color:colors.muted,marginTop:7,textAlign:'center'},progressHeader:{marginTop:25,flexDirection:'row',justifyContent:'space-between'},progressLabel:{fontFamily:font.bold,fontSize:10,color:colors.muted,letterSpacing:1.4},progressDay:{fontFamily:font.bold,fontSize:12,color:colors.acid},progressTrack:{height:8,borderRadius:4,backgroundColor:colors.raised,marginTop:10,overflow:'hidden'},progressFill:{height:'100%',borderRadius:4,backgroundColor:colors.acid},commitment:{backgroundColor:colors.panel,borderRadius:radius.md,borderWidth:1,borderColor:colors.line,padding:19,marginVertical:28},commitmentLabel:{fontFamily:font.bold,fontSize:9,color:colors.muted,letterSpacing:1.3},commitmentValue:{fontFamily:font.bold,fontSize:31,color:colors.cream,marginTop:5},commitmentUnit:{fontSize:14,color:colors.acid},commitmentNote:{fontFamily:font.regular,fontSize:11,color:colors.muted,marginTop:4},squadRow:{flexDirection:'row',marginTop:16,marginBottom:6},avatar:{width:43,height:43,borderRadius:22,backgroundColor:colors.raised,borderWidth:2,borderColor:colors.ink,alignItems:'center',justifyContent:'center'},avatarText:{fontFamily:font.bold,color:colors.cream,fontSize:12},onchainNote:{fontFamily:font.medium,fontSize:10,color:colors.muted,textAlign:'center',marginTop:14},proofBox:{height:320,borderRadius:radius.lg,borderWidth:1.5,borderStyle:'dashed',borderColor:'#4C5146',backgroundColor:colors.panel,alignItems:'center',justifyContent:'center',overflow:'hidden'},proofBoxFilled:{borderStyle:'solid',borderColor:colors.acid},proofImage:{width:'100%',height:'100%'},cameraCircle:{width:62,height:62,borderRadius:31,backgroundColor:colors.acid,alignItems:'center',justifyContent:'center'},proofTitle:{fontFamily:font.bold,fontSize:18,color:colors.cream,marginTop:15},proofSub:{fontFamily:font.regular,fontSize:12,color:colors.muted,marginTop:4},proofRule:{flexDirection:'row',gap:9,alignItems:'center',marginTop:16},proofRuleText:{fontFamily:font.medium,fontSize:12,color:colors.muted},
});
