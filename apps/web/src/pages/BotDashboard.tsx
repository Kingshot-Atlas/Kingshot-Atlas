import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';
import { neonGlow, FONT_DISPLAY, colors } from '../utils/styles';
import { usePremium } from '../contexts/PremiumContext';
import {
  GuildSettings, AllianceEvent, GuildAdmin, EventHistoryRow, EventType, DashTab,
  DiscordChannel, DiscordRole, DiscordCategory,
  ReactionRoleConfig,
  EVENT_ORDER, EVENT_META, DEFAULT_GIFT_CODE_MESSAGE,
  FIXED_REFERENCE_DATES, getFixSteps,
  fmt, ago,
  iS, lS, Dot, Tog, SearchableSelect, EvCard,
} from './BotDashboardComponents';

// ─── Emoji Picker ───────────────────────────────────────────────────────────

type EmojiEntry = [string, string]; // [emoji, searchable keywords]
const EMOJI_CATEGORIES: { label: string; emojis: EmojiEntry[] }[] = [
  { label: 'Smileys', emojis: [
    ['😀','grinning face happy smile'],['😃','smiley face happy'],['😄','smile grin happy'],['😁','beaming grin teeth'],['😆','laughing xd'],['😅','sweat smile nervous'],['🤣','rofl rolling laughing'],['😂','joy crying laughing tears'],['🙂','slightly smiling'],['🙃','upside down'],['😊','blush happy shy'],['😇','angel halo innocent'],['🥰','love hearts face'],['😍','heart eyes love'],['🤩','star struck amazed'],['😘','kiss blowing'],['😗','kissing'],['😚','kissing closed eyes'],['😙','kissing smiling'],['🥲','smiling tear'],['😋','yummy delicious tongue'],['😛','tongue out'],['😜','wink tongue crazy'],['🤪','zany crazy wild'],['😝','squinting tongue'],['🤑','money face rich'],['🤗','hugging hug'],['🤭','hand over mouth oops'],['🤫','shush quiet secret'],['🤔','thinking hmm'],['🫡','salute'],['🤐','zipper mouth quiet'],['🤨','raised eyebrow skeptical'],['😐','neutral face blank'],['😑','expressionless'],['😶','no mouth silent'],['🫥','dotted line face'],['😏','smirk flirty'],['😒','unamused annoyed'],['🙄','eye roll whatever'],['😬','grimace awkward'],['😮‍💨','exhale sigh'],['🤥','lying pinocchio'],['😌','relieved content'],['😔','pensive sad'],['😪','sleepy tired'],['🤤','drooling'],['😴','sleeping zzz'],['😷','mask sick'],['🤒','thermometer sick fever'],['🤕','bandage hurt injured'],['🤢','nauseated sick green'],['🤮','vomiting sick'],['🥵','hot sweating'],['🥶','cold freezing'],['🥴','woozy drunk'],['😵','dizzy'],['😵‍💫','spiral dizzy'],['🤯','exploding head mind blown'],['🤠','cowboy hat yeehaw'],['🥳','party celebration birthday'],['🥸','disguise'],['😎','cool sunglasses'],['🤓','nerd glasses'],['🧐','monocle fancy'],['😕','confused'],['🫤','diagonal mouth'],['😟','worried'],['🙁','slightly frowning'],['☹️','frowning sad'],['😮','open mouth surprised'],['😯','hushed'],['😲','astonished shocked'],['😳','flushed embarrassed'],['🥺','pleading puppy eyes'],['🥹','holding back tears'],['😦','frowning open mouth'],['😧','anguished'],['😨','fearful scared'],['😰','anxious sweat'],['😥','sad relieved'],['😢','crying tear'],['😭','sobbing crying loud'],['😱','screaming fear'],['😖','confounded'],['😣','persevering'],['😞','disappointed sad'],['😓','downcast sweat'],['😩','weary tired'],['😫','tired exhausted'],['🥱','yawning bored'],['😤','triumph angry steam'],['😡','angry mad red'],['😠','angry'],['🤬','swearing cursing'],['😈','devil smiling purple'],['👿','imp angry devil'],['💀','skull dead death'],['☠️','skull crossbones danger'],['💩','poop'],['🤡','clown'],['👹','ogre oni'],['👺','goblin tengu'],['👻','ghost boo'],['👽','alien'],['👾','space invader game'],['🤖','robot bot'],['😺','cat happy smile'],['😸','cat grin'],['😹','cat joy tears'],['😻','cat heart eyes'],['😼','cat smirk'],['😽','cat kiss'],['🙀','cat weary'],['😿','cat crying'],['😾','cat angry'],
  ] },
  { label: 'People', emojis: [
    ['👋','wave hello hi bye hand'],['🤚','raised back hand'],['🖐️','hand fingers splayed'],['✋','raised hand stop high five'],['🖖','vulcan spock'],['🫱','rightwards hand'],['🫲','leftwards hand'],['🫳','palm down hand'],['🫴','palm up hand'],['👌','ok perfect'],['🤌','pinched fingers italian'],['🤏','pinching small tiny'],['✌️','peace victory'],['🤞','crossed fingers luck hope'],['🫰','hand index thumb crossed'],['🤟','love you gesture'],['🤘','rock on metal horns'],['🤙','call me shaka hang loose'],['👈','point left'],['👉','point right'],['👆','point up'],['🖕','middle finger'],['👇','point down'],['☝️','index pointing up'],['🫵','pointing at viewer'],['👍','thumbs up like good yes'],['👎','thumbs down dislike bad no'],['✊','fist bump raised'],['👊','fist punch'],['🤛','left fist bump'],['🤜','right fist bump'],['👏','clap applause'],['🙌','raised hands celebration hooray'],['🫶','heart hands love'],['👐','open hands'],['🤲','palms up together'],['🤝','handshake deal agreement'],['🙏','pray please thank you namaste'],['✍️','writing hand'],['💅','nail polish'],['🤳','selfie'],['💪','muscle strong flex bicep'],['🦾','mechanical arm prosthetic'],['🦿','mechanical leg prosthetic'],['🦵','leg'],['🦶','foot'],['👂','ear listen'],['🦻','ear hearing aid'],['👃','nose smell'],['🧠','brain smart'],['🫀','anatomical heart'],['🫁','lungs'],['🦷','tooth dental'],['🦴','bone'],['👀','eyes look see watching'],['👁️','eye'],['👅','tongue lick'],['👄','mouth lips'],['🫦','biting lip'],['👶','baby'],['🧒','child kid'],['👦','boy'],['👧','girl'],['🧑','person adult'],['👱','blond person'],['👨','man'],['👩','woman'],['🧔','beard'],['👴','old man grandpa'],['👵','old woman grandma'],['🙍','frowning person'],['🙎','pouting person'],['🙅','no gesture'],['🙆','ok gesture'],['💁','tipping hand sassy'],['🙋','raising hand'],['🧏','deaf person'],['🙇','bowing'],['🤦','facepalm'],['🤷','shrug idk'],['👮','police officer cop'],['🕵️','detective spy'],['💂','guard'],['🥷','ninja'],['👷','construction worker'],['🫅','person crown'],['🤴','prince'],['👸','princess'],['👳','turban'],['👲','cap'],['🧕','headscarf hijab'],['🤵','tuxedo'],['👰','veil bride'],['🤰','pregnant'],['🫃','pregnant man'],['🤱','breastfeeding'],['👼','angel baby'],['🎅','santa christmas'],['🤶','mrs claus christmas'],['🦸','superhero'],['🦹','supervillain'],['🧙','mage wizard'],['🧚','fairy'],['🧛','vampire'],['🧜','merperson'],['🧝','elf'],['🧞','genie'],['🧟','zombie'],['🧌','troll'],['💆','massage'],['💇','haircut'],['🚶','walking'],['🧍','standing'],['🧎','kneeling'],['🏃','running'],['💃','dancer dancing woman'],['🕺','man dancing disco'],['👯','bunny ears'],['🧖','sauna steam'],['🧗','climbing'],
  ] },
  { label: 'Animals', emojis: [
    ['🐶','dog puppy'],['🐱','cat kitty meow'],['🐭','mouse'],['🐹','hamster'],['🐰','rabbit bunny'],['🦊','fox'],['🐻','bear'],['🐼','panda'],['🐻‍❄️','polar bear'],['🐨','koala'],['🐯','tiger'],['🦁','lion king'],['🐮','cow'],['🐷','pig'],['🐽','pig nose'],['🐸','frog'],['🐵','monkey'],['🙈','see no evil monkey'],['🙉','hear no evil monkey'],['🙊','speak no evil monkey'],['🐒','monkey'],['🐔','chicken'],['🐧','penguin'],['🐦','bird'],['🐤','baby chick'],['🐣','hatching chick'],['🐥','front facing chick'],['🦆','duck'],['🦅','eagle'],['🦉','owl'],['🦇','bat'],['🐺','wolf'],['🐗','boar'],['🐴','horse'],['🦄','unicorn magical'],['🐝','bee honeybee'],['🪱','worm'],['🐛','bug caterpillar'],['🦋','butterfly'],['🐌','snail'],['🐞','ladybug'],['🐜','ant'],['🦟','mosquito'],['🦗','cricket'],['🪳','cockroach'],['🕷️','spider'],['🕸️','spider web'],['🦂','scorpion'],['🐢','turtle tortoise'],['🐍','snake'],['🦎','lizard'],['🦖','trex dinosaur'],['🦕','dinosaur sauropod'],['🐙','octopus'],['🦑','squid'],['🦐','shrimp'],['🦞','lobster'],['🦀','crab'],['🐡','blowfish puffer'],['🐠','tropical fish'],['🐟','fish'],['🐬','dolphin'],['🐳','whale spouting'],['🐋','whale'],['🦈','shark'],['🪸','coral'],['🐊','crocodile'],['🐅','tiger'],['🐆','leopard'],['🦓','zebra'],['🦍','gorilla'],['🦧','orangutan'],['🐘','elephant'],['🦛','hippo'],['🦏','rhino'],['🐪','camel'],['🐫','two hump camel'],['🦒','giraffe'],['🦘','kangaroo'],['🦬','bison'],['🐃','water buffalo'],['🐂','ox'],['🐄','cow'],['🐎','horse racing'],['🐖','pig'],['🐏','ram sheep'],['🐑','ewe sheep'],['🦙','llama alpaca'],['🐐','goat'],['🦌','deer'],['🐕','dog'],['🐩','poodle'],['🦮','guide dog'],['🐕‍🦺','service dog'],['🐈','cat'],['🐈‍⬛','black cat'],['🪶','feather'],['🐓','rooster'],['🦃','turkey'],['🦤','dodo'],['🦚','peacock'],['🦜','parrot'],['🦢','swan'],['🦩','flamingo'],['🪺','nest eggs'],['🐇','rabbit'],['🦝','raccoon'],['🦨','skunk'],['🦡','badger'],['🦫','beaver'],['🦦','otter'],['🦥','sloth'],['🐁','mouse'],['🐀','rat'],['🐿️','chipmunk squirrel'],['🦔','hedgehog'],
  ] },
  { label: 'Food', emojis: [
    ['🍎','red apple fruit'],['🍐','pear fruit'],['🍊','orange tangerine fruit'],['🍋','lemon fruit'],['🍌','banana fruit'],['🍉','watermelon fruit'],['🍇','grapes fruit'],['🍓','strawberry fruit'],['🫐','blueberries fruit'],['🍈','melon fruit'],['🍒','cherries fruit'],['🍑','peach fruit'],['🥭','mango fruit'],['🍍','pineapple fruit'],['🥥','coconut'],['🥝','kiwi fruit'],['🍅','tomato'],['🍆','eggplant aubergine'],['🥑','avocado'],['🥦','broccoli'],['🥬','leafy green'],['🥒','cucumber'],['🌶️','hot pepper chili'],['🫑','bell pepper'],['🌽','corn'],['🥕','carrot'],['🫒','olive'],['🧄','garlic'],['🧅','onion'],['🥔','potato'],['🍠','sweet potato'],['🫘','beans'],['🥐','croissant'],['🥖','baguette bread'],['🍞','bread'],['🥨','pretzel'],['🥯','bagel'],['🧀','cheese'],['🥚','egg'],['🍳','cooking fried egg'],['🧈','butter'],['🥞','pancakes'],['🧇','waffle'],['🥓','bacon'],['🥩','meat steak'],['🍗','poultry leg chicken'],['🍖','meat bone'],['🌭','hot dog'],['🍔','hamburger burger'],['🍟','french fries'],['🍕','pizza'],['🫓','flatbread'],['🥪','sandwich'],['🌮','taco'],['🌯','burrito'],['🫔','tamale'],['🥙','pita'],['🧆','falafel'],['🥗','salad'],['🥘','pot of food curry'],['🫕','fondue'],['🥫','canned food'],['🧂','salt'],['🍝','spaghetti pasta'],['🍜','ramen noodles'],['🍲','pot stew'],['🍛','curry rice'],['🍣','sushi'],['🍱','bento box'],['🥟','dumpling'],['🍤','shrimp tempura'],['🍙','rice ball onigiri'],['🍚','rice'],['🍘','rice cracker'],['🍥','fish cake'],['🥠','fortune cookie'],['🥡','takeout box'],['🦪','oyster'],['🍦','ice cream soft serve'],['🍧','shaved ice'],['🍨','ice cream'],['🍩','donut doughnut'],['🍪','cookie'],['🎂','birthday cake'],['🍰','shortcake'],['🧁','cupcake'],['🥧','pie'],['🍫','chocolate bar'],['🍬','candy'],['🍭','lollipop'],['🍮','custard pudding'],['🍯','honey pot'],['🍼','baby bottle'],['🥛','milk glass'],['☕','coffee hot'],['🫖','teapot'],['🍵','tea'],['🍶','sake'],['🍾','champagne bottle'],['🍷','wine glass'],['🍸','cocktail martini'],['🍹','tropical drink'],['🍺','beer mug'],['🍻','cheers beers clinking'],['🥂','clinking glasses'],['🥃','whiskey tumbler'],['🫗','pouring liquid'],['🥤','cup straw'],['🧋','bubble tea boba'],['🧃','juice box'],['🧉','mate'],['🫙','jar'],
  ] },
  { label: 'Activities', emojis: [
    ['⚽','soccer football'],['🏀','basketball'],['🏈','football american'],['⚾','baseball'],['🥎','softball'],['🎾','tennis'],['🏐','volleyball'],['🏉','rugby'],['🥏','frisbee disc'],['🎱','pool billiards 8ball'],['🪀','yoyo'],['🏓','ping pong table tennis'],['🏸','badminton'],['🏒','ice hockey'],['🥅','goal net'],['⛳','golf'],['🏹','archery bow arrow'],['🎣','fishing'],['🤿','diving mask'],['🥊','boxing glove'],['🥋','martial arts'],['🎽','running shirt'],['🛹','skateboard'],['🛼','roller skate'],['🛷','sled'],['⛸️','ice skating'],['🥌','curling stone'],['🎿','ski skiing'],['⛷️','skier skiing'],['🏂','snowboarder'],['🪂','parachute'],['🏋️','weight lifting'],['🤼','wrestling'],['🤸','cartwheel gymnast'],['🤽','water polo'],['🚴','cycling bike'],['🚵','mountain biking'],['🤾','handball'],['🏌️','golf'],['🏇','horse racing'],['🧘','yoga meditation'],['🏄','surfing'],['🏊','swimming'],['🤽','water polo'],['🧗','climbing'],['🤺','fencing sword'],['🎮','video game controller gaming'],['🕹️','joystick arcade'],['🎲','dice game'],['♟️','chess pawn'],['🎯','bullseye target dart'],['🎳','bowling'],['🪄','magic wand'],['🎪','circus tent'],['🎨','art palette painting'],['🎭','theater drama masks'],['🎼','music score'],['🎵','music note'],['🎶','music notes'],['🎤','microphone karaoke'],['🎧','headphones music'],['🎷','saxophone jazz'],['🪗','accordion'],['🎸','guitar rock'],['🎹','piano keyboard'],['🎺','trumpet'],['🎻','violin'],['🪕','banjo'],['🥁','drum'],['🪘','long drum'],['🏆','trophy winner champion'],['🥇','gold medal first'],['🥈','silver medal second'],['🥉','bronze medal third'],['🏅','sports medal'],['🎖️','military medal'],['🎗️','reminder ribbon'],['🎟️','admission ticket'],['🎫','ticket'],['🎪','circus tent'],
  ] },
  { label: 'Travel & Nature', emojis: [
    ['🚗','car automobile'],['🚕','taxi cab'],['🚙','suv'],['🚌','bus'],['🚎','trolleybus'],['🏎️','race car'],['🚓','police car'],['🚑','ambulance'],['🚒','fire engine truck'],['🚐','minibus van'],['🛻','pickup truck'],['🚚','delivery truck'],['🚛','semi truck'],['🚜','tractor farm'],['🏍️','motorcycle'],['🛵','scooter'],['🚲','bicycle bike'],['🛴','kick scooter'],['🛺','auto rickshaw'],['🚀','rocket launch space'],['🛸','ufo alien flying saucer'],['🛩️','small airplane'],['✈️','airplane plane flight'],['🚁','helicopter'],['🛶','canoe'],['⛵','sailboat'],['🚤','speedboat'],['🛥️','motor boat'],['🛳️','passenger ship cruise'],['⛴️','ferry'],['🚢','ship'],['⚓','anchor'],['🗼','tokyo tower'],['🏰','castle european'],['🏯','castle japanese'],['🏟️','stadium'],['🎡','ferris wheel'],['🎢','roller coaster'],['🎠','carousel'],['⛲','fountain'],['🌋','volcano'],['🏔️','snow mountain'],['🗻','mount fuji'],['🏕️','camping tent'],['🏖️','beach umbrella'],['🏜️','desert'],['🌅','sunrise'],['🌄','sunrise mountains'],['🌆','cityscape dusk'],['🌇','sunset city'],['🌉','bridge night'],['🌌','milky way galaxy stars'],['🗽','statue liberty'],['🗿','moai easter island'],['🌍','globe earth africa europe'],['🌎','globe earth americas'],['🌏','globe earth asia'],['🌐','globe meridians'],['🧭','compass'],['🏠','house home'],['🏡','house garden'],['🏢','office building'],['🏣','post office'],['🏥','hospital'],['🏦','bank'],['🏨','hotel'],['🏪','convenience store'],['🏫','school'],['🏬','department store'],['🏭','factory'],['🏯','japanese castle'],['⛪','church'],['🕌','mosque'],['🕍','synagogue'],['⛩️','shrine shinto'],['🌳','deciduous tree'],['🌲','evergreen tree pine'],['🌴','palm tree tropical'],['🌵','cactus desert'],['🌿','herb leaf'],['🍀','four leaf clover luck'],['🍁','maple leaf canada fall'],['🍂','fallen leaf autumn'],['🍃','leaf fluttering wind'],['🪻','hyacinth flower'],['🌺','hibiscus flower'],['🌻','sunflower'],['🌹','rose flower'],['🌷','tulip flower'],['🌼','blossom flower'],['🌸','cherry blossom sakura'],['💐','bouquet flowers'],['🪷','lotus flower'],['🪹','empty nest'],['🐚','seashell shell'],['🪨','rock stone'],['🪵','wood log'],['🍄','mushroom'],
  ] },
  { label: 'Objects', emojis: [
    ['⌚','watch time'],['📱','phone mobile'],['💻','laptop computer'],['⌨️','keyboard'],['🖥️','desktop computer monitor'],['🖨️','printer'],['🖱️','mouse computer'],['💽','computer disk'],['💾','floppy disk save'],['💿','cd dvd'],['📀','dvd'],['📷','camera photo'],['📸','camera flash photo'],['📹','video camera'],['🎥','movie camera film'],['📞','telephone phone'],['📺','tv television'],['📻','radio'],['🎙️','studio microphone podcast'],['🎚️','level slider'],['🎛️','control knobs'],['🧭','compass'],['⏱️','stopwatch timer'],['⏲️','timer clock'],['⏰','alarm clock'],['🕰️','mantelpiece clock'],['🔋','battery'],['🔌','plug electric'],['💡','light bulb idea'],['🔦','flashlight torch'],['🕯️','candle'],['🧯','fire extinguisher'],['🛢️','oil drum barrel'],['💰','money bag'],['💳','credit card'],['💎','gem diamond jewel'],['⚖️','balance scale justice'],['🧰','toolbox'],['🔧','wrench tool'],['🔨','hammer tool'],['⚒️','hammer pick'],['🛠️','hammer wrench tools'],['⛏️','pick'],['🔩','nut bolt'],['⚙️','gear settings'],['🧲','magnet'],['🔫','pistol gun water'],['💣','bomb'],['🧨','firecracker dynamite'],['🪓','axe'],['🔪','knife'],['🗡️','dagger sword'],['⚔️','crossed swords battle fight'],['🛡️','shield protect defense'],['🔑','key'],['🗝️','old key'],['🔒','locked padlock'],['🔓','unlocked'],['📦','package box'],['📫','mailbox'],['📬','mailbox flag'],['✉️','email envelope letter'],['📝','memo note writing'],['📁','folder file'],['📂','open folder'],['📋','clipboard'],['📌','pushpin pin'],['📎','paperclip'],['🖊️','pen'],['✏️','pencil'],['📏','ruler'],['📐','triangular ruler'],['✂️','scissors cut'],['🗃️','card file box'],['🗄️','file cabinet'],['🗑️','trash wastebasket delete'],['🔐','locked key'],['🪙','coin money'],['💵','dollar money'],['💴','yen money'],['💶','euro money'],['💷','pound money'],['📊','bar chart graph'],['📈','chart increasing up'],['📉','chart decreasing down'],
  ] },
  { label: 'Symbols', emojis: [
    ['❤️','red heart love'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['🤎','brown heart'],['💔','broken heart'],['❣️','heart exclamation'],['💕','two hearts'],['💞','revolving hearts'],['💓','beating heart'],['💗','growing heart'],['💖','sparkling heart'],['💘','heart arrow cupid'],['💝','heart ribbon gift'],['💟','heart decoration'],['❤️‍🔥','heart fire burning'],['❤️‍🩹','mending heart'],['⭐','star'],['🌟','glowing star'],['💫','dizzy star'],['✨','sparkles magic'],['⚡','lightning zap bolt electric'],['🔥','fire hot flame lit'],['💥','collision boom explosion'],['❄️','snowflake cold winter'],['🌈','rainbow'],['☀️','sun sunny'],['🌤️','sun small cloud'],['⛅','sun cloud'],['🌥️','sun behind cloud'],['☁️','cloud'],['🌧️','cloud rain'],['⛈️','cloud lightning rain'],['🌩️','cloud lightning'],['💧','droplet water'],['💦','sweat splash water'],['🌊','wave ocean water'],['✅','check mark yes done'],['❌','cross mark no wrong'],['⚠️','warning caution'],['🔴','red circle'],['🟠','orange circle'],['🟡','yellow circle'],['🟢','green circle'],['🔵','blue circle'],['🟣','purple circle'],['⚫','black circle'],['⚪','white circle'],['🟤','brown circle'],['🔶','large orange diamond'],['🔷','large blue diamond'],['🔸','small orange diamond'],['🔹','small blue diamond'],['💠','diamond dot'],['♠️','spade'],['♣️','club'],['♥️','heart suit'],['♦️','diamond suit'],['🏁','checkered flag race finish'],['🚩','red flag'],['🎌','crossed flags'],['🏴','black flag'],['🏳️','white flag surrender'],['🏳️‍🌈','rainbow flag pride lgbtq'],['🏴‍☠️','pirate flag'],['🔔','bell notification'],['🔕','bell silent muted'],['📢','loudspeaker megaphone'],['📣','megaphone cheering'],['💬','speech bubble chat message'],['💭','thought bubble'],['🗯️','anger bubble'],['🔇','muted speaker'],['🔈','speaker low'],['🔉','speaker medium'],['🔊','speaker loud'],['🎵','music note'],['🎶','music notes'],['💤','sleeping zzz'],['💢','anger symbol'],['💬','speech bubble chat'],['🔰','beginner japanese'],['♻️','recycling recycle'],['✳️','eight spoked asterisk'],['❇️','sparkle'],['🔱','trident emblem'],['📛','name badge'],['🔰','beginner'],['⭕','circle red'],['✅','check yes'],['☑️','ballot check'],['✔️','check mark heavy'],['❎','cross mark'],['➕','plus add'],['➖','minus subtract'],['➗','divide'],['✖️','multiply'],['♾️','infinity'],['‼️','double exclamation'],['⁉️','exclamation question'],['❓','question mark red'],['❔','question mark white'],['❕','exclamation mark white'],['❗','exclamation mark red'],['〰️','wavy dash'],['©️','copyright'],['®️','registered'],['™️','trademark'],['#️⃣','hash number sign'],['*️⃣','asterisk keycap'],['0️⃣','zero'],['1️⃣','one'],['2️⃣','two'],['3️⃣','three'],['4️⃣','four'],['5️⃣','five'],['6️⃣','six'],['7️⃣','seven'],['8️⃣','eight'],['9️⃣','nine'],['🔟','ten keycap'],['💯','hundred perfect score'],['🔠','input latin uppercase'],['🔡','input latin lowercase'],['🔢','input numbers'],['🔣','input symbols'],['🔤','input latin letters'],['🆎','ab blood type'],['🆑','cl button'],['🆒','cool button'],['🆓','free button'],['🆔','id button'],['🆕','new button'],['🆖','ng button'],['🆗','ok button'],['🆘','sos help emergency'],['🆙','up button'],['🆚','vs versus'],['🈁','japanese here'],['🈶','japanese not free charge'],['🈯','japanese reserved'],['🉐','japanese bargain'],['🈹','japanese discount'],['🈚','japanese free charge'],['🈲','japanese prohibited'],['🉑','japanese acceptable'],['㊗️','japanese congratulations'],['㊙️','japanese secret'],
  ] },
];

// Flatten for search
const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(c => c.emojis);

const EmojiPicker: React.FC<{ value: string; onChange: (emoji: string) => void }> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const q = search.trim().toLowerCase();
  const filteredCategories = q
    ? [{ label: 'Results', emojis: ALL_EMOJIS.filter(([, keywords]) => keywords.toLowerCase().includes(q)) }]
    : EMOJI_CATEGORIES;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} type="button"
        style={{ width: 44, height: 36, fontSize: value ? '1.1rem' : '0.7rem', backgroundColor: '#1a1a1a', border: `1px solid ${open ? '#a855f7' : '#333'}`, borderRadius: 6, cursor: 'pointer', color: value ? undefined : colors.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}>
        {value || '😀'}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4, width: 320, maxHeight: 360, backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.7)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #222' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emoji (e.g. smile, heart, fire)..." autoFocus
              style={{ width: '100%', padding: '0.35rem 0.5rem', backgroundColor: '#111', border: '1px solid #333', borderRadius: 6, color: '#fff', fontSize: '0.75rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ overflowY: 'auto', padding: '0.3rem', flex: 1 }}>
            {filteredCategories.map(cat => (
              <div key={cat.label}>
                {cat.emojis.length > 0 && (
                  <>
                    <div style={{ color: colors.textMuted, fontSize: '0.6rem', fontWeight: 700, padding: '0.3rem 0.2rem 0.15rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cat.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                      {cat.emojis.map(([em]) => (
                        <button key={em} onClick={() => { onChange(em); setOpen(false); setSearch(''); }} type="button"
                          style={{ width: '100%', aspectRatio: '1', fontSize: '1.15rem', backgroundColor: em === value ? '#a855f730' : 'transparent', border: em === value ? '1px solid #a855f7' : '1px solid transparent', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.1s' }}
                          onMouseEnter={e => { if (em !== value) (e.currentTarget.style.backgroundColor = '#ffffff10'); }}
                          onMouseLeave={e => { if (em !== value) (e.currentTarget.style.backgroundColor = 'transparent'); }}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {q && cat.emojis.length === 0 && (
                  <div style={{ color: colors.textMuted, fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem 0.5rem' }}>No emojis match "{search}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Role Assigner Card ─────────────────────────────────────────────────────

const RoleAssignerCard: React.FC<{
  cfg: ReactionRoleConfig; mob: boolean;
  dChannels: DiscordChannel[]; dRoles: DiscordRole[]; loadingDiscord: boolean;
  onUpdate: (u: Partial<ReactionRoleConfig>) => void; onDelete: () => void;
  onDeploy: () => void; onEdit: () => void; onCopy: () => void;
  deploying: boolean; rrError: string;
}> = ({ cfg, mob, dChannels, dRoles, loadingDiscord, onUpdate, onDelete, onDeploy, onEdit, onCopy, deploying, rrError }) => {

  const updateMapping = (idx: number, patch: Partial<{ emoji: string; role_id: string; role_name?: string; label?: string }>) => {
    const updated = cfg.emoji_role_mappings.map((m, i) => i === idx ? { ...m, ...patch } : m);
    onUpdate({ emoji_role_mappings: updated });
  };

  return (
    <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${cfg.active ? '#a855f730' : colors.border}`, padding: mob ? '0.85rem' : '1rem 1.25rem', marginBottom: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🏷️</span>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: mob ? '0.85rem' : '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.title || 'Untitled'}</span>
          {cfg.active && cfg.message_id && <span style={{ fontSize: '0.6rem', fontWeight: 600, color: '#22c55e', backgroundColor: '#22c55e15', padding: '0.1rem 0.4rem', borderRadius: 3, flexShrink: 0 }}>LIVE</span>}
          {!cfg.active && <span style={{ fontSize: '0.6rem', fontWeight: 600, color: colors.textMuted, backgroundColor: `${colors.textMuted}15`, padding: '0.1rem 0.4rem', borderRadius: 3, flexShrink: 0 }}>DRAFT</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          <button onClick={onCopy} title="Duplicate config" style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer', padding: '0.2rem 0.3rem' }}>📋</button>
          <button onClick={onDelete} title="Delete" style={{ background: 'none', border: 'none', color: colors.error, fontSize: '0.75rem', cursor: 'pointer', padding: '0.2rem 0.3rem' }}>🗑️</button>
        </div>
      </div>

      {/* Channel */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={lS}>CHANNEL</label>
        {dChannels.length > 0 || loadingDiscord ? (
          <SearchableSelect value={cfg.channel_id || null} onChange={v => onUpdate({ channel_id: v || '' })} options={dChannels.map(c => ({ id: c.id, name: c.name, category: '' }))} placeholder="Select a channel" loading={loadingDiscord} accentColor="#a855f7" />
        ) : (
          <input type="text" value={cfg.channel_id} onChange={e => onUpdate({ channel_id: e.target.value })} placeholder="Channel ID" style={iS} />
        )}
      </div>

      {/* Title + Description — side by side on desktop, stacked on mobile */}
      <div style={{ display: 'flex', flexDirection: mob ? 'column' : 'row', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ flex: mob ? undefined : '0 0 40%' }}>
          <label style={lS}>EMBED TITLE</label>
          <input type="text" value={cfg.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="Role Selection" maxLength={100} style={{ ...iS, width: '100%', maxWidth: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lS}>EMBED MESSAGE</label>
          <textarea value={cfg.description} onChange={e => onUpdate({ description: e.target.value })} placeholder="React to get your roles!" rows={2} maxLength={1000} style={{ ...iS, width: '100%', maxWidth: '100%', resize: 'vertical', minHeight: 44, fontFamily: 'inherit', fontSize: '0.8rem', lineHeight: 1.4 }} />
        </div>
      </div>

      {/* Emoji → Role Mappings */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={lS}>EMOJI → ROLE MAPPINGS ({cfg.emoji_role_mappings.length}/20)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
          {cfg.emoji_role_mappings.map((mapping, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: mob ? 'stretch' : 'center', gap: mob ? '0.3rem' : '0.4rem', padding: '0.35rem 0.5rem', backgroundColor: '#a855f708', border: '1px solid #a855f720', borderRadius: 6, flexDirection: mob ? 'column' : 'row' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <EmojiPicker value={mapping.emoji} onChange={emoji => updateMapping(idx, { emoji })} />
                <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>→</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {dRoles.length > 0 || loadingDiscord ? (
                    <SearchableSelect value={mapping.role_id || null} onChange={v => { const roleName = dRoles.find(r => r.id === v)?.name; updateMapping(idx, { role_id: v || '', role_name: roleName }); }} options={dRoles.map(r => ({ id: r.id, name: r.name, color: r.color }))} placeholder="Select role" loading={loadingDiscord} accentColor="#a855f7" />
                  ) : (
                    <input type="text" value={mapping.role_id} onChange={e => updateMapping(idx, { role_id: e.target.value })} placeholder="Role ID" style={{ ...iS, width: '100%', maxWidth: 'none' }} />
                  )}
                </div>
                {!mob && (
                  <button onClick={() => { const updated = cfg.emoji_role_mappings.filter((_, i) => i !== idx); onUpdate({ emoji_role_mappings: updated }); }} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem', flexShrink: 0 }}>✕</button>
                )}
              </div>
              {mob && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input type="text" value={mapping.label || ''} onChange={e => updateMapping(idx, { label: e.target.value })} placeholder="Label (optional)" maxLength={50} style={{ ...iS, flex: 1, maxWidth: 'none', fontSize: '0.72rem' }} />
                  <button onClick={() => { const updated = cfg.emoji_role_mappings.filter((_, i) => i !== idx); onUpdate({ emoji_role_mappings: updated }); }} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.7rem', padding: '0.2rem 0.4rem', flexShrink: 0 }}>✕</button>
                </div>
              )}
              {!mob && (
                <input type="text" value={mapping.label || ''} onChange={e => updateMapping(idx, { label: e.target.value })} placeholder="Label (optional)" maxLength={50} style={{ ...iS, width: 120, maxWidth: 120, fontSize: '0.72rem' }} />
              )}
            </div>
          ))}
        </div>
        {cfg.emoji_role_mappings.length < 20 && (
          <button onClick={() => { const updated = [...cfg.emoji_role_mappings, { emoji: '', role_id: '' }]; onUpdate({ emoji_role_mappings: updated }); }} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: '1px solid #a855f730', borderRadius: 6, color: '#a855f7', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>
            + Add Mapping
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexDirection: mob ? 'column' : 'row' }}>
          <button onClick={onDeploy} disabled={deploying || !cfg.channel_id || cfg.emoji_role_mappings.length === 0}
            style={{ flex: 1, padding: '0.5rem 1rem', backgroundColor: deploying ? colors.border : '#a855f720', border: '1px solid #a855f740', borderRadius: 8, color: deploying ? colors.textMuted : '#a855f7', fontSize: '0.8rem', fontWeight: 600, cursor: deploying || !cfg.channel_id || cfg.emoji_role_mappings.length === 0 ? 'default' : 'pointer' }}>
            {deploying ? '⏳ Working...' : cfg.message_id ? '🔄 Re-deploy' : '🚀 Deploy to Discord'}
          </button>
          {cfg.message_id && (
            <button onClick={onEdit} disabled={deploying}
              style={{ flex: mob ? undefined : '0 0 auto', padding: '0.5rem 1rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: '0.8rem', fontWeight: 600, cursor: deploying ? 'default' : 'pointer' }}>
              ✏️ Edit Message
            </button>
          )}
        </div>
        {cfg.message_id && (
          <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.3rem', textAlign: 'center' }}>
            Message ID: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#a855f7' }}>{cfg.message_id}</span>
          </div>
        )}
        {rrError && (
          <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', borderRadius: 6, backgroundColor: `${colors.error}10`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.72rem' }}>
            ❌ {rrError}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const BotDashboard: React.FC = () => {
  useDocumentTitle('Bot Dashboard — Atlas');
  const { user, profile } = useAuth();
  const mob = useIsMobile();
  const { isSupporter, isAdmin } = usePremium();
  const canMultiServer = isSupporter || isAdmin;

  const [loading, setLoading] = useState(true);
  const [guilds, setGuilds] = useState<GuildSettings[]>([]);
  const [selGuild, setSelGuild] = useState<string | null>(null);
  const [events, setEvents] = useState<AllianceEvent[]>([]);
  const [admins, setAdmins] = useState<GuildAdmin[]>([]);
  const [hist, setHist] = useState<EventHistoryRow[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<DashTab>('notifications');
  const [giftCodeOpen, setGiftCodeOpen] = useState(false);
  const [showLocal, setShowLocal] = useState(false);
  const [discordGuilds, setDiscordGuilds] = useState<{guild_id: string; guild_name: string; guild_icon: string | null}[]>([]);
  const [fetchingGuilds, setFetchingGuilds] = useState(false);
  const [setupErr, setSetupErr] = useState('');
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [blockInput, setBlockInput] = useState('');
  const [blockingUser, setBlockingUser] = useState(false);
  const [blockSuggestions, setBlockSuggestions] = useState<{ id: string; discord_username: string; username: string; discord_id: string }[]>([]);
  const [blockSearchOpen, setBlockSearchOpen] = useState(false);
  const blockSearchRef = useRef<HTMLDivElement>(null);
  const [removingGuild, setRemovingGuild] = useState<string | null>(null);
  const [dChannels, setDChannels] = useState<DiscordChannel[]>([]);
  const [dRoles, setDRoles] = useState<DiscordRole[]>([]);
  const [dCategories, setDCategories] = useState<DiscordCategory[]>([]);
  const [loadingDiscord, setLoadingDiscord] = useState(false);
  const [testingEvent, setTestingEvent] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string; steps?: string[] }>>({});
  const [testingGiftCode, setTestingGiftCode] = useState(false);
  const [giftCodeTestResult, setGiftCodeTestResult] = useState<{ ok: boolean; msg: string; steps?: string[] } | null>(null);
  // Reaction Role state
  const [rrConfigs, setRrConfigs] = useState<ReactionRoleConfig[]>([]);
  const [rrSaving, setRrSaving] = useState(false);
  const [rrDeploying, setRrDeploying] = useState<string | null>(null);
  const [rrError, setRrError] = useState('');
  const [rrErrorId, setRrErrorId] = useState<string | null>(null);

  const guild = useMemo(() => guilds.find(g => g.guild_id === selGuild) || null, [guilds, selGuild]);
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // Sort events in the correct display order
  const sortedEvents = useMemo(() => {
    const order = new Map(EVENT_ORDER.map((t, i) => [t, i]));
    return [...events].sort((a, b) => (order.get(a.event_type) ?? 99) - (order.get(b.event_type) ?? 99));
  }, [events]);

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadGuilds = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const { data: ar } = await supabase.from('bot_guild_admins').select('guild_id').eq('user_id', user.id);
      const { data: og } = await supabase.from('bot_guild_settings').select('*').eq('created_by', user.id);
      const ids = new Set([...(ar || []).map(r => r.guild_id), ...(og || []).map(g => g.guild_id)]);
      if (ids.size === 0) { setGuilds([]); setLoading(false); return; }
      const { data } = await supabase.from('bot_guild_settings').select('*').in('guild_id', Array.from(ids));
      const gs = data || [];
      setGuilds(gs);
      if (gs.length > 0 && !selGuild) setSelGuild(gs[0].guild_id);
    } catch (e) { console.error('Load guilds failed:', e); }
    finally { setLoading(false); }
  }, [user, selGuild]);

  const loadEv = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_alliance_events').select('*').eq('guild_id', gid).order('event_type');
    if (data) setEvents(data);
  }, []);

  const loadAdm = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_guild_admins').select('*').eq('guild_id', gid).order('role');
    if (data) {
      const uids = data.map(a => a.user_id);
      const { data: ps } = await supabase.from('profiles').select('id, username, discord_username').in('id', uids);
      const pm = new Map((ps || []).map(p => [p.id, p.discord_username || p.username]));
      setAdmins(data.map(a => ({ ...a, username: pm.get(a.user_id) || 'Unknown' })));
    }
  }, []);

  const loadHist = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_event_history').select('*').eq('guild_id', gid).order('sent_at', { ascending: false }).limit(50);
    if (data) setHist(data);
  }, []);

  const loadRr = useCallback(async (gid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('bot_reaction_roles').select('*').eq('guild_id', gid).order('created_at', { ascending: false });
    if (data) setRrConfigs(data);
  }, []);

  useEffect(() => { if (selGuild) { loadEv(selGuild); loadAdm(selGuild); loadHist(selGuild); loadRr(selGuild); } }, [selGuild, loadEv, loadAdm, loadHist, loadRr]);
  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  // ─── Fetch Discord Channels & Roles for searchable dropdowns ────────
  const fetchDiscordData = useCallback(async (gid: string) => {
    if (!supabase || !profile?.discord_id) return;
    setLoadingDiscord(true);
    try {
      const [chRes, roRes] = await Promise.all([
        supabase.functions.invoke('verify-guild-permissions', {
          body: { action: 'list-channels', guild_id: gid, discord_id: profile.discord_id },
        }),
        supabase.functions.invoke('verify-guild-permissions', {
          body: { action: 'list-roles', guild_id: gid, discord_id: profile.discord_id },
        }),
      ]);
      setDChannels(chRes.data?.channels || []);
      setDCategories(chRes.data?.categories || []);
      setDRoles(roRes.data?.roles || []);
    } catch (e) { console.error('Failed to fetch Discord data:', e); }
    finally { setLoadingDiscord(false); }
  }, [profile?.discord_id]);

  useEffect(() => { if (selGuild) fetchDiscordData(selGuild); }, [selGuild, fetchDiscordData]);

  // Auto-set fixed reference dates for non-Bear-Hunt events that have none
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    events.forEach(ev => {
      if (ev.event_type !== 'bear_hunt' && !ev.reference_date && FIXED_REFERENCE_DATES[ev.event_type]) {
        const fixedDate = FIXED_REFERENCE_DATES[ev.event_type]!;
        setEvents(p => p.map(e => e.id === ev.id ? { ...e, reference_date: fixedDate } : e));
        sb.from('bot_alliance_events').update({ reference_date: fixedDate, updated_at: new Date().toISOString() }).eq('id', ev.id).then(() => {});
      }
    });
  }, [events.length]); // Only when events array length changes (initial load)

  // ─── Auto-detect Discord Guilds ──────────────────────────────────────────

  const fetchDiscordGuilds = useCallback(async () => {
    if (!supabase || !profile?.discord_id) return;
    setFetchingGuilds(true); setSetupErr('');
    try {
      const { data, error } = await supabase.functions.invoke('verify-guild-permissions', {
        body: { action: 'list-guilds', discord_id: profile.discord_id },
      });
      if (error) { setSetupErr('Could not fetch servers. Try again later.'); return; }
      setDiscordGuilds(data?.guilds || []);
      if ((data?.guilds || []).length === 0) setSetupErr('No servers found where you have Manage Server permission and Atlas Bot is present.');
    } catch { setSetupErr('Could not connect to Discord. Try again.'); }
    finally { setFetchingGuilds(false); }
  }, [profile?.discord_id]);

  const registerGuild = async (g: {guild_id: string; guild_name: string; guild_icon: string | null}) => {
    if (!supabase || !user) return;
    setRegisteringId(g.guild_id);
    try {
      const { data, error } = await supabase.from('bot_guild_settings')
        .insert({ guild_id: g.guild_id, guild_name: g.guild_name, guild_icon_url: g.guild_icon, created_by: user.id })
        .select().single();
      if (error) { flash(error.code === '23505' ? 'Server already registered.' : error.message, false); return; }
      setGuilds(p => [...p, data]); setSelGuild(data.guild_id);
      await loadEv(data.guild_id); await loadAdm(data.guild_id);
      flash('Server registered!');
    } catch { flash('Registration failed', false); }
    finally { setRegisteringId(null); }
  };

  // ─── Updates ────────────────────────────────────────────────────────────

  const upEv = async (eid: string, u: Partial<AllianceEvent>) => {
    if (!supabase) return;
    setEvents(p => p.map(e => e.id === eid ? { ...e, ...u } : e));
    const { error } = await supabase.from('bot_alliance_events').update({ ...u, updated_at: new Date().toISOString() }).eq('id', eid);
    if (error) { flash('Save failed', false); if (guild) loadEv(guild.guild_id); }
  };

  const upGuild = async (u: Partial<GuildSettings>) => {
    if (!supabase || !guild) return;
    setGuilds(p => p.map(g => g.guild_id === guild.guild_id ? { ...g, ...u } : g));
    const { error } = await supabase.from('bot_guild_settings').update({ ...u, updated_at: new Date().toISOString() }).eq('id', guild.id);
    if (error) { flash('Save failed', false); loadGuilds(); }
  };

  // ─── Reaction Role CRUD ─────────────────────────────────────────────────
  const createRr = async () => {
    if (!supabase || !guild) return;
    setRrSaving(true);
    try {
      const { data, error } = await supabase.from('bot_reaction_roles')
        .insert({ guild_id: guild.guild_id, channel_id: '', title: 'Role Selection', description: 'React to get your roles!', emoji_role_mappings: [] })
        .select().single();
      if (error) { flash(error.message, false); return; }
      setRrConfigs(p => [data, ...p]);
      flash('Role assigner created');
    } finally { setRrSaving(false); }
  };

  const updateRr = async (id: string, u: Partial<ReactionRoleConfig>) => {
    if (!supabase) return;
    setRrConfigs(p => p.map(c => c.id === id ? { ...c, ...u } : c));
    const { error } = await supabase.from('bot_reaction_roles').update({ ...u, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { flash('Save failed', false); if (guild) loadRr(guild.guild_id); }
  };

  const deleteRr = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('bot_reaction_roles').delete().eq('id', id);
    if (error) { flash('Delete failed', false); return; }
    setRrConfigs(p => p.filter(c => c.id !== id));
    flash('Deleted');
  };

  const deployRr = async (cfg: ReactionRoleConfig) => {
    if (!cfg.channel_id || cfg.emoji_role_mappings.length === 0) { flash('Set a channel and at least one emoji-role mapping first.', false); return; }
    setRrDeploying(cfg.id); setRrError(''); setRrErrorId(null);
    try {
      const { getAuthHeaders } = await import('../services/authHeaders');
      const auth = await getAuthHeaders();
      const mappingLines = cfg.emoji_role_mappings.map(m => `${m.emoji} — ${m.label || m.role_name || 'Role'}`).join('\n');
      const description = `${cfg.description}\n\n${mappingLines}`;
      const res = await fetch(`${API_URL}/api/v1/bot/send-reaction-role`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ channel_id: cfg.channel_id, title: cfg.title, description, emoji_role_mappings: cfg.emoji_role_mappings, config_id: cfg.id }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.message_id) {
          await updateRr(cfg.id, { message_id: result.message_id, active: true });
        }
        flash('Role assigner deployed! Check your Discord channel.');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const msg = typeof err.detail === 'string' ? err.detail : 'Deploy failed';
        setRrError(msg); setRrErrorId(cfg.id);
        flash('Deploy failed', false);
      }
    } catch { setRrError('Could not reach server.'); setRrErrorId(cfg.id); flash('Could not reach server.', false); }
    finally { setRrDeploying(null); }
  };

  const editRr = async (cfg: ReactionRoleConfig) => {
    if (!cfg.channel_id || !cfg.message_id) { flash('No deployed message to edit.', false); return; }
    setRrDeploying(cfg.id); setRrError(''); setRrErrorId(null);
    try {
      const { getAuthHeaders } = await import('../services/authHeaders');
      const auth = await getAuthHeaders();
      const mappingLines = cfg.emoji_role_mappings.map(m => `${m.emoji} — ${m.label || m.role_name || 'Role'}`).join('\n');
      const description = `${cfg.description}\n\n${mappingLines}`;
      const res = await fetch(`${API_URL}/api/v1/bot/edit-reaction-role`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ channel_id: cfg.channel_id, message_id: cfg.message_id, title: cfg.title, description, config_id: cfg.id }),
      });
      if (res.ok) {
        flash('Message updated in Discord!');
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const msg = typeof err.detail === 'string' ? err.detail : 'Edit failed';
        setRrError(msg); setRrErrorId(cfg.id);
        flash('Edit failed', false);
      }
    } catch { setRrError('Could not reach server.'); setRrErrorId(cfg.id); flash('Could not reach server.', false); }
    finally { setRrDeploying(null); }
  };

  const copyRr = async (cfg: ReactionRoleConfig) => {
    if (!supabase || !guild) return;
    setRrSaving(true);
    try {
      const { data, error } = await supabase.from('bot_reaction_roles')
        .insert({
          guild_id: guild.guild_id,
          channel_id: cfg.channel_id,
          title: `${cfg.title} (copy)`,
          description: cfg.description,
          emoji_role_mappings: cfg.emoji_role_mappings,
        })
        .select().single();
      if (error) { flash(error.message, false); return; }
      setRrConfigs(p => [data, ...p]);
      flash('Config duplicated');
    } finally { setRrSaving(false); }
  };

  const searchBlockUsers = useCallback(async (q: string) => {
    if (!supabase || q.length < 2) { setBlockSuggestions([]); return; }
    const { data } = await supabase.from('profiles')
      .select('id, username, discord_username, discord_id')
      .not('discord_id', 'is', null)
      .ilike('discord_username', `%${q}%`)
      .limit(10);
    setBlockSuggestions((data || []).filter(p => !admins.some(a => a.user_id === p.id)) as typeof blockSuggestions);
  }, [admins]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (blockSearchRef.current && !blockSearchRef.current.contains(e.target as Node)) setBlockSearchOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const blockUser = async (userId?: string) => {
    if (!supabase || !guild) return;
    const targetId = userId;
    if (!targetId && !blockInput.trim()) return;
    setBlockingUser(true);
    try {
      let p: { id: string; username: string; discord_id: string | null; discord_username: string | null } | null = null;
      if (targetId) {
        const { data } = await supabase.from('profiles').select('id, username, discord_id, discord_username').eq('id', targetId).single();
        p = data;
      } else {
        const { data } = await supabase.from('profiles').select('id, username, discord_id, discord_username').ilike('discord_username', blockInput.trim()).single();
        p = data;
      }
      if (!p) { flash('User not found.', false); return; }
      if (!p.discord_id) { flash('User has no Discord linked.', false); return; }
      if (admins.some(a => a.user_id === p!.id && a.role === 'owner')) { flash('Cannot block the owner.', false); return; }
      if (admins.some(a => a.user_id === p!.id && a.role === 'blocked')) { flash('Already blocked.', false); return; }
      // Remove any existing admin entry first, then insert as blocked
      const existing = admins.find(a => a.user_id === p!.id);
      if (existing) await supabase.from('bot_guild_admins').delete().eq('id', existing.id);
      const { error } = await supabase.from('bot_guild_admins').insert({ guild_id: guild.guild_id, user_id: p.id, role: 'blocked' });
      if (error) { flash(error.message, false); return; }
      flash(`Blocked ${p.discord_username || p.username}`); setBlockInput(''); setBlockSuggestions([]); setBlockSearchOpen(false); await loadAdm(guild.guild_id);
    } catch { flash('Failed', false); }
    finally { setBlockingUser(false); }
  };

  const unblockUser = async (aid: string) => {
    if (!supabase || !guild) return;
    const { error } = await supabase.from('bot_guild_admins').delete().eq('id', aid);
    if (error) { flash('Failed', false); return; }
    flash('Unblocked'); await loadAdm(guild.guild_id);
  };

  const removeGuild = async (gid: string) => {
    if (!supabase || !user) return;
    setRemovingGuild(gid);
    try {
      // Delete admins, events, history, reaction roles, then settings
      await supabase.from('bot_guild_admins').delete().eq('guild_id', gid);
      await supabase.from('bot_event_history').delete().eq('guild_id', gid);
      await supabase.from('bot_alliance_events').delete().eq('guild_id', gid);
      await supabase.from('bot_reaction_roles').delete().eq('guild_id', gid);
      const { error } = await supabase.from('bot_guild_settings').delete().eq('guild_id', gid);
      if (error) { flash('Failed to remove server', false); return; }
      setGuilds(p => p.filter(g => g.guild_id !== gid));
      if (selGuild === gid) setSelGuild(guilds.find(g => g.guild_id !== gid)?.guild_id || null);
      flash('Server removed');
    } catch { flash('Failed', false); }
    finally { setRemovingGuild(null); }
  };

  // ─── Test Messages ──────────────────────────────────────────────────────

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const sendTestEvent = async (ev: AllianceEvent) => {
    const m = EVENT_META[ev.event_type];
    const channelId = ev.channel_id || guild?.reminder_channel_id;
    if (!channelId) { flash('No channel configured.', false); return; }
    setTestingEvent(ev.id);
    setTestResults(p => { const n = { ...p }; delete n[ev.id]; return n; });
    try {
      const { getAuthHeaders } = await import('../services/authHeaders');
      const auth = await getAuthHeaders();
      const firstSlot = ev.time_slots.length > 0 ? ev.time_slots[0] : null;
      const timeStr = firstSlot ? `${fmt(firstSlot)} UTC` : 'TBD';
      const customMsg = ev.custom_message;
      const description = customMsg
        ? `${customMsg}\nJoin us at **${timeStr}**.`
        : `${m.defaultMessage}\nJoin us at **${timeStr}**.`;
      const res = await fetch(`${API_URL}/api/v1/bot/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          channel_id: channelId,
          embed: {
            title: `${m.icon} ${m.label} starting soon!`,
            url: 'https://ks-atlas.com',
            description,
            color: parseInt(m.color.replace('#', ''), 16),
            footer: { text: 'Brought to you by Atlas · ks-atlas.com' },
          },
        }),
      });
      if (res.ok) {
        setTestResults(p => ({ ...p, [ev.id]: { ok: true, msg: 'Test message sent! Check your Discord channel.' } }));
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const detail = typeof err.detail === 'string' ? err.detail : 'Unknown error';
        setTestResults(p => ({ ...p, [ev.id]: { ok: false, msg: `Failed: ${detail}`, steps: getFixSteps(detail) } }));
      }
    } catch {
      setTestResults(p => ({ ...p, [ev.id]: { ok: false, msg: 'Could not reach server.', steps: getFixSteps('503') } }));
    } finally { setTestingEvent(null); }
  };

  const sendTestGiftCode = async () => {
    const channelId = guild?.gift_code_channel_id || guild?.reminder_channel_id;
    if (!channelId) { flash('No channel configured for gift codes.', false); return; }
    setTestingGiftCode(true);
    setGiftCodeTestResult(null);
    try {
      const { getAuthHeaders } = await import('../services/authHeaders');
      const auth = await getAuthHeaders();
      const msg = guild?.gift_code_custom_message || DEFAULT_GIFT_CODE_MESSAGE;
      const res = await fetch(`${API_URL}/api/v1/bot/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          channel_id: channelId,
          embed: {
            title: '🎁 New Gift Code!',
            url: 'https://ks-atlas.com/gift-codes',
            description: `${msg}\n\nNew gift code released: \`TESTCODE123\`\n\n[View codes on Atlas](https://ks-atlas.com/gift-codes)\n\n*This is a test — not a real code.*`,
            color: 0x22c55e,
            footer: { text: 'Brought to you by Atlas · ks-atlas.com' },
          },
        }),
      });
      if (res.ok) {
        setGiftCodeTestResult({ ok: true, msg: 'Test gift code alert sent! Check your Discord channel.' });
      } else {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        const detail = typeof err.detail === 'string' ? err.detail : 'Unknown error';
        setGiftCodeTestResult({ ok: false, msg: `Failed: ${detail}`, steps: getFixSteps(detail) });
      }
    } catch {
      setGiftCodeTestResult({ ok: false, msg: 'Could not reach server.', steps: getFixSteps('503') });
    } finally { setTestingGiftCode(false); }
  };

  // ─── Auth Gates ─────────────────────────────────────────────────────────

  if (!user) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>Sign In Required</h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Sign in with your Atlas account to manage bot settings.</p>
        <Link to="/profile" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', backgroundColor: colors.primary, color: colors.bg, borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Sign In</Link>
      </div>
    </div>
  );

  if (!profile?.discord_id) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 450 }}>
        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🔗</span>
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>Link Your Discord</h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Link your Discord account in your profile first.</p>
        <Link to="/profile" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', backgroundColor: colors.discord, color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Go to Profile</Link>
      </div>
    </div>
  );

  if (!isSupporter && !isAdmin) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <img src="/AtlasBotAvatar.webp" alt="Atlas Bot" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem', display: 'block', border: '2px solid #FF6B8A30' }} />
        <h2 style={{ color: colors.text, fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
          <span style={{ color: '#fff' }}>BOT</span><span style={{ color: '#FF6B8A', marginLeft: '0.3rem' }}>DASHBOARD</span>
        </h2>
        <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.6 }}>The Bot Dashboard is available to Atlas Supporters.</p>
        <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem' }}>What you get:</div>
          {['Set up Alliance Event reminders for your server', 'Auto-post new gift codes to your Discord', 'Test messages before they go live', 'Manage multiple servers'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#FF6B8A', fontSize: '0.75rem' }}>✓</span>
              <span style={{ color: colors.textMuted, fontSize: '0.8rem' }}>{f}</span>
            </div>
          ))}
        </div>
        <Link to="/support" style={{ display: 'inline-block', padding: '0.7rem 1.5rem', background: 'linear-gradient(135deg, #FF6B8A 0%, #FF8FA3 100%)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>Become a Supporter →</Link>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'pulse 1.5s infinite' }}>⚙️</div>
        <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading dashboard...</p>
      </div>
    </div>
  );

  // ─── Setup View ─────────────────────────────────────────────────────────

  if (guilds.length === 0) return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      <div style={{ padding: mob ? '2rem 1rem 1rem' : '2.5rem 2rem 1.5rem', textAlign: 'center', background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)' }}>
        <img src="/AtlasBotAvatar.webp" alt="Atlas Bot" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem', display: 'block', border: '2px solid #22d3ee30' }} />
        <h1 style={{ fontSize: mob ? '1.5rem' : '2rem', fontWeight: 'bold', marginBottom: '0.5rem', fontFamily: FONT_DISPLAY }}>
          <span style={{ color: '#fff' }}>BOT</span><span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.4rem' }}>DASHBOARD</span>
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: mob ? '0.85rem' : '0.95rem', maxWidth: 500, margin: '0 auto' }}>Manage Alliance Event Reminders and Gift Codes.</p>
      </div>
      <div style={{ maxWidth: 550, margin: '2rem auto', padding: mob ? '0 1rem' : '0 2rem' }}>
        <div style={{ backgroundColor: colors.surface, borderRadius: 16, border: `1px solid ${colors.border}`, padding: mob ? '1.25rem' : '1.75rem' }}>
          <h2 style={{ color: colors.text, fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Select Your Server</h2>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Servers where <strong style={{ color: colors.text }}>Atlas Bot</strong> is present and you have <strong style={{ color: colors.text }}>Manage Server</strong> permission will appear below.
          </p>

          {discordGuilds.length === 0 && !fetchingGuilds && (
            <button onClick={fetchDiscordGuilds} disabled={fetchingGuilds}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: colors.primary, border: 'none', borderRadius: 8, color: colors.bg, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
              Detect My Servers
            </button>
          )}

          {fetchingGuilds && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }}>🔍</div>
              <p style={{ color: colors.textMuted, fontSize: '0.8rem' }}>Checking your Discord servers...</p>
            </div>
          )}

          {discordGuilds.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {discordGuilds.map(g => (
                <div key={g.guild_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#0f0f0f', borderRadius: 10, border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    {g.guild_icon ? <img src={g.guild_icon} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} /> : <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: colors.textMuted, flexShrink: 0 }}>{g.guild_name.charAt(0)}</div>}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: colors.text, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guild_name}</div>
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem', fontFamily: "'JetBrains Mono', monospace" }}>{g.guild_id}</div>
                    </div>
                  </div>
                  <button onClick={() => registerGuild(g)} disabled={registeringId === g.guild_id}
                    style={{ padding: '0.4rem 0.9rem', backgroundColor: colors.primary, border: 'none', borderRadius: 6, color: colors.bg, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {registeringId === g.guild_id ? '...' : 'Register'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {setupErr && <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: `${colors.error}15`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.8rem', marginTop: '0.75rem' }}>{setupErr}</div>}

          {discordGuilds.length > 0 && (
            <button onClick={fetchDiscordGuilds} disabled={fetchingGuilds}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textMuted, fontSize: '0.75rem', cursor: 'pointer' }}>
              ↻ Refresh List
            </button>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>← Back to Atlas Bot</Link>
        </div>
      </div>
    </div>
  );

  // ─── Dashboard View ─────────────────────────────────────────────────────

  const activeEv = events.filter(e => e.enabled && e.time_slots.length > 0).length;
  const tabs: { id: DashTab; label: string; icon: string }[] = [
    { id: 'notifications', label: 'Notifications', icon: '📣' },
    { id: 'roles', label: 'Roles', icon: '🏷️' },
    { id: 'servers', label: 'Servers', icon: '🖥️' },
    { id: 'access', label: 'Access', icon: '🔐' },
    { id: 'history', label: 'History', icon: '📋' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bg }}>
      {toast && <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, padding: '0.6rem 1.2rem', borderRadius: 8, backgroundColor: toast.ok ? colors.success : colors.error, color: '#fff', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ padding: mob ? '1.5rem 1rem 1rem' : '2rem 2rem 1.25rem', background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)', borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/AtlasBotAvatar.webp" alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #22d3ee30' }} />
            <div>
              <h1 style={{ fontSize: mob ? '1.1rem' : '1.35rem', fontWeight: 'bold', fontFamily: FONT_DISPLAY, margin: 0 }}>
                <span style={{ color: '#fff' }}>BOT</span><span style={{ ...neonGlow('#22d3ee'), marginLeft: '0.35rem' }}>DASHBOARD</span>
              </h1>
              {guilds.length > 1 ? (
                <select value={selGuild || ''} onChange={e => setSelGuild(e.target.value)} style={{ backgroundColor: 'transparent', border: 'none', color: colors.textMuted, fontSize: '0.75rem', outline: 'none', cursor: 'pointer', padding: 0 }}>
                  {guilds.map(g => <option key={g.guild_id} value={g.guild_id}>{g.guild_name}</option>)}
                </select>
              ) : <p style={{ color: colors.textMuted, fontSize: '0.75rem', margin: 0 }}>{guild?.guild_name}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {canMultiServer && (
              <button onClick={() => { setTab('servers'); fetchDiscordGuilds(); }} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.35rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: 'transparent' }}>+ Server</button>
            )}
            <button onClick={() => setShowLocal(!showLocal)} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.35rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: showLocal ? `${colors.primary}15` : 'transparent' }}>{showLocal ? '🕐 Local' : '🌐 UTC'}</button>
            <Link to="/atlas-bot" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.75rem', padding: '0.4rem 0.7rem', borderRadius: 6, border: `1px solid ${colors.border}` }}>← Bot</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: mob ? '1rem' : '1.5rem 2rem 2rem' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[
            { l: 'Active Reminders', v: String(activeEv), c: colors.success },
            { l: 'Configured', v: `${events.filter(e => e.time_slots.length > 0).length}/4`, c: colors.primary },
            { l: 'Gift Codes', v: guild?.gift_code_alerts ? 'ON' : 'OFF', c: guild?.gift_code_alerts ? colors.success : colors.textMuted },
            { l: 'Blocked', v: String(admins.filter(a => a.role === 'blocked').length), c: admins.some(a => a.role === 'blocked') ? colors.error : colors.textMuted },
          ].map(s => (
            <div key={s.l} style={{ backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ color: s.c, fontSize: '1.1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
              <div style={{ color: colors.textMuted, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: '0.2rem' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: `1px solid ${colors.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: mob ? '0.5rem 0.75rem' : '0.6rem 1rem', backgroundColor: tab === t.id ? colors.surface : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.id ? colors.primary : 'transparent'}`, color: tab === t.id ? colors.text : colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Notifications Tab */}
        {tab === 'notifications' && guild && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>NOTIFICATION</span><span style={{ ...neonGlow(colors.primary), marginLeft: '0.3rem' }}>CENTER</span>
              </h2>
              <span style={{ color: colors.textMuted, fontSize: '0.7rem' }}>Auto-saves</span>
            </div>

            {/* Default Reminder Channel */}
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
              <label style={lS}>DEFAULT REMINDER CHANNEL</label>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem', marginTop: 0 }}>All alerts and reminders go here unless overridden individually.</p>
              {dChannels.length > 0 || loadingDiscord ? (
                <SearchableSelect value={guild.reminder_channel_id} onChange={v => upGuild({ reminder_channel_id: v })} options={dChannels.map(c => ({ id: c.id, name: c.name, category: '' }))} placeholder="Select a channel" loading={loadingDiscord} />
              ) : (
                <input type="text" value={guild.reminder_channel_id || ''} onChange={e => upGuild({ reminder_channel_id: e.target.value || null })} placeholder="Channel ID" style={iS} />
              )}
            </div>

            {/* 🚨 Alerts Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ color: colors.text, fontSize: mob ? '0.9rem' : '0.95rem', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🚨 Alerts
              </h3>

              {/* Gift Code Alerts — pill toggle style like EvCard */}
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${guild.gift_code_alerts ? `${colors.success}30` : colors.border}`, transition: 'border-color 0.2s' }}>
                <div onClick={() => setGiftCodeOpen(!giftCodeOpen)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mob ? '0.85rem' : '1rem 1.25rem', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: mob ? '1.25rem' : '1.5rem' }}>🎁</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ color: colors.text, fontWeight: 700, fontSize: mob ? '0.9rem' : '0.95rem' }}>Gift Codes</span>
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '0.15rem' }}>Auto-post new gift codes to your server</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Dot on={guild.gift_code_alerts} />
                    <Tog on={guild.gift_code_alerts} set={v => upGuild({ gift_code_alerts: v })} c={colors.success} />
                    <span style={{ color: colors.textMuted, fontSize: '0.8rem', transition: 'transform 0.2s', transform: giftCodeOpen ? 'rotate(180deg)' : '' }}>▼</span>
                  </div>
                </div>
                {giftCodeOpen && (
                  <div style={{ padding: mob ? '0 0.85rem 0.85rem' : '0 1.25rem 1.25rem', borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '1rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={lS}>GIFT CODE CHANNEL <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional override)</span></label>
                      {dChannels.length > 0 || loadingDiscord ? (
                        <SearchableSelect value={guild.gift_code_channel_id} onChange={v => upGuild({ gift_code_channel_id: v })} options={dChannels.map(c => ({ id: c.id, name: c.name, category: '' }))} placeholder="Uses default channel" loading={loadingDiscord} accentColor={colors.success} />
                      ) : (
                        <input type="text" value={guild.gift_code_channel_id || ''} onChange={e => upGuild({ gift_code_channel_id: e.target.value || null })} placeholder="Uses default channel" style={iS} />
                      )}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={lS}>ROLE TO MENTION <span style={{ fontWeight: 400, color: colors.textMuted }}>(optional)</span></label>
                      {dRoles.length > 0 || loadingDiscord ? (
                        <SearchableSelect value={guild.gift_code_role_id} onChange={v => upGuild({ gift_code_role_id: v })} options={[...(guild.guild_id ? [{ id: guild.guild_id, name: '@everyone', color: 0 }] : []), ...dRoles.map(r => ({ id: r.id, name: r.name, color: r.color }))]} placeholder="No role mention" loading={loadingDiscord} accentColor={colors.success} />
                      ) : (
                        <input type="text" value={guild.gift_code_role_id || ''} onChange={e => upGuild({ gift_code_role_id: e.target.value || null })} placeholder="Role ID (optional)" style={iS} />
                      )}
                    </div>
                    <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: '0.75rem' }}>
                      <button onClick={sendTestGiftCode} disabled={testingGiftCode || !(guild.gift_code_channel_id || guild.reminder_channel_id)}
                        style={{ padding: '0.5rem 1rem', backgroundColor: testingGiftCode ? colors.border : `${colors.success}20`, border: `1px solid ${colors.success}40`, borderRadius: 8, color: testingGiftCode ? colors.textMuted : colors.success, fontSize: '0.8rem', fontWeight: 600, cursor: testingGiftCode || !(guild.gift_code_channel_id || guild.reminder_channel_id) ? 'default' : 'pointer', width: '100%' }}>
                        {testingGiftCode ? '⏳ Sending...' : '🧪 Send Test Gift Code Alert'}
                      </button>
                      {!(guild.gift_code_channel_id || guild.reminder_channel_id) && <div style={{ color: colors.textMuted, fontSize: '0.65rem', marginTop: '0.3rem' }}>Set a reminder channel first.</div>}
                      {giftCodeTestResult && (
                        <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: 8, backgroundColor: giftCodeTestResult.ok ? `${colors.success}10` : `${colors.error}10`, border: `1px solid ${giftCodeTestResult.ok ? colors.success : colors.error}30` }}>
                          <div style={{ color: giftCodeTestResult.ok ? colors.success : colors.error, fontSize: '0.8rem', fontWeight: 600 }}>{giftCodeTestResult.ok ? '✅' : '❌'} {giftCodeTestResult.msg}</div>
                          {giftCodeTestResult.steps && giftCodeTestResult.steps.length > 0 && (
                            <div style={{ marginTop: '0.4rem' }}>
                              <div style={{ color: colors.textSecondary, fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.2rem' }}>How to fix:</div>
                              {giftCodeTestResult.steps.map((s, i) => <div key={i} style={{ color: colors.textMuted, fontSize: '0.7rem', paddingLeft: '0.5rem' }}>{i + 1}. {s}</div>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 🗓️ Alliance Events Section */}
            <div>
              <h3 style={{ color: colors.text, fontSize: mob ? '0.9rem' : '0.95rem', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🗓️ Reminders
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sortedEvents.map(ev => <EvCard key={ev.id} ev={ev} onUp={u => upEv(ev.id, u)} mob={mob} local={showLocal} channels={dChannels} roles={dRoles} categories={dCategories} loadingDiscord={loadingDiscord} guildChannelId={guild?.reminder_channel_id || null} guildId={guild?.guild_id || null} onTest={sendTestEvent} testing={testingEvent === ev.id} testResult={testResults[ev.id] || null} />)}
                {events.length === 0 && <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>No events configured. Try refreshing.</div>}
              </div>
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {tab === 'roles' && guild && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>REACTION</span><span style={{ ...neonGlow('#a855f7'), marginLeft: '0.3rem' }}>ROLES</span>
              </h2>
              <button onClick={createRr} disabled={rrSaving} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#a855f715', border: '1px solid #a855f740', borderRadius: 8, color: '#a855f7', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                {rrSaving ? '...' : '+ New Role Assigner'}
              </button>
            </div>

            {/* Setup Instructions */}
            <div style={{ backgroundColor: '#a855f708', borderRadius: 12, border: '1px solid #a855f720', padding: mob ? '0.85rem' : '1rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ color: '#a855f7', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>📋 Setup Guide</div>
              <div style={{ color: colors.textMuted, fontSize: '0.72rem', lineHeight: 1.6 }}>
                <div style={{ marginBottom: '0.3rem' }}><strong style={{ color: colors.text }}>1.</strong> Create a role assigner below and pick a channel.</div>
                <div style={{ marginBottom: '0.3rem' }}><strong style={{ color: colors.text }}>2.</strong> Customize the title, message, and add emoji → role mappings.</div>
                <div style={{ marginBottom: '0.3rem' }}><strong style={{ color: colors.text }}>3.</strong> Click <strong style={{ color: '#a855f7' }}>Deploy</strong> — Atlas Bot will post the message and add reactions.</div>
                <div style={{ marginBottom: '0.3rem' }}><strong style={{ color: colors.text }}>4.</strong> When users react, they get the role. When they remove the reaction, the role is removed.</div>
                <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', backgroundColor: '#f59e0b10', border: '1px solid #f59e0b25', borderRadius: 6 }}>
                  <span style={{ color: '#f59e0b', fontSize: '0.68rem' }}>⚠️ <strong>Important:</strong> Atlas Bot's role must be <em>above</em> the roles it assigns in Server Settings → Roles. Otherwise Discord will block the assignment.</span>
                </div>
              </div>
            </div>

            {rrConfigs.length === 0 && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>
                No role assigners yet. Click "+ New Role Assigner" to create one.
              </div>
            )}

            {rrConfigs.map(cfg => (
              <RoleAssignerCard key={cfg.id} cfg={cfg} mob={mob} dChannels={dChannels} dRoles={dRoles} loadingDiscord={loadingDiscord}
                onUpdate={(u: Partial<ReactionRoleConfig>) => updateRr(cfg.id, u)} onDelete={() => { if (confirm('Delete this role assigner?')) deleteRr(cfg.id); }}
                onDeploy={() => deployRr(cfg)} onEdit={() => editRr(cfg)} onCopy={() => copyRr(cfg)}
                deploying={rrDeploying === cfg.id} rrError={rrErrorId === cfg.id ? rrError : ''} />
            ))}
          </div>
        )}

        {/* Servers Tab */}
        {tab === 'servers' && guild && (
          <div>
            <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>CONNECTED</span><span style={{ ...neonGlow(colors.primary), marginLeft: '0.3rem' }}>SERVERS</span>
            </h2>

            {/* Server list — tap to switch */}
            <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1.25rem' }}>
              <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.75rem', marginTop: 0 }}>Tap a server to switch. Remove to disconnect completely.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {guilds.map(g => (
                  <div key={g.guild_id}
                    onClick={() => setSelGuild(g.guild_id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', backgroundColor: g.guild_id === selGuild ? `${colors.primary}08` : '#0f0f0f', borderRadius: 8, border: `1px solid ${g.guild_id === selGuild ? colors.primary + '30' : colors.border}`, cursor: 'pointer', transition: 'border-color 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      {g.guild_icon_url ? <img src={g.guild_icon_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: colors.textMuted, flexShrink: 0 }}>{g.guild_name.charAt(0)}</div>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guild_name}</div>
                        <div style={{ color: g.guild_id === selGuild ? colors.primary : colors.textMuted, fontSize: '0.6rem' }}>{g.guild_id === selGuild ? '● Currently viewing' : g.guild_id}</div>
                      </div>
                    </div>
                    {g.created_by === user?.id && (
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${g.guild_name}? This deletes all events, settings, and history for this server.`)) removeGuild(g.guild_id); }}
                        disabled={removingGuild === g.guild_id}
                        style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.error}40`, borderRadius: 6, color: colors.error, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {removingGuild === g.guild_id ? '...' : '✕ Remove'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Add Server */}
            {canMultiServer && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1.25rem' }}>
                <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem' }}>+ Add a Server</h3>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.75rem' }}>As a Supporter, you can manage bot settings for multiple Discord servers.</p>

                {discordGuilds.length === 0 && !fetchingGuilds && (
                  <button onClick={fetchDiscordGuilds} style={{ padding: '0.5rem 1rem', backgroundColor: colors.primary, border: 'none', borderRadius: 8, color: colors.bg, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                    Detect More Servers
                  </button>
                )}

                {fetchingGuilds && <p style={{ color: colors.textMuted, fontSize: '0.75rem' }}>🔍 Checking your Discord servers...</p>}

                {discordGuilds.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {discordGuilds.filter(dg => !guilds.some(g => g.guild_id === dg.guild_id)).map(g => (
                      <div key={g.guild_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem', backgroundColor: '#0f0f0f', borderRadius: 8, border: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          {g.guild_icon ? <img src={g.guild_icon} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: colors.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: colors.textMuted, flexShrink: 0 }}>{g.guild_name.charAt(0)}</div>}
                          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guild_name}</span>
                        </div>
                        <button onClick={() => registerGuild(g)} disabled={registeringId === g.guild_id}
                          style={{ padding: '0.3rem 0.7rem', backgroundColor: colors.primary, border: 'none', borderRadius: 6, color: colors.bg, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {registeringId === g.guild_id ? '...' : '+ Add'}
                        </button>
                      </div>
                    ))}
                    {discordGuilds.filter(dg => !guilds.some(g => g.guild_id === dg.guild_id)).length === 0 && (
                      <p style={{ color: colors.textMuted, fontSize: '0.75rem' }}>All available servers are already registered.</p>
                    )}
                  </div>
                )}

                {setupErr && <div style={{ padding: '0.5rem 0.7rem', borderRadius: 6, backgroundColor: `${colors.error}15`, border: `1px solid ${colors.error}30`, color: colors.error, fontSize: '0.75rem', marginTop: '0.5rem' }}>{setupErr}</div>}
              </div>
            )}

            {!canMultiServer && guilds.length >= 1 && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid #FF6B8A20`, padding: mob ? '1rem' : '1.25rem' }}>
                <h3 style={{ color: colors.text, fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem' }}>🌐 Multiple Servers</h3>
                <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginBottom: '0.5rem' }}>Manage bot settings across multiple Discord servers.</p>
                <Link to="/support" style={{ color: '#FF6B8A', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>Become a Supporter →</Link>
              </div>
            )}
          </div>
        )}

        {/* Access Control Tab */}
        {tab === 'access' && guild && (
          <div>
            <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: FONT_DISPLAY }}>
              <span style={{ color: '#fff' }}>ACCESS</span><span style={{ ...neonGlow('#a855f7'), marginLeft: '0.3rem' }}>CONTROL</span>
            </h2>
            <div style={{ backgroundColor: `${colors.primary}08`, borderRadius: 10, border: `1px solid ${colors.primary}20`, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>🔓 Who can access this dashboard?</div>
              <div style={{ color: colors.textMuted, fontSize: '0.75rem', lineHeight: 1.5 }}>
                Anyone with <strong style={{ color: colors.text }}>Manage Server</strong> permission in your Discord server can access this dashboard — no setup needed. The server owner can block specific users below.
              </div>
            </div>
            {guild.created_by === user?.id && (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: mob ? '1rem' : '1.25rem', marginBottom: '1rem' }}>
                <label style={lS}>BLOCK A USER</label>
                <p style={{ color: colors.textMuted, fontSize: '0.7rem', marginBottom: '0.5rem' }}>Blocked users cannot access this server's dashboard even if they have Manage Server permission.</p>
                <div ref={blockSearchRef} style={{ position: 'relative', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input type="text" value={blockInput} onChange={e => { setBlockInput(e.target.value); setBlockSearchOpen(true); searchBlockUsers(e.target.value); }}
                      onFocus={() => { if (blockInput.length >= 2) setBlockSearchOpen(true); }}
                      onKeyDown={e => { if (e.key === 'Enter') blockUser(); }} placeholder="Discord username" style={iS} />
                    {blockSearchOpen && blockSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, backgroundColor: '#1a1a1a', border: `1px solid ${colors.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', maxHeight: 180, overflowY: 'auto' }}>
                        {blockSuggestions.map(s => (
                          <button key={s.id} onClick={() => { blockUser(s.id); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.45rem 0.6rem', border: 'none', borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: 'transparent', color: colors.text, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>
                            <span style={{ fontSize: '0.85rem' }}>🎮</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{s.discord_username}</div>
                              <div style={{ color: colors.textMuted, fontSize: '0.65rem' }}>Atlas: {s.username}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => blockUser()} disabled={!blockInput.trim() || blockingUser} style={{ padding: '0.5rem 1rem', backgroundColor: blockInput.trim() ? colors.error : colors.border, border: 'none', borderRadius: 8, color: blockInput.trim() ? '#fff' : colors.textMuted, fontSize: '0.8rem', fontWeight: 600, cursor: blockInput.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>{blockingUser ? '...' : '🚫 Block'}</button>
                </div>
              </div>
            )}
            {admins.filter(a => a.role === 'blocked').length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={lS}>BLOCKED USERS</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {admins.filter(a => a.role === 'blocked').map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.error}20`, padding: '0.65rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>�</span>
                        <div><div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{a.username}</div><div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>Blocked • {ago(a.created_at)}</div></div>
                      </div>
                      {guild.created_by === user?.id && (
                        <button onClick={() => unblockUser(a.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid ${colors.success}40`, borderRadius: 6, color: colors.success, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Unblock</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ backgroundColor: colors.surface, borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0.85rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>👑</span>
                <div><div style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>Server Owner</div><div style={{ color: colors.textMuted, fontSize: '0.6rem' }}>{admins.find(a => a.role === 'owner')?.username || 'You'}</div></div>
              </div>
              <div style={{ color: colors.textMuted, fontSize: '0.7rem', lineHeight: 1.4 }}>The owner who registered this server. Only the owner can block/unblock users and remove the server.</div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ color: colors.text, fontSize: mob ? '1rem' : '1.1rem', fontWeight: 700, margin: 0, fontFamily: FONT_DISPLAY }}>
                <span style={{ color: '#fff' }}>REMINDER</span><span style={{ ...neonGlow(colors.success), marginLeft: '0.3rem' }}>HISTORY</span>
              </h2>
              <button onClick={() => { if (selGuild) loadHist(selGuild); }} style={{ color: colors.textMuted, fontSize: '0.7rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: `1px solid ${colors.border}`, cursor: 'pointer', backgroundColor: 'transparent' }}>↻ Refresh</button>
            </div>
            {hist.length === 0 ? (
              <div style={{ backgroundColor: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, padding: '2rem', textAlign: 'center', color: colors.textMuted, fontSize: '0.85rem' }}>No reminders sent yet. History appears after the first reminder fires.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {hist.map(h => {
                  const em = EVENT_META[h.event_type as EventType];
                  return (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0.6rem 0.85rem' }}>
                      <span style={{ fontSize: '1rem' }}>{em?.icon || '📢'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ color: colors.text, fontSize: '0.8rem', fontWeight: 600 }}>{em?.label || h.event_type}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '0.05rem 0.35rem', borderRadius: 3, backgroundColor: h.status === 'sent' ? `${colors.success}20` : `${colors.error}20`, color: h.status === 'sent' ? colors.success : colors.error }}>{h.status}</span>
                          {h.time_slot && <span style={{ color: colors.textMuted, fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(h.time_slot)} UTC</span>}
                        </div>
                        {h.error_message && <div style={{ color: colors.error, fontSize: '0.65rem', marginTop: '0.1rem' }}>{h.error_message}</div>}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: '0.65rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{ago(h.sent_at)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '1.5rem', paddingBottom: '1rem' }}>
          <Link to="/atlas-bot" style={{ color: colors.primary, textDecoration: 'none', fontSize: '0.8rem' }}>← Atlas Bot</Link>
          <Link to="/tools" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>All Tools</Link>
          <Link to="/" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: '0.8rem' }}>Home</Link>
        </div>
      </div>
    </div>
  );
};

export default BotDashboard;
