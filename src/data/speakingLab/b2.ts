import { buildLevelDataset, p, w, type RawCategoryBucket } from './types';

const WORD_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Academic Discourse, Logic & Rhetoric',
    styleTag: 'core',
    items: w(`
      paradigm premise syllogism deduction induction inference extrapolation synthesis antithesis
      dialectic rhetoric eloquence persuasion rebuttal refutation corroboration substantiation
      empirical anecdotal qualitative quantitative correlation causation validity reliability
      methodology epistemology ontology taxonomy hierarchy dichotomy nuance ambiguity paradox
      contradiction fallacy tautology hyperbole understatement irony sarcasm satire allegory
      metaphor metonymy juxtaposition coherence cohesion conciseness clarity precision rigor
      scrutiny skepticism objectivity subjectivity impartiality bias prejudice heuristic cognition
      metacognition intuition rationality pragmatism idealism realism utilitarianism altruism
      ethics integrity accountability transparency governance jurisprudence legislation statute
      precedent verdict arbitration mediation consensus compromise diplomacy geopolitics
      sovereignty hegemony multilateralism globalization localization modernization urbanization
      demographics socioeconomic inequality mobility meritocracy philanthropy civic engagement
      discourse narrative framing perspective standpoint worldview ideology orthodoxy heterodoxy
      dogma doctrine tenet axiom postulate corollary theorem conjecture hypothesis verification
      falsification replication peer_review monograph dissertation symposium colloquium anthology
    `),
  },
  {
    category: 'Economics, Leadership & Innovation',
    styleTag: 'core',
    items: w(`
      macroeconomics microeconomics equilibrium scarcity opportunity_cost elasticity inflation
      deflation stagflation recession austerity stimulus liquidity solvency valuation equity
      leverage capital portfolio diversification volatility benchmark arbitrage dividend yield
      subsidy tariff embargo quota deregulation privatization nationalization monopoly oligopoly
      antitrust cartel competitiveness productivity efficiency scalability sustainability viability
      disruption innovation incubation acceleration venture_capital bootstrapping crowdfunding
      valuation_cap burn_rate runway traction retention churn acquisition monetization freemium
      synergy alignment delegation empowerment mentorship stewardship vision strategy execution
      roadmap milestone deliverable stakeholder shareholder fiduciary compliance governance_board
      audit transparency_report logistics procurement inventory_turnover supply_chain resilience
      outsourcing offshoring automation augmentation optimization iteration prototyping ergonomics
      intellectual_property copyright patent_pending licensing royalty franchising negotiation
      concession deadlock impasse mediation_panel arbitration_award resolution consensus_building
      entrepreneurship intrapreneurship philanthropy social_enterprise microfinance circular_economy
    `),
  },
  {
    category: 'Science, Medicine & Future Frontier',
    styleTag: 'core',
    items: w(`
      neuroscience neuroplasticity synapse neurotransmitter dopamine serotonin cortisol circadian
      homeostasis immunology pathogen antibody antigen epidemic pandemic epidemiology etiology
      prognosis pathology pharmacology genomics epigenetics biotechnology bioethics longevity
      prosthetics telemedicine diagnostics biomimicry nanotechnology quantum_computing entanglement
      superposition cryptography blockchain decentralization interoperability latency throughput
      algorithmic machine_learning neural_architecture inference_engine hallucination alignment
      astrophysics cosmology exoplanet terraform propulsion orbital_mechanics gravitational_wave
      dark_matter singularity spectroscopy thermodynamics entropy superconductivity fusion_energy
      fission electrolysis decarbonization sequestration reforestation agroecology permaculture
      hydroponics desalination watershed_management biodiversity_hotspot ecological_footprint
      anthropocene paleontology stratigraphy archaeology radiocarbon_dating anthropology ethnography
      linguistics phonology morphology syntax semantics pragmatics sociolinguistics psycholinguistics
      semiotics acoustics optics photonics metallurgy polymers graphene composite aerodynamics
      hydrodynamics seismology meteorology climatology oceanography bathymetry glaciology volcanology
    `),
  },
  {
    category: 'Arts, Literature, Film & Aesthetics',
    styleTag: 'core',
    items: w(`
      aesthetics sublime avant_garde minimalism surrealism impressionism expressionism cubism
      baroque renaissance neoclassical romanticism modernism postmodernism realism naturalism
      chiaroscuro impasto fresco lithograph etching sculpture_relief kinetic_art installation
      curation provenance retrospective patronage connoisseur virtuoso maestro prodigy ensemble
      counterpoint polyphony dissonance resonance timbre crescendo diminuendo staccato legato
      improvisation syncopation acoustics choreography libretto soliloquy monologue denouement
      foreshadowing flashback epiphany catharsis hubris nemesis tragicomedy Bildungsroman
      pastiche parody motif leitmotif symbolism imagery cadence prose_poetry sonnet_form
      haiku_verse elegy ode ballad epic_poem cinematography montage chiaroscuro_lighting mise_en_scene
      auteur storyboard voiceover soundscape Foley_art documentary_cinema neorealism animation_cel
      architecture brutalism Art_Deco gothic_arch cantilever facade atrium colonnade acoustic_hall
      calligraphy typography kerning layout_grid iconography heraldry tapestry_weave ceramics
    `),
  },
  {
    category: 'Psychology, Character & Human Dynamics',
    styleTag: 'core',
    items: w(`
      resilience perseverance fortitude equanimity composure poise serenity mindfulness empathy
      compassion benevolence magnanimity generosity humility modesty candor authenticity integrity
      rectitude diligence tenacity grit resolve conviction autonomy agency self_efficacy
      introspection reflection self_awareness emotional_intelligence charisma rapport diplomacy
      tact discretion prudence foresight discernment acumen sagacity erudition curiosity
      wonder awe gratitude reverence optimism buoyancy adaptability versatility resourcefulness
      ingenuity originality spontaneity whimsy melancholy nostalgia wistfulness ambivalence
      trepidation apprehension consternation exasperation indignation resentment apathy lethargy
      complacency hubris vanity pretentiousness cynicism skepticism stoicism vulnerability
      camaraderie solidarity kinship reciprocity hospitality cordiality conviviality collegiality
      mentorship stewardship altruism civic_mindedness patriotism cosmopolitanism tolerance pluralism
      reconciliation forgiveness redemption atonement conscience remorse contrition catharsis_feel
    `),
  },
  {
    category: 'High-Precision Verbs',
    styleTag: 'core',
    items: w(`
      abridge accentuate acclaim acclimatize corroborate delineate demarcate demystify denote
      depict deplore deprecate derive destabilize deter deviate devise diagnose differentiate
      diffuse digress dilate dilute diminish discern disclose discourse discredit discriminate
      disentangle dismantle disparage dispatch dispel dispense disperse displace disseminate
      dissent dissipate dissuade distill distinguish distort distract diverge diversify divert
      divest divulge document domesticate dominate donate dramatize dwindle eclipse economize
      edify efface elaborate elevate elicit elucidate emanate emancipate embark embellish
      embody embrace emerge emulate enable enact encapsulate encompass encounter encroach
      encumber endorse endow endure enforce engender engrave enhance enigma_solve enlighten
      enlist enrich enroll ensue ensure entail entangle enthrall entice entitle entrench
      entrust enumerate enunciate envision epitomize equate equilibrate equip eradicate erase
      erect erode err escalate eschew espouse establish esteem estimate estrange etch
      evacuate evade evaluate evaporate evoke evolve exacerbate exact exaggerate exalt
      examine exasperate excavate exceed excel excerpt exchange excite exclaim exclude excoriate
      exculpate execute exemplify exempt exercise exert exhale exhaust exhibit exhilarate exhort
      exhume exile exist exonerate expand expatriate expect expedite expel expend experience
    `),
  },
  {
    category: 'Sophisticated Adjectives & Modifiers',
    styleTag: 'core',
    items: w(`
      ubiquitous ephemeral quintessential pragmatic meticulous scrupulous fastidious conscientious
      diligent assiduous tenacious relentless resolute steadfast unwavering stalwart intrepid
      audacious enterprising resourceful ingenious innovative pioneering groundbreaking seminal
      formidable compelling cogent persuasive eloquent articulate lucid succinct concise terse
      verbose loquacious garrulous reticent taciturn laconic enigmatic cryptic esoteric arcane
      recondite abstruse opaque pellucid transparent limpid luminous incandescent radiant resplendent
      ornate opulent sumptuous austere ascetic Spartan stark bleak somber lugubrious poignant
      evocative haunting nostalgic idyllic pastoral serene tranquil placid halcyon turbulent
      tempestuous volatile erratic capricious mercurial whimsical eccentric idiosyncratic eclectic
      heterogeneous homogeneous monolithic ubiquitous_norm sporadic intermittent perennial perpetual
      incessant relentless_pace nascent fledgling burgeoning thriving flourishing stagnant dormant
      obsolete antiquated archaic anachronistic contemporary cutting_edge unprecedented anomalous
      paradoxical ironical satirical facetious sardonic acerbic trenchant incisive astute
      perspicacious perceptive discerning judicious prudent circumspect wary vigilant meticulous_eye
    `),
  },
  {
    category: 'Single-Syllable Mastery & Sound Contrasts',
    styleTag: 'single_syllable',
    items: w(`
      aught bade baize balk balm bard baste bawl bayou_dip beach_head beau_ideal beck
      belch berth bight bilge binge birr blanch blare blear bleeps blench blight blithe_air
      bloat blotch blouse bludgeon blurb blurt blush boar bode bogle bogue boil bold
      boll bolt bomb bond bone bong book boom boon boor boost boot booth booze
      bore born borsch bort boss botch both bough bounce bound bout bow bowl box
      brace bract brad brag braid brain brake brand brash brass brat brave brawl brawn
      bray braze breach bread break bream breast breath breech breed breeze breve brew briar
      bribe brick bride bridge brief brig brim brine bring brink brisk broad broil broke
      brood brook broom broth brow brown browse bruise bruit brunt brush brute buck budge
      buff build bulb bulge bulk bull bump bunch bung bunk bunt buoy burl burn
      burp burr burst busk buss bust butch butt buy buzz byre byte cache cadge
      cage cairn cake calf calk call calm calve came camp cane cant cape car
      card care carp cart carve case cash cask cast catch caulk cause cave caw
      cease cede ceil cell cent chaff chain chair chalk champ chance change chant chap
      char charge charm chart chase chasm_one chat cheap cheat check cheek cheep cheer cheese
      chef chess chest chew chic chick chide chief child chill chime chimp chin chine
      chink chip chirp chive chock choice choir choke chomp choose chop chord chore chose
      chow chuck chug chum chump chunk churn chute cinch cite clad claim clam clamp
      clan clang clank clap clash clasp class clause claw clay clean clear cleat cleave
      cleft clench clerk click cliff climb clime clinch cling clink clip cloak clock clod
      clog clomp clone close cloth cloud clout clove clown cloy club cluck clue clump
    `),
  },
  {
    category: 'Multisyllable Mastery (4–7 Syllables)',
    styleTag: 'multisyllable',
    items: w(`
      accountability acknowledgment acronymous adaptability administrative aerodynamic aestheticism
      affability aggrandizement alphanumerical ambiguity amelioration anachronistic analytical
      anatomical animadversion annihilation anonymity antagonism anthropocentric anthropological
      anticipation antidisestablishmentarianism antipathetic apocalyptical apologetically
      appreciatively approachability appropriateness approximation arbitrarily archaeological
      architectural aristocracy arithmetical articulation artificiality assimilation association
      astronomical asymmetrically atmospherical audaciousness authenticity authoritarianism
      autobiographical automatization availability avant_gardism bacteriologist barometrical
      beatification beneficently benevolence bibliographer bicentennial bilateralism biochemically
      biodegradable biodiversity bioengineering biographical bioluminescence biomechanical
      biotechnology breathtakingly bureaucratic cacophonous calligraphy cannibalization
      capability capitalization capitulation capriciousness cardiovascular caricature cartographical
      catastrophically categorization Catholicism celebratory centralization ceremonialism
      certification chairmanship chameleonic characterization charitable choreography chronological
      cinematography circumnavigation circumstantial civilization clarification classification
      claustrophobic climatological collaboration collectivism colonialist colorimetrical
      commemorative commercialization commodification communication communitarian companionable
      comparatively compatibility compartmentalize compassionately compensation competitiveness
      complementarity complexity complimentary comprehensibility comprehensiveness computational
      concatenation centralization_hub conceptualization reconciliation_act condensation_point
      confidentiality configurational confirmation_bias congratulatory congregationally
      conscientiousness consequentialism conservationist considerably consideration_deep
      consistency_key consolidation_act constellation_set constitutionalism constructivism
      consultative contemporaneity contextualization continuation_act contradiction_key
      contrapuntal controversialist conventionality conversationalist cooperativeness coordination
      correspondence_key corroboration cosmopolitanism counterintuitive counterrevolutionary
      credibility_check criminological crystallization culinary_art cultural_relativism
      cumulative_effect curricular_map customization_key cybernetics_lab decaffeinated
      decentralization declassification decolonization deconstruction deforestation
      degenerative dehumanization deliberation delineation democratization
      demonstratively demystification denomination denunciation departmentalize
    `),
  },
  {
    category: 'Difficult & Rare C1/B2 Stretch Lexicon',
    styleTag: 'difficult',
    items: w(`
      aberration abeyance abject abjure ablution abnegation abominate aboriginal abortive abrade
      abrogate abscond absolve abstemious abstinent abstruse abysmal accede accentuate accessible
      accessory acclaim acclivity accolade accomplice accord accost accretion accrue acerbic
      achromatic acme acoustic acquiesce acquit acrid acrimonious acronym acumen acute
      adage adamant adapt addendum addiction addle adduce adept adequate adhere adherent
      adhesion adjacent adjunct adjure admonish adolescent adopt adore adorn adroit adulation
      adulterate adumbrate advent adventitious adversary adverse adversity advert advertise
      advocacy advocate aegis aerie aesthetic affable affected affection affidavit affiliate
      affinity affirm affix affliction affluence affluent afford affront afoot aftermath
      agape agenda aggrandize aggravate aggregate aggression aggrieve aghast agile agitate
      agnostic agrarian agree agreeable ailment airy akin alacrity albeit alchemy
      alcove alert alias alibi alienate align alimentary allay allege allegiance allegory
      alleviate alliteration allocate allot alloy allude allure allusion alluvial ally
      almanac aloof aloft altercation altruistic amalgamate amass amateurish ambidextrous ambience
      ambiguous ambition ambivalent amble ambrosia ambulatory ambush ameliorate amenable amend
      amenities amiable amicable amiss amity amnesia amnesty amoral amorphous amortize
      amphibian amphitheater ample amplify amplitude amputate amulet amuse anachronism analgesic
      analogous analogy anarchy anathema anatomy ancestry anchor ancillary anecdote anemia
      anesthetic anguish angular animadversion animate animosity animus annals annex annihilate
      annotate announce annoy annual annuity annul anodyne anoint anomalous anomaly
      anonymity anonymous antagonism antecede antecedent antediluvian anthem anthology anthropoid
      anthropology anticlimax antidote antipathy antiquated antiquity antithesis anvil apathy
      ape aperture apex aphorism apiary aplomb apocalyptic apocryphal apogee apolitical
      apologist apologize apoplexy apostasy apostate apothecary apothegm apotheosis appall
    `),
  },
];

