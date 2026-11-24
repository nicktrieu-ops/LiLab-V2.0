import { buildLevelDataset, p, w, type RawCategoryBucket } from './types';

const WORD_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Travel, Culture & World Places',
    styleTag: 'core',
    items: w(`
      continent hemisphere equator meridian capital province region district territory border customs
      embassy visa currency exchange_rate souvenir_shop brochure itinerary_plan backpacker_hostel
      boutique_hotel resort campground cabin_rental cruise_liner ferry_terminal runway_lights tarmac
      baggage_claim departure_lounge security_check boarding_gate overhead_bin turbulence altitude
      horizon landmark_tower cathedral mosque pagoda temple_gate shrine monastery citadel fortress
      amphitheater aqueduct monument_park heritage_site exhibition gallery_wing sculpture_garden
      festival parade carnival_float fireworks_show lantern_festival harvest_feast tradition custom
      ceremony ritual folklore legend myth proverb dialect accent_mark etiquette hospitality_warmth
      cuisine delicacy street_food spice_market bazaar night_market artisan craftsman weaver potter
      calligrapher musician_troupe storyteller guide_book audio_guide excursion_boat safari_jeep
      snorkeling_gear scuba_mask hiking_boots trekking_pole compass_bearing summit_trail scenic_route
    `),
  },
  {
    category: 'Science, Space & Technology',
    styleTag: 'core',
    items: w(`
      experiment hypothesis observation evidence measurement variable conclusion laboratory_bench
      microscope_slide test_tube beaker funnel pipette magnet_pole circuit_board battery_cell
      voltage current conductor insulator solar_panel wind_turbine hydropower geothermal_heat
      molecule atom electron proton neutron element compound mixture solution crystal_lattice
      evaporation condensation precipitation filtration gravity_force friction momentum inertia
      velocity acceleration spectrum_light prism_beam refraction reflection_angle laser_beam soundwave
      frequency vibration echo_chamber telescope_lens satellite_orbit space_probe rover_wheel
      astronaut_crew space_station launchpad countdown booster_rocket solar_system mercury_planet
      venus_cloud mars_crater jupiter_storm saturn_rings uranus_tilt neptune_wind comet_orbit
      eclipse_shadow supernova_flash black_hole galaxy_spiral algorithm coding_block database
      software hardware processor microchip sensor_chip robotics_arm prototype drone_flight
      virtual_reality simulation_lab hologram_view cybersecurity password_vault encryption_key
      bandwidth wireless_router bluetooth_pair touchscreen_pad cloud_storage livestream podcast_mic
    `),
  },
  {
    category: 'School, Storytelling & Media',
    styleTag: 'core',
    items: w(`
      curriculum syllabus semester midterm final_exam essay_draft outline_plan brainstorm_map
      thesis_point paragraph_hook transition_word conclusion_note citation_source bibliography
      encyclopedia_entry atlas_page almanac_fact magazine_issue newspaper_column headline_bold
      editorial_view interview_clip journalist_note reporter_mic photographer_shot documentary_film
      animation_frame storyboard_sketch screenplay_line dialogue_tag narrator_voice protagonist_hero
      antagonist_rival setting_scene plot_twist climax_peak resolution_end suspense_mood mystery_clue
      detective_case fantasy_realm sci_fi_world fable_moral metaphor_image simile_like rhyme_scheme
      stanza_verse rhythm_meter chorus_hook melody_tune harmony_chord tempo_beat acoustic_guitar
      percussion_set symphony_piece composer_score rehearsal_room backstage_pass spotlight_beam
      curtain_call applause_wave encore_song audience_applause reviewer_rating podcast_host
      broadcast_studio microphone_stand soundcheck_test soundtrack_mix visual_effects cinematography
    `),
  },
  {
    category: 'Nature, Weather & Sustainability',
    styleTag: 'core',
    items: w(`
      ecosystem_balance biodiversity_rich conservation_plan wildlife_sanctuary national_park
      endangered_species extinction_risk reforestation_drive mangrove_forest coral_bleaching
      ocean_current tidal_wave coastal_erosion river_basin watershed_area groundwater_well
      reservoir_dam irrigation_canal fertile_soil topsoil_layer compost_bin organic_farming
      greenhouse_effect carbon_footprint renewable_energy solar_grid wind_farm recycling_center
      upcycling_craft zero_waste biodegradable_bag plastic_pollution oil_spill smog_cloud
      acid_rain drought_alert flood_warning landslide_risk earthquake_zone tsunami_siren
      volcanic_ash seismic_wave Richter_scale monsoon_season tropical_cyclone trade_winds
      jet_stream polar_vortex frostbite_alert heatwave_peak humidity_index barometer_drop
      thunderhead_cloud lightning_bolt hailstone_fall sleet_shower mist_valley morning_dew
      photosynthesis_cycle chlorophyll_green pollination_bee nectar_drop germination_seed
      sapling_tree canopy_shade forest_floor lichen_patch mushroom_cap fern_frond moss_carpet
      migration_route hibernation_den nocturnal_owl amphibian_frog reptile_scale mammal_fur
    `),
  },
  {
    category: 'Health, Sports & Wellness',
    styleTag: 'core',
    items: w(`
      nutrition_plan balanced_diet carbohydrate_fuel protein_source vitamin_boost mineral_rich
      antioxidant_berry hydration_goal calorie_burn metabolism_rate immune_system vaccination_shot
      prescription_med pharmacist_advice stethoscope_check thermometer_read blood_pressure
      first_aid_kit antiseptic_wipe sterile_gauze splint_brace crutches_pair recovery_time
      rehabilitation_ex posture_check ergonomic_chair mindfulness_breath meditation_calm
      gratitude_journal sleep_hygiene circadian_rhythm endurance_run cardio_workout strength_drill
      agility_ladder coordination_test flexibility_stretch warmup_jog cooldown_walk marathon_race
      triathlon_event relay_baton hurdle_jump long_jump high_jump javelin_throw discus_spin
      archery_target gymnastics_beam parallel_bars vault_leap figure_skating speed_skating
      ice_hockey_puck curling_stone alpine_skiing snowboard_trick surfboard_wax kayak_paddle
      rock_harness bouldering_wall cycling_peloton Velodrome_track tournament_bracket championship_ring
      quarterfinal_match semifinal_clash tiebreaker_point overtime_goal penalty_kick free_throw
      sportsmanship_code fair_play_award team_captain coaching_strategy playbook_plan
    `),
  },
  {
    category: 'Work, Money & Community Life',
    styleTag: 'core',
    items: w(`
      career_path profession_choice occupation_field internship_role apprentice_craft mentor_advice
      entrepreneur_spirit startup_pitch business_plan budget_sheet allowance_save savings_account
      interest_rate investment_fund charity_drive fundraiser_bake volunteer_hour community_garden
      neighborhood_watch town_hall_meeting mayor_speech council_vote election_ballot petition_sign
      recycling_drive food_bank_box shelter_support donation_bin scholarship_grant tuition_fee
      invoice_slip receipt_copy warranty_card refund_policy exchange_counter bargain_hunt
      discount_coupon loyalty_points wholesale_price retail_shelf inventory_list supply_chain
      warehouse_dock freight_train cargo_ship delivery_courier tracking_number customer_service
      feedback_survey review_star quality_control safety_inspector architect_blueprint civil_engineer
      software_developer graphic_designer animator_studio chef_kitchen pastry_baker veterinarian_care
      marine_biologist astronomer_dome archaeologist_dig diplomat_envoy translator_booth
    `),
  },
  {
    category: 'Dynamic Action Verbs',
    styleTag: 'core',
    items: w(`
      accomplish achieve acquire adapt adjust admire admit adopt advance advertise advise afford
      alter amaze amuse analyze announce annoy anticipate apologize appeal appear applaud apply
      appoint appreciate approach approve argue arrange arrive assemble assess assign assist associate
      assume assure astonish attach attempt attend attract audition authorize avoid award balance
      banish bargain behave benefit betray bewilder blend blossom boast border borrow bounce
      brainstorm broadcast budget calculate campaign cancel capture carve celebrate challenge champion
      change charge chase cherish clarify classify cleanse collaborate collapse collect combine comfort
      command commemorate comment commit communicate compare compete compile complain complete compose
      comprehend compromise conceal concentrate conclude confirm connect conquer conserve consider
      consist console construct consult consume contact contain contemplate contend contest continue
      contract contrast contribute control convince cooperate coordinate cope correspond counsel create
      criticize cultivate cure customize debate decide declare decline decorate decrease dedicate defend
    `),
  },
  {
    category: 'Descriptive & Expressive Adjectives',
    styleTag: 'core',
    items: w(`
      abundant accessible accurate accustomed adaptable admirable adorable adventurous affectionate
      affordable agile agreeable alert alike alive allergic amateur amazing ambitious amiable
      amused ancient angelic animated annual anonymous anxious appealing appreciative appropriate
      arctic arid aromatic artistic astonished athletic attentive attractive audible authentic
      automatic available average awake aware awesome awkward balanced barren bashful battered
      dazzling deafening debatable decent decisive decorative dedicated deep defensive defiant
      definite delicate delightful demanding dense dependable deserted deserving desperate detailed
      determined devastating devoted diagonal different difficult dignified diligent dim diplomatic
      direct disastrous discreet dishonest dismal distinct distinguished distracted diverse dizzy
      dramatic eager earnest eccentric economical ecstatic effortless elaborate elderly elegant
      eloquent empathetic energetic enthusiastic envious essential eternal ethical eventual evident
      exacting excellent exceptional exciting exclusive exotic expansive expectant experienced
      experimental expert expressive exquisite extensive extraordinary extravagant extreme fabulous
    `),
  },
  {
    category: 'Single-Syllable Sound Challenges',
    styleTag: 'single_syllable',
    items: w(`
      knave knead knell knife knight knit knob knock knoll knot know knuckle wrack wrangle
      wrap wrath wreak wreath wreck wren wrench wrest wretch wring wrist writ write writhe
      wrong wrought wry psalm gnash gnat gnaw gnome gnu phlox phrase phlegm quaff quail
      quaint quake qualm quark quart quartz quash quay queen quell quench query quest queue
      quick quid quiet quill quilt quince quint quip quirk quit quite quiz quote squad
      squall square squash squat squawk squeak squeal squeeze squelch squid squint squire squirm
      squirt schwa scheme schism school sconce scone scoop scoot scope scorch score scorn
      scour scout scowl scram scrap scrape scratch scrawl scream screech screen screw scribe
      scrimp script scroll scrub scruff scrunch sculpt scythe sleigh sleight sluice slouch slough
      sludge slurp smudge snatch sneer sneeze sniff snooze snort snout snub snuff sparse
      spasm spawn speak spear speck speech speed spell spend sphere spice spike spill spin
      spine spire spite splash splay spleen splice splint split spoil spoke sponge spoof spook
      spool spoon spore sport spout sprain sprawl spray spread sprig spring sprint sprite sprout
      spruce sprung spud spunk spur spurn spurt spy square_one squash_it squib squint_eye
      stalk stall stamp stand stank star starch stare stark start starve stash state stave
      stay stead steak steal steam steed steel steep steer stem step stern stew stick
      stiff stile still stilt sting stink stint stir stitch stock stoke stole stomp stone
    `),
  },
  {
    category: 'Multisyllable Word Studio',
    styleTag: 'multisyllable',
    items: w(`
      abbreviation acceleration accessibility accommodation accomplishment accountability acknowledgment
      acquaintance administration adolescence advertisement aerodynamics affectionately affiliation
      affordability agriculture alphabetically alternatively amalgamation ambassador ambiguity
      amphitheater amplification anachronism analytical anatomy anniversary announcement anticipation
      apologetically apparatus appreciation apprenticeship appropriateness approximation aquarium
      archaeological architectural argumentative arithmetic articulation artificial assimilation
      association astonishingly astronomical asymmetrical atmospheric authenticity autobiographical
      automatically availability bacteriology barometric beneficially bibliography bicentennial
      bioluminescence biotechnology botanical breathtakingly broadcasting bureaucracy calligraphy
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
    `),
  },
  {
    category: 'Difficult Stretch Vocabulary',
    styleTag: 'difficult',
    items: w(`
      abstain accelerate acclaim accommodate accompany accomplish accumulate accustomed acknowledge
      acquire acute adamant adequate adhere adjacent adjust administer admirable adolescent adopt
      adorn adroit advance adversary adverse advocate aesthetic affable affiliate affluent agenda
      aggravate aggregate agile agitate agrarian agreeable ailment akin alacrity albeit alchemy
      alert alias alienate align allay allege allegiance alleviate allocate allot allude allure
      ally aloft aloof alter alternate altitude altruistic amalgamate amass amateur amaze ambient
      ambiguous ambition ambivalent amble ambush ameliorate amenable amend amenity amiable amicable
      amid amiss amity amnesty amorphous ample amplify amulet amuse analogy anarchy anatomy
      ancestor anchor ancillary anecdote anguish angular animate animosity annex annihilate annotate
      announce annual annul anomaly anonymous antagonist antecedent anthem anthology antidote
      antipathy antiquity antithesis apathy apex aphorism aplomb apocalyptic apocryphal apogee
      apologist apostrophe appall apparatus apparel apparent apparition appeal appease appellation
      append appertain appetite applaud appliance applicable applicant application appoint apportion
      appraisal appreciate apprehend apprentice apprise approach approbation appropriate approve
      approximate aptitude aquatic arable arbiter arbitrary arbitrate arbor arcade arcane archaic
      archetype archipelago archive ardent arduous arena argot arid aristocracy armada armistice
      aroma arouse arraign array arrears arrest arrival arrogant arrogate arsenal arson artful
      articulate artifact artifice artisan artless ascend ascendancy ascent ascertain ascetic
    `),
  },
];

