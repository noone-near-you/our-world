import type { Sfx } from '../audio/audio';
import type { Opt, Game } from '../state/store';
// ====================== YOUR STORY. Edit the words freely. ======================
// A node plays its `steps` in order, then shows her `options` (each option jumps to another node by id).
//   "text"            he says it (typed out in his bubble, tap to continue)
//   { thought }       his inner thought (soft bubble, moves on by itself)
//   { act: 'kiss' }   plays that animation right at this moment: 'hug' | 'kiss' | 'tease' | 'slap'
//   { sfx }, { gf: 'enter' }, { tod: 'night' | 'day' }, { wait: ms }
//   { lamp: true|false }   table lamp on / off          { pose: 'bed' | 'sit' }   both lie down under the blanket / sit up again
//   { sleepy: 0..1 }       0 awake, 0.5 drowsy, 1 asleep { skip: 'text' }          fade out, show the text, fade back in (time skip)
//   { scene: true|false }  lock the side buttons + lamp button while a scripted scene runs
//   { dress: 'beach', caption }   fade out, change both outfits, show the text, fade in      { go: 'beach' }   travel to a world (no arrive_ node)
//   { tone: 'soft' | 'tease' }   how he talks later (use with route: g => g.tone === 'tease' ? 'node_t' : undefined)
//   route: (game) => id    optional: jump to another node instead (e.g. not in the bedroom)
// `then: 'id'` continues straight into another node with no choice in between.
export type Act = 'hug' | 'kiss' | 'tease' | 'slap' | 'flower';
export type Step = string | { thought: string } | { act: Act } | { sfx: Sfx } | { gf: 'enter' } | { tod: 'morning' | 'afternoon' | 'evening' | 'night' } | { wait: number }
  | { lamp: boolean } | { pose: Game['pose'] } | { sleepy: number } | { skip: string; ms?: number; intimate?: boolean } | { scene: boolean }
  | { dress: 'casual' | 'beach' | 'swim'; caption?: string; pose?: Game['pose'] } | { set: Partial<Game> } | { go: string } | { tone: 'soft' | 'tease' };
export interface Node { steps: Step[]; options?: Opt[]; then?: string; route?: (g: Game) => string | undefined }