const PHRASE_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Debate, Persuasion & Academic Discourse',
    styleTag: 'core',
    items: p(`
      At first glance, that proposal appears cost-effective, yet it overlooks long-term maintenance.
      Allow me to unpack the underlying premise before addressing the counterargument.
      The empirical evidence overwhelmingly corroborates what educators have observed for decades.
      While correlation can highlight fascinating patterns, it must never be mistaken for causation.
      What differentiates a resilient city from a fragile one is proactive green infrastructure.
      I wholeheartedly concede that automation improves efficiency; nevertheless, human judgment remains irreplaceable.
      Let us examine this dilemma through three distinct lenses: ethical, economic, and environmental.
      To substantiate that claim, consider how bilingualism measurably enhances cognitive flexibility.
      Rather than framing this as an either-or dichotomy, why not pursue a hybrid model?
      One striking implication of this study is that curiosity predicts mastery even more than raw speed.
      Could you clarify whether your statistics account for regional demographic shifts?
      Even if we grant that short-term transition costs are steep, inaction carries a far higher price.
      It is imperative that emerging technologies remain transparent, accountable, and inclusive.
      From a pragmatic standpoint, piloting the curriculum across two schools first minimizes risk.
      That distinction may seem subtle on paper, yet in practice it transforms the student experience.
      Allow me to reframe the debate around a question everyone in this room cares deeply about.
      Compelling rhetoric moves an audience only when anchored in verifiable facts and empathy.
      In synthesizing both perspectives, a remarkably coherent third option begins to emerge.
      Notice how the author juxtaposes quiet domestic scenes against sweeping historical upheaval.
      To avoid confirmation bias, strong thinkers actively seek out credible dissenting viewpoints.
      By any objective metric, early investment in arts education yields extraordinary lifelong dividends.
      Let us scrutinize the methodology before drawing sweeping generalizations from a small sample.
      In closing, progress rarely arrives overnight; it is forged through patient, principled dialogue.
      I appreciate the rigor of your rebuttal—it forced our side to sharpen every assumption.
      Ultimately, critical thinking empowers young citizens to navigate an age of rapid change.
      Without clear benchmarks for accountability, even the noblest policy risks losing momentum.
      Let me bridge those two ideas with a real-world case study from Copenhagen and Singapore.
      That raises a profound philosophical question about what we owe to future generations.
      Maintaining composure and civility under fierce questioning is the hallmark of mature leadership.
      Thank you, judges and fellow debaters, for an exhilarating and intellectually rich round!
    `),
  },
  {
    category: 'Executive Interviews, Hosting & Public Speaking',
    styleTag: 'core',
    items: p(`
      Good evening, distinguished guests, educators, and fellow innovators—welcome to the summit!
      Before we begin, take three seconds to imagine a classroom without walls or borders.
      What catalyzed this initiative was a single conversation with a curious ten-year-old student.
      Walk me through a time when a project went off track and how you steered it back.
      Initially, our prototype fell short of expectations; however, user interviews revealed the root cause.
      By iterating rapidly and listening without ego, we tripled engagement within six weeks.
      If selected for this fellowship, I intend to bridge STEM innovation with community storytelling.
      My greatest strength lies in translating dense technical concepts into clear, engaging narratives.
      One area I am actively refining is delegating earlier rather than trying to carry every detail solo.
      Let us pivot now to the financial sustainability and community impact of our proposal.
      As illustrated by the upward trajectory on screen, retention rose steadily quarter after quarter.
      Pause right there—that single statistic tells the entire story far better than ten bullet points.
      Our keynote speaker tonight has spent two decades pioneering coral restoration across the Pacific.
      It is my genuine honor to welcome an extraordinary mentor and storyteller to the stage!
      That was a truly illuminating talk—let us dive straight into our fireside Q&A!
      You mentioned earlier that failure is an indispensable teacher; could you share a defining example?
      For students watching from across Southeast Asia, what daily habit builds lasting fluency?
      We have time for one final question from the balcony—please step up to the microphone!
      Thank you for articulating such a nuanced question; let me respond from two angles.
      Wrapping up tonight's panel, one theme echoed through every speaker's journey: courageous curiosity.
      When you step onto a stage, remember it is never about perfection—it is about genuine connection.
      Controlling your breathing stabilizes your vocal resonance and projects quiet authority.
      Delivering a crisp opening hook within ten seconds earns your audience's full attention.
      Varying sentence length creates natural musicality that keeps listeners leaning forward.
      Let us acknowledge the tireless volunteers backstage who made this international broadcast seamless!
      Before we adjourn, scan the screen to access our open-source toolkit and bilingual study guide.
      I welcome any candid feedback afterward so we can make next year's symposium even stronger.
      Thank you for your generous attention, thoughtful questions, and infectious enthusiasm tonight!
      Keep questioning, keep building, and keep amplifying voices that deserve to be heard.
      Good night everyone, and safe travels home!
    `),
  },
  {
    category: 'Global Affairs, Culture & Literature Analysis',
    styleTag: 'core',
    items: p(`
      Preserving endangered languages safeguards irreplaceable ecological knowledge and oral history.
      When traditional craftsmanship collaborates with contemporary design, heritage thrives anew.
      Urban planners worldwide are reclaiming concrete highways to create vibrant pedestrian greenways.
      Great literature invites us to inhabit lives vastly different from our own with deep empathy.
      Notice how the novelist employs weather imagery to mirror the protagonist's internal turmoil.
      Although the ending remains deliberately ambiguous, it lingers in the reader's mind for days.
      Cross-cultural misunderstandings often stem from unspoken assumptions about directness and politeness.
      Studying world cinema reveals how universal human hopes transcend borders and dialects.
      Balanced journalism requires distinguishing verified reporting from persuasive opinion columns.
      Digital literacy today means pausing to verify provenance before sharing a viral headline.
      Public libraries endure as vital democratic sanctuaries where curiosity costs nothing.
      Climate adaptation demands both bold international treaties and nimble grassroots solutions.
      Circular economies redesign products from inception so yesterday's waste becomes tomorrow's input.
      Why do ancient proverbs continue to resonate in an era of smartphones and satellites?
      Because human nature—our yearning for belonging, fairness, and meaning—evolves far more slowly than tech!
      Music acts as a universal grammar capable of uniting strangers within a single chorus.
      Restoring historic neighborhoods requires honoring architectural memory while meeting modern accessibility needs.
      Global trade connects distant artisans with appreciative audiences, provided supply chains stay ethical.
      International student exchanges dissolve stereotypes faster than any textbook chapter ever could.
      In an interconnected world, multilingual thinkers serve as indispensable bridges between communities.
      Examining history through multiple primary sources guards against oversimplified myths.
      Every culinary dish carries centuries of geography, migration, and creative improvisation on a plate!
      Thoughtful tourism enriches host communities rather than overwhelming fragile ecosystems.
      When museums repatriate cultural artifacts, they foster long-overdue dialogue and mutual respect.
      True cosmopolitanism means celebrating your own roots while remaining genuinely curious about others.
      How can youth councils play a substantive role in shaping local sustainability policies?
      Mentorship across generations blends youthful boldness with hard-won practical wisdom.
      Art does not merely mirror society; at its finest, it stretches our collective imagination.
      Every fluent conversation across cultures is a quiet act of everyday diplomacy.
      May our curiosity stay fearless and our empathy stay boundless!
    `),
  },
  {
    category: 'Everyday Sophisticated Nuance & Tact',
    styleTag: 'core',
    items: p(`
      I hate to be the bearer of complicated news, yet we need to revisit our launch timeline.
      With all due respect, I believe rushing this release could compromise our reputation for quality.
      Let me play devil's advocate for a moment to pressure-test our strongest assumptions.
      That is a remarkably thoughtful suggestion—let us figure out how to weave it in seamlessly.
      I couldn't agree more with your diagnosis; the real challenge lies in consistent execution.
      To be completely candid, I had serious reservations at first, yet the results won me over!
      Would you be open to exploring a phased rollout rather than an all-or-nothing switch?
      I completely understand why that delay felt frustrating, and here is how we will make it right.
      Let us table that side issue for fifteen minutes so we can resolve the core bottleneck first.
      You have a real gift for spotting subtle patterns that almost everyone else overlooks!
      If memory serves me right, we encountered a strikingly similar hurdle during last spring's showcase.
      Don't hesitate to push back if any part of this draft feels overly dense or convoluted.
      It goes without saying that everyone's late-night contribution made this milestone possible.
      Looking at the bigger picture, a two-day postponement is trivial compared to getting it right.
      I am genuinely torn—both candidates bring complementary strengths to the editorial team.
      Let us sleep on these options and reconvene tomorrow morning with fresh eyes.
      Credit where credit is due: your calm diplomacy turned a tense meeting into a breakthrough!
      I stand corrected—thank you for pointing out the updated census figures so tactfully!
      On second thought, simplifying the opening slide will let your spoken story shine brighter.
      Nothing beats a crisp walk outdoors when your creative momentum hits a stubborn wall.
      Balancing ambitious goals with sustainable rest is an art worth mastering early in life.
      She has an uncanny knack for asking the exact question that unlocks a stalled discussion.
      Let us keep expectations realistic while still leaving room for pleasant surprises!
      That gesture of quiet kindness spoke volumes without needing a single grand announcement.
      Thank you for giving me the benefit of the doubt while we sorted out the technical glitch.
      There is a fine line between healthy perfectionism and endless procrastination!
      Once you strip away the jargon, the core idea is wonderfully intuitive and elegant.
      I wouldn't trade the lessons from that chaotic first hackathon for anything in the world!
      Let us celebrate this win tonight, then set our sights on an even bolder horizon tomorrow.
      Staying endlessly teachable is the truest superpower at any stage of life!
    `),
  },
  {
    category: 'Science, Ethics, Innovation & Leadership',
    styleTag: 'core',
    items: p(`
      Breakthrough discoveries rarely emerge in isolation; they flourish where diverse disciplines intersect.
      Designing ethical AI requires auditing training data for hidden biases long before public deployment.
      How do we foster bold scientific curiosity while upholding rigorous safety benchmarks?
      Biomimicry reminds engineers that nature has already solved countless efficiency puzzles over millennia.
      Transparent science communication empowers citizens to make informed decisions during public health crises.
      Transitioning an entire grid to renewable energy demands parallel breakthroughs in battery storage.
      True leadership is measured less by individual accolades and more by how many others you empower.
      When evaluating a bold startup claim, always ask what assumptions must hold true for it to scale.
      Open-source collaboration enables students in Ho Chi Minh City and Toronto to build together in real time.
      Quantum encryption promises to reshape digital security in ways we are only beginning to grasp.
      Investing in preventive healthcare delivers dramatically higher human well-being than emergency intervention alone.
      Sustainable urban architecture pairs passive solar cooling with abundant shade canopies and walkable streets.
      What safeguards ensure that rapid automation broadens human creativity instead of narrowing opportunity?
      Peer-reviewed replication is the quiet backbone separating durable truth from flashy one-off headlines.
      Effective mentors resist giving instant answers; instead, they ask the probing question that unlocks insight.
      Protecting ocean ecosystems is inseparable from stabilizing global weather patterns and coastal livelihoods.
      Iterative prototyping lowers the emotional cost of failure by treating every version as a learning step.
      Cross-generational teamwork unites seasoned institutional memory with fearless digital fluency.
      How can youth innovators ensure accessibility is engineered from day one rather than bolted on later?
      Clear data storytelling turns raw spreadsheets into compelling catalysts for civic action.
      Intellectual humility—the willingness to revise your stance when stronger evidence arrives—is rare and vital.
      Circular supply chains challenge manufacturers to design electronics for effortless repair and reuse.
      Studying neuroscience has transformed how educators approach spaced repetition, sleep, and active recall.
      When a crisis hits, calm preparation and clear delegation matter infinitely more than loud urgency.
      Global space exploration exemplifies how peaceful scientific collaboration can transcend national rivalries.
      Cultivating deep focus in an economy engineered for distraction is a decisive modern advantage.
      Every algorithm reflects human values—whether consciously articulated or inadvertently embedded.
      How might local micro-forests transform heat islands across rapidly growing Southeast Asian cities?
      Ethical persuasion informs and elevates the listener rather than exploiting fear or haste.
      Building psychological safety inside a team unleashes candid feedback and sharper creative risks.
      Long-term stewardship asks us to weigh how today's convenience echoes seven generations from now.
      The most transformative leaders listen intently to voices at the margins before finalizing policy.
      Curiosity without rigor drifts into speculation; rigor without curiosity stalls into routine.
      Bridging humanities and engineering equips future builders to ask not only "can we?" but "should we?"
      Innovation at its highest calling expands human dignity, joy, and shared flourishing!
    `),
  },
  {
    category: 'Advanced Idioms & Nuanced Metaphors',
    styleTag: 'idiom',
    items: p(`
      The committee decided to err on the side of caution until independent safety audits concluded.
      Her groundbreaking essay really set the cat among the pigeons across the entire department!
      Let us separate the wheat from the chaff and focus exclusively on verified data.
      He has an uncanny ability to read the room before uttering a single word.
      Turning down that shortcut proved he wasn't willing to compromise his principles for quick applause.
      Our ambitious timeline was a double-edged sword: it sparked focus, yet raised stress levels.
      Don't rest on your laurels after one great semester—keep stretching your vocabulary!
      The sudden funding grant arrived as a bolt from the blue just when we needed it most.
      She weathered the storm of harsh criticism with remarkable grace and composure.
      That loophole in the rulebook opened a veritable Pandora's box of unintended debates.
      He went out on a limb defending an unpopular idea, and six months later it proved visionary!
      We need to cut through the red tape so student-led green projects can launch before summer.
      Her closing metaphor drove the point home with unforgettable emotional clarity.
      Taking everything at face value without questioning sources is a recipe for misinformation.
      They buried the hatchet after the tense finals and collaborated on a charity concert!
      That tiny oversight turned out to be the Achilles' heel of an otherwise brilliant prototype.
      Let us not throw caution completely to the wind—calculated boldness beats reckless haste.
      His documentary struck gold by letting ordinary neighborhood elders narrate their own history.
      She had her work cut out for her coordinating twelve international time zones seamlessly.
      It is a watershed moment whenever a young speaker realizes their voice genuinely moves people.
      Don't let the perfect become the enemy of the good when drafting your first script.
      He passed the baton gracefully to the next generation of student club leaders.
      We navigated uncharted waters together and emerged far more resourceful than before.
      Her candid remarks were a breath of fresh air after hours of scripted speeches.
      Let us keep our finger on the pulse of how young audiences actually discover new books.
      That compromise proved to be the linchpin holding the entire coalition together.
      He hit a glass ceiling until he stepped outside his specialty and learned systems design.
      Reading widely across disciplines connects dots that narrow specialists rarely notice.
      She gave credit generously rather than hogging the limelight after the standing ovation.
      The devil is always in the details when translating subtle humor between languages!
      Let us turn over a new leaf and approach this semester with curiosity instead of anxiety.
      His witty improvisation saved the live broadcast from grinding to a halt.
      That speech was a tour de force of clarity, humor, and heartfelt conviction!
      When push comes to shove, integrity always outlasts temporary applause.
      Strike while the iron is hot and apply while your momentum is peaking!
    `),
  },
  {
    category: 'World Cultural Phrases & Dialects (US, UK, AU, CA, IE, NZ, SG, ZA)',
    styleTag: 'cultural',
    items: p(`
      [UK] That architectural lecture was utterly riveting—I was completely absorbed from start to finish!
      [UK] Let us not make a song and dance about a minor typo; we can fix it in two seconds.
      [UK] He is terribly polite, so when he says "quite interesting," read between the lines!
      [UK] That indie film didn't quite live up to the billing, though the soundtrack was smashing.
      [UK] We got caught in a proper downpour on the Tube walk and arrived looking like drowned rats!
      [UK] Cheers for flagging that discrepancy—you have got an eagle eye for detail!
      [UK] It is swings and roundabouts: shorter commutes mean higher rent, and vice versa.
      [UK] Let us have a proper natter over scones once exam season wraps up!
      [AU] Fair go, mate—give every team member an equal shot at presenting their prototype!
      [AU] That documentary on Outback astronomy was an absolute corker!
      [AU] Don't spit the dummy over tough refereeing—channel that fire into cleaner footwork!
      [AU] He isn't here to muck around; he had the entire dataset visualized before morning tea!
      [AU] Tall poppy syndrome shouldn't ever dim anyone's pride in genuine hard work!
      [AU] Let us duck out for a quick yarn by the harbour once the workshop finishes.
      [AU] Good on ya for backing yourself and auditioning for the lead debate slot!
      [US] Let us peel back the onion on why rural broadband adoption stalled last year.
      [US] That startup pitch really moved the needle with the impact-investing judges!
      [US] Let us not boil the ocean—ship a crisp pilot first and iterate from real feedback!
      [US] She hit a grand slam during the Q&A by citing three independent field studies.
      [US] Keep your ear to the ground for summer research fellowships opening in March.
      [US] That bipartisan town hall was a surprisingly constructive meeting of the minds.
      [CA] Navigating both English and French signage in Montreal gives the city effortless flair.
      [CA] Grab your winter boots—there is black ice along the walkway this morning, eh?
      [CA] We spent the long weekend portaging canoes between mirror-still lakes in Algonquin!
      [CA] Sorry to circle back so late, yet I wanted to share the revised slide deck before dawn.
      [CA] That indie folk trio from Halifax completely stole the festival spotlight!
      [IE] There is no harm in chancing your arm and applying for that dream mentorship!
      [IE] He has the gift of the gab—he could turn a bus timetable into riveting theater!
      [IE] We were blown away by the fierce warmth and hospitality across every village in Kerry.
      [IE] Fair dues to the organizing crew—not a single microphone glitched all night!
      [NZ] Kia ora tatou—acknowledging the land and community sets a grounded tone for our forum.
      [NZ] That tramping track along the Routeburn was next-level breathtaking, sweet as!
      [NZ] Yeah nah, rushing the environmental review would be a massive own-goal long term.
      [NZ] She brought serious mana and calm leadership to the international youth delegation!
      [SG] Don't just study rote—think creatively so your ideas stand out, can lah!
      [SG] Wah, that bilingual MC transitioned between English and Mandarin so effortlessly, steady pom pi pi!
      [SG] Let us gather at the kopitiam to debrief after the regional robotics finals!
      [ZA] Ubuntu reminds us that our humanity flourishes only when we uplift one another!
      [ZA] That coastal drive down Chapman's Peak at dusk was genuinely next-level lekker!
      [ZA] Howzit team—sharp-sharp, let us run through the final rehearsal cues once more!
    `),
  },
  {
    category: 'Sophisticated Colloquialisms & Contemporary Slang',
    styleTag: 'slang',
    items: p(`
      Honestly, that keynote speaker dropped pure gold for twenty minutes straight!
      Not gonna lie, once you get past the initial jitters, live debate is genuinely addictive.
      Low-key, the quietest researcher on our panel had the sharpest take of the whole night!
      No cap, mastering syllable stress completely transformed how confident I sound on mic!
      That indie documentary lives rent-free in my head—the cinematography was unreal.
      Let us stop overthinking the slides and just cook—our core narrative is already rock solid!
      Big respect to anyone willing to own a mistake publicly and pivot gracefully!
      Wait, hear me out: what if we open the showcase with a sixty-second acoustic poem?
      She effortlessly ate up the toughest rebuttal round without breaking a sweat!
      That museum exhibition totally passed the vibe check—interactive, thoughtful, and gorgeous.
      I am high-key obsessed with etymology now that I see how languages borrow from each other!
      Don't sleep on regional accents—understanding Scottish, Aussie, and Kiwi cadence makes you unstoppable!
      Honestly, trying to memorize scripts word-for-word is a trap; internalize the beats instead!
      Hard pass on dull bullet-heavy slides—let us tell the story visually and conversationally!
      That coding hack saved us literally three hours of tedious formatting—absolute lifesaver!
      Fair play, I was skeptical at first, yet your data visualization completely convinced me!
      Let us lock in for one clean dress rehearsal so tomorrow's gala feels effortless!
      Plot twist: our backup demo ended up impressing the judges even more than plan A!
      He is seriously built different when it comes to improvising witty transitions on stage!
      Zero gatekeeping here—let us share our whole pronunciation checklist with the younger class!
      My brain is officially fried after three back-to-back mock interviews; time for green tea!
      That melody hits right in the feels every time the strings swell in the chorus.
      Give yourself some grace—fluency is a marathon, not an overnight sprint!
      Whoa, that architectural time-lapse just scratched an itch in my brain—so satisfying!
      I am totally here for classrooms that blend coding, music, poetry, and public speaking!
      Spill the secret—how did you keep your voice so calm under those bright studio lights?
      That transition from humor to heartfelt sincerity was chef's kiss perfection!
      Shout-out to every mentor who pushed us gently out of our comfort zones this year!
      Hands down, the most rewarding part of learning English is making real friends worldwide!
      Let us wrap this up on a high note—we came, we spoke, we crushed it!
      Real talk: confidence isn't the absence of nerves; it is speaking clearly right alongside them.
      That counterexample completely flipped the script on our entire seminar discussion!
      Keep showing up, keep experimenting, and watch your voice become your greatest signature!
      All vibes, zero stress—let us take a deep breath and nail this final challenge!
      Catch you at the next global showcase—stay curious and stay bold!
    `),
  },
];

export const B2_DATASET = buildLevelDataset('b2', WORD_BUCKETS, PHRASE_BUCKETS);
