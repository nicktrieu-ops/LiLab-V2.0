import { buildLevelDataset, p, w, type RawCategoryBucket } from './types';

const WORD_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'School, Subjects & Classroom',
    styleTag: 'core',
    items: w(`
      subject lesson timetable schedule recess assembly principal librarian classmate partner locker hallway
      cafeteria gymnasium auditorium laboratory science history geography literature grammar phonics spelling
      dictionary workbook textbook assignment project homework report grade score mark certificate trophy
      medal prize award contest debate speech recital choir band orchestra drama painting sculpture
      drawing origami marker highlighter sharpener compass protractor calculator stapler paperclip binder
      clipboard folder index bookmark chapter paragraph title author illustrator publisher glossary margin
      question answer example solution mistake correction practice review revision study memory attention
      effort progress improvement curiosity creativity teamwork cooperation leadership responsibility focus
      alphabet vowel consonant syllable accent rhythm sentence clause period comma question_mark exclamation
      chalkboard whiteboard projector speaker microphone headphones tablet laptop charger keyboard monitor
    `),
  },
  {
    category: 'Daily Routines & Home Life',
    styleTag: 'core',
    items: w(`
      morning weekday weekend sunrise sunset midnight breakfast brunch lunch snack dinner supper bedtime
      alarm shower bath toothbrush toothpaste mouthwash soap shampoo conditioner towel bathrobe slippers
      pajamas uniform outfit wardrobe hanger laundry hamper washer dryer detergent clothesline ironing
      chore sweeping mopping dusting vacuuming polishing tidying organizing recycling compost garbage
      trashcan broom dustpan bucket sponge dishcloth dishwasher counter cupboard pantry shelf refrigerator
      freezer microwave kettle toaster blender skillet saucepan ladle spatula whisk colander cutting_board
      napkin tablecloth coaster placemat teacup saucer pitcher thermos lunchbox water_bottle apron
      armchair bookshelf cushion curtain blinds carpet doormat hallway staircase railing balcony patio
      driveway mailbox doorbell keyhole padlock flashlight toolbox hammer screwdriver wrench nail screw
      calendar diary journal checklist reminder habit routine errand appointment visit welcome hospitality
    `),
  },
  {
    category: 'Town, Places & Community',
    styleTag: 'core',
    items: w(`
      neighborhood downtown suburb avenue boulevard intersection crosswalk sidewalk pavement traffic
      roundabout overpass tunnel highway bridge fountain plaza square courtyard statue monument landmark
      museum gallery theater cinema stadium arena pool rink bowling_alley arcade amusement_park carnival
      circus aquarium planetarium botanical_garden greenhouse orchard vineyard meadow pasture farmyard
      bakery butcher_shop grocery_store supermarket pharmacy drugstore bookstore stationery_shop florist
      barbershop salon laundromat tailor_shop shoe_store toy_store pet_shop hardware_store department_store
      restaurant bistro cafe diner pizzeria food_court market_stall vendor customer cashier receipt
      discount bargain change wallet coin banknote credit_card library post_office fire_station police_station
      hospital clinic emergency_room dentist_office veterinary_clinic airport terminal runway harbor pier
      lighthouse train_station subway_station bus_stop taxi_stand parking_lot gas_station hotel motel
    `),
  },
  {
    category: 'Travel, Transport & Directions',
    styleTag: 'core',
    items: w(`
      journey voyage trip excursion vacation holiday adventure expedition tour sightseeing souvenir
      postcard luggage suitcase backpack duffel_bag carry_on passport boarding_pass ticket reservation
      itinerary map guidebook compass binoculars camera tripod umbrella raincoat sunscreen sunglasses
      airplane helicopter glider balloon_ride express_train bullet_train tram trolley cable_car subway
      ferry yacht sailboat canoe kayak raft motorboat cruise_ship submarine bicycle tricycle unicycle
      skateboard scooter rollerblade motorcycle moped ambulance firetruck police_car delivery_van tractor
      bulldozer crane forklift passenger driver captain pilot sailor conductor attendant tourist traveler
      explorer backpacker commuter pedestrian cyclist departure arrival delay boarding gate platform
      track aisle window_seat seatbelt life_jacket helmet rearview_mirror headlight windshield steering_wheel
      north south east west northeast northwest southeast southwest forward backward sideways straight
      corner opposite between beside behind across through around beyond toward destination distance
    `),
  },
  {
    category: 'Health, Sports & Hobbies',
    styleTag: 'core',
    items: w(`
      health fitness energy strength stamina balance flexibility posture muscle skeleton joint heart
      lungs breathing pulse temperature headache stomachache toothache earache sore_throat runny_nose
      coughing sneezing allergy rash blister sprain bruise bandage ointment syrup vitamin nutrition
      protein calcium fiber hydration exercise warmup stretching jogging sprinting cycling swimming
      diving surfing sailing rowing skating skiing sledding snowboarding hiking camping rock_climbing
      gymnastics yoga martial_arts karate judo taekwondo fencing archery badminton tennis ping_pong
      volleyball basketball football soccer baseball softball cricket rugby hockey golf bowling
      athlete player teammate captain referee umpire coach goalkeeper striker defender champion medalist
      scoreboard whistle stadium_seat trophy_cup hobby pastime collecting gardening photography baking
      knitting sewing crocheting woodworking pottery painting sketching calligraphy origami journaling
      chess checkers scrabble jigsaw_puzzle magic_trick puppetry storytelling singing drumming strumming
    `),
  },
  {
    category: 'Food, Flavors & Cooking',
    styleTag: 'core',
    items: w(`
      appetizer starter main_course side_dish dessert beverage smoothie milkshake lemonade iced_tea
      espresso hot_chocolate mineral_water sparkling_water cereal oatmeal porridge omelet scrambled_eggs
      pancakes waffles french_toast croissant baguette muffin scone biscuit pretzel dumpling spring_roll
      sushi ramen pho curry stew casserole lasagna ravioli spaghetti meatballs steak roast_chicken
      grilled_fish shrimp_tempura fried_rice mashed_potatoes french_fries coleslaw fruit_salad soup_bowl
      avocado artichoke asparagus beetroot brussels_sprouts cauliflower celery eggplant fennel leek
      mushroom okra parsnip radish squash zucchini apricot blackberry blueberry cantaloupe cranberry
      dragonfruit fig grapefruit guava honeydew jackfruit lychee nectarine papaya passionfruit persimmon
      pomegranate raspberry tangerine almond cashew chestnut hazelnut macadamia pistachio walnut sesame
      sunflower_seed cinnamon nutmeg vanilla cardamom clove basil cilantro mint oregano parsley rosemary
      thyme turmeric paprika mustard ketchup mayonnaise vinegar olive_oil soy_sauce savory tangy zesty
      crunchy crispy chewy creamy fluffy tender juicy flaky spicy mild bitter bland delicious
    `),
  },
  {
    category: 'Nature, Animals & Environment',
    styleTag: 'core',
    items: w(`
      environment nature wildlife habitat ecosystem rainforest woodland grassland wetland desert tundra
      glacier iceberg volcano crater canyon gorge cliff ridge summit plateau valley basin waterfall
      rapids creek estuary delta lagoon reef coral_reef coastline peninsula archipelago island_chain
      atmosphere climate forecast temperature_gauge barometer humidity breeze gale hurricane cyclone
      typhoon tornado blizzard hailstorm drizzle downpour rainbow_arc sunset_glow twilight dawn dusk
      constellation planet_ring asteroid comet_tail meteor_shower telescope_lens mammal reptile amphibian
      insect arachnid crustacean mollusk marsupial primate predator prey herbivore carnivore omnivore
      migration hibernation camouflage pollination nectar hive burrow nest den flock herd pack pride
      school_of_fish swarm cheetah leopard jaguar panther puma lynx hyena jackal coyote badger otter
      beaver hedgehog porcupine armadillo sloth anteater platypus wallaby wombat lemur orangutan gorilla
      chimpanzee flamingo toucan hornbill pelican albatross seagull puffin kingfisher woodpecker hummingbird
      magpie swallow dragonfly praying_mantis grasshopper cicada firefly_light seahorse stingray manta_ray
    `),
  },
  {
    category: 'Everyday Verbs & Actions',
    styleTag: 'core',
    items: w(`
      arrive depart travel explore discover invent create design build repair decorate arrange organize
      collect gather sort pack unpack deliver carry lift lower drag push_open pull_shut fasten unfasten
      button zip tie untie fold unfold wrap unwrap measure weigh calculate estimate compare match
      choose decide prefer agree disagree promise remind forget remember imagine wonder guess suppose
      believe hope wish dream expect notice observe examine inspect search_for locate recognize identify
      explain describe discuss debate argue persuade advise suggest recommend warn encourage praise
      congratulate thank apologize forgive complain interrupt whisper mumble shout cheer applaud whistle
      laugh_aloud giggle chuckle grin frown sigh yawn sneeze_loudly shiver sweat stretch_out relax rest
      recover heal protect rescue guard defend escape hide_away chase_after capture release share_fairly
      borrow lend exchange trade purchase spend save_money afford donate volunteer recycle plant_seeds
      harvest water_plants cook_dinner chop slice peel grate boil simmer fry grill roast bake_bread
      serve taste_test spill wipe_clean scrub rinse polish dry_off sweep_up vacuum_rug mop_floor
    `),
  },
  {
    category: 'Feelings, Qualities & Adjectives',
    styleTag: 'core',
    items: w(`
      cheerful delighted thrilled excited enthusiastic eager hopeful optimistic grateful thankful proud
      confident brave courageous fearless calm peaceful relaxed content satisfied amused playful curious
      interested amazed astonished surprised shocked confused puzzled nervous anxious worried frightened
      terrified lonely homesick disappointed upset frustrated annoyed impatient jealous embarrassed shy
      exhausted drowsy energetic lively active healthy fit strong sturdy fragile delicate gentle polite
      respectful honest truthful loyal faithful generous helpful thoughtful caring kindhearted friendly
      sociable outgoing patient tolerant fair reasonable sensible clever bright brilliant creative witty
      talented skillful careful cautious clumsy careless messy tidy neat spotless gleaming sparkling
      colorful vibrant vivid pastel pale dim gloomy shadowy blinding ancient antique modern brand_new
      ordinary common unusual rare strange weird mysterious famous popular favorite useful helpful_tool
      useless convenient comfortable cozy cramped spacious enormous gigantic massive miniature tiny_bit
      narrow_path steep shallow deep_sea hollow solid flexible stiff elastic sticky slippery greasy
      rough_edge smooth_stone sharp_point blunt_tip loud_bang silent peaceful_night rapid swift gradual
    `),
  },
  {
    category: 'Single-Syllable Sound Challenges',
    styleTag: 'single_syllable',
    items: w(`
      breadth stealth wealth health realm dealt knelt felt_hat melt_down pelt_rain quilt guilt built
      silt tilt wilt hilt jilt split_pea sprint_fast squint flint glint hint_card mint_leaf print_out
      splint tint_glass strength_test length_wise warmth_glow depth_chart width_line fifths sixths
      eighths twelfths tenths hundredths thousandths months_ago cloths_fold oaths_kept paths_walked
      wreaths_hung sheaths_drawn breathes_deep bathes_warm soothes_pain smooths_out grooves_deep
      scratched stretched sketched fetched patched matched watched latched hatched thatched witched
      twitched switched pitched ditched hitched stitched shrieked squeaked creaked streaked tweaked
      squelched drenched wrenched clenched benches trenches branches crunches munches punches lunches
      splashed smashed crashed trashed flashed clashed slashed dashed mashed washed squashed throng
      thrive thrust throb thump thud thwart thatch thaw theft theme thick thief thigh thing think
      third thirst thorn thorough_end thought_out thread_needle threat_level three_fold thresh_grain
      threw_far thrift_shop thrill_ride throat_clear throne_room throng_crowd through_way throw_far
      shrub shrug shrunk shroud shrank shred_paper shrewd_plan shriek_loud shrill_note shrimp_boat
      shrink_wrap scribe script scroll scrub_brush scruff_neck scrunch_up sculpt_clay sphere sphinx
      phrase phlegm phloem plinth plight plough_field drought_year fraught_time naught_left wrought
      caught_up taught_well bought_new brought_home fought_hard sought_out ought_to thought_well
      gauge_read vague_hint plague_old rogue_wave vogue_style league_play fatigue_end choir_song
      aisle_seat isle_bay corps_band coup_plan depot_stop ballet_step buffet_line gourmet_dish
    `),
  },
  {
    category: 'Multisyllable Word Studio',
    styleTag: 'multisyllable',
    items: w(`
      adventure_story anniversary_day announcement_bell apology_note appearance_look appointment_time
      appreciation_card aquarium_tank architecture_plan arrangement_list arrival_gate assignment_sheet
      astronomy_club athletics_meet atmosphere_layer attendance_roll auditorium_stage autobiography
      availability_slot backpacker_trail badminton_court bakery_counter barbecue_grill basketball_hoop
      beautifully_drawn beginning_stage behavior_chart beneficiary_name biography_book biology_class
      boomerang_throw botanical_park boundary_line brainstorming_pad breakfast_table breathlessly
      broadcasting_room brotherhood_bond butterfly_garden cafeteria_tray calculation_step calendar_year
      calligraphy_brush camouflage_coat campground_site capability_test capitalization_rule
      cardiovascular_fit carpenter_bench caterpillar_leaf celebration_song centimeter_ruler
      certificate_frame championship_cup characteristic_trait cheerfulness_ray chemistry_lab
      childhood_memory choreography_move chrysanthemum_bloom cinematography_art circulation_path
      circumference_line civilization_era clarification_note classification_key cleanliness_habit
      collaboration_hub collection_box colonization_map combination_lock comfortable_chair
      communication_hub community_center companion_dog comparison_chart compass_reading competition_day
      complimentary_pass comprehension_quiz concentration_game conclusion_line condensation_drop
      confectionery_shop confidence_boost confirmation_code congratulation_card connection_bridge
      conscientious_work conservation_park consideration_act consistency_goal constellation_map
      construction_site consultation_room container_ship contemplation_time contemporary_art
      continuation_line contribution_box conversation_star cooperation_game coordination_drill
      correspondence_box cosmopolitan_city creativity_spark credibility_check curiosity_spark
      curriculum_guide customization denominator department_head departure_board
      dependability_star description_text destination_map determination_win development_plan
      diagonal_line dictionary_page difference_check difficulty_level digestion_step digital_camera
    `),
  },
  {
    category: 'Difficult Stretch Vocabulary',
    styleTag: 'difficult',
    items: w(`
      abundance accurate achieve adapt admire advantage ambitious analyze ancient_ruin appreciate
      approach appropriate architect artificial assemble astonish atmosphere_change attract audience
      authentic authority automatic brilliant_idea calculate_fast campaign_trail candidate_list
      capable_team capacity_limit capture_moment catastrophe_alert cautious_step celebrate_win
      challenge_task champion_spirit chaos_calm character_trait charity_event cheerful_mood
      chronicle_book circulate_air citizen_duty civilize_land clarity_voice classify_items climate_zone
      clumsy_move collaborate_well collapse_wall colleague_help combine_colors comedy_show
      comfort_zone command_voice commemorate_day commerce_hub commit_time communicate_well
      companion_ship compare_notes compassion_heart compel_action compete_fairly complex_puzzle
      compliment_kind compose_music comprehend_text compromise_fair conceal_clue concentrate_now
      concept_map concern_care conclude_story concrete_wall condemn_wrong condition_check conduct_band
      confess_truth confident_tone confirm_plan conflict_solve conform_rule confront_fear confuse_path
      connect_dots conquer_peak conscience_clear conscious_mind consequence_act conserve_water
      consider_all consist_of console_friend conspicuous_sign constant_effort construct_bridge
      consult_guide consume_less contact_list contain_water contemplate_deep contemporary_style
      contend_prize content_heart contest_entry continent_map continue_on contract_sign contradiction
      contrast_tone contribute_all control_room controversy_talk convenient_way convention_hall
      converse_well convert_unit convey_idea convince_all cooperate_now coordinate_plan cope_well
    `),
  },
];