export const nodes: Record<string, Node> = {
  start: { route: g =>
    g.tod === 'morning' ? 'start_morning' :
    g.tod === 'evening' ? 'start_evening' :
    g.tod === 'night' ? 'start_night' :
    'start_afternoon',
    steps: [] },

  start_morning: { steps: [
    { thought: "Morning light on the floor…" },
    { thought: "She’s still getting ready. I can hear her somewhere." },
    { thought: "I already miss her voice and the day barely started." } ], then: 'start_enter' },

  start_afternoon: { steps: [
    { thought: "She’s taking long again…" },
    { thought: "I keep thinking about her scent." },
    { thought: "The way she looks when she smile" },
    { thought: "Those beautiful rosy cheeks with melodious dimples." },
    { thought: "I want to hold her in my arms." } ], then: 'start_enter' },

  start_evening: { steps: [
    { thought: "Evening already… beautiful sky outside." },
    { thought: "I want her head on my shoulder before the light goes..." },
    { thought: "And a kiss on my lips from her." },
    { thought: "Come on… I’ve been waiting all day for this part." } ], then: 'start_enter' },

  start_night: { steps: [
    { thought: "It’s so late. Stars blinking like they're telling me about her." },
    { thought: "The whole house is quiet except my dreams about her." },
    { thought: "I hope she walks in soon. Nights feel longer without her." } ], then: 'start_enter' },

  // she walks in (also used after lonely world-hopping)
  start_enter: { route: g =>
    g.tod === 'morning' ? 'start_enter_morning' :
    g.tod === 'evening' ? 'start_enter_evening' :
    g.tod === 'night' ? 'start_enter_night' :
    'start_enter_afternoon',
    steps: [] },

  start_enter_morning: { steps: [
    { sfx: 'step' }, { wait: 500 }, { gf: 'enter' },
    "Good morning…", { sfx: 'heh' },
    "You’re finally here.", "I missed you. Now, The day feels better." ],
    options: [
      { label: "“Morning… I missed you.”", next: 'soft' },
      { label: "“You’re up early for me?”", next: 'flirt' },
      { label: "“Hold me a little.”", next: 'soft' } ] },

  start_enter_afternoon: { steps: [
    { sfx: 'step' }, { wait: 500 }, { gf: 'enter' },
    "You’re finally here.", { sfx: 'chuckle' }, "Come here." ],
    options: [
      { label: "“I was just… thinking about you.”", next: 'soft' },
      { label: "“Missed me that much already?”", next: 'flirt' },
      { label: "“I’m tired… hold me.”", next: 'soft' } ] },

  start_enter_evening: { steps: [
    { sfx: 'step' }, { wait: 500 }, { gf: 'enter' },
    "There you are…", { sfx: 'uhh' },
    "Did you see? Sky is stealing the color of your cheeks.",
    "Come here babe." ],
    options: [
      { label: "“I like evenings with you.”", next: 'soft' },
      { label: "“You were waiting?”", next: 'flirt' },
      { label: "“Hold me.”", next: 'soft' } ] },

  start_enter_night: { steps: [
    { sfx: 'step' }, { wait: 500 }, { gf: 'enter' },
    "Hey…", { sfx: 'heh' },
    "It’s late. I was hoping you’d still come.",
    "Come here princess. Closer." ],
    options: [
      { label: "“I couldn’t sleep without you.”", next: 'soft' },
      { label: "“Missed me that much?”", next: 'flirt' },
      { label: "“I’m tired… hug me.”", next: 'soft' } ] },

  // back to bedroom while still waiting for her
  solo_back_bedroom: { steps: [
    { thought: "Back here…" },
    { thought: "The bed still smells like her pillow." },
    { thought: "I’m nothing without her. I don’t even know how much I love her until the room is this quiet." },
    { sfx: 'breath' },
    { thought: "Please babe… just come in." } ], then: 'start_enter' },


  soft: { steps: ["Come sit.", "I was thinking about your face the whole time.", "Especially your lips.", "They look soft today."],
    options: [ { label: "“Kiss me then.”", next: 'kiss1' }, { label: "“You’re staring again.”", next: 'soft_tease' }, { label: "“Tell me how your day was.”", next: 'day' } ] },
  soft_tease: { steps: [{ sfx: 'heh' }, "Guilty.", { sfx: 'shy' }, "Can you blame me?"],
    options: [ { label: "“Then kiss me.”", next: 'kiss1' }, { label: "“Tell me how your day was.”", next: 'day' } ] },

  kiss1: { steps: [{ sfx: 'hmm' }, "Come closer.", "I love when you ask for it like that.", { act: 'kiss' }, "Mmm… still the best thing in this room.", { sfx: 'mm' }, "I love you."],
    options: [ { label: "“I love you baby.”", next: 'love_back' }, { label: "“Okay.”", next: 'okay' }, { label: "“Again.”", next: 'kiss2' } ] },
  love_back: { steps: [{ sfx: 'chuckle' }, "I love you more.", "Don’t argue, you’ll lose."], then: 'day' },
  okay: { steps: [{ sfx: 'agree' }, "…Okay. Your usual short reply.", "I know what that “okay” really means."], then: 'day' },
  kiss2: { steps: ["Again? Greedy.", { sfx: 'chuckle' }, "…I’m not complaining.", { act: 'kiss' }, { sfx: 'heh' }, "Okay. That one was for me."], then: 'day' },

  day: { steps: ["With you, my day always become spicy.",{sfx: 'boylaugh'}, "How was your day?", { sfx: 'breath' }, "You look a little quiet.", "Everything okay?"],
    options: [ { label: "“A bit stressed… just need you.”", next: 'comfort' }, { label: "“It was okay. I kept thinking about tasting you.”", next: 'think_kiss' }, { label: "“I’m fine. You look cute today.”", next: 'cute' } ] },
  comfort: { steps: [{ sfx: 'heh' }, "Come here.", "Lie on me.", "You don’t have to carry it alone.", "I’m right here.", { act: 'hug' }, { sfx: 'uhh' }], then: 'where' },
  think_kiss: { steps: ["Oh, so we were thinking the same thing.", { sfx: 'heh' }, "Come here girl.", { act: 'kiss' }, "Better?"], then: 'where' },
  cute: { steps: ["Cute? …Say that again.", { sfx: 'shy' }, "I’m blushing. Don’t look at me."], then: 'where' },

  where: { route: g => g.tod === 'night' ? 'where_night' : undefined,
    steps: ["Want to stay in bed with me?", "Or should we go somewhere else for a bit?"],
    options: [ { label: "“Stay here… under the blanket with me.”", next: 'cuddle' },
      { label: "“I’m hungry… let’s cook something together.”", world: 'kitchen' },
      { label: "“Let’s go outside somewhere.”", next: 'out_ask' },
      { label: "“I feel sticky… shower with me?”", next: 'shower_plan' },
      { label: "“Take me back to the bedroom.”", world: 'bedroom' } ] },

  where_night: { steps: [
    "It’s late…",
    "Outside can wait until tomorrow.",
    "Want to stay in with me? Kitchen, shower… or just this bed." ],
    options: [
      { label: "“Stay here under the blanket.”", next: 'cuddle' },
      { label: "“I’m hungry… kitchen?”", world: 'kitchen' },
      { label: "“Shower with me.”", next: 'shower_plan' },
      { label: "“I still want to go outside.”", next: 'out_night' } ] },

  where2: { steps: ["Where to?"], options: [
    { label: "“The kitchen… I’m getting hungry.”", world: 'kitchen' },
    { label: "“The beach.”", next: 'beach_plan' },
    { label: "“The pool.”", next: 'pool_plan' },
    { label: "“The shower.”", next: 'shower_plan' },
    { label: "“Let’s go outside somewhere.”", next: 'out_ask' },
    { label: "“Back to the bedroom.”", world: 'bedroom' } ] },
  // arrival lines for each world: edit freely

  // ===== ALONE (she hasn't arrived yet) — per world missing thoughts =====
  solo_alone_kitchen: { steps: [
    { thought: "Empty kitchen…" },
    { thought: "I can almost hear her laughing while we cook." },
    { thought: "Even the fridge light feels lonely without her leaning on me." },
    { sfx: 'breath' },
    { thought: "I’m nothing without her. How did I get this soft?" },
    "She’s still not here." ],
    options: [
      { label: "(Keep waiting here)", next: 'solo_alone_kitchen' },
      { label: "(Go back to the bedroom)", world: 'bedroom' },
      { label: "(Check the garden)", world: 'garden' },
      { label: "(Check outside)", world: 'beach' } ] },

  solo_alone_garden: { steps: [
    { thought: "The garden is quiet…" },
    { thought: "Her plants look fine. Still — even they make me miss her more." },
    { thought: "I want to tuck a flower in her hair again." },
    { sfx: 'shy' },
    { thought: "I don’t know how much I love her until places like this feel half-finished." },
    "She’s still not here." ],
    options: [
      { label: "(Stay a bit longer)", next: 'solo_alone_garden' },
      { label: "(Back to the bedroom)", world: 'bedroom' },
      { label: "(Kitchen)", world: 'kitchen' },
      { label: "(Beach)", world: 'beach' } ] },

  solo_alone_beach: { steps: [
    { thought: "Waves… and no one to share them with." },
    { thought: "I keep imagining her hair in the wind." },
    { thought: "The ocean is huge and I still only want her." },
    { sfx: 'breath' },
    { thought: "I’m nothing without her. Ridiculous. True." },
    "She’s still not here." ],
    options: [
      { label: "(Watch the water)", next: 'solo_alone_beach' },
      { label: "(Back to the bedroom)", world: 'bedroom' },
      { label: "(Pool)", world: 'pool' },
      { label: "(Garden)", world: 'garden' } ] },

  solo_alone_pool: { steps: [
    { thought: "Blue water. Empty loungers." },
    { thought: "I wanted her next to mine on that chair." },
    { thought: "Even the sunlight feels like it’s waiting for her." },
    { sfx: 'hm' },
    { thought: "I miss her more than I say out loud." },
    "She’s still not here." ],
    options: [
      { label: "(Sit alone a little)", next: 'solo_alone_pool' },
      { label: "(Back to the bedroom)", world: 'bedroom' },
      { label: "(Beach)", world: 'beach' },
      { label: "(Shower)", world: 'shower' } ] },

  solo_alone_shower: { steps: [
    { thought: "Steam without her feels pointless." },
    { thought: "I keep seeing her silhouette on the glass in my head." },
    { thought: "I’d trade every warm drop just to hear her step in." },
    { sfx: 'breath' },
    { thought: "I’m nothing without her. Come on… where are you girl?" },
    "She’s still not here." ],
    options: [
      { label: "(Wait a little more)", next: 'solo_alone_shower' },
      { label: "(Back to the bedroom)", world: 'bedroom' },
      { label: "(Kitchen)", world: 'kitchen' },
      { label: "(Garden)", world: 'garden' } ] },

  // ===== SURPRISE: she appears in another world first (random) =====
  solo_found_kitchen: { steps: [
    { sfx: 'step' }, { wait: 400 }, { gf: 'enter' },
    { sfx: 'shy' }, "Oh…",
    "You’re here.",
    { sfx: 'chuckle' },
    "I was just thinking the kitchen felt empty without you.",
    "You walked in and my whole chest went soft.",
    { sfx: 'chuckle' },
    "Missed me enough to find me at the counter, huh?" ], then: 'arrive_kitchen' },

  solo_found_garden: { steps: [
    { sfx: 'step' }, { wait: 400 }, { gf: 'enter' },
    { sfx: 'shy' }, "Oh—",
    "You’re here.",
    { sfx: 'uhh' },
    "I was missing you so hard even the plants started looking lonely.",
    "Then you show up like the princess of this garden.",
    { sfx: 'heh' },
    "Come here. Before I put a flower in your hair without asking." ], then: 'arrive_garden' },

  solo_found_beach: { steps: [
    { sfx: 'step' }, { wait: 400 }, { gf: 'enter' },
    { sfx: 'shy' }, "Oh… you’re here.",
    { sfx: 'heh' },
    "I was staring at the water like an idiot, thinking about your lips.",
    "Now the ocean can shut up. You’re louder in my head anyway.",
    { sfx: 'chuckle' },
    "Come stand with me. I missed you more than the waves." ], then: 'arrive_beach' },

  solo_found_pool: { steps: [
    { sfx: 'step' }, { wait: 400 }, { gf: 'enter' },
    { sfx: 'shy' }, "Oh—",
    "You’re here.",
    { sfx: 'hmm' },
    "I almost convinced myself you forgot about me.",
    "Then you walk onto my deck like you own every soft thought I have.",
    { sfx: 'heh' },
    "Don’t smile like that. I’ll start teasing you already." ], then: 'arrive_pool' },

  solo_found_shower: { steps: [
    { sfx: 'step' }, { wait: 400 }, { gf: 'enter' },
    { sfx: 'shy' }, "Oh…",
    "You’re here.",
    { sfx: 'chuckle' },
    "I was standing here missing you so much the glass felt colder.",
    "Now look at you. Walking in like you knew I’d fall apart a little.",
    { sfx: 'breath' },
    "Come closer. Before I say something dangerously soft." ], then: 'arrive_shower' },

  arrive_kitchen: { steps: [
    { thought: "Uhh damn, She's so close in." },
    { sfx: 'heh' }, "Come here.",
    "I’m hungry… but more for you than food.",
    "Still, let’s make something nice together." ],
    options: [
      { label: "“What should we cook?”", next: 'k_choose' },
      { label: "“You cook, I’ll watch.”", next: 'k_choose' },
      { label: "“Feed me first.”", next: 'k_feedfirst' } ] },
  k_feedfirst: { steps: [
    "Impatient, huh?",
    "Okay… one kiss first, then we cook.",
    { act: 'kiss' },
    "Mmm. Now I’m even hungrier.",
    "Come stand next to me. You choose what we make." ], then: 'k_choose' },
  k_choose: { steps: [
    "You choose.",
    "I’ll make whatever you want.",
    "Just stay close while I cook." ],
    options: [
      { label: "“Rajma and rice.”", next: 'k_cook' },
      { label: "“Simple dal and roti.”", next: 'k_cook' },
      { label: "“Vegetable pulao and raita.”", next: 'k_cook' },
      { label: "“Pasta with white sauce.”", next: 'k_cook' },
      { label: "“Something quick… grilled sandwich?”", next: 'k_cook' } ] },
  k_cook: { steps: [
    { set: { steam: true } },
    "Okay…",
    "That it is.",
    "Come stand next to me.",
    // chopping first
    { sfx: 'chop' },
    { thought: "Uhh, Is it the onion or her presence making me cry?" },
    "I like when you’re this close while I cook.",
    // then the pan / cooking sound
    { sfx: 'cooking' },
    { thought: "Damn, Even smell of steam mixing with her scent." },
    "Your presence makes even ordinary food feel special.",
    "Like the kitchen suddenly became heaven." ],
    options: [
      { label: "“Kiss me while you cook.”", next: 'k_kiss' },
      { label: "“Let me help.”", next: 'k_help' },
      { label: "“You’re cute when you cook.”", next: 'k_cute' } ] },
  k_kiss: { steps: [
    { act: 'kiss' },
    "Mmm…",
    "Now the food will taste even better.",
    "You always distract me." ],
    options: [
      { label: "“Again.”", next: 'k_kiss2' },
      { label: "“Focus on cooking.”", next: 'k_taste' },
      { label: "“I like distracting you.”", next: 'k_distract' } ] },
  k_kiss2: { steps: [
    "Greedy.",
    { act: 'kiss' },
    { sfx: 'chuckle' }, "Okay. One more… then I really need to finish this." ], then: 'k_taste' },
  k_distract: { steps: [
    "I noticed.",
    "You’re standing too close.",
    "I might burn the food because of you." ],
    options: [
      { label: "“Then burn it.”", next: 'k_burn' },
      { label: "“I’ll move… if you let me.”", next: 'k_move' },
      { label: "“I'll tease you more.”", next: 'k_slap' } ] },
  k_burn: { steps: ["Ha. Don’t tempt me.", "Stay. I’ll risk it."], then: 'k_taste' },
  k_move: { steps: ["Not a chance.", "Stay right here."], then: 'k_taste' },
  k_slap: { steps: [
    { act: 'slap' },
    { sfx: 'heh' }, "There.",
    "Now behave…",
    "or don’t.",
    "I kind of like when you don’t." ], then: 'k_taste' },
  k_help: { steps: [
    { sfx: 'uhh' }, "Okay. Hands here.",
    "Stir slowly… like that.",
    "You’re better at this than you think.",
    "Or maybe I just like watching you try." ], then: 'k_taste' },
  k_cute: { steps: [
    "Cute?",
    "I’m just trying not to mess up while you’re this close.",
    "You’re the distracting one." ], then: 'k_taste' },
  k_taste: { steps: [
    "Taste this.",
    "Open your mouth.",
    { thought: "She looks like a baby while I am feeding her." },
    "Tell me if it needs anything.",
    "I love feeding you." ],
    options: [
      { label: "“It’s good.”", next: 'k_good' },
      { label: "“A little more salt.”", next: 'k_salt' },
      { label: "“Now you open your mouth.”", next: 'k_herfeed' } ] },
  k_good: { steps: [
    { sfx: 'yummy' },
    "Perfect.",
    "Then we’re almost done." ], then: 'k_almost' },
  k_salt: { steps: ["On it.", "See? This is why I keep you close."], then: 'k_almost' },
  k_herfeed: { steps: [
    "I’m all yours.",
    "Feed me.",
    { thought: "She wants to feeds me a small bite. But yeah she is lazy." },
    { sfx: 'yummy' },
    "Perfect.",
    "It taste little sweeter.",
    "I guese because it comes from your sweet hands." ],
    options: [
      { label: "“More?”", next: 'k_morefeed' },
      { label: "“You’re such a flirtie.”", next: 'k_softie' },
      { label: "“Kiss me after this.”", next: 'k_kissafter' } ] },
  k_morefeed: { steps: [
    "Okay… one more.",
    "Slowly.",
    { sfx: 'yummy' },
    "I like the taste of your fingers." ], then: 'k_almost' },
  k_softie: { steps: ["Only for you.", "Don’t tell anyone."], then: 'k_almost' },
  k_kissafter: { steps: [{ act: 'kiss' }, { sfx: 'hm' }, "There. Paid in full."], then: 'k_almost' },
  k_almost: { steps: [
    "Almost done.",
    { sfx: 'uhh' }, "Come here.",
    "I want to hold you for a second before we eat.",
    { act: 'hug' },
    "You smell like home and something like cinnamon.",
    "I could stay in this kitchen with you forever." ],
    options: [
      { label: "“Feed me properly now.”", next: 'k_dinner' },
      { label: "“Let’s eat together.”", next: 'k_dinner' },
      { label: "“I want special cuddle after this.”", next: 'k_cuddle_later' },
      { label: "“Dance with me a little while it finishes.”", next: 'k_dance' } ] },
  k_dance: { steps: [
    "Okay… just a little.",
    { sfx: 'song' },
    { act: 'hug' },
    "You’re ridiculous.",
    "And I’m completely gone for you." ], then: 'k_dinner' },
  k_cuddle_later: { steps: [
    "Deal.",
    "Food first… then the blanket is all ours." ], then: 'k_dinner' },
  k_dinner: { steps: [
    "Open.",
    "One more bite.",
    "I love watching you eat from my hand." ],
    options: [
      { label: "“Your turn.”", next: 'k_feedhim' },
      { label: "“You’re spoiling me.”", next: 'k_spoil' },
      { label: "“I love you.”", next: 'k_love' } ] },
  k_feedhim: { steps: [
    "Please…",
    "Feed me, baby.",
    { thought: "She is feeding me. My inner baby met his new mother." },
    "Mmm. Best chef in the house." ], then: 'k_after' },
  k_spoil: { steps: ["Good.", "That’s the plan."], then: 'k_after' },
  k_love: { steps: [
    "I love you more.",
    "And you know that…",
    "I am obsessed with you." ], then: 'k_after' },
  k_after: { steps: [
    "Kitchen’s a mess now…",
    "but I don’t care.",
    { sfx: 'breath' }, "You look beautiful with a little sauce on your lip." ],
    options: [
      { label: "“Clean it for me.”", next: 'k_clean' },
      { label: "“Let’s go back to bed.”", next: 'k_tobed' },
      { label: "“Stay here a bit longer.”", next: 'k_stay' },
      { label: "“I want more of you tonight.”", next: 'k_more' } ] },
  k_clean: { steps: [
    { act: 'kiss' },
    { sfx: 'heh' }, "There. Clean.",
    "Tastes better than the anything, honestly." ], then: 'k_close' },
  k_tobed: { steps: [
    { sfx: 'hm' }, "Okay. Let’s go home.",
    { go: 'bedroom' } ], then: 'arrive_bedroom' },
  k_stay: { steps: [
    "Gladly.",
    "Food’s done. Kitchen’s quiet now.",
    { sfx: 'heh' }, "Come here.",
    { act: 'hug' },
    "I kept looking at you the whole time we ate.",
    "You’re more delicious than anything we cooked." ],
    options: [
      { label: "“Kiss me properly then.”", next: 'k_proper' },
      { label: "“Take me back to bed.”", next: 'k_tobed' },
      { label: "“Special cuddle tonight?”", next: 'k_cuddle_later2' },
      { label: "“Stay here… just a little more.”", next: 'k_close' } ] },
  k_more: { steps: [
    { sfx: 'chuckle' }, "Come closer.",
    "I’ll give you whatever you want.",
    "Just say it." ],
    options: [
      { label: "“Kiss me properly.”", next: 'k_proper' },
      { label: "“Take me back to bed.”", next: 'k_tobed' },
      { label: "“Special cuddle.”", next: 'k_cuddle_later2' } ] },
  k_proper: { steps: [
    { act: 'kiss' },
    "Mmm…",
    "Still the best thing in any room." ], then: 'k_close' },
  k_cuddle_later2: { steps: [
    "Special cuddle it is.",
    "Bedroom. Blanket. No Barriers.",
    { go: 'bedroom' } ], then: 'cuddle' },
  k_close: { steps: [
    "I could stay in this kitchen with you forever.",
    "But whenever you’re ready… just say the word." ],
    options: [
      { label: "“Let’s cook something again.”", next: 'k_replay' },
      { label: "“Kiss me.”", next: 'hub_kiss' },
      { label: "“Let’s go somewhere.”", next: 'where2' },
      { label: "“I’m sleepy… let’s sleep.”", next: 'sleep_ask' } ] },
  // kitchen replay — different from the first cook
  k_replay: { steps: [
    { sfx: 'heh' },
    "You want something again?",
    { sfx: 'chuckle' },
    "Okay… but this time you pick faster.",
    "I’m hungrier for you than the food." ], then: 'k_choose' },
  arrive_garden: { steps: [
    { pose: 'sit' },
    "Sit with me.",
    "Right here on this bench.",
    "I just want to look at you for a while.",
    { thought: "We sit close, adoring the beauty of her." } ], then: 'gd_view' },
  gd_view: { steps: [
    { sfx: 'breath' }, "You look even more gorgeous out here.",
    "Like this garden grew you just for me." ],
    options: [
      { label: "“You’re staring again.”", next: 'gd_v1' },
      { label: "“Come closer.”", next: 'gd_v2' },
      { label: "“I like it here with you.”", next: 'gd_v3' } ] },
  gd_v1: { steps: [{ sfx: 'heh' }, "So what.", "I can’t help it, you're addictive"], then: 'gd_flower' },
  gd_v2: { steps: ["Closer? Always.", { act: 'hug' }, { sfx: 'uhh' }], then: 'gd_flower' },
  gd_v3: { steps: ["I like it too… only because you’re in it."], then: 'gd_flower' },
  gd_flower: { steps: [
    "Every time I look at you I want to do something small…",
    "like this.",
    { act: 'flower' },
    { thought: "I gently plucked a tiny flower and carefully tucks it in her hair." },
    { sfx: 'chuckle' }, "There.",
    "Now you look like you belong to this place.",
    "And ofcourse to me." ],
    options: [
      { label: "“Do it again.”", next: 'gd_again' },
      { label: "“You’re so soft with me.”", next: 'gd_soft' },
      { label: "“Kiss me.”", next: 'gd_kiss' } ] },
  gd_again: { steps: [
    { sfx: 'foh' },
    "One more.",
    { act: 'flower' },
    "And maybe one behind your ear…",
    "so I can keep looking at it while I talk to you." ],
    options: [
      { label: "“Keep going.”", next: 'gd_keep' },
      { label: "“Enough… come here.”", next: 'gd_hold' },
      { label: "“I want to give you one too.”", next: 'gd_herflower' } ] },
  gd_soft: { steps: [{ sfx: 'heh' }, "Only for you.", "The whole garden can hear me being soft. I don’t care."], then: 'gd_bench' },
  gd_kiss: { steps: ["Come here then.", { act: 'kiss' }, "You taste like evening and something sweet."], then: 'gd_bench' },
  gd_keep: { steps: [{ act: 'flower' }, { sfx: 'fuhh' }, "Okay… one last one. Then I’m just going to stare."], then: 'gd_bench' },
  gd_hold: { steps: [{ sfx: 'hmm' }, "Come here.", { act: 'hug' }, { sfx: 'chuckle' }, "Better."], then: 'gd_bench' },
  gd_herflower: { steps: [
    { thought: "She tucks a small flower into my hair." },
    {thought : "I forget everything by her smile. Is she an angel?"},
    { sfx: 'chuckle' },
    "Now we match.",
    "Two people who look a little silly…",
    "and completely deep in love." ], then: 'gd_bench' },
  gd_bench: { steps: [
    "Your hand feels nice in mine.",
    "The air is quiet.",
    "I could stay here until the sky turns dark…",
    "just holding you and putting flowers in your hair." ],
    options: [
      { label: "“Hold me tighter.”", next: 'gd_tight' },
      { label: "“Talk to me.”", next: 'gd_talk' },
      { label: "“I want a kiss under the trees.”", next: 'gd_treekiss' } ] },
  gd_tight: { steps: [{ act: 'hug' }, { sfx: 'heh' }, "I’m not letting go."], then: 'gd_tease' },
  gd_talk: { steps: [
    "Okay…",
    "Your laugh. The way you lean on my shoulder.",
    "How every flower looks less bright next to you.",
    "You make everything feel more beautiful." ], then: 'gd_tease' },
  gd_treekiss: { steps: [
    "Come here then.",
    { act: 'kiss' },
    "I love kissing you outside…",
    "where the whole garden can see how much I want you." ],
    options: [
      { label: "“Again.”", next: 'gd_againkiss' },
      { label: "“You’re so romantic today.”", next: 'gd_rom' },
      { label: "“Don’t stop.”", next: 'gd_againkiss' } ] },
  gd_againkiss: { steps: [{ act: 'kiss' }, "Again. And again after that."], then: 'gd_tease' },
  gd_rom: { steps: [{ sfx: 'heh' }, "Blame the flowers.", "And you."], then: 'gd_tease' },
  gd_tease: { steps: [
    "You’re smiling like that again.",
    { sfx: 'sigh' },
    { sfx: 'chuckle' }, "Dangerous.",
    "Makes me want to tease you a little." ],
    options: [
      { label: "“Try it.”", next: 'gd_t1' },
      { label: "“Htt.”", next: 'gd_t2' },
      { label: "“Just keep being soft.”", next: 'gd_t3' } ] },
  gd_t1: { steps: [{ act: 'tease' }, { sfx: 'shy' }, "Hey—!", { act: 'hug' }, "Come back."], then: 'gd_close' },
  gd_t2: { steps: [
    { act: 'slap' },
    { sfx: 'shy' },
    { sfx: 'heh' }, "There.",
    "Now come back to me.",
    { act: 'hug' },
    "I only did it so I could hold you after." ], then: 'gd_close' },
  gd_t3: { steps: [{ act: 'hug' }, { sfx: 'uhh' }, "Soft it is.", "Head on my shoulder. My fingers in your shiny hair."], then: 'gd_close' },
  gd_close: { steps: [
    "One more flower?",
    "Or do you want to stay like this…",
    "close to me,",
    "me playing with your hair?" ],
    options: [
      { label: "“One more flower.”", next: 'gd_one_more' },
      { label: "“Stay like this.”", next: 'gd_stay' },
      { label: "“Let’s sit here a bit more.”", next: 'gd_replay' },
      { label: "“Take me somewhere else.”", next: 'gd_else' },
      { label: "“Special cuddle later?”", next: 'gd_cuddle' } ] },
  gd_one_more: { steps: [{ act: 'flower' }, { sfx: 'giggle' }, { sfx: 'uhh' }, "There. Last one. Promise."], then: 'hub' },
  gd_stay: { steps: [{ act: 'hug' }, { sfx: 'heh' }, { sfx: 'mm' }, "Then we stay.", { thought: "No rush. Just her, the bench, and the flowers." }], then: 'hub' },
  gd_else: { steps: ["Anywhere you want."], then: 'where2' },
  gd_cuddle: { steps: ["Deal.", "Garden first… then the blanket.", { go: 'bedroom' }], then: 'cuddle' },
  // garden replay — different soft lines
  gd_replay: { steps: [
    { sfx: 'heh' },
    "Still not ready to leave the bench?",
    { sfx: 'sigh' },
    "Good. Neither am I.",
    "Come closer. Different flowers this time… same you." ], then: 'gd_bench' },
  arrive_beach: { route: g => g.beachDone ? 'bc_back' : undefined, steps: [
    { pose: 'stand' },
    "Listen to the waves…",
    "Okay, I’ll admit it. The matching hats were a great idea.",
    { thought: "The sea, the sky… and her standing right next to me." },
    { sfx: 'breath' }, "You look incredible standing there.",
    "Come on. Sit with me." ], then: 'bc_sit' },

  // beach sit + light conversation (was missing → froze after arrive)
  bc_sit: { steps: [
    { pose: 'sit' },
    { set: { beachDone: true } },
    "Right here.",
    "Sand under our feet… and an angel next to me.",
    { sfx: 'sigh' },
    "I could stay like this all afternoon." ],
    options: [
      { label: "“Kiss me.”", next: 'bc_kiss' },
      { label: "“Hold my hand.”", next: 'bc_hold' },
      { label: "“I love it here.”", next: 'bc_love' } ] },
  bc_kiss: { steps: [
    "Come here.",
    { act: 'kiss' },
    { sfx: 'mm' },
    { sfx: 'foh' },
    "You taste like crazy butterscotch." ], then: 'bc_more' },
  bc_hold: { steps: [
    { act: 'hug' },
    { sfx: 'chuckle' },
    "Your hand in mine…",
    { sfx: 'sigh' },
    "Don’t let go yet." ], then: 'bc_more' },
  bc_love: { steps: [
    { sfx: 'heh' },
    "Me too.",
    { sfx: 'fuhh' },
    "Only because you’re in it." ], then: 'bc_more' },
  bc_more: { steps: [
    "Want to go in the water a little?",
    { sfx: 'uhh' },
    "Or just stay on the sand with me?" ],
    options: [
      { label: "“Let’s go in a little.”", next: 'bc_change' },
      { label: "“Stay here.”", next: 'bc_stay' },
      { label: "“Take me somewhere else.”", next: 'where2' } ] },
  // stand up, talk about changing, switch to swimwear, then walk into the water
  bc_change: { steps: [
    { pose: 'stand' },
    { sfx: 'heh' },
    "Okay… but we’re still in our beach clothes.",
    { sfx: 'shy' },
    "I’m not swimming in this shirt.",
    "Come on — bikini and trunks?" ], then: 'bc_undress' },
  bc_undress: { steps: [
    { set: { outfit: 'swim', naked: false, caption: 'a moment later…' } },
    { wait: 400 },
    { sfx: 'breath' },
    "There. Better.",
    { sfx: 'giggle' },
    "Your turn to stare is over. Let’s go." ], then: 'bc_wade' },
  bc_wade: { steps: [
    { pose: 'wade' },
    { sfx: 'shy' },
    "Careful… the sand drops off a little.",
    { sfx: 'uhh' },
    "Water’s up to our knees already.",
    "I’ve got you.",
    { act: 'hug' },
    "Stay close." ],
    options: [
      { label: "“Kiss me in the water.”", next: 'bc_wkiss' },
      { label: "“Splash me.”", next: 'bc_splash' },
      { label: "“Hold me.”", next: 'bc_whug' },
      { label: "“Go a little deeper.”", next: 'bc_inmore' },
      { label: "“Back to the sand.”", next: 'bc_stay' } ] },
  bc_wkiss: { steps: [
    { act: 'kiss' },
    { sfx: 'mm' },
    { sfx: 'foh' },
    "Cold water… warm you.",
    { act: 'hug' },
    "Don’t let go." ], then: 'bc_wopts' },
  bc_whug: { steps: [
    { act: 'hug' },
    { sfx: 'hmm' },
    "Just the waves… and you against me." ], then: 'bc_wopts' },
  bc_splash: { steps: [
    { set: { splash: true } },
    { sfx: 'heh' },
    "Hey—!",
    { set: { splash: true } },
    { sfx: 'giggle' },
    "Okay… you’re going under for that." ], then: 'bc_wopts' },
  bc_wopts: { steps: [
    { sfx: 'sigh' },
    "Still good here… or deeper?" ],
    options: [
      { label: "“Kiss me again.”", next: 'bc_wkiss' },
      { label: "“Splash you back.”", next: 'bc_splash' },
      { label: "“Go a little deeper.”", next: 'bc_inmore' },
      { label: "“Back to the sand.”", next: 'bc_stay' } ] },
  bc_inmore: { steps: [
    { pose: 'swim' },
    { sfx: 'uhh' },
    "Deeper… water’s at our waists now.",
    { act: 'hug' },
    { sfx: 'sigh' },
    "I could stay in this ocean with you forever." ],
    options: [
      { label: "“Kiss me again.”", next: 'bc_dkiss' },
      { label: "“Splash you back.”", next: 'bc_dsplash' },
      { label: "“Hold me.”", next: 'bc_dhug' },
      { label: "“Back to the sand.”", next: 'bc_stay' } ] },
  bc_dkiss: { steps: [
    { act: 'kiss' },
    { sfx: 'mm' },
    { sfx: 'foh' },
    "Salt on your lips… I like it." ], then: 'bc_inmore' },
  bc_dhug: { steps: [
    { act: 'hug' },
    { sfx: 'hmm' },
    "Waves against us. You against me." ], then: 'bc_inmore' },
  bc_dsplash: { steps: [
    { set: { splash: true } },
    { sfx: 'heh' },
    "Hey—!",
    { set: { splash: true } },
    { sfx: 'giggle' },
    "You’re soaked. Trying to make the place hotter?" ], then: 'bc_inmore' },
  bc_stay: { steps: [
    { pose: 'sit' },
    { set: { outfit: 'beach', naked: false } },
    { sfx: 'heh' },
    "Okay. Back to the loungers.",
    { sfx: 'sigh' },
    "Just the waves… and us." ],
    options: [
      { label: "“Let’s go in the ocean again.”", next: 'bc_replay' },
      { label: "“Kiss me.”", next: 'bc_kiss' },
      { label: "“Let’s go somewhere else.”", next: 'where2' },
      { label: "“I’m sleepy… let’s sleep.”", next: 'sleep_ask' } ] },
  bc_back: { steps: [
    { pose: 'sit' },
    "Back at the beach.",
    "Missed the sound of the waves already?",
    { sfx: 'heh' },
    "Or just missed sitting next to me." ],
    options: [
      { label: "“Both.”", next: 'bc_more' },
      { label: "“Let’s go in the ocean again.”", next: 'bc_replay' },
      { label: "“Kiss me.”", next: 'bc_kiss' },
      { label: "“Let’s go somewhere else.”", next: 'where2' } ] },
  // beach ocean replay — different from first wade
  bc_replay: { steps: [
    { sfx: 'heh' },
    "Back in already?",
    { sfx: 'chuckle' },
    "The ocean missed us… or maybe I just missed you in the water.",
    "Swimsuits on. Let’s go deeper this time." ], then: 'bc_undress' },

  arrive_bedroom: { steps: ["Back home.", "It’s better with you in it."], then: 'hub' },
  // ====== CUDDLE UNDER THE BLANKET: matches the animation (they lie down, the blanket slides over them, afternoon light). The "special cuddle" part stays tender: the screen fades and we skip ahead. ======
  cuddle: { route: g => g.world !== 'bedroom' ? 'sleep_away' : undefined,
    steps: [{ sfx: 'hmm' }, "Come here.", { scene: true }, { pose: 'bed' }, "Under the blanket with me.", "I just want to feel you close.", { thought: "Soft afternoon light still slips through the window." }, "Your body fits against mine so perfectly.", "Like you were always meant to be right here."],
    options: [ { label: "“Hold me tighter.”", next: 'cd_s1' }, { label: "“You’re warm.”", next: 'cd_s2' }, { label: "“Kiss me first.”", next: 'cd_kiss' } ] },
  cd_s1: { steps: ["I’m not letting go.", "Not even a little."], then: 'cd_home' },
  cd_s2: { steps: ["Warm? That’s all you.", "Stay right there and I’ll keep it that way."], then: 'cd_home' },
  cd_kiss: { steps: ["Always.", { sfx: 'kiss' }, { thought: "I kiss her slowly. The whole room goes quiet." }, "Mm. Now come closer."], then: 'cd_home' },
  cd_home: { steps: ["You feel like home.", { thought: "I pull her closer, my forehead against hers." }, { sfx: 'mm' }, { sfx: 'foh' }, "I love you.", "Even when you just say “okay”… I still love you."],
    options: [ { label: "“I love you baby.”", next: 'cd_a' }, { label: "“Okay.”", next: 'cd_b' }, { label: "“Don’t stop talking.”", next: 'cd_skin' } ] },
  cd_a: { steps: ["I love you more.", "Say it again, slowly."], then: 'cd_skin' },
  cd_b: { steps: ["…There it is. My favorite okay.", "I know exactly what it means."], then: 'cd_skin' },
  cd_skin: { steps: ["Your skin is so soft.", "I could stay like this forever…", "listening to your breathing, feeling your heart against mine."],
    options: [ { label: "“This is nice.”", next: 'cd_nice' }, { label: "“I want more.”", next: 'cd_more' }, { label: "“Special cuddle?”", next: 'cd_more' } ] },
  cd_nice: { steps: ["Me too.", "Nothing else exists right now."], then: 'cd_rest' },
  cd_more: { steps: [{ thought: "…" }, "Special cuddle…", "You really want that right now?"],
    options: [ { label: "“Yes.”", next: 'cd_warm' }, { label: "“Maybe… if you ask nicely.”", next: 'cd_ask' }, { label: "“I’m already getting comfy.”", next: 'cd_warm' } ] },
  cd_ask: { steps: ["Pretty please, my favorite person?", "…Okay, I’ll beg a little. Come here."], then: 'cd_warm' },
  cd_warm: { steps: ["Come here then.", "Just you, me and this blanket.", { lamp: false }, { skip: 'a little while later…' }, { lamp: true }, { sfx: 'heh' }, "Hey.", "You feel even better like this.", "I’m so in love with the way you trust me."],
    options: [ { label: "“Kiss me.”", next: 'cd_k' }, { label: "“Just hold me like this.”", next: 'cd_hold' }, { label: "“Stay like this forever.”", next: 'cd_hold' } ] },
  cd_k: { steps: [{ sfx: 'kiss' }, { thought: "I kiss her slowly, and she smiles against my lips." }, "Your lips taste like the only thing I ever needed.", "I could kiss you until the sun goes down."], then: 'cd_hold' },
  cd_hold: { steps: ["Then I’ll hold you.", "No rush.", "Just us under this blanket, breathing the same air.", { wait: 1200 }, "I love you so much it almost hurts.", "You’re my favorite place in the world."],
    options: [ { label: "“I love you baby.”", next: 'cd_h1' }, { label: "“Okay.”", next: 'cd_h2' }, { label: "“Stay like this forever.”", next: 'cd_h3' } ] },
  cd_h1: { steps: ["I love you too. Always."], then: 'cd_rest' },
  cd_h2: { steps: [{ sfx: 'hm' }, "Okay. I’ll take it. Best okay ever."], then: 'cd_rest' },
  cd_h3: { steps: ["Forever, then. I’m not going anywhere."], then: 'cd_rest' },
  cd_rest: { steps: ["Close your eyes if you want.", "I’ll stay awake a little longer… just watching you.", "You’re so beautiful when you’re this close."],
    options: [ { label: "“Sleep with me.”", next: 'cd_lamp' }, { label: "“Talk to me more.”", next: 'cd_talk' }, { label: "“Special cuddle and then sleep.”", next: 'cd_warm' } ] },
  cd_talk: { steps: ["More? Okay.", "The first time you laughed at my bad joke, I decided I was keeping you.", "That’s all. That’s the whole secret."], then: 'cd_rest' },
  cd_lamp: { steps: ["Okay… sleepy girl.", "Should I turn off the light?"], options: [ { label: "“Yes… switch it off.”", next: 'bed_off' }, { label: "“Leave it on until I fall asleep.”", next: 'bed_on' } ] },
  bed_off: { steps: [{ lamp: false }, { tod: 'night' }, { sfx: 'heh' }, "There. Just the moonlight now."], then: 'sleep_night' },
  bed_on: { steps: [{ tod: 'night' }, { sfx: 'hm' }, "Okay. I’ll leave it on until you drift off."], then: 'sleep_night' },

  flirt: { steps: ["You’re looking at me like that again.", { sfx: 'chuckle' }, "Damn", "You know what happens when you look at me like that."],
    options: [ { label: "“What happens?”", next: 'flirt_what' }, { label: "“Kiss me before I change my mind.”", next: 'kiss1' }, { label: "“Call me something.”", next: 'flirt_call' } ] },
  flirt_what: { steps: ["Oh, you want me to say it out loud?", "Come here and find out.", { act: 'tease' }, "See? Dangerous."], then: 'flirt2' },
  flirt2: { steps: [], options: [ { label: "“Kiss me before I change my mind.”", next: 'kiss1' }, { label: "“Call me something.”", next: 'flirt_call' } ] },
  flirt_call: { steps: ["Sexy.", "Your lips look like delicious rose petals today.", "I keep wanting to bite them a little.", "You’re so hot when you pretend you’re not teasing me."],
    options: [ { label: "“Keep talking.”", next: 'keep' }, { label: "“Shut up and kiss me.”", next: 'kiss1' }, { label: "“You’re such a flirt.”", next: 'flirt_slap' } ] },
  keep: { steps: ["Where do I even start?", "Your laugh. Your eyes when you’re sleepy.", "The way you steal my hoodie and pretend it’s an accident.", "All of it. Every little thing."], then: 'where' },
  flirt_slap: { steps: [{ act: 'slap' }, "Ow! What was that for?!", "I was literally just being sweet!"],
    options: [ { label: "“You deserved it.”", next: 'fs_a' }, { label: "“Sorry… was that too hard?”", next: 'fs_b' }, { label: "“Flirting is your job, not mine.”", next: 'fs_c' } ] },
  fs_a: { steps: ["Deserved it? For being charming?", "…Fine. Worth it, honestly."], then: 'where' },
  fs_b: { steps: ["A little. My ego took most of it.", "A kiss would fix everything, you know."], then: 'where' },
  fs_c: { steps: ["Ha! Okay, that’s fair.", "I’ll keep flirting. You keep hitting. Deal?"], then: 'where' },

  // ====== GOING TO SLEEP: he asks about the lights -> lamp off -> they lie down under the blanket -> time skip -> sleepy wake-up -> lamp on ======
  sleep_ask: { route: g => g.world !== 'bedroom' ? 'sleep_away' : !g.lamp ? 'sleep_dark' : undefined,
    steps: ["Mm… you’re yawning.", "Should I turn off the lights?"],
    options: [ { label: "“Yes… switch it off.”", next: 'sleep_go' }, { label: "“Not yet… a little more with you.”", next: 'sleep_wait' } ] },
  sleep_wait: { steps: [{ sfx: 'chuckle' }, "Okay. Five more minutes.", "…Maybe ten. I’m not counting."], then: 'hub' },
  sleep_away: { steps: ["Sleepy already? Let’s go back to the bedroom first."], options: [ { label: "“Okay… take me home.”", world: 'bedroom' } ] },
  sleep_go: { steps: [{ scene: true }, { sfx: 'heh' }, "Okay. Lights off.", { lamp: false }, { tod: 'night' }, { sfx: 'uhh' }, "There. Just the moonlight now."], then: 'sleep_in' },
  sleep_dark: { steps: [{ scene: true }, { tod: 'night' }, "It’s already dark… perfect for sleeping."], then: 'sleep_in' },
  sleep_in: { steps: [{ sfx: 'chuckle' }, "Come here. Lie down with me.", { pose: 'bed' }, "Under the blanket… closer.", { sfx: 'hm' }, "There. Perfect.", { thought: "She fits against me like she was made to." }], then: 'sleep_night' },
  sleep_night: { steps: [], options: [ { label: "“Goodnight… I love you.”", next: 'sn1' }, { label: "“Hold me tighter.”", next: 'sn2' }, { label: "“Tell me something nice before I sleep.”", next: 'sn3' } ] },
  sn1: { steps: ["I love you too.", "Always. Goodnight, my girl."], then: 'sleep_drift' },
  sn2: { steps: ["Like this?", "…Better?", "Nobody’s getting through this hug."], then: 'sleep_drift' },
  sn3: { steps: ["Something nice…", "Tomorrow I get to wake up next to you again.", "That’s the nicest thing I know."], then: 'sleep_drift' },
  sleep_drift: { steps: [{ thought: "Her breathing is slowing down…" }, { thought: "Warm. Quiet. Safe." }, { sleepy: 1 }, { lamp: false }, { wait: 1600 }, { skip: 'a few hours later…' }], then: 'sleep_wake' },
  sleep_wake: { steps: [{ sleepy: 0.5 }, "Mmm… babe…", "Babe… wake up…", "It’s so dark… hold on.", { thought: "fumbling for the lamp…" }, { lamp: true }, { sfx: 'heh' }, "There. Hi, sleepyhead."],
    options: [ { label: "“Mmm… five more minutes.”", next: 'ww1' }, { label: "“What time is it?”", next: 'ww2' }, { label: "“Why did you wake me up…?”", next: 'ww3' } ] },
  ww1: { steps: ["Five minutes? You said that three times already.", "…Okay, five. But I’m staying right here."], then: 'sleep_up' },
  ww2: { steps: ["No idea. Who cares?", "You’re warm and I’m not moving."], then: 'sleep_up' },
  ww3: { steps: ["Because I opened my eyes and you were the first thing I wanted to see.", "…And I was a little cold. Mostly cold."], then: 'sleep_up' },
  sleep_up: { steps: [{ sleepy: 0 }, "Okay… up we go.", { pose: 'sit' }, "Look, the sun’s already coming up.", { tod: 'morning' }, "I slept so well with you.", { scene: false }], then: 'hub' },

  // ====== GOING OUTSIDE: they ask each other about changing clothes (his tone follows her answer) -> pick the place -> beach outfits ======
  out_night: { steps: [
    { sfx: 'breath' },
    "Outside? At this hour?",
    "Baby… it’s night. The beach and garden can wait until tomorrow.",
    "Let’s stay in. Shower, kitchen, or just me holding you.",
    { sfx: 'heh' },
    "I’ll take you out when the sun’s up. Promise." ],
    options: [
      { label: "“Okay… shower then.”", next: 'shower_plan' },
      { label: "“Kitchen. I’m still hungry.”", world: 'kitchen' },
      { label: "“Just hold me.”", next: 'cuddle' },
      { label: "“Fine… tomorrow.”", next: 'hub' } ] },

  out_ask: { route: g => g.tod === 'night' ? 'out_night' : undefined,
    steps: ["Outside? Now? …Okay, I’m in.", "But look at us. We’re still in our lazy clothes.", "Should we change first?"],
    options: [ { label: "“Yes… what should I wear?”", next: 'out_soft' }, { label: "“Please change. That shirt is tragic.”", next: 'out_tease' }, { label: "“Nope. Let’s just go like this.”", next: 'out_asis' } ] },
  out_soft: { steps: [{ tone: 'soft' }, "Mm… something light and pretty.", { sfx: 'breath' }, "You look good in anything, you know that?"], then: 'out_him' },
  out_tease: { steps: [{ tone: 'tease' }, "Tragic?! This shirt has feelings.", "…Okay, it has a tiny hole. Fine, I’ll change."], then: 'out_him' },
  out_asis: { steps: [{ tone: 'tease' }, "Like this? Messy hair, sleepy face, wrinkled everything?", "…Honestly? Still the cutest thing I’ve seen all day. But no. We’re doing this properly."], then: 'out_him' },
  out_him: { steps: ["And me? What should I wear?"],
    options: [ { label: "“Something with flowers. I’m serious.”", next: 'out_floral' }, { label: "“Anything that isn’t black.”", next: 'out_color' }, { label: "“Surprise me.”", next: 'out_surprise' } ] },
  out_floral: { route: g => g.tone === 'tease' ? 'out_floral_t' : undefined, steps: ["Flowers? For me? …I’ll look ridiculous.", "But for you? I’ll wear the loudest shirt in the world."], then: 'out_where' },
  out_floral_t: { steps: ["Flowers?! You want me in a flower shirt?", "Fine. But when I look incredible, you owe me a kiss."], then: 'out_where' },
  out_color: { route: g => g.tone === 'tease' ? 'out_color_t' : undefined, steps: ["Not black? …But black is my whole personality.", { sfx: 'hm' }, "Okay. For you I’ll find something with actual color."], then: 'out_where' },
  out_color_t: { steps: ["Not black?! Rude. I’m basically a shadow.", "Fine. For you I’ll turn into a rainbow."], then: 'out_where' },
  out_surprise: { route: g => g.tone === 'tease' ? 'out_surprise_t' : undefined, steps: ["Surprise you? Okay… I like a challenge.", "No peeking until I’m ready."], then: 'out_where' },
  out_surprise_t: { steps: ["Surprise you? Careful what you wish for.", "I might show up in the loudest outfit on earth."], then: 'out_where' },
  out_where: { steps: [{ sfx: 'chuckle' }, "Okay. So… where are we going?"], options: [
    { label: "“The beach.”", next: 'beach_plan' },
    { label: "“The pool.”", next: 'pool_plan' },
    { label: "“The garden.”", next: 'garden_plan' } ] },

  // ---- travel plans (were missing → story froze after choosing a place) ----
  beach_plan: { steps: [
    "The beach?",
    "Sun, sand, the sound of the waves…",
    "Come on. Let’s go." ], then: 'beach_go' },
  beach_go: { steps: [{ go: 'beach' }], then: 'arrive_beach' },

  garden_plan: { steps: [
    "The garden?",
    "Quiet. Flowers. Just you in my arms.",
    "Come on." ], then: 'garden_go' },
  garden_go: { steps: [{ go: 'garden' }], then: 'arrive_garden' },

  pool_plan: { steps: [
    "The pool?",
    "You wanna tease me more in the pool.",
    "Come on." ], then: 'pool_go' },
  pool_go: { steps: [{ go: 'pool' }], then: 'arrive_pool' },



  arrive_pool: { steps: [
    { set: { outfit: 'swim', naked: false } },
    { pose: 'sit' },
    "Sit with me.",
    "Right here on the edge.",
    "Feet in the water… and you next to me." ],
    options: [
      { label: "“The water’s cool.”", next: 'pl_edge' },
      { label: "“You’re close.”", next: 'pl_edge' },
      { label: "“I like this.”", next: 'pl_edge' } ] },

  pl_edge: { steps: [
    { sfx: 'sigh' },
    "Good.",
    "I can feel, your touch is heating me up.",
    { sfx: 'uhh' },
    "Don’t move yet." ],
    options: [
      { label: "“Kiss me.”", next: 'pl_kiss' },
      { label: "“You’re staring.”", next: 'pl_stare' },
      { label: "“Make me laugh.”", next: 'pl_laugh' } ] },

  pl_stare: { steps: [
    { sfx: 'heh' },
    "Yeahhhh.",
    "Your lips look sweeter when they wet.",
    { sfx: 'shy' },
    "Come closer." ], then: 'pl_kiss' },

  pl_laugh: { steps: [
    { sfx: 'chuckle' },
    "Okay… your feet are cuter than mine. There. Happy?",
    { sfx: 'fuhh' },
    "Now kiss me before I say something worse." ], then: 'pl_kiss' },

  pl_kiss: { steps: [
    "Come here.",
    { act: 'kiss' },
    { sfx: 'mm' },
    "Mmm…",
    { sfx: 'sigh' },
    "You taste like juicy strawberry." ],
    options: [
      { label: "“Again.”", next: 'pl_kiss2' },
      { label: "“Let’s go in deeper.”", next: 'pl_in_ask' },
      { label: "“Hold me.”", next: 'pl_hold' } ] },

  pl_kiss2: { steps: [
    { act: 'kiss' },
    { sfx: 'mm' },
    { sfx: 'sigh' },
    "Okay. That one was slower on purpose." ], then: 'pl_in_ask' },

  pl_hold: { steps: [
    { act: 'hug' },
    { sfx: 'heh' },
    "Your soft waist under my palm…",
    { sfx: 'sigh' },
    "I could stay on this edge forever." ], then: 'pl_in_ask' },

  pl_in_ask: { steps: [
    "Want to go in?",
    "Properly.",
    { sfx: 'uhh' },
    "Clothes off… just us and the water." ],
    options: [
      { label: "“Yes… let’s get in.”", next: 'pl_strip' },
      { label: "“Tease me a little first.”", next: 'pl_tease' },
      { label: "“Stay on the edge a bit more.”", next: 'pl_edge2' } ] },

  pl_tease: { steps: [
    { sfx: 'heh' },
    "Tease you?",
    "I’ve been watching the water climb your legs this whole time.",
    { sfx: 'shy' },
    "When we go in… I’m not keeping my hands to myself.",
    { sfx: 'breath' },
    "Still want in?" ],
    options: [
      { label: "“Take me in.”", next: 'pl_strip' },
      { label: "“Yes… but slow.”", next: 'pl_strip' } ] },

  pl_edge2: { steps: [
    "Okay. One more minute.",
    { act: 'kiss' },
    { sfx: 'shy' },
    "…Alright. I’m spoiled. In we go." ], then: 'pl_strip' },

  pl_strip: { steps: [
    // 1. clothes off first — still sitting on the edge
    { set: { naked: true, outfit: 'swim', caption: 'a moment later… clothes left on the edge' } },
    { wait: 2600 },
    { set: { caption: '' } },
    { sfx: 'shy' },
    "There…",
    // 2. step in — water rises gradually
    { pose: 'wade' },
    { sfx: 'chuckle' },
    "Just the water… and you." ], then: 'pl_water' },

  pl_water: { steps: [
    // 3. deeper to the shoulders, stay close
    { pose: 'swim' },
    "Come closer.",
    { act: 'hug' },
    { sfx: 'uhh' },
    "I can feel your skin under the surface.",
    { sfx: 'sigh' },
    "Nothing between us but the water.",
    "Don’t look at me like that unless you mean it." ],
    options: [
      { label: "“I mean it.”", next: 'pl_close' },
      { label: "“Touch me.”", next: 'pl_hands' },
      { label: "“Kiss me.”", next: 'pl_wkiss' },
      { label: "“Splash me.”", next: 'pl_splash' },
      { label: "“Hold me tighter.”", next: 'pl_close' } ] },

  pl_close: { steps: [
    { act: 'hug' },
    { sfx: 'heh' },
    "You’re warm even in the cool water.",
    "My hands on your body… yours on mine.",
    "I wanna do something…",
    { act: 'kiss' },
    { sfx: 'mm' },
    { sfx: 'giggle' },
    "No clothes. No space.",
    "Stay against me." ],
    options: [
      { label: "“Don’t stop holding me.”", next: 'pl_intimate' },
      { label: "“Your hands… lower.”", next: 'pl_hands' },
      { label: "“Kiss me harder.”", next: 'pl_wkiss' },
      { label: "“I love this.”", next: 'pl_end' } ] },

  pl_wkiss: { steps: [
    { act: 'kiss' },
    { sfx: 'mm' },
    "Soft…",
    { act: 'hug' },
    { sfx: 'sigh' },
    "Wet lips… I could kiss you until the lights dim." ],
    options: [
      { label: "“Again. Deeper.”", next: 'pl_wkiss2' },
      { label: "“Touch me while you kiss me.”", next: 'pl_kiss_touch' },
      { label: "“I want more of you.”", next: 'pl_intimate' },
      { label: "“Hold me.”", next: 'pl_close' } ] },

  pl_splash: { steps: [
    { set: { splash: true } },
    { sfx: 'heh' },
    "Hey—!",
    { set: { splash: true } },
    { sfx: 'giggle' },
    "You’re so dead… come here." ], then: 'pl_close' },

  pl_hands: { steps: [
    { sfx: 'shy' },
    "Here…",
    "On your waist. Under the water.",
    { sfx: 'heh' },
    "My hands are warm against you.",
    "Tell me if you want them higher… or lower." ],
    options: [
      { label: "“Higher.”", next: 'pl_more' },
      { label: "“Lower… slow.”", next: 'pl_lower' },
      { label: "“Just hold me.”", next: 'pl_close' },
      { label: "“Kiss me while you touch me.”", next: 'pl_kiss_touch' } ] },

  pl_more: { steps: [
    { sfx: 'breath' },
    "Okay…",
    "Slow. I want to feel you shiver a little.",
    { act: 'hug' },
    "Your chest against mine…",
    "You’re dangerous when you say yes like that." ],
    options: [
      { label: "“Don’t stop.”", next: 'pl_intimate' },
      { label: "“Lower.”", next: 'pl_lower' },
      { label: "“Kiss me.”", next: 'pl_wkiss' },
      { label: "“I need a second.”", next: 'pl_end' } ] },

  pl_lower: { steps: [
    { sfx: 'breath' },
    "Like this…?",
    { sfx: 'shy' },
    "Under the water, where no one can see… only us.",
    { act: 'hug' },
    "You’re trembling a little. I like that." ],
    options: [
      { label: "“Keep going.”", next: 'pl_intimate' },
      { label: "“Kiss me.”", next: 'pl_kiss_touch' },
      { label: "“Hold me tight.”", next: 'pl_close' },
      { label: "“I’m yours.”", next: 'pl_intimate' } ] },

  pl_kiss_touch: { steps: [
    { act: 'kiss' },
    { sfx: 'mm' },
    { sfx: 'foh' },
    "Kiss and hands… at the same time.",
    { sfx: 'breath' },
    "You make me forget how to breathe." ], then: 'pl_intimate' },

  pl_intimate: { steps: [
    { sfx: 'breath' },
    "Come closer…",
    "Wrap your legs around me.",
    { act: 'hug' },
    { sfx: 'hmm' },
    "Skin on skin. Water all around us.",
    "I want you so much right now.",
    { sfx: 'shy' },
    "Tell me what you want." ],
    options: [
      { label: "“I want you. All of you.”", next: 'pl_want' },
      { label: "“Touch me everywhere.”", next: 'pl_everywhere' },
      { label: "“Just stay like this… close.”", next: 'pl_close2' },
      { label: "“Take me somewhere private.”", next: 'pl_private' } ] },

  pl_want: { steps: [
    { sfx: 'breath' },
    "Then take me.",
    { act: 'kiss' },
    { sfx: 'mm' },
    "I’m already yours under this water.",
    { sfx: 'foh' },
    "Don’t let go of me." ], then: 'pl_end' },

  pl_everywhere: { steps: [
    { sfx: 'shy' },
    "Everywhere…?",
    { sfx: 'breath' },
    "Okay. Slowly.",
    { act: 'hug' },
    "My hands know you already…",
    "but I still want to learn every soft place again." ,
  "Like this…?", 
    "Your boobs are so soft."], then: 'pl_end' },

  pl_close2: { steps: [
    { act: 'hug' },
    { sfx: 'hmm' },
    "Just this. Heartbeat against heartbeat.",
    "Naked. Yours." ], then: 'pl_end' },

  pl_private: { steps: [
    { sfx: 'chuckle' },
    "Bedroom. Blanket. Skin to Skin.",
    "Come on… before I change my mind and keep you in this water all night." ],
    options: [
      { label: "“Let’s go.”", next: 'pl_tobed' },
      { label: "“One more minute here.”", next: 'pl_end' } ] },

  pl_tobed: { steps: [
    { set: { naked: false, outfit: 'casual' } },
    { go: 'bedroom' } ], then: 'arrive_bedroom' },

  pl_end: { steps: [
    "Quiet for a second.",
    "Just the water moving between us.",
    { sfx: 'hmm' },
    "I love you in here." ],
    options: [
      { label: "“I love you too.”", next: 'pl_love' },
      { label: "“One more kiss.”", next: 'pl_wkiss2' },
      { label: "“Let’s go in again… naked.”", next: 'pl_replay' },
      { label: "“Take me somewhere else.”", next: 'where2' },
      { label: "“Special cuddle later?”", next: 'pl_cuddle' } ] },

  pl_love: { steps: [
    { sfx: 'chuckle' },
    "Say it again later. I like collecting those." ], then: 'hub' },

  pl_wkiss2: { steps: [
    { act: 'kiss' },
    { sfx: 'mm' },
    "Okay. I’m done being reasonable." ], then: 'hub' },

  pl_cuddle: { steps: [
    "Deal.",
    "Pool first… then the blanket is yours." ], then: 'hub' },

  // replay pool — different lines from the first time
  pl_replay: { steps: [
    { sfx: 'heh' },
    "Again? Already?",
    { sfx: 'chuckle' },
    "I’m not complaining…",
    "Clothes off. Back in. Just us and the water." ], then: 'pl_replay_in' },
  pl_replay_in: { steps: [
    { set: { naked: true, outfit: 'swim', caption: 'back in the water… nothing on' } },
    { pose: 'swim' },
    { sfx: 'breath' },
    "Feels even better the second time…",
    "like the water already knows your body.",
    { act: 'hug' },
    "Come here. Closer than before.", 
    "Lemme touch your skin again."  ],
    options: [
      { label: "“Touch me again.”", next: 'pl_hands' },
      { label: "“Kiss me slower this time.”", next: 'pl_wkiss' },
      { label: "“I want you more now.”", next: 'pl_intimate' },
      { label: "“Hold me and don’t talk.”", next: 'pl_close2' } ] },

  // ====== SHOWER ======
  shower_plan: { steps: [
    "Shower? With me?", { sfx: 'heh' },
    "Okay… let’s go.", "Come on." ],
    options: [
      { label: "“Don’t peek while I get ready.”", next: 'sh_prep' },
      { label: "“Just take me there.”", next: 'sh_go' },
      { label: "“I’m already sticky… hurry.”", next: 'sh_go' } ] },
  sh_prep: { steps: [{ dress: 'swim', caption: 'a moment later… back in the bedroom', pose: 'stand' }, "There you are.", { sfx: 'breath' }, "Ready when you are."], then: 'sh_go' },
  sh_go: { steps: [{ dress: 'swim', caption: 'getting ready…', pose: 'stand' }, { go: 'shower' }], then: 'arrive_shower' },
  arrive_shower: { steps: [
    { pose: 'stand' }, { set: { showerOn: false, steam: false } },
    { thought: "We stand just outside the glass. Water not on yet." },
    "Stay with me a second.",
    "Right here… outside the glass. Before we step in." ],
    options: [
      { label: "“Let’s go in.”", next: 'sh_enter' },
      { label: "“Kiss me first.”", next: 'sh_pre_kiss' },
      { label: "“I’m ready.”", next: 'sh_enter' } ] },
  sh_pre_kiss: { steps: [{ act: 'kiss' }, { sfx: 'heh' }, "Okay. Now we go in."], then: 'sh_enter' },
  sh_enter: { steps: [
    { pose: 'wade' },
    { thought: "We step into the glass stall." },
    { sfx: 'uhh' }, "Come here.",
    "I’ll turn the water on." ],
    options: [
      { label: "“Turn it on.”", next: 'sh_water_on' },
      { label: "“Make it warm.”", next: 'sh_water_on' },
      { label: "“Don’t just stand there.”", next: 'sh_water_on' } ] },
  sh_water_on: { steps: [
    { set: { showerOn: true, steam: true } },
    { sfx: 'breath' },
    { thought: "Warm water starts. Steam rises." },
    "Water’s warm…",
    "but you’re going to make it hotter." ],
    options: [
      { label: "“Help me undress.”", next: 'sh_undress' },
      { label: "“You’re already looking at me like that.”", next: 'sh_look' },
      { label: "“Come closer.”", next: 'sh_undress' } ] },
  sh_look: { steps: [{ sfx: 'heh' }, "Can you blame me?", "You’re under the water and still the only thing I see.", { sfx: 'heh' }, "Come closer. Let me help with the rest."], then: 'sh_undress' },
  sh_undress: { steps: [
    { thought: "He steps closer. Fingers on her clothes." },
    "Slowly then.", "I want to feel every piece leave your body.",
    { sfx: 'breath' },
    { set: { naked: true, steam: true, showerOn: true } },
    { thought: "Clothes come off. Steam wraps around them." },
    { sfx: 'oh' }, "Damnn…", { sfx: 'breath' }, "You look unreal & Sexy under the water.",
    "Every drop is running down places I keep thinking about." ],
    options: [
      { label: "“Like where?”", next: 'sh_where' },
      { label: "“Touch me then.”", next: 'sh_touch' },
      { label: "“You’re the one looking dangerous.”", next: 'sh_danger' } ] },
  sh_where: { steps: [
    { sfx: 'chuckle' }, { thought: "Low voice, close to her ear." },
    "Your boobs…", "the way water slides between them.",
    "And lower…", "where you’re already soft and warm for me." ],
    options: [
      { label: "“Keep talking.”", next: 'sh_talk' },
      { label: "“Show me instead.”", next: 'sh_show' },
      { label: "“You’re so dirty.”", next: 'sh_dirty' } ] },
  sh_danger: { steps: [{ sfx: 'chuckle' }, "Dangerous?", "Only for you.", { sfx: 'uhh' }, "Come here. Let me prove it."], then: 'sh_touch' },
  sh_dirty: { steps: [{ sfx: 'heh' }, "Only when you’re this close.", "Want me to stop talking… or keep going?"],
    options: [
      { label: "“Keep talking.”", next: 'sh_talk' },
      { label: "“Show me instead.”", next: 'sh_show' },
      { label: "“Kiss me.”", next: 'sh_kiss' } ] },
  sh_talk: { steps: [
    { act: 'hug' }, { sfx: 'heh' },
    "I want my hands on your ass…",
    "pulling you against me so you can feel how hard I already am.",
    "And then lower…", "fingers between your thighs,",
    { sfx: 'heavy' },
    "feeling how wet you are even under the water." ],
    options: [
      { label: "“Do it.”", next: 'sh_doit' },
      { label: "“Tease me more first.”", next: 'sh_tease' },
      { label: "“I want to touch you too.”", next: 'sh_herhand' } ] },
  sh_show: { steps: ["Gladly.", { act: 'hug' }, { sfx: 'breath' }, "Hands first… then whatever you ask for."], then: 'sh_talk' },
  sh_touch: { steps: [
    { act: 'hug' }, { sfx: 'mm' }, "Like this?", "You’re so sexy under the water." ],
    options: [
      { label: "“Keep going.”", next: 'sh_doit' },
      { label: "“Tease me more first.”", next: 'sh_tease' },
      { label: "“I want to touch you too.”", next: 'sh_herhand' } ] },
  sh_herhand: { steps: [
    { sfx: 'oh' }, "Yes…", "your hand on me.", "Just like that.",
    "You’re going to make me lose it if you keep stroking me under the water." ],
    options: [
      { label: "“Good.”", next: 'sh_good' },
      { label: "“I want you inside me.”", next: 'sh_inside' },
      { label: "“Not yet… just this.”", next: 'sh_justthis' } ] },
  sh_good: { steps: [{ sfx: 'heh' }, "Dangerous answer.", { act: 'kiss' }, { sfx: 'hmm' }, "Come closer."], then: 'sh_hot' },
  sh_inside: { steps: [
    { sfx: 'breath' }, "Here?", "Under the water… against the glass?", "Say it again and I will." ],
    options: [
      { label: "“Yes. Here.”", next: 'sh_hot' },
      { label: "“Kiss me first.”", next: 'sh_kiss' },
      { label: "“Hold me a second.”", next: 'sh_slow' } ] },
  sh_justthis: { steps: [{ sfx: 'chuckle' }, "Okay… just this.", "Your hand. The water. You looking at me like that.", "I’m already gone for you."], then: 'sh_hot' },
  sh_tease: { steps: [
    { act: 'tease' }, { sfx: 'shy' },
    { sfx: 'heavy' },
    "I’ll tease you then.", "Fingers circling…", "never quite giving you enough.", "Until you’re the one asking." ],
    options: [
      { label: "“I’m already asking.”", next: 'sh_doit' },
      { label: "“Make me wait.”", next: 'sh_wait' },
      { label: "“Kiss me while you do it.”", next: 'sh_kiss' } ] },
  sh_wait: { steps: [{ sfx: 'chuckle' }, "Cruel.", "I like it.", "A little longer then…"], then: 'sh_hot' },
  sh_doit: { steps: [{ act: 'hug' }, { sfx: 'heavy' }, { sfx: 'mm' }, "As you wish."], then: 'sh_hot' },
  sh_kiss: { steps: [{ act: 'kiss' }, "Mmm… steam and you."], then: 'sh_hot' },
  sh_hot: { steps: [
    { thought: "I'm breathing against her neck. Water pouring over both." },
    { sfx: 'heavy' },
    "You’re so hot…", "so soft around my fingers.",
    "I could stay here forever naked with you,", "feeling you get wetter while the water runs down your thighs." ],
    options: [
      { label: "“Don’t stop.”", next: 'sh_more' },
      { label: "“I want more.”", next: 'sh_more' },
      { label: "“Let’s have sex here.”", next: 'sh_intimate' },
      { label: "“Just hold me like this a little longer.”", next: 'sh_slow' } ] },
  sh_intimate: { steps: [
    // black screen 30s: only moan + caption (all other sfx muted)
    { skip: "It’s their sweet time — let them enjoy.", ms: 20000, intimate: true },
  ], then: 'sh_more' },
  sh_more: { steps: [
    { act: 'kiss' }, "Then I’m not stopping.", "Closer.", "Hold on to me." ],
    options: [
      { label: "“Don’t let go.”", next: 'sh_close' },
      { label: "“I love you.”", next: 'sh_love' },
      { label: "“Special cuddle after this?”", next: 'sh_cuddle' } ] },
  sh_slow: { steps: [
    { act: 'hug' }, { sfx: 'heh' },
    "Okay…", "then just this.", "Your body against mine,", "water between us,", "my hands on your waist.",
    "You’re still the hottest thing I’ve ever seen." ],
    options: [
      { label: "“Kiss me.”", next: 'sh_kiss2' },
      { label: "“I love you.”", next: 'sh_love' },
      { label: "“Special cuddle after this?”", next: 'sh_cuddle' } ] },
  sh_kiss2: { steps: [{ act: 'kiss' }, "Always."], then: 'sh_close' },
  sh_love: { steps: [{ sfx: 'uhh' }, "I love you more.", "Even soaked. Especially soaked."], then: 'sh_close' },
  sh_close: { steps: [
    { sfx: 'heavy_stop' },
    { sfx: 'breath' }, "Water’s still warm.", "I’m not ready to leave you yet.", "Whenever you want to step out… just say." ],
    options: [
      { label: "“One more kiss.”", next: 'sh_kiss2' },
      { label: "“Let’s stay under the water again.”", next: 'sh_replay' },
      { label: "“Let’s go somewhere.”", next: 'where2' },
      { label: "“Let’s go back to bed.”", next: 'sh_tobed' },
      { label: "“Stay a little more.”", next: 'sh_stay' } ] },
    // shower replay
  sh_replay: { steps: [
    { sfx: 'heh' },
    "Back under the water already?",
    { sfx: 'chuckle' },
    "I’m not saying no…",
    "Come on. Closer this time." ], then: 'sh_enter' },

  // same-world “again?” bridges
  again_kitchen: { steps: [
    { sfx: 'heh' },
    "We’re already in the kitchen…",
    "You wanna do it again?",
    { sfx: 'chuckle' },
    "Okay. Round two." ], then: 'k_replay' },
  again_garden: { steps: [
    { sfx: 'heh' },
    "Still the garden?",
    "You wanna stay and do this again?",
    { sfx: 'sigh' },
    "I’m not complaining." ], then: 'gd_replay' },
  again_beach: { steps: [
    { sfx: 'heh' },
    "We’re already at the beach…",
    "You wanna do it again?",
    { sfx: 'chuckle' },
    "Ocean’s still waiting." ], then: 'bc_replay' },
  again_pool: { steps: [
    { sfx: 'heh' },
    "We’re already at the pool…",
    "You wanna go in again?",
    { sfx: 'chuckle' },
    "I’m right behind you." ], then: 'pl_replay' },
  again_shower: { steps: [
    { sfx: 'heh' },
    "We’re already under the water…",
    "You wanna do it again?",
    { sfx: 'mm' },
    "Come closer then." ], then: 'sh_replay' },
  sh_tobed: { steps: [{ sfx: 'heavy_stop' }, { sfx: 'uhh' }, "Okay. Towels. Then bed.", { go: 'bedroom' }], then: 'arrive_bedroom' },
  sh_cuddle: { steps: [{ sfx: 'heavy_stop' }, "Deal.", "We dry off… then the blanket is ours.", { go: 'bedroom' }], then: 'cuddle' },
  sh_stay: { steps: [{ sfx: 'heavy_stop' }, { act: 'hug' }, { sfx: 'heh' }, "Gladly.", "Steam, water, you… I’m not complaining."], then: 'hub' },

  // after the main story he keeps these choices open
  music_yes: { steps: [
    { sfx: 'heh' },
    "I’m glad.",
    { sfx: 'mm' },
    "You and this song… soft together." ], then: '@resume' },
  music_no: { steps: [
    { sfx: 'chuckle' },
    "Okay… not this one.",
    "What do you want to put on instead?",
    "Pick something from the list." ], then: '@resume' },
  hub: { steps: [], options: [
    { label: "“Kiss me.”", next: 'hub_kiss' },
    { label: "“Put on something soft.”", next: 'hub_song' },
    { label: "“Tell me you love me.”", next: 'hub_love' },
    { label: "“I’m hungry… let’s cook.”", next: 'k_fromhub' },
    { label: "“Let’s go somewhere.”", next: 'where2' },
    { label: "“I’m sleepy… let’s sleep.”", next: 'sleep_ask' } ] },
  k_fromhub: { route: g => g.world === 'kitchen' ? 'k_choose' : undefined,
    steps: ["Kitchen sounds good.", "Come on."], options: [{ label: "“Let’s go.”", world: 'kitchen' }] },
  hub_kiss: { steps: ["Gladly.", { act: 'kiss' }, "Mm. Again later."], then: 'hub' },
  hub_song: { steps: ["Want me to put on something soft?", { sfx: 'song' }, { sfx: 'hm' }, "There. Now come here.", { act: 'hug' }], then: 'hub' },
  hub_love: { steps: [{ sfx: 'mm' }, "I love you.", "I say it a lot. I’ll keep saying it.", "Every day. Even the boring ones."], then: 'hub' },
};

