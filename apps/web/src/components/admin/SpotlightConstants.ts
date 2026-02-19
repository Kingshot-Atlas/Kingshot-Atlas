export type SpotlightReason = 'supporter' | 'ambassador' | 'booster';

export const REASON_CONFIG: Record<SpotlightReason, { label: string; emoji: string; color: string }> = {
  supporter: { label: 'Became a Supporter', emoji: '💎', color: '#22d3ee' },
  ambassador: { label: 'Became an Ambassador', emoji: '🏛️', color: '#a855f7' },
  booster: { label: 'Boosted the Server', emoji: '🚀', color: '#f472b6' },
};

const SUPPORTER_MESSAGES = [
  "🎉 A new legend rises! {user} just became an **Atlas Supporter**! Your belief in this community fuels everything we build. From the bottom of our hearts — thank you. 💎",
  "⚡ {user} just leveled up to **Atlas Supporter**! Every kingdom, every score, every feature — you make it possible. We don't take that for granted. Thank you! 💎",
  "🌟 Shoutout to {user} for becoming an **Atlas Supporter**! You're not just supporting a tool — you're investing in the competitive Kingshot community. That means the world. 💎",
  "💎 {user} has joined the ranks of **Atlas Supporters**! The intelligence gets stronger, the tools get sharper — all because of people like you. Thank you for believing in Atlas!",
  "🏆 Big moment! {user} just subscribed as an **Atlas Supporter**! Your contribution keeps this community-powered project alive and growing. We salute you! 💎",
  "✨ Welcome to the Supporter family, {user}! Your support means more kingdoms tracked, better tools, and a stronger community. Atlas wouldn't be Atlas without you. 💎",
  "🔥 {user} just unlocked **Atlas Supporter** status! You're powering the tools that thousands of players rely on every day. That's legendary. Thank you! 💎",
  "💪 The Atlas army grows stronger! {user} just joined as an **Atlas Supporter**. Your backing keeps the scoreboard running and the data flowing. We appreciate you! 💎",
  "🎯 {user} has stepped up as an **Atlas Supporter**! You're the reason we can keep building the best kingdom intelligence out there. Massive respect. 💎",
  "⭐ A new Supporter enters the arena! {user}, your contribution goes straight into making Atlas better for every player. From all of us — thank you! 💎",
  "🛡️ {user} just became an **Atlas Supporter** and joined the backbone of this community! Every feature, every update — you make it happen. Thank you for standing with us! 💎",
  "🌍 {user} is now an **Atlas Supporter**! You're helping build the #1 intelligence platform for competitive Kingshot players worldwide. That's something to be proud of. 💎",
];

const AMBASSADOR_MESSAGES = [
  "🏛️ {user} has earned the title of **Atlas Ambassador**! By spreading the word and bringing players into the fold, you've proven yourself a true champion of this community. 🙌",
  "⚡ A new **Ambassador** has emerged! {user} has been rallying players and building bridges across kingdoms. Your referrals strengthen us all. Thank you! 🏛️",
  "🌟 Hats off to {user} — our newest **Atlas Ambassador**! You didn't just join the community, you grew it. That kind of dedication doesn't go unnoticed. 🏛️",
  "🏛️ {user} just unlocked **Ambassador** status! Every player you've brought to Atlas makes our intelligence network stronger. You're a legend. Keep building! 💜",
  "🎉 The Atlas community grows thanks to people like {user}, our newest **Ambassador**! Your referrals bring kingdoms together and make everyone's experience richer. 🏛️",
  "👑 {user} has been crowned an **Atlas Ambassador**! Your dedication to growing this community is unmatched. Twenty referrals and counting — you're a force of nature! 🏛️",
  "🔥 From player to legend — {user} just became an **Atlas Ambassador**! You've brought an incredible number of players into the fold. The community salutes you! 🏛️",
  "💜 {user} is now officially an **Atlas Ambassador**! Your tireless work spreading the word about Atlas has made a real difference. We couldn't do this without you. 🏛️",
  "🏛️ Bow before {user}, our newest **Atlas Ambassador**! You've proven that one person truly can grow a community. Your referrals are legendary. 👏",
  "🌍 {user} just reached **Ambassador** tier! By connecting players across kingdoms, you've helped build something bigger than any one kingdom. Thank you, Ambassador! 🏛️",
  "⭐ {user} has achieved **Atlas Ambassador** status! Your passion for this community shines through every referral. We're honored to have you leading the charge! 🏛️",
  "🎯 The network expands! {user} just became an **Atlas Ambassador** through pure dedication and community spirit. You're an inspiration to us all. 🏛️",
];

const BOOSTER_MESSAGES = [
  "🚀 {user} just **boosted** the Atlas Discord server! You're literally powering up our community hub. That's next-level support — thank you! 💖",
  "✨ Server boost incoming! {user} just gave the Atlas Discord a boost! Better quality, better emojis, better everything — all thanks to you. 🚀",
  "🎉 {user} dropped a **server boost** on the Atlas Discord! You're making this community shine brighter. We see you, we appreciate you! 🚀💖",
  "💖 Big thanks to {user} for **boosting** our Discord server! Every boost makes this space better for hundreds of competitive players. You're a real one! 🚀",
  "🚀 The Atlas Discord just got an upgrade! {user} boosted the server — better audio, better streams, better vibes for everyone. Thank you! 💖",
  "⚡ {user} just boosted the Atlas server! Higher quality voice channels, more emoji slots, and a bigger upload limit — all because of you. Thank you! 🚀",
  "🌟 A wild **server boost** appeared! {user} just powered up the Atlas Discord. You're the MVP of community vibes! 🚀💖",
  "💎 {user} just dropped a boost on the Atlas Discord! That's the kind of energy that makes this community special. We appreciate you! 🚀",
  "🔥 Server boost alert! {user} just made the Atlas Discord even better. More features, more fun, more competitive spirit. Thank you! 🚀💖",
  "🏆 {user} boosted the Atlas Discord and leveled up our whole community! Better streaming, better emotes, better everything. You rock! 🚀",
];

export const MESSAGE_POOLS: Record<SpotlightReason, string[]> = {
  supporter: SUPPORTER_MESSAGES,
  ambassador: AMBASSADOR_MESSAGES,
  booster: BOOSTER_MESSAGES,
};

export const getRandomMessage = (reason: SpotlightReason, discordUsername: string, discordUserId: string): string => {
  const pool = MESSAGE_POOLS[reason];
  const idx = Math.floor(Math.random() * pool.length);
  const template = pool[idx] ?? pool[0] ?? '';
  const mention = discordUserId.trim() ? `<@${discordUserId.trim()}>` : `**${discordUsername}**`;
  return template.replace(/\{user\}/g, mention);
};

export interface SpotlightHistoryEntry {
  id: string;
  discord_username: string | null;
  discord_user_id: string | null;
  reason: string;
  message: string;
  auto_triggered: boolean;
  status: string;
  created_at: string;
  sent_at: string | null;
}

export type SpotlightMode = 'template' | 'custom';
export type TabView = 'compose' | 'history' | 'pending';

export const SPOTLIGHT_AVATAR = 'https://ks-atlas.com/AtlasBotAvatar.webp';
export const SPOTLIGHT_NAME = 'Atlas';