const PHRASE_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Daily Routines & School Life',
    styleTag: 'core',
    items: p(`
      I wake up at six thirty every morning.
      I brush my teeth and wash my face right away.
      What time does your first class start today?
      My favorite school subject is science and art.
      Could you lend me a highlighter for a minute?
      Let us work together on this group project!
      I always pack my backpack the night before.
      Did you remember to bring your homework notebook?
      Excuse me, could you explain that example again?
      I practiced reading aloud for twenty minutes today.
      Our class is visiting the natural history museum!
      Let us meet at the library after lunch break.
      Please keep your desk neat and organized.
      Who is presenting their story first today?
      I scored ninety-five percent on my spelling quiz!
      Do you want to sit together in the cafeteria?
      We have music rehearsal every Wednesday afternoon.
      Take careful notes during the science experiment.
      Don't forget to return your library books on Friday.
      Let us review our vocabulary flashcards together.
      I love painting watercolors in art studio class.
      May I sharpen my pencil before we begin?
      Please speak a little louder so everyone can hear.
      Our teacher praised our teamwork and creativity.
      I am excited to join the school coding club!
      After school, I usually ride my bike with friends.
      I help my parents set the table for dinner.
      Before bed, I read two chapters of my storybook.
      Getting enough sleep helps my brain stay sharp.
      Tomorrow is going to be another awesome school day!
    `),
  },
  {
    category: 'Polite Requests & Everyday Conversations',
    styleTag: 'core',
    items: p(`
      Would you mind opening the window a little bit?
      Could you please pass me the salt and pepper?
      Excuse me, where is the nearest subway station?
      How much does this colorful storybook cost?
      I would like a glass of fresh mango juice, please.
      Thank you so much for your kind help today!
      No problem at all, I am always happy to help.
      I am terribly sorry for being five minutes late.
      Do not worry about it, we just got started!
      Could you speak a bit slower, please?
      What does this interesting new word mean?
      How do you pronounce this long English word?
      Can I try saying that sentence one more time?
      Let me think about that for just a second.
      That is a really thoughtful question to ask!
      I completely agree with your wonderful idea.
      Maybe we could try doing it a different way.
      Would you like to join us at the park later?
      I would love to, let me ask my mom first!
      Sorry, I cannot make it this Saturday afternoon.
      How about meeting next Sunday morning instead?
      Please let me know if you need anything else.
      Hold on a moment, I will check my schedule.
      Thank you for inviting me to your birthday party!
      It was wonderful chatting with you this afternoon.
      Please say hello to your family for me!
      Have a safe and pleasant trip home today.
      Call me whenever you arrive at the station.
      I appreciate how patient and helpful you are.
      Let us keep in touch over the summer break!
    `),
  },
  {
    category: 'Travel, Directions & Exploring Town',
    styleTag: 'core',
    items: p(`
      Go straight ahead for two blocks, then turn left.
      The bakery is right across from the city park.
      Turn right at the traffic light near the bridge.
      Is the science museum within walking distance?
      You can take bus number twelve straight downtown.
      Which platform does the express train leave from?
      We need to check in two hours before our flight.
      Please fasten your seatbelt during takeoff and landing.
      I would love a window seat to watch the clouds!
      Where can we pick up our checked luggage?
      Do you have a free city map for visitors?
      Let us take a ferry ride across the sparkling bay.
      Look at the historic clock tower in the square!
      Can we buy two student tickets for the aquarium?
      What time does the botanical garden close today?
      Let us stop by the souvenir shop for postcards.
      Always look both ways before crossing the crosswalk.
      Put on your helmet before riding your bicycle.
      We packed snacks, water bottles, and a flashlight.
      Camping under the starry sky was unforgettable!
      Look through the binoculars at that colorful parrot!
      Follow the wooden trail signs through the forest.
      Let us rest on this shady bench by the fountain.
      The view from the mountain peak is breathtaking!
      We took dozens of sunny photos at the beach.
      Remember to put on sunscreen before swimming.
      How long does it take to drive to the harbor?
      The traffic is moving smoothly this morning.
      Our tour guide shared fascinating local legends.
      Traveling teaches us so much about the world!
    `),
  },
  {
    category: 'Hobbies, Sports & Expressing Feelings',
    styleTag: 'core',
    items: p(`
      What do you enjoy doing in your free time?
      I love playing badminton with my dad on weekends.
      She practices piano for thirty minutes every day.
      He is really talented at sketching comic heroes.
      Let us start a friendly chess tournament today!
      My sister bakes the most delicious chocolate muffins.
      I feel so excited about our upcoming field trip!
      Sometimes I feel nervous before going on stage.
      Taking three slow deep breaths helps me stay calm.
      I am really proud of finishing my first chapter book!
      When my friend feels sad, I listen and cheer them up.
      Even if we lose a match, good sportsmanship matters.
      Cheering for our teammates gives everyone energy!
      Don't give up—every mistake helps you grow stronger.
      I was amazed by how fast the dolphins jumped!
      That magic show left the whole audience speechless.
      My hobby is collecting stamps from different countries.
      Have you ever tried growing strawberries on a balcony?
      Swimming laps in the morning makes me feel refreshed.
      Let us stretch our arms and legs before running.
      Pass the ball to the open player on the right!
      What a fantastic goal right before the whistle!
      I enjoy building creative robots out of cardboard.
      Listening to peaceful music helps me focus well.
      Playing board games brings the whole family together.
      I hope to learn how to play the acoustic guitar.
      Doing origami requires patience and steady fingers.
      Writing in my daily journal clears my mind.
      Sharing hobbies is the best way to make friends!
      I feel grateful for all the wonderful things I learned.
    `),
  },
  {
    category: 'Food, Shopping & Dining Out',
    styleTag: 'core',
    items: p(`
      Could we see the menu for today, please?
      What do you recommend for someone who likes noodles?
      I would like a bowl of hot pho with extra herbs.
      Could I have mine without spicy chili peppers?
      This mango smoothie tastes sweet and refreshing!
      May we have some extra napkins and spoons, please?
      Excuse me, could we get the bill when you have a moment?
      Everything on the table was absolutely delicious!
      Let us go grocery shopping for fresh fruits and veggies.
      We need a loaf of whole wheat bread and a carton of milk.
      Are these strawberries grown locally on a farm?
      This bakery smells like warm cinnamon and butter!
      Do you have this blue jacket in a smaller size?
      May I try these sneakers on to check the fit?
      They fit comfortably and feel super lightweight.
      Is there a student discount on art supplies today?
      Let us compare prices before making a decision.
      Remember to bring our reusable cloth shopping bags!
      Cooking homemade pizza together is so much fun.
      Wash the crisp lettuce leaves under cold running water.
      Carefully chop the carrots with an adult's help.
      Let the soup simmer gently for fifteen minutes.
      Taste a small spoonful to check the seasoning.
      Would anyone like a second helping of fried rice?
      Save room for a slice of warm apple pie!
      Drinking plenty of water keeps us healthy and alert.
      Balanced meals give us energy for learning and play.
      I packed a crunchy cucumber sandwich for lunch.
      Thank you to the chef for preparing such a feast!
      Sharing food with friends makes every meal sweeter.
    `),
  },
  {
    category: 'Everyday Stories & Descriptions',
    styleTag: 'core',
    items: p(`
      Last Saturday, we explored a hidden waterfall in the hills.
      While we were walking, a friendly squirrel crossed our path.
      Suddenly, dark gray clouds rolled across the bright sky.
      Luckily, we had brought our colorful raincoats along!
      After the rain stopped, a double rainbow appeared overhead.
      The main character in my book is a clever young inventor.
      First, she draws a careful blueprint in her notebook.
      Next, she gathers recycled bottles, gears, and tape.
      Finally, her solar-powered toy boat glides across the pond!
      Have you ever seen a shooting star at night?
      My grandmother told me an old folk tale about kindness.
      In the story, a tiny sparrow saves an entire village.
      Can you describe what your dream treehouse looks like?
      It has a rope ladder, a cozy reading nook, and a telescope!
      From the top window, you can watch birds build nests.
      On rainy afternoons, I love listening to raindrops tap the glass.
      Winter mornings feel crisp, cool, and peaceful outside.
      In spring, colorful blossoms cover every park pathway.
      Summer afternoons are perfect for swimming and watermelon.
      In autumn, golden leaves swirl gently down to the ground.
      Our neighborhood park just opened a brand-new skate ramp.
      Volunteers planted fifty young trees along the riverbank.
      Clean rivers provide safe homes for fish and turtles.
      Every small eco-friendly habit protects our planet!
      Next weekend, I plan to visit my cousins in the countryside.
      We are going to feed the goats and pick ripe mangoes.
      I cannot wait to tell my classmates all about the trip!
      What was the funniest thing that happened to you this week?
      Tell me more details—that sounds super interesting!
      Every day brings a brand-new story worth sharing!
    `),
  },
  {
    category: 'Everyday Idioms & Fun Expressions',
    styleTag: 'idiom',
    items: p(`
      Learning new words is a walk in the park when you practice!
      Don't judge a book by its cover before reading it.
      She passed the spelling test with flying colors!
      It is time to hit the books before Friday's quiz.
      We are all in the same boat, so let us help each other.
      That tricky math problem finally clicked—lightbulb moment!
      He is a real bookworm who finishes three novels a week.
      Keep your eyes peeled for the yellow school bus!
      I have butterflies in my stomach before my speech!
      Speaking on stage gets easier once you break the ice.
      Don't put all your eggs in one basket.
      Let us call it a day and rest our brains.
      She has a green thumb—every plant she waters blooms!
      That bicycle costs an arm and a leg!
      He spilled the beans about the surprise birthday party!
      You took the words right out of my mouth!
      Let us sleep on it and decide tomorrow morning.
      Better late than never, glad you made it here!
      Slow and steady wins the race every single time.
      A friend in need is a friend indeed.
      When pigs fly, my cat will do my math homework!
      He is over the moon about winning the art prize!
      My mom has eyes in the back of her head!
      Don't bite off more than you can chew.
      Let us touch wood for sunny picnic weather!
      She went the extra mile to help her classmate.
      It is a small world—we met our neighbor on vacation!
      Stop beating around the bush and tell us the news!
      We started from scratch and built a fantastic model.
      You really saved the day with that spare battery!
      Hold on tight, we are in for a bumpy ride!
      My mind went completely blank for two seconds.
      He has a memory like an elephant!
      Practice regularly and you will get the hang of it!
      Let us make a long story short—we won first place!
    `),
  },
  {
    category: 'World Cultural Phrases (US, UK, AU, CA, IE, NZ, SG, ZA)',
    styleTag: 'cultural',
    items: p(`
      [UK] Fancy going to the cinema this afternoon?
      [UK] Have a lovely cuppa while we read together!
      [UK] That new backpack looks really smart on you!
      [UK] Let us grab fish and chips by the seaside.
      [UK] Sorry, I forgot my brolly and it is drizzling!
      [UK] Spot on! That answer is completely right.
      [UK] Let us have a quick chinwag after football practice.
      [UK] Don't forget to put your rubbish in the bin.
      [AU] Fair dinkum, did you really see a wild kangaroo?
      [AU] Let us head to the beach this arvo!
      [AU] Throw some veggies on the barbie for lunch!
      [AU] She'll be right, don't stress about it!
      [AU] Grab your swimmers and towel, we are leaving soon!
      [AU] He is a true-blue friend you can always count on.
      [AU] Let us stop at the servo to fill up the car.
      [US] Let us touch base after lunch to plan the poster.
      [US] You really stepped up to the plate for our team!
      [US] That science project is a total home run!
      [US] Let us shoot some hoops in the driveway.
      [US] Keep me posted on when the movie starts!
      [US] No sweat, I can finish drawing the banner tonight.
      [CA] Grab a double-double and a box of maple donuts!
      [CA] Put on your runners before heading to gym class.
      [CA] We are heading up to the cottage this long weekend.
      [CA] Hand me a serviette from the picnic basket, please.
      [CA] Bundle up—it is freezing out there today, eh?
      [IE] That magic show was mighty craic!
      [IE] Sure look, we will figure it out together!
      [IE] Fair play to you for helping the new student!
      [IE] Wait a second, I am just going to grab my runners.
      [NZ] Kia ora everyone, welcome to our assembly!
      [NZ] That hike to the waterfall was choice, bro!
      [NZ] Let us pack the chilly bin for our beach picnic.
      [NZ] No dramas, we have plenty of extra paintbrushes!
      [SG] Wait for me, I am going to chope a table first!
      [SG] Don't worry, this math problem is very easy one!
      [SG] Let us tapao some chicken rice for dinner tonight.
      [ZA] Howzit guys, ready for the weekend match?
      [ZA] We are having a lekker braai in the backyard!
      [ZA] Wait at the robot and turn left after the park.
    `),
  },
  {
    category: 'Fun Everyday Slang & Colloquialisms',
    styleTag: 'slang',
    items: p(`
      That skateboard trick was seriously next level!
      No cap, that was the best smoothie I ever tasted!
      Let us chill and listen to some upbeat tunes.
      I am totally stoked for the summer coding camp!
      You absolutely crushed your English presentation!
      My bad, I accidentally took the wrong water bottle.
      No worries, it is totally all good!
      That new animated movie looks super hype!
      Hold up, wait for me by the front gate!
      I am kinda hungry—let us grab a quick snack.
      Wanna team up for the trivia game later?
      Gonna finish my homework before dinner tonight!
      Gotcha! That explanation makes total sense now.
      Whoa, that dinosaur skeleton is legit gigantic!
      Let us bounce before the rain starts pouring!
      That song is a total earworm—I keep humming it!
      Don't sweat it, we will ace the next round!
      He is super chill and gets along with everyone.
      That comic book has awesome artwork, hands down!
      I am low-key excited about trying rock climbing.
      Wait a sec, let me double-check my backpack.
      You totally nailed the tricky pronunciation!
      That joke had the whole class cracking up!
      Let us hang out at the skatepark on Saturday.
      I am totally beat after running three laps!
      Sweet! We got an extra ten minutes of recess!
      For real? You built that game all by yourself?
      That puppy is literally the cutest thing ever!
      Count me in—I am totally down for bowling!
      Peace out, catch you bright and early tomorrow!
      Fair enough, let us try your plan first!
      Right on, that is exactly what I was thinking!
      Heads up—the floor near the fountain is slippery!
      Keep it up, you are on a massive winning streak!
      Big props to everyone who helped clean the room!
    `),
  },
];

export const A1_DATASET = buildLevelDataset('a1', WORD_BUCKETS, PHRASE_BUCKETS);