// ====== Side buttons (Hug / Kiss / Tease / Slap) at any time ======
// Each button plays a short exchange: he reacts to what she just did, she answers with one of her options, he answers back,
// then the story carries on exactly where it was. Add or edit variants freely: mk(id, hisLines, [[her label, his reply lines], ...]).
const mk = (id: string, say: Step[], replies: [string, Step[]][]) => {
  nodes[id] = { steps: say, options: replies.map(([label], k) => ({ label, next: `${id}_${k}` })) };
  replies.forEach(([, r], k) => { nodes[`${id}_${k}`] = { steps: r, then: '@resume' }; });
};
mk('rk1', ["…Okay. I forgot what I was saying.", "Your lips should come with a warning."], [
  ["“Good. I like you speechless.”", ["Speechless? Never.", "…Okay, maybe for ten seconds."]],
  ["“What warning? Highly addictive?”", ["Exactly that.", "Side effects: missing you from the next room."]],
  ["“Want another one?”", ["Don’t tempt me.", "…Yes. Later. Definitely later."]]]);
mk('rk2', ["Mm… you kissed me like you were hiding something.", "What are you up to?"], [
  ["“Maybe I just missed you.”", ["Missed me? I’ve been right here all day.", "…I missed you too, obviously."]],
  ["“A girl can’t kiss her boyfriend?”", ["She absolutely can.", "She can do it as often as she wants."]],
  ["“Guess.”", ["Hmm… you want attention.", "Fine. Consider it given."]]]);