const PHRASE_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Travel, Airports & Cultural Exploration',
    styleTag: 'core',
    items: p(`
      Could you tell me which gate the flight to Sydney boards from?
      I would like to exchange some Vietnamese dong for British pounds.
      Our family planned a five-day cultural itinerary across Japan.
      Excuse me, is photography allowed inside this historic temple?
      The local night market is famous for its aromatic street food!
      We rented bicycles to explore the ancient lantern-lit town.
      Make sure you keep your passport and boarding pass somewhere safe.
      Due to heavy monsoon rain, our ferry departure was delayed by an hour.
      Could you recommend an authentic traditional dish to try tonight?
      Learning even five greeting words in a new language shows respect.
      This museum audio guide explains the history in both English and Vietnamese.
      We watched skilled artisans paint intricate patterns on ceramic bowls.
      From the observation deck, you can admire the entire city skyline!
      Always check the weather forecast before packing for a mountain trip.
      Does this express train stop at the central station downtown?
      We booked a guided kayaking excursion through the emerald caves.
      Look at the architecture of this two-hundred-year-old stone bridge!
      Remember to stay with the tour group while crossing busy squares.
      What cultural festival are people celebrating in the plaza today?
      Every country we visit teaches us fresh ways to see the world.
      I bought handmade bookmarks as souvenirs for my classmates back home.
      Could we get a table near the window overlooking the harbor?
      The hotel receptionist gave us helpful directions to the botanical garden.
      Packing light makes transferring between trains so much easier!
      Let us leave a positive review for our friendly local tour guide.
      Traveling abroad inspired me to practice my English speaking every day.
      We learned how to fold traditional paper cranes during the workshop.
      Have you ever tasted freshly baked croissants in a cozy French cafe?
      Respecting local customs makes every traveler a great global citizen.
      I hope to visit at least ten different countries before I turn twenty!
    `),
  },
  {
    category: 'School Presentations, Stories & Ideas',
    styleTag: 'core',
    items: p(`
      Good morning everyone, today I am excited to present my science project!
      First, let me explain the main question behind our experiment.
      As you can see on this colorful chart, solar energy powered the fan.
      In conclusion, renewable energy helps keep our air clean and healthy.
      Thank you for listening—does anyone have any questions for our team?
      The most suspenseful moment in the novel happened right at midnight.
      Although the main character felt nervous, she showed tremendous courage.
      In my opinion, teamwork achieves far more than working alone.
      On the other hand, quiet solo study helps me concentrate deeply.
      Could you give me an example to help clarify that grammar rule?
      Let us brainstorm five creative titles for our animated short film!
      What if the friendly robot discovers a hidden garden on Mars?
      First draft is done—now let us edit our spelling and punctuation!
      Speaking clearly and making eye contact keeps the audience engaged.
      I practiced my speech in front of a mirror three times last night.
      My favorite part of the documentary was watching penguins dive underwater.
      Did you know that octopuses have three hearts and blue blood?
      Let us compare the two inventions and list their biggest advantages.
      According to our class survey, reading comics is the top weekend hobby.
      That unexpected plot twist at the end completely surprised me!
      Can you summarize the whole chapter in just three clear sentences?
      Let us assign each team member a clear role before we start building.
      If we manage our time wisely, we will finish ahead of schedule.
      I really admire how vividly the author described the stormy ocean.
      Using expressive intonation brings every character's dialogue to life!
      Let us double-check all our measurements before recording the result.
      Making mistakes during rehearsal is how great performers improve!
      Which documentary or podcast would you recommend for curious kids?
      Writing stories lets you invent entire galaxies right from your desk.
      Let us give a big round of applause to our classmates!
    `),
  },
  {
    category: 'Daily Discussions, Plans & Problem-Solving',
    styleTag: 'core',
    items: p(`
      If it stays sunny this weekend, let us organize a park picnic!
      What should we do if it suddenly starts pouring rain?
      In that case, we can move indoors and host a board-game tournament.
      I have been practicing guitar for six months and finally learned a full song!
      How long have you lived in this lively neighborhood?
      Have you ever tried coding your own interactive video game?
      I would rather spend Saturday hiking than staring at a screen all day.
      Let us compromise so everyone gets to pick one fun activity.
      Wait—before we decide, let us weigh the pros and cons together.
      I forgot my umbrella at school, so I had to dash home between showers.
      Could you remind me to email my teacher before five o'clock?
      My bike chain came loose, so my dad taught me how to repair it.
      Saving a small part of my allowance helped me buy a new telescope!
      Recycling paper and plastic bottles at home takes just a few seconds.
      Our class organized a weekend bake sale to support an animal shelter.
      Volunteers picked up litter and planted flowers along the walking trail.
      When you disagree with a friend, explain your feelings calmly and kindly.
      Listening carefully without interrupting builds strong trust.
      I appreciate your honest feedback—it helped me make my poster much clearer!
      Whenever a task feels overwhelming, break it into tiny doable steps.
      Getting at least nine hours of sleep boosts memory and creativity.
      Warming up properly before soccer prevents sore muscles later.
      Drinking water instead of sugary soda keeps my energy steady all day.
      Which club are you thinking about joining next semester?
      I am torn between joining the robotics team and the junior MC studio!
      Why not try a trial session for both before making up your mind?
      That sounds like a super sensible plan—thank you for the advice!
      Let us set a daily ten-minute speaking goal to level up our fluency.
      Consistency beats cramming every single time!
      Look how far your pronunciation has come since last month!
    `),
  },
  {
    category: 'Past Experiences & Future Dreams',
    styleTag: 'core',
    items: p(`
      When I was younger, I used to be terrified of speaking on stage.
      After joining LiLab, I discovered how fun public speaking can be!
      Last summer, I attended a creative camp where we filmed our own movie.
      While we were filming, a friendly golden retriever photobombed our scene!
      We laughed so hard that we decided to keep the puppy in the final movie!
      I had never seen snow until our family visited the northern mountains.
      Have you ever slept in a tent and woken up to birdsong?
      By the time we reached the lighthouse, the sunset had turned the sea gold.
      Next year, I hope to pass my Cambridge A2 Flyers exam with top shields!
      One day, I dream of becoming a marine biologist who protects coral reefs.
      My best friend wants to design eco-friendly solar-powered cities!
      If I could invent anything, I would build a translator collar for dogs.
      Imagine being able to travel anywhere in the world in ten minutes!
      If we had a time machine, I would visit ancient Egypt to see the pyramids.
      What skill are you most excited to master over the next six months?
      I am determined to read twenty English chapter books this school year.
      Looking back, winning our first team debate taught me real confidence.
      Even when our prototype broke twice, we kept tweaking until it worked!
      That moment taught me that persistence matters more than instant luck.
      I still remember the first time I ordered food in English all by myself.
      My heart was pounding, yet the waiter smiled and understood every word!
      Small brave steps eventually turn into giant life adventures.
      What is the most memorable trip you have ever taken with your family?
      I will never forget snorkeling beside sea turtles in crystal-clear water.
      Someday I want to host an international youth podcast about world cultures.
      Our generation can invent amazing green solutions for planet Earth!
      Learning English opens doors to friendships across every continent.
      I feel excited thinking about all the places I have yet to explore.
      Keep dreaming big and practicing a little bit every single day!
      The future belongs to curious minds who never stop learning!
    `),
  },
  {
    category: 'Expressing Opinions & Polite Debate',
    styleTag: 'core',
    items: p(`
      From my point of view, learning music helps sharpen our math skills too.
      I see what you mean, although I look at it slightly differently.
      That is a valid point—I had not considered that angle before!
      Personally, I believe reading paper books feels cozier than reading on tablets.
      Still, e-books are super convenient when you are packing for a long trip!
      One strong reason to learn coding early is that it trains logical thinking.
      Another major benefit is being able to turn your wild ideas into real apps!
      To be honest, I prefer outdoor team sports over solo video games.
      However, creative puzzle games can also be a great workout for your brain.
      Could you back up that opinion with a real-life example?
      Let us hear everyone's perspective before we vote as a group.
      I strongly agree that schools should have bigger gardens and green spaces.
      Not only do trees provide shade, they also teach us how food grows.
      Even though homework takes effort, practicing reinforces what we learn in class.
      The key is balancing study time with plenty of play and rest.
      What would happen if every student walked or biked to school once a week?
      First, neighborhood traffic would shrink; second, everyone would feel fitter!
      I respectfully disagree with that rule because younger kids need extra time.
      May I add one more idea to what Maya just shared?
      Let us combine both suggestions to design the best possible solution!
      In short, kindness and curiosity should guide every decision we make.
      That debate was lively, respectful, and packed with clever arguments!
      Staying calm even when others disagree is the mark of a true leader.
      Let us summarize the three main reasons supporting our team's proposal.
      Always ask thoughtful "why" and "how" questions when exploring new topics!
    `),
  },
  {
    category: 'Colorfully Rich Idioms & Expressions',
    styleTag: 'idiom',
    items: p(`
      Every single setback can be a blessing in disguise if you learn from it.
      Don't count your chickens before they hatch—finish the final round first!
      She really hit the ground running on her first day at the new school.
      We pulled it off right at the eleventh hour before the bell rang!
      You can't beat the best of both worlds—fun learning and real results!
      Keep your head above water by tackling one homework task at a time.
      Let us think outside the box and invent a totally original poster!
      He is a dark horse in the chess club—nobody expected him to win!
      Reading between the lines, I think the hero knew the secret all along.
      Don't cry wolf or nobody will believe you when you really need help!
      It takes two to tango, so both partners need to share the work.
      She let her imagination run wild while writing the fantasy story!
      That new solar car is light-years ahead of last year's model!
      We are on the same wavelength—we picked the exact same color palette!
      Don't jump to conclusions until you gather all the clues!
      He has his head in the clouds whenever he daydreams about space.
      Stepping out of your comfort zone is where real growth begins.
      She bent over backwards to make the exchange student feel welcome.
      You hit the jackpot with such a supportive group of classmates!
      Let us cut to the chase and test our robot on the track!
      That complicated diagram finally made sense—everything fell into place!
      He threw in the towel too early, so we encouraged him to try again.
      Actions speak louder than promises when you want to earn trust.
      Don't make a mountain out of a molehill over one tiny smudge!
      We got off on the right foot by introducing ourselves with warm smiles.
      She knows the entire museum map like the back of her hand!
      It was touch and go for a minute, yet our paper bridge held five books!
      He is quick on the uptake and mastered the guitar riff in ten minutes.
      Let us keep the ball rolling while our creativity is flowing!
      A picture is worth a thousand words in any presentation.
      You really stole the show with your expressive storytelling!
      Don't burn the candle at both ends—get proper rest before exam day!
      We crossed that bridge when we came to it and handled it smoothly.
      Put yourself in someone else's shoes before judging their choice.
      Good things come to those who stay patient and work steadily!
    `),
  },
  {
    category: 'World Cultural Phrases (US, UK, AU, CA, IE, NZ, SG, ZA)',
    styleTag: 'cultural',
    items: p(`
      [UK] That new sci-fi movie was proper brilliant, wasn't it?
      [UK] I am chuffed to bits about winning the poetry competition!
      [UK] Give us a bell later so we can plan Saturday's trip.
      [UK] Don't get your knickers in a twist—we still have ten minutes!
      [UK] Let us nip down to the corner shop for a pint of milk.
      [UK] That rainy match left everyone completely knackered!
      [UK] Cheers mate, you are an absolute star for carrying that!
      [UK] It is chucking it down outside—better grab your wellies!
      [AU] Too right! Exploring the Great Barrier Reef is unforgettable!
      [AU] Let us chuck a U-ey and grab some cold gelato by the pier.
      [AU] Don't spit the dummy just because you missed one shot!
      [AU] That surfer is a total legend on the big waves!
      [AU] Let us have a quick yarn about your trip to Melbourne.
      [AU] You did a ripper job designing that eco-poster!
      [AU] He was flat out like a lizard drinking preparing for the gala!
      [US] Let us rain-check the skatepark until the storm clears up.
      [US] That pitch was right out of left field—nobody saw it coming!
      [US] You knocked that English presentation clear out of the ballpark!
      [US] Let us touch base tomorrow to wrap up the science slides.
      [US] Give me a shout if you want to study together this afternoon!
      [US] That museum exhibit was totally worth the hype!
      [CA] We spent the whole afternoon playing shinny on the frozen pond!
      [CA] Put your hoodie—or bunny hug—on before walking to the bus stop!
      [CA] Don't forget a loonie and a toonie for the arcade games!
      [CA] That maple taffy on fresh snow is out of this world, eh?
      [CA] Sorry to bother you, could you pass the ketchup?
      [IE] We had fierce craic listening to live fiddle music in Galway!
      [IE] Grand stretch in the evenings now that summer is arriving!
      [IE] Ah sure, it will be grand—just take a deep breath and smile!
      [IE] Thanks a million for walking me through that coding bug!
      [NZ] Heaps of friendly hikers waved hello along the mountain trail!
      [NZ] Chur bro, thanks for sharing your extra markers with me!
      [NZ] That view over Milford Sound is stunner, yeah nah, seriously!
      [NZ] Tu meke! You smashed your personal best swimming record!
      [SG] Wah, your robotics project is power lah!
      [SG] Don't be paiseh—step up to the mic and share your story!
      [SG] Let us makan at the hawker centre right after school!
      [ZA] Ag shame, don't worry—we will help you find your lost cap!
      [ZA] That wildlife safari at sunrise was seriously lekker!
      [ZA] Hold tight, we are heading to the beach now-now!
    `),
  },
  {
    category: 'Natural Everyday Slang & Colloquialisms',
    styleTag: 'slang',
    items: p(`
      That animation you built in the studio is straight fire!
      Low-key, I think practicing aloud actually feels super fun now!
      High-key impressed by how smoothly you spoke that whole paragraph!
      No cap, your accent sounds way clearer than last month!
      That new space game totally slaps—the music is unreal!
      Don't sleep on the cultural exploration workshop, it is awesome!
      It is giving major movie-director energy right now!
      You totally understood the assignment on that science model!
      Let us vibe to some lo-fi beats while we sketch our comic.
      I am dead tired after swimming twenty laps at the pool!
      Wait, spill the tea—who won the school robotics trophy?!
      That puzzle had me stumped for ages, not gonna lie!
      Honestly, my brain just glitched on that tongue-twister word!
      Big W for our team finishing two days ahead of the deadline!
      Take a chill pill—we still have plenty of time to practice!
      That comeback in the final thirty seconds was pure clutch!
      You are literally carrying the whole trivia squad today!
      Bro, did you see how high that bottle rocket launched?!
      Same here, I am totally obsessed with astronomy podcasts!
      Catching good vibes all week long in English class!
      My bad, I spaced out for a second—could you repeat that?
      I am down for grabbing boba tea right after rehearsal!
      That magician's card trick completely blew everyone away!
      Keep grinding and you will unlock the top speaker badge!
      She is a total pro at explaining tricky math puzzles.
      Hands down, that was the most epic field trip this year!
      Plot twist—the quietest kid in class turned out to be a guitar prodigy!
      Shout-out to our coach for always cheering us on!
      Zero chance I am missing Friday's talent showcase!
      Let us lock in and ace these next five speaking rounds!
      Whoa, that sunset over the bay looks unreal!
      You crushed it—ten out of ten, zero notes!
      Fair play, that was a super smart move in chess!
      Catch you on the flip side after music practice!
      Stay awesome and keep leveling up your voice!
    `),
  },
];

export const A2_DATASET = buildLevelDataset('a2', WORD_BUCKETS, PHRASE_BUCKETS);
