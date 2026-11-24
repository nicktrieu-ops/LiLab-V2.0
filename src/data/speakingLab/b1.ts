import { buildLevelDataset, p, w, type RawCategoryBucket } from './types';

const WORD_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Academic & Critical Thinking',
    styleTag: 'core',
    items: w(`
      abstract accuracy achieve analysis analyze approach argument assessment assumption authority
      available benefit concept conclude conclusion conduct consequence consistent context contrast
      contribute contribution data debate define definition demonstrate derive design determine
      develop development distinguish distribution economy element emphasis emphasize environment
      establish estimate evaluate evidence factor feature focus formula framework function generate
      hypothesis identify illustrate impact implement implication indicate individual influence
      interpret interpretation investigate issue justify logic logical maintain major method
      methodology modify monitor objective obtain occur outcome overall perspective phase phenomenon
      policy positive potential precise predict principle priority procedure process produce
      project promote proportion prove publish purchase range react reaction region register
      regulate reinforce reject relate relevant rely remove require research resolve resource
      respond response restore restrict retain reveal review revise role scheme section sector
      select sequence series shift significant similar source specific strategy structure submit
      subsequent substitute sufficient summarize summary supplement survey sustain symbol target
      technique technology temporary theory thesis topic tradition transfer transform transition
      trend trigger ultimate undergo underlie unique utilize valid validity variable vary version
    `),
  },
  {
    category: 'Global Culture, History & Society',
    styleTag: 'core',
    items: w(`
      ancestor heritage folklore chronicle dynasty empire republic democracy constitution parliament
      citizenship community diversity inclusion equality justice freedom liberty solidarity tolerance
      diplomacy treaty alliance sovereignty migration diaspora settlement urbanization civilization
      architecture cathedral pagoda citadel monument artifact relic manuscript inscription calligraphy
      tapestry porcelain lacquerware embroidery sculpture fresco mosaic symphony opera ballet
      cinema literature poetry novel biography memoir essay journalism broadcast editorial headline
      documentary censorship copyright ethics morality philosophy spirituality ritual ceremony
      pilgrimage festival carnival jubilee commemoration anniversary hospitality etiquette protocol
      cuisine gastronomy delicacy spice harvest agriculture craftsmanship guild artisan merchant
      commerce trade export import tariff currency inflation recession prosperity philanthropy
      charity volunteerism activism advocacy campaign petition referendum ballot consensus debate
      dialect vernacular accent idiom proverb metaphor allegory satire irony symbolism mythology
      legend archetype hero Odyssey renaissance enlightenment revolution reformation independence
    `),
  },
  {
    category: 'Science, Innovation & Environment',
    styleTag: 'core',
    items: w(`
      ecosystem biodiversity habitat conservation sustainability ecology climate atmosphere stratosphere
      troposphere ozone carbon emissions renewable geothermal hydroelectric photovoltaic turbine
      biomass biofuel compost recycling deforestation reforestation desertification erosion glacier
      permafrost permafrost_melt drought tsunami earthquake volcano eruption seismic tectonic
      hurricane cyclone monsoon precipitation condensation evaporation transpiration photosynthesis
      chlorophyll cellular genetics chromosome genome mutation evolution adaptation species mammal
      amphibian reptile invertebrate vertebrate microorganism bacteria virus antibody vaccine immunity
      metabolism nutrition enzyme protein carbohydrate lipid vitamin mineral antibiotic diagnosis
      therapy surgery anatomy neurology cardiology psychology cognition perception memory emotion
      molecule compound reaction catalyst isotope radiation spectrum wavelength frequency quantum
      gravity relativity velocity acceleration momentum friction inertia magnetism electricity
      circuit semiconductor transistor microchip processor algorithm encryption cybersecurity firewall
      database cloud robotics automation artificial_intelligence neural_network simulation prototype
      satellite spacecraft telescope observatory constellation nebula galaxy asteroid supernova
    `),
  },
  {
    category: 'Communication, Media & Careers',
    styleTag: 'core',
    items: w(`
      eloquence articulation pronunciation intonation fluency persuasion negotiation mediation
      collaboration presentation briefing keynote webinar seminar workshop symposium conference
      interview resume portfolio credential qualification internship apprenticeship mentorship
      leadership management entrepreneurship startup venture innovation patent trademark franchise
      budget forecast revenue profit dividend expenditure audit invoice taxation investment
      stockholder dividend_yield inflation_rate logistics supply_chain inventory distribution
      warehouse freight customs retail wholesale marketing branding campaign demographic audience
      engagement analytics metric conversion algorithm_feed influencer creator podcast livestream
      newsletter subscription headline_news investigative_report press_release spokesperson public_relations
      diplomat ambassador translator interpreter linguist educator professor researcher scientist
      engineer architect designer developer programmer analyst consultant strategist producer
      director cinematographer editor composer choreographer curator archivist librarian journalist
      broadcaster attorney paralegal judge mediator physician surgeon therapist pharmacist
      veterinarian nutritionist physiotherapist coach referee coordinator organizer administrator
    `),
  },
  {
    category: 'Travel, Adventure & Lifestyle',
    styleTag: 'core',
    items: w(`
      expedition itinerary excursion pilgrimage voyage cruise transit layover stopover departure
      arrival customs_clearance immigration passport_control boarding_gate terminal concourse runway
      turbulence jetlag altitude acclimatize accommodation hostel boutique resort villa chalet
      campsite backcountry wilderness trailhead summit ridge plateau canyon gorge glacier_lake
      archipelago peninsula coastline fjord estuary lagoon oasis savannah tundra rainforest
      snorkeling scuba_diving kayaking rafting paragliding mountaineering trekking backpacking
      orienteering navigation compass landmark panorama vista horizon twilight sunrise sunset
      cuisine street_food hospitality concierge excursionist sightseer wanderlust nostalgia
      mindfulness meditation wellness resilience balance discipline routine productivity minimalism
      organization declutter ergonomics posture stamina endurance agility flexibility nutrition
      hydration sleep_cycle recreation pastime hobby craftsmanship photography videography sketching
      watercolor pottery woodworking gardening horticulture astronomy stargazing birdwatching
      volunteering mentoring tutoring fundraising community_service friendship camaraderie empathy
    `),
  },
  {
    category: 'Verbs for Precision & Expression',
    styleTag: 'core',
    items: w(`
      accelerate accommodate accompany accomplish accumulate acknowledge acquire adapt address adhere
      adjust administer admire admit adopt advance advocate affect afford aggravate allocate
      allow alter amaze amplify analyze animate announce anticipate apologize appeal appear
      applaud apply appoint appreciate approach approve argue arrange articulate assemble assess
      assign assist associate assume assure astonish attach attempt attend attract attribute
      authorize automate avoid award balance banish bargain behave benefit betray bewilder
      blend blossom boast border borrow bounce brainstorm broadcast budget calculate campaign
      cancel capture carve celebrate challenge champion change charge chase cherish clarify
      classify collaborate collapse collect combine comfort command commemorate comment commit
      communicate compare compete compile complain complete compose comprehend compromise conceal
      concentrate conceptualize conclude condemn conduct confess confide confirm conflict conform
      confront confuse connect conquer conserve consider consist console construct consult consume
      contact contain contemplate contend contest continue contract contradict contrast contribute
      control convene converge converse convert convey convince cooperate coordinate cope correspond
      counsel counter create criticize cultivate cure customize debate debug decay deceive
      decide declare decline decorate decrease dedicate deduce defend defer define deflect
    `),
  },
  {
    category: 'Adjectives & Nuanced Descriptors',
    styleTag: 'core',
    items: w(`
      abundant accessible accurate accustomed adaptable admirable adorable adventurous affectionate
      affordable agile agreeable alert alike alive allergic amateur amazing ambitious amiable
      amused ancient angelic animated annual anonymous anxious appealing appreciative appropriate
      arctic arid aromatic artistic ashamed astonished athletic attentive attractive audible
      authentic automatic available average aware awesome awkward balanced barren bashful
      beneficial benevolent biased bizarre bleak blissful blunt bold boisterous booming boundless
      brilliant brisk brittle broad brutal bubbly bulky buoyant bustling calculating calm
      candid capable captivating careful careless casual cautious celebrated celestial central
      certain charming cheerful chilly chronic circular civic civil classic clean clear
      clever clumsy coastal coherent cohesive coincidental collaborative collective colorful
      colossal comfortable comical commanding commercial committed common communicative compact
      compassionate compatible compelling competent competitive complacent complex compliant
      comprehensive compulsory concealed concentrated concise concrete conditional confident
      confidential conflicting conforming confused congenital conscientious conscious consecutive
      consequential conservative considerable considerate consistent conspicuous constant constructive
      contagious contemporary content contentious continental continual continuous contradictory
      contrasting contributing controversial convenient conventional conversational convinced
    `),
  },
  {
    category: 'Single-Syllable Pronunciation Challenges',
    styleTag: 'single_syllable',
    items: w(`
      ache aisle alms arch awe badge balm barge bathe beau beige binge birch blithe
      bluff blurt boast bough bought brace braid brawl breach breadth breath breve bribe
      brief brisk broach bronze brood brook froth fraught freight fresh frieze fright fringe
      frock frond frost frown froze fruit fudge fugue fume fund funk furl fuse fuss
      gauge gaunt gauze gawk gaze gear geese gel gene germ gest ghost ghoul gild
      gill gilt gist glad glare glaze gleam glean glee glen glib glide glint glitz
      gloat globe gloom gloss glove glow glue glum glut gnarl gnash gnat gnaw gnome
      goad goal goat gorge gouge gourd gout gown grab grace grade graft grain grand
      grant grape graph grasp grass grate grave graze grease great greed Greek green greet
      grief grieve grill grim grime grin grind grip grit groan groin groom groove grope
      gross group grouse grout grove growl grown growth grub grudge gruff grump grunt guard
      guess guest guide guild guile guilt guise gulf gull gulp gush gust guy gym
      hale half hall halt halve hand hang hard hare harm harp harsh haste hatch
      hate haul haunt have hawk haze head heal health heap hear heard heart hearth
      heat heath heave hedge heed heel heft height heir held hell helm help hemp
      hence herb herd here hero hew hide high hike hill hilt hind hinge hint
      hire hiss hitch hive hoard hoarse hoax hock hoe hoist hold hole home hone
      hood hoof hook hoop hoot hope horde horn horse hose host hour house hove
      howl hub hue huff huge hulk hull hum hump hunch hung hunk hunt hurl
      hurt hush husk hymn hype isle itch jade jail jamb jar jaunt jaw jazz
      jeer jell jerk jest jet jib jibe jilt jinx job jock jog join joint
      joist joke jolt joust joy judge jug juice juke jump June junk just jut
    `),
  },
  {
    category: 'Multisyllable Word Studio',
    styleTag: 'multisyllable',
    items: w(`
      abbreviation accessibility accommodation accountability acknowledgment acquaintance administration
      adolescence aerodynamics affiliation agriculture ambiguity amphitheater amplification anachronism
      analytical anniversary anticipation apologetically apparatus appreciation apprenticeship
      appropriateness approximation archaeological architectural argumentative articulation artificial
      assimilation association astonishingly astronomical asymmetrical atmospheric authenticity
      autobiographical automatically availability bacteriology barometric beneficially bibliography
      bicentennial bioluminescence biotechnology breathtakingly broadcasting bureaucracy calligraphy
      carbohydrate cardiologist cartography catastrophic categorization celebratory centralization
      ceremonial certification championship characterization choreography chronological cinematography
      circumnavigation circumstantial civilization clarification classification claustrophobia
      climatology collaboration collectibles colonialism commemoration commercialization communication
      companionable comparative compatibility compensation competitiveness compilation complementarity
      complexity complimentary comprehension comprehensiveness computational concentration
      conceptualization conciliation condensation confidentiality configuration confirmation
      congratulatory congregation conscientiousness conservationist consideration consistency
      consolidation constellation constitution construction consultation contemplation contemporary
      continuation contradiction contribution controversy convenience convention conversational
      cooperation coordination correspondence cosmopolitan creativity credibility curiosity
      curriculum customization cylinder declaration decoration dedication definition deforestation
      deliberation deliciousness democracy demonstration denominator department dependability
      description destination determination development diagonal dictionary differentiation difficulty
      digestion diplomacy disadvantage disagreement disappearance disappointment discipline
      discontinuation discovery discrimination discussion disillusionment disobedience disorder
      displacement dissatisfaction dissemination distinction distribution diversification diversity
      documentation domestication dramatization duplication durability eccentricity ecological
      economical ecosystem editorial education effectiveness efficiency elaboration electricity
    `),
  },
  {
    category: 'Difficult & Advanced Stretch Vocabulary',
    styleTag: 'difficult',
    items: w(`
      abstain acclaim adamant adhere adjacent adroit adversary adverse advocate aesthetic
      affable affluent agenda aggravate aggregate agile agitate agrarian ailment akin
      alacrity albeit alchemy alias alienate align allay allege allegiance alleviate
      allocate allot allude allure aloof alter alternate altitude altruistic amalgamate
      amass ambient ambiguous ambivalent amble ambush ameliorate amenable amend amenity
      amiable amicable amid amiss amity amnesty amorphous ample amplify amulet
      analogy anarchy anatomy ancestor anchor ancillary anecdote anguish angular animosity
      annex annihilate annotate annul anomaly anonymous antagonist antecedent anthem anthology
      antidote antipathy antiquity antithesis apathy apex aphorism aplomb apocalyptic apocryphal
      apogee apologist apostrophe appall apparatus apparel apparent apparition appeal appease
      appellation append appertain appetite applaud appliance applicable applicant application
      appoint apportion appraisal appreciate apprehend apprentice apprise approach approbation
      appropriate approve approximate aptitude aquatic arable arbiter arbitrary arbitrate arbor
      arcade arcane archaic archetype archipelago archive ardent arduous arena argot arid
      aristocracy armada armistice aroma arouse arraign array arrears arrest arrival arrogant
      arrogate arsenal arson artful articulate artifact artifice artisan artless ascend ascendancy
      ascent ascertain ascetic ascribe aseptic ashen asinine askance askew asperity aspersion
      aspirant aspiration aspire assail assassin assault assay assent assert assess asset
      assiduous assign assimilate assist associate assuage assume assurance assure asterisk
    `),
  },
];