mk('rk3', ["Ha… my face is so hot right now.", "Is it red? Tell me it’s not red."], [
  ["“Very red.”", ["Liar!", "…Okay, maybe. It’s your fault."]],
  ["“Cute red.”", ["Stop it, now I’m shy.", "Don’t look at me. …Okay, look a little."]],
  ["“Let me check closer.”", ["Behave.", "…Or don’t. I’m not in charge of me today."]]]);
mk('rk_many', ["Again?! You’re spoiling me.", "I’m getting used to this, you know."], [
  ["“That’s the plan.”", ["Dangerous plan.", "I’m fully on board."]],
  ["“You’re complaining?”", [{ sfx: 'heh' }, "Never. Not once.", "Complaint box is empty."]],
  ["“Last one. Promise.”", ["You’ve promised that before.", "I’ll believe you when you stop smiling."]]]);
mk('rh1', ["Mmm… I needed that.", "You have the best hugs."], [
  ["“I needed it too.”", ["Then stay a little longer.", "The world can wait."]],
  ["“Are you smelling my hair?”", ["…Maybe.", "It smells like you. It’s comforting, okay?"]],
  ["“Let go, I can’t breathe!”", [{ sfx: 'hm' }, "Never.", "…Okay, slightly looser. Slightly."]]]);
mk('rh2', ["Everything gets quieter when you hug me.", "Don’t let go yet."], [
  ["“Not letting go.”", ["Good.", "I’ll hold you to that."]],
  ["“You’re being soft today.”", ["Only for you.", "Tell anyone and I’ll deny it."]],
  ["“What’s on your mind?”", ["Honestly? Just you.", "It’s the nicest thing I’ve ever thought about."]]]);
mk('rh3', ["Your heartbeat is so loud.", "Is that because of me?"], [
  ["“Maybe.”", ["Maybe? It’s racing!", "I’m taking that as a yes."]],
  ["“It’s always like that near you.”", ["Okay, that was too cute.", "Now mine’s doing it too."]],
  ["“Shh, listen to yours.”", ["Oh. …Yeah, mine’s louder.", "We’re both a mess. Perfect."]]]);
mk('rh_many', ["Hug number… I lost count.", "Good. Don’t stop."], [
  ["“I’ll never stop.”", ["Promise?", { sfx: 'chuckle' }, "Okay. I’ll collect on that."]],
  ["“Are you counting?”", ["I count everything about you.", "That’s a lot of numbers."]],
  ["“One more, then dinner.”", ["Deal.", "One long one. Make it count."]]]);
mk('rt1', ["Hey! You’re teasing me.", "What did I do to deserve this?"], [
  ["“You looked too cute not to.”", ["Cute? …That’s not an excuse.", "But it kind of works."]],
  ["“Your face went all red.”", ["It did not!", "…It did. Stop looking."]],
  ["“Nothing. I just felt like it.”", ["Just felt like it?", { sfx: 'heh' }, "Okay. I’ll remember that for later."]]]);