const PHRASE_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Expressing Nuanced Opinions & Persuasion',
    styleTag: 'core',
    items: p(`
      From my perspective, early exposure to global cultures fosters lifelong empathy.
      While I see the merit in that approach, I think there is a stronger alternative.
      That raises a compelling question we should examine more closely.
      What strikes me most about this research is how consistent the results are.
      On the one hand, digital tools accelerate learning; on the other hand, balance is vital.
      To put it simply, consistent daily practice outperforms last-minute cramming.
      If we look at the long-term impact, sustainable habits pay off enormously.
      Could you clarify what evidence led you to that particular conclusion?
      I would argue that creative storytelling builds confidence across every subject.
      It is worth considering how this decision affects younger learners as well.
      Rather than viewing mistakes as failures, we should treat them as useful data.
      To illustrate my point, let me share an example from our school science fair.
      Naturally, everyone brings a slightly different experience to the discussion.
      Let us find common ground so both teams feel heard and respected.
      Broadly speaking, clear communication depends on listening just as much as speaking.
      In addition to saving energy, public transit reduces city noise and congestion.
      Despite the initial setbacks, our robotics group refined the prototype and succeeded.
      Regardless of which topic you pick, structure your speech with a clear takeaway.
      As far as I am concerned, bilingual fluency is one of the best gifts you can build.
      Taking everything into account, I strongly recommend moving forward with plan B.
      Before jumping to a verdict, let us verify the original source together.
      I completely follow your logic, though I wonder how it works in smaller towns.
      The primary advantage of small-group classes is individualized feedback every session.
      Have you considered combining visual diagrams with a short live demonstration?
      Ultimately, the most memorable speeches speak both to the mind and to the heart.
      I appreciate you challenging that assumption—it sharpened my whole argument!
      Let us summarize our three strongest points before the moderator calls time.
      Would you mind expanding on that second point with a concrete scenario?
      All things considered, our collaborative approach yielded an impressive outcome.
      Thank you for such an engaging and thought-provoking exchange of ideas!
    `),
  },
  {
    category: 'Storytelling, Interviews & Stage Presence',
    styleTag: 'core',
    items: p(`
      Ladies and gentlemen, welcome to tonight's LiLab Creative Showcase!
      Have you ever paused to imagine what cities will look like fifty years from now?
      Picture a morning where solar rooftops power every school bus on the avenue.
      Let me take you back to the moment that sparked my curiosity about astronomy.
      At first, everything went smoothly—until an unexpected monsoon cloud rolled in!
      Just when we thought the festival would be canceled, the entire community stepped up.
      Looking back on that afternoon, I realize how much resilience we built together.
      Thank you for joining me on today's podcast—could you introduce your project?
      What inspired you to turn a classroom hobby into a full community initiative?
      What was the toughest obstacle you encountered while designing your prototype?
      If you could give one piece of advice to a nervous first-time speaker, what would it be?
      Pause for two full seconds after your opening question to let the room lean in.
      Varying your pace and vocal pitch keeps every listener hooked from start to finish.
      Making warm eye contact across the left, center, and right connects the whole room.
      Let us transition smoothly from the background story to our live demo!
      As this chart highlights, student participation nearly doubled within one semester.
      To wrap up, remember that small courageous actions create lasting ripples.
      Now I would love to open the floor to questions from our audience!
      That is a brilliant question—let me break my answer into two quick parts.
      If I understand your question correctly, you are asking about long-term costs.
      I don't have the exact figure off the top of my head, but I will follow up right away!
      Please join me in giving a warm round of applause to our next speaker!
      It has been an absolute privilege hosting this international youth forum today.
      Behind every polished stage performance are dozens of quiet rehearsal sessions.
      Even seasoned speakers feel adrenaline—the secret is channeling it into energy!
      Your storytelling voice sounds warm, articulate, and genuinely enthusiastic!
      Remember to project clearly to the back row without rushing your endings.
      When you tell a true story with honesty, the audience roots for you immediately.
      Stay tuned right after the break for our live student debate finals!
      Thank you everyone, and have an inspiring rest of the evening!
    `),
  },
  {
    category: 'Science, Tech & Future Discussions',
    styleTag: 'core',
    items: p(`
      Our experiment tested whether natural ventilation cools classrooms more efficiently.
      To keep the trial fair, we controlled every variable except window placement.
      Interestingly, the data contradicted our original hypothesis by nearly twelve percent!
      Scientists rely on peer review to verify results and catch hidden blind spots.
      Renewable solar microgrids can keep rural clinics powered even during severe storms.
      How can artificial intelligence assist students without replacing human creativity?
      Responsible technology starts with strong privacy safeguards and transparent design.
      When debugging code, isolating one small function at a time saves hours of guessing.
      Biodiversity acts like a safety net that helps ecosystems bounce back from droughts.
      Restoring coastal mangrove forests protects shorelines while sheltering marine nurseries.
      Did you know that deep-sea creatures use bioluminescence to communicate in darkness?
      Space telescopes let astronomers peer billions of years back into cosmic history.
      Reducing single-use plastics starts with redesigning everyday packaging thoughtfully.
      Citizen science apps allow students anywhere to log local bird migrations accurately.
      Understanding basic statistics helps you spot misleading charts in daily news.
      Every major breakthrough begins with someone brave enough to ask "why not?"
      How might biodegradable materials transform fashion and architecture over the next decade?
      Balancing screen time with outdoor exploration keeps both attention and mood healthy.
      Let us prototype a lightweight mobile interface that seniors can read effortlessly.
      Testing our app with real users revealed three usability fixes within five minutes!
      Collaboration between engineers, artists, and ethicists produces the best innovations.
      Clean water filtration remains one of the highest-impact engineering challenges worldwide.
      Studying how geckos climb glass inspired brand-new reusable adhesive materials!
      Curiosity paired with disciplined experimentation turns wild sketches into reality.
      Which scientific discovery from the past century amazes you the most?
      I find ocean exploration fascinating because so much of the seabed remains unmapped.
      Protecting pollinators like native bees is essential for global food security.
      Smart urban parks cool neighborhoods while soaking up heavy seasonal rainwater.
      Science communication matters because complex discoveries deserve clear everyday language.
      The best inventions solve real human problems with elegance and simplicity!
    `),
  },
  {
    category: 'Travel, Problem-Solving & Real-World Situations',
    styleTag: 'core',
    items: p(`
      Excuse me, my connecting flight was delayed—could you help me rebook onto the next one?
      Would it be possible to request a vegetarian meal for the return journey?
      I seem to have misplaced my metro pass; where can I purchase a replacement card?
      Could you recommend a neighborhood off the beaten path with authentic local food?
      We ended up taking the scenic coastal train instead of flying, and it was magical!
      Before booking any excursion, always double-check cancellation policies and weather alerts.
      Navigating a bustling foreign market taught me how far a friendly smile goes!
      I would like to return this jacket because the zipper stopped working smoothly.
      Do you happen to have the same style available in medium at another branch?
      Thank you for resolving that billing error so promptly—I truly appreciate it!
      Let us split the project timeline into weekly milestones so nobody gets overwhelmed.
      If we run behind schedule, let us flag it early rather than waiting until Friday.
      Could we reschedule Thursday's rehearsal to Friday afternoon so everyone can attend?
      I completely forgot to attach the slide deck—sending the updated file right now!
      Let me walk you through the checklist step by step so nothing slips through the cracks.
      Comparing two local maps helped us discover a quieter bike path through the trees.
      When visiting a sacred temple, dressing modestly shows genuine cultural awareness.
      Packing a universal power adapter and a refillable bottle saves both money and waste.
      Getting slightly lost in a historic quarter led us straight to the coziest bookshop!
      Staying calm under travel hiccups turns stressful delays into funny stories later.
      Could you verify whether this museum admission includes the temporary photo gallery?
      We pooled our ideas and organized an international food fair for three hundred guests!
      Volunteering as a bilingual guide sharpened my listening skills faster than any textbook.
      Managing a monthly budget taught me the difference between urgent needs and impulse wants.
      Always back up your presentation files both in the cloud and on a portable drive!
      Thank you for your hospitality—we felt right at home from the very first evening.
      Would you mind sending me the recipe for that incredible lemongrass soup?
      Learning how different cultures celebrate New Year expanded my appreciation for traditions.
      No matter how far you travel, curiosity and kindness are universally understood.
      Here is to many more meaningful journeys and unforgettable conversations ahead!
    `),
  },
  {
    category: 'Wellness, Hobbies, Media & Daily Reflections',
    styleTag: 'core',
    items: p(`
      Taking a twenty-minute screen-free walk after school resets my focus almost immediately.
      What podcast or YouTube documentary series has taught you something surprising lately?
      Learning to cook three healthy weekday meals is a practical skill every teenager should build.
      Whenever I feel overwhelmed by upcoming deadlines, writing a prioritized checklist calms me down.
      I recently picked up digital illustration, and experimenting with lighting layers is so rewarding!
      How do you balance competitive schoolwork with hobbies that exist purely for joy?
      Joining an amateur choir taught me how breathing control transforms both singing and speaking.
      Reading fiction before bedtime helps me unwind far better than scrolling through short videos.
      Our book club meets every second Saturday to compare favorite chapters and character motives.
      Keeping a gratitude log for thirty days shifted how I notice small moments of kindness.
      Have you noticed how different genres of instrumental music affect your study speed?
      Stretching for ten minutes every morning keeps my shoulders relaxed during long coding sessions.
      Volunteering at the weekend community garden introduced me to neighbors of all generations.
      I love filming short stop-motion animations using everyday objects from around the house.
      Setting boundaries around phone notifications helped me finish my essay in half the usual time!
      What personal habit are you proudest of building over the past twelve months?
      Learning chess endgame strategies improved my patience both on and off the board.
      Trying a brand-new sport as a beginner reminds you how brave it is to learn publicly.
      Visiting local art galleries sparks fresh color palettes for my own design projects.
      Sharing home-cooked meals with extended family keeps our cultural recipes alive.
      When choosing a book, I love picking authors from countries I have never visited yet.
      Practicing deep listening means focusing on understanding rather than planning your reply.
      Even ten minutes of daily outdoor sunlight noticeably boosts mood and energy levels.
      Editing my own short video clips taught me how pacing changes emotional storytelling.
      Have you ever tried sketching a busy street corner from real life in under five minutes?
      Collaborating with teammates who think differently than I do always produces richer ideas.
      Checking in on a quiet friend after a tough week can brighten their entire month.
      Celebrating small weekly milestones keeps long-term goals feeling exciting instead of distant.
      Keeping a pocket notebook for intriguing new English idioms is my favorite language trick!
      Every conversation is a chance to learn a fresh perspective you hadn't imagined before.
      Good rest isn't a reward for finishing everything—it is the fuel that makes great work possible.
      Teaching a younger student how to solve a puzzle reinforces your own understanding twice as deeply.
      Switching between creative hobbies keeps curiosity sharp throughout the entire school year.
      What new skill would you love to explore if you had a completely free month this summer?
      Reflecting at the end of each week helps turn ordinary experiences into lasting wisdom.
    `),
  },
  {
    category: 'Expressive Idioms & Figurative Phrases',
    styleTag: 'idiom',
    items: p(`
      Let us not beat around the bush—we need to rethink our rehearsal plan today.
      She bit the bullet and volunteered to deliver the opening speech in front of five hundred people.
      Cutting corners on research always comes back to haunt you during Q&A.
      We had to go back to the drawing board when our first bridge collapsed under weight.
      That unexpected scholarship was the icing on the cake after months of hard work!
      He kept a level head even when the microphone cut out mid-sentence.
      Finding an affordable studio near downtown is like looking for a needle in a haystack.
      She really rose to the occasion when the team captain caught the flu.
      Let us play it by ear depending on how quickly the afternoon storm passes.
      He hit the nail right on the head with that insightful observation about character growth.
      Don't throw the baby out with the bathwater—keep the parts of the design that work!
      We are skating on thin ice if we leave our science slides until midnight.
      Her speech struck a chord with parents and teachers across the whole auditorium.
      Let us clear the air right away so there are no lingering misunderstandings.
      He has a knack for breaking complex physics down into crystal-clear metaphors.
      We pulled out all the stops to make the Cultural Expo unforgettable!
      Taking that creative coding elective turned out to be a total game changer.
      She took the constructive critique in stride and polished her essay to perfection.
      It is easy to talk the talk, yet true leaders walk the walk every day.
      Let us kill two birds with one stone by practicing pronunciation while reviewing history!
      Don't jump the gun before reading every instruction on the rubric carefully.
      He missed the boat on early registration, so he joined the waitlist instead.
      Once we got on the same page, the entire team clicked effortlessly!
      She always sees the silver lining even when plans go sideways.
      The museum's ancient tapestry really stood the test of time.
      Let us put our heads together and crack this final logic riddle!
      He was caught between a rock and a hard place choosing between two great offers.
      Her violin solo brought the house down with a standing ovation!
      Let us nip that scheduling mix-up in the bud before invitations go out.
      Time will tell whether this bold new transit policy succeeds.
      He went above and beyond to mentor the incoming freshmen.
      That tiny detail turned out to be the tip of the iceberg!
      She kept her cards close to her chest until the big reveal.
      We burned the midnight oil, yet seeing the finished film made it worthwhile.
      Rome wasn't built in a day—fluent speaking grows brick by steady brick!
    `),
  },
  {
    category: 'World Cultural Phrases (US, UK, AU, CA, IE, NZ, SG, ZA)',
    styleTag: 'cultural',
    items: p(`
      [UK] I am over the moon—my debate team made it to the regional finals!
      [UK] That new documentary was a bit of a slow burn, yet utterly gripping!
      [UK] Don't faff about—our train to Edinburgh leaves in ten minutes!
      [UK] He is completely gutted about missing the championship match.
      [UK] Let us pop round to the bookshop after tea to browse travel guides.
      [UK] That old cinema has loads of charm, doesn't it?
      [UK] Fair play, you managed to keep calm even when the projector froze!
      [UK] Touch wood, the drizzle will clear up before the outdoor concert.
      [AU] Reckon we should head down to the foreshore before sunset, mate?
      [AU] No dramas at all—I can cover the intro slides while you set up the mic.
      [AU] He had a fair crack at the toughest question and nailed half of it!
      [AU] That coastal road trip along the Great Ocean Road was unreal!
      [AU] Let us grab a flat white and brainstorm our podcast episode this arvo.
      [AU] Don't chuck a sickie when the whole team is counting on your solo!
      [AU] She is an absolute weapon at mental arithmetic and quick trivia!
      [US] Let us circle back after lunch once everyone reviews the draft budget.
      [US] That idea has serious legs—we could scale it across the whole district!
      [US] Let us shoot the breeze for five minutes before diving into study mode.
      [US] You really hit it out of the park with those crisp data visuals!
      [US] Give me a heads-up if traffic slows down on the interstate.
      [US] That community mural turned out to be a real crowd-pleaser!
      [CA] We picked up a dozen Timbits on our way to the morning hockey tournament.
      [CA] Grab your parka—the wind chill makes it feel twenty degrees colder!
      [CA] Sorry to interrupt, could we double-check the schedule for the Victoria Day weekend?
      [CA] Taking the ferry across Vancouver Island was pure magic, eh?
      [CA] Let us grab a quick bite before hitting the trails at Banff!
      [IE] We had a whale of a time exploring the Cliffs of Moher!
      [IE] Stop acting the maggot and help us rehearse the final scene!
      [IE] You are dead right—starting with a personal story hooks the crowd immediately.
      [IE] Sure look, there is no point stressing over spilled tea now!
      [NZ] Sweet as, I will bring the chilly bin and extra snacks for the hike!
      [NZ] Yeah nah, I think waiting until the fog lifts is way safer for the climb.
      [NZ] Heaps of students signed up for the weekend marine conservation cleanup!
      [NZ] Kia kaha—stay strong and keep believing in your own voice!
      [SG] Don't kiasu too much—focus on enjoying the learning journey too!
      [SG] Can or not? Of course can lah, we practiced this all week!
      [SG] Let us lepak at the library courtyard after finishing our mock exam.
      [ZA] Just now we will review the script—first let us grab some rooibos tea!
      [ZA] Eish, that mountain climb was steeper than the guidebook warned!
      [ZA] Everything came together so lekker for our international culture night!
    `),
  },
  {
    category: 'Natural Modern Slang & Colloquial English',
    styleTag: 'slang',
    items: p(`
      Not gonna lie, that interactive coding challenge hooked me immediately!
      Wait a second—you actually composed that whole soundtrack from scratch? Respect!
      Honestly, I was low-key terrified of debating, yet it turned into my favorite club!
      No cap, listening back to my own voice helped me fix three tricky vowels!
      That sci-fi short film hits different when you watch it on the big auditorium screen.
      Let us lock in for twenty focused minutes, then reward ourselves with a break!
      Zero regrets signing up for the Junior MC workshop—it boosted my confidence big time!
      My bad, I totally blanked on the second verse during dress rehearsal.
      It is all good—nobody even noticed because you recovered so smoothly!
      That robotics prototype is legitimately mind-blowing—how did you wire the sensors?
      Don't sleep on daily five-minute shadowing; it works wonders for fluency!
      She has major main-character energy every time she steps behind the podium!
      We completely vibed with the visiting students from Melbourne and Toronto.
      Hold up, let me double-check those stats before we put them on the slide.
      That plot twist in chapter twelve had my jaw on the floor!
      I am kinda torn between learning French or Japanese next year.
      Fair enough—let us test both designs side by side and let the data decide!
      Big shout-out to everyone who stayed late to paint the stage backdrops!
      That playlist is straight-up elite for late-afternoon sketching sessions.
      Honestly, I am totally beat after running the charity 5K this morning!
      Let us touch grass for half an hour and clear our heads in the park.
      You nailed the intonation on that idiom—ten out of ten delivery!
      For real though, teamwork makes tough deadlines feel twice as manageable.
      Wait, spill the details—how did the regional spelling bee turn out?
      We pulled off a clutch presentation even after the projector cable went missing!
      Keep flexing those vocabulary muscles—you are leveling up every single week!
      That mural downtown is an absolute vibe—let us snap a group photo!
      Catching a quick breather before round three of the trivia finals!
      No sweat, I have got your back if you forget your opening cue!
      Peace out, team—let us crush tomorrow's showcase together!
      Seriously though, speaking English feels way less scary once you just go for it!
      Total win—our eco-club hit its recycling target two weeks early!
      That joke landed so cleanly the whole auditorium burst out laughing!
      Sounds like a plan—count me in for Saturday morning rehearsal!
      Let us keep the momentum rolling all the way to the finish line!
    `),
  },
];

export const B1_DATASET = buildLevelDataset('b1', WORD_BUCKETS, PHRASE_BUCKETS);