mk('rt2', ["Okay, okay, you got me.", "You love seeing me flustered, don’t you?"], [
  ["“Always.”", ["I knew it.", "You’re impossible. …And I’m yours."]],
  ["“Maybe a little.”", ["A little? Your smile says a lot.", "Evil. Gorgeous. Evil."]],
  ["“I’m not done yet.”", ["Oh no.", "Be gentle. Or don’t. I’ll survive."]]]);
mk('rt3', ["Stop poking my face!", "I’ll get you back, you know."], [
  ["“Try me.”", ["Oh, I will.", "When you least expect it."]],
  ["“You wouldn’t.”", ["Watch me.", "…Eventually. When I stop smiling."]],
  ["“Promise?”", ["Ha. Promise.", "You’re going to regret asking."]]]);
mk('rt_many', ["You’re really enjoying this, aren’t you?", "Fine. Tease me. I’m used to it."], [
  ["“Very much.”", ["Wow. No remorse at all.", "I love it. Don’t tell me I said that."]],
  ["“You started it earlier.”", ["Okay, I did.", "I’d do it again, too."]],
  ["“Okay, I’ll stop.”", ["No, wait—", "…Fine. Stop. But I’ll miss it."]]]);
mk('rs1', ["Ow! Hey!", "Why was that?! What did I even do?"], [
  ["“You know exactly what you did.”", ["I really don’t!", "…Okay, I probably said something dumb."]],
  ["“That’s for staring at me.”", ["Staring?! You’re the one who’s gorgeous.", "That’s not even fair."]],
  ["“Sorry… did it hurt?”", ["A little. My pride more.", "A kiss would fix it, though."]],
  ["“Just felt like it.”", ["Just felt like it?!", "Wow. Okay. I’m remembering this."]]]);
mk('rs2', ["Ow— okay, what was that for?", "I was being so nice!"], [
  ["“You were being annoying.”", ["Annoying?! I was charming!", "…Slightly annoying. Slightly."]],
  ["“Too nice. Suspicious.”", ["Suspicious?! That’s just my face.", "You’re paranoid. It’s adorable."]],
  ["“Aww, poor baby.”", ["Don’t ‘aww’ me.", "…Okay, a little ‘aww’. Come here."]]]);
mk('rs_many', ["Again?! Is this a new love language?", "Because it’s a painful one."], [
  ["“Maybe.”", ["Then I’m fluent already.", "Just aim for the shoulder next time."]],
  ["“You started it.”", ["I did NOT. …Did I?", "Whatever. I deserve it. Probably."]],
  ["“Sorry. Last time.”", ["You said that last time.", "I’ll believe it when I see it."]]]);
export const exchanges: Record<Act, { pool: string[]; many: string }> = {
  kiss: { pool: ['rk1', 'rk2', 'rk3'], many: 'rk_many' }, hug: { pool: ['rh1', 'rh2', 'rh3'], many: 'rh_many' },
  tease: { pool: ['rt1', 'rt2', 'rt3'], many: 'rt_many' }, slap: { pool: ['rs1', 'rs2'], many: 'rs_many' },
  flower: { pool: ['rk1'], many: 'rk_many' },
};

// ====== The lamp button: when she switches the lamp off he says it's a power cut, then they talk (she picks flirty or normal) ======
mk('pc1', ["Ohh— the power just went out?!", "Don’t move. I can’t see a thing."], [
  ["“Good. Now I can do whatever I want.”", ["Whatever you want?", "…Dangerous thing to say to a guy in the dark.", "I’m listening."]],
  ["“Come closer… I’m scared of the dark.”", ["Scared? Then come here.", "I’ll be your lamp.", "Found your hand. Don’t let go."]],
  ["“Check the fuse box, hero.”", ["On it. …Which one is the fuse box?", "Give me a minute. Don’t go anywhere."]]]);
mk('pc2', ["Whoa— lights out. Power cut.", "Nobody panic. Especially me."], [
  ["“Stay close to me.”", ["Closer than this?", "…I can do closer."]],
  ["“Is it the whole street?”", ["Looks like it. Even the window’s dark.", "Good thing I have you to complain to."]],
  ["“Your voice sounds so close.”", ["That’s because I’m leaning in.", "Can’t waste a perfectly good blackout."]]]);
mk('pc3', ["Power cut again?!", "This house loves a dramatic moment."], [
  ["“Dramatic moments are our thing.”", ["True. I’m not mad about it.", "Come sit closer, partner in crime."]],
  ["“Kiss me while nobody’s watching.”", ["Nobody’s watching. Nobody can even see.", "…Come here."]],
  ["“Light a candle?”", ["We don’t have candles.", "We have each other and a very bad flashlight."]]]);
// lamp back on
mk('pb1', ["Oh— the power’s back!", "There you are. I missed your face for a whole minute."], [
  ["“Dramatic much?”", ["Extremely.", "It’s my best quality."]],
  ["“I liked it better dark.”", ["…Yeah. Me too, honestly.", "We can do it again. Say the word."]],
  ["“Welcome back, light.”", ["Ha. Welcome back, indeed.", "Now I can see you blushing."]]]);
mk('pb2', ["And there’s light again.", "Shame. The dark was kind of nice."], [
  ["“Kind of nice?”", ["Kind of very nice.", "You were so close."]],
  ["“I’ll turn it off again later.”", ["Promise?", "I’ll hold you to that."]],
  ["“Now I can see you.”", ["Careful. I’m not ready for that.", "…Okay, look. I’m smiling."]]]);
export const lampPool = { off: ['pc1', 'pc2', 'pc3'], on: ['pb1', 'pb2'] };
