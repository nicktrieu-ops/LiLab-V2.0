import { buildLevelDataset, p, w, type RawCategoryBucket } from './types';

const WORD_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Family, People & Jobs',
    styleTag: 'core',
    items: w(`
      mother father mom dad sister brother baby family grandma grandpa aunt uncle cousin friend
      boy girl child children man woman person people name neighbor classmate teacher student twin
      son daughter parents home love hug kiss smile laugh buddy pal guest king queen prince
      princess hero helper doctor nurse cook driver farmer singer dancer artist pilot baker police
      clown pirate fairy giant elf wizard witch knight guard coach chef vet dentist barber tailor
      painter potter fisher hunter sailor soldier mayor judge actor writer poet player winner leader team
      group crowd lady gentleman kid toddler infant teen adult elder heroines partner mate chum fellow
    `),
  },
  {
    category: 'Animals, Bugs & Sea Life',
    styleTag: 'core',
    items: w(`
      cat dog bird fish duck chicken cow pig sheep horse goat mouse rabbit frog turtle snake
      lion tiger bear elephant monkey giraffe zebra hippo rhino panda koala kangaroo fox wolf deer
      owl eagle parrot penguin swan bee ant bug spider butterfly ladybug worm snail whale dolphin
      shark crab octopus seal puppy kitten pony bunny chick hamster goldfish lizard bat camel donkey
      rooster hen turkey goose crow pigeon robin sparrow hawk falcon peacock flamingo ostrich cygnet
      squirrel chipmunk beaver otter badger raccoon skunk hedgehog mole ferret dormouse fawn cub calf
      lamb foal goat_kid piglet duckling gosling tadpole toad gecko iguana cobra viper python boa
      starfish jellyfish seahorse lobster shrimp clam oyster mussel squid walrus manatee sea_otter
      cricket beetle moth wasp hornet bumblebee firefly dragonfly mosquito flea tick slug centipede
    `),
  },
  {
    category: 'Food, Fruit & Kitchen',
    styleTag: 'core',
    items: w(`
      apple banana orange grape pear peach mango melon lemon lime berry cherry kiwi plum coconut
      pineapple watermelon strawberry bread rice noodle pasta pizza burger sandwich soup salad egg cheese
      butter milk water juice tea cocoa yogurt cream cake pie cookie candy chocolate honey jam
      sugar salt meat beef pork sausage bean pea corn carrot potato tomato onion lettuce cucumber
      pumpkin broccoli spinach cabbage radish turnip garlic ginger pepper chili olive avocado papaya
      guava lychee apricot fig date raisin almond peanut walnut cashew pecan oat wheat flour dough
      toast waffle pancake muffin donut bagel bun roll pretzel cracker chip popcorn snack lunch dinner
      breakfast supper feast meal picnic bite sip taste flavor sweet sour salty bitter spicy yummy
      cup mug glass plate bowl spoon fork knife pot pan oven stove fridge freezer sink kettle
      blender toaster tray napkin straw jar bottle can tin lid apron recipe menu dish treat
    `),
  },
  {
    category: 'Home, Rooms & Everyday Things',
    styleTag: 'core',
    items: w(`
      house room door window wall floor roof stairs kitchen bedroom bathroom garden yard balcony garage
      hall porch attic cellar closet pantry bed chair table desk sofa couch lamp clock mirror
      rug mat curtain shelf bookcase drawer cabinet chest bench stool crib cradle hammock pillow blanket
      sheet quilt duvet mattress towel soap shampoo brush comb toothbrush toothpaste sponge bucket mop
      broom vacuum iron hanger basket box bin bag sack purse wallet key lock bell button switch
      plug cord wire battery candle match lighter fan heater radio screen phone camera photo frame
      vase plant pot soil lawn fence gate path step brick tile wood glass stone metal cable
      plastic paper string rope ribbon tape glue pin needle thread buttonhole zipper pocket tag label
    `),
  },
  {
    category: 'School, Art & Play',
    styleTag: 'core',
    items: w(`
      school class classroom book page pen pencil crayon marker eraser ruler scissors notebook folder
      backpack board chalk map globe chart card letter word sentence story song poem number line
      circle square triangle star heart shape color paint picture drawing sketch poster comic album
      computer tablet keyboard quiz test homework lesson reading writing math music art sport game
      playground slide swing seesaw sandbox hoop ball doll teddy robot block puzzle kite drum flute
      piano guitar violin trumpet bell whistle rattle marble dice chess checker domino cardgame tag
      race jump_rope hopscotch picnic_rug chalkbox sticker stamp glitter clay dough puppet mask costume
      crown wand cape shield sword drumstick easel canvas palette paintbrush crayonbox clipboard deskpad
    `),
  },
  {
    category: 'Body, Health & Clothes',
    styleTag: 'core',
    items: w(`
      head hair face eye ear nose mouth lip tooth teeth tongue chin cheek neck shoulder arm
      elbow hand finger thumb wrist palm nail chest back belly waist hip leg knee ankle foot
      feet toe heel skin bone blood brain heart_beat lung breath voice cough sneeze fever cold
      ache hurt bump cut bruise bandage pill medicine rest nap sleep dream wake yawn stretch
      shirt t-shirt blouse dress skirt pants jeans shorts coat jacket sweater hoodie vest suit tie
      hat cap beanie crown_hat scarf glove mitten sock boot shoe sneaker sandal slipper belt buckle
      glasses watch ring necklace bracelet earring bow headband apron pajama robe swimsuit raincoat
      umbrella pocket sleeve collar hem cuff lace heel_shoe button_up zip_coat sunhat earmuff overalls
    `),
  },
  {
    category: 'Nature, Space & Weather',
    styleTag: 'core',
    items: w(`
      sun moon sky cloud rain snow wind storm rainbow fog mist dew frost ice hail thunder
      lightning heat cold_air warm cool breeze gust sunny rainy windy snowy cloudy foggy icy stormy
      tree leaf leaves branch twig trunk root bark flower rose lily daisy tulip sunflower grass
      bush shrub hedge moss fern vine seed sprout bud bloom petal thorn forest wood jungle park
      meadow field valley hill mountain peak cliff cave rock pebble boulder sand mud clay dirt
      river stream brook creek waterfall lake pond pool swamp sea ocean bay coast shore beach
      island reef wave tide shell coral fire flame spark smoke ash air earth world planet starlight
      comet meteor rocket_ship galaxy orbit crater spring summer autumn fall winter weather season
    `),
  },
  {
    category: 'Action Verbs & Movement',
    styleTag: 'core',
    items: w(`
      walk run jump hop skip leap swim dive fly soar climb crawl roll slide swing dance
      twirl spin sing hum clap snap stomp wave nod wink blink grin laugh giggle cry sob
      play draw color paint read write count spell speak talk say tell ask answer shout whisper
      listen hear look see watch peek find seek hide eat drink bite chew lick sip cook
      bake mix stir pour wash rinse dry clean sweep wipe brush comb sleep wake rise sit
      stand kneel bend stretch stop go come leave stay wait hurry rush give take get put
      set lay lift drop open close shut lock push pull throw toss catch kick hit tap
      hold grab carry hug pat rub tickle help share lend borrow make build fix break cut
      tear fold glue tape wear dress ride drive steer sail row float sink melt freeze grow
      plant water pick dig bury feed pet chase follow lead win lose try start begin finish
    `),
  },
  {
    category: 'Describing Words, Time & Places',
    styleTag: 'core',
    items: w(`
      red blue yellow green pink purple brown black white gray gold silver orange_color teal navy
      bright dark light pale shiny dull clear foggy big small huge tiny tall short long wide
      narrow thick thin fat slim heavy light_weight fast quick slow old new young fresh stale
      good bad great fine nice kind sweet gentle brave bold shy calm loud quiet noisy soft
      hard smooth rough bumpy sharp blunt flat round oval square_shape straight curved crooked bent
      happy glad joyful merry sad gloomy mad angry scared afraid brave_heart tired sleepy awake
      hungry thirsty full rich poor busy free lazy clever smart silly funny cute pretty lovely
      clean dirty neat messy wet dry hot warm_day chilly cool_air early late soon now then
      today tomorrow yesterday morning noon afternoon evening night midnight day week month year hour
      minute second Monday Tuesday Wednesday Thursday Friday Saturday Sunday city town village street
      road lane bridge corner shop store market mall cafe bakery library museum zoo farm airport
      station harbor castle tower palace tent camp cabin hut barn church temple hospital clinic bank
    `),
  },
  {
    category: 'Single-Syllable Sound Challenges',
    styleTag: 'single_syllable',
    items: w(`
      through thought though tough rough cough laugh bright flight fright knight light_beam sight
      tight slight weight eight height straight strength length width depth sixth eighth twelfth fifth
      clothes months breaths truths myths paths baths cloths moths mouths youths south north earth
      worth birth third first bird_song thirst nurse purse curse burst church search heard learn
      pearl swirl twirl world_map whirlpool_top squirm squirt skirt_hem shirt_cuff chirp_sound
      splash split sprint spring_time spray spread sprout sprawl screech scream screen_glow scrub
      shrink shrug shred shriek shrimp_tail throat throne throw_ball thrill three_stars thread
      choose shoes chewed stewed blue_sky glue_stick true_tale clue_card fruit_cup suit_coat
      juice_box cruise_ship bruise_mark yacht aisle isle climb_up comb_hair lamb_wool thumb_up
      crumb numb dumb_luck plumb_line wrist_band wrap_up wren wreck write_down wrong_way knee_pad
      kneel_down knit_hat knob knock knot_tie know_how gnome gnaw sign_post climb_wall calf_baby
      half_pie palm_tree psalm calm_sea walk_fast talk_loud chalk_line folk_song yolk_egg
    `),
  },
  {
    category: 'Multisyllable Word Studio',
    styleTag: 'multisyllable',
    items: w(`
      hippopotamus rhinoceros caterpillar crocodile alligator butterfly_wing dragonfly_wing
      watermelon_slice strawberry_jam pineapple_juice blueberry_pie raspberry_tart avocado_toast
      broccoli_tree cauliflower asparagus cucumber_slice potato_chips tomato_sauce macaroni
      spaghetti_bowl marshmallow lollipop_stick chocolate_cake lemonade_stand peppermint
      cinnamon_roll gingerbread_man umbrella_stand binoculars telescope microscope thermometer
      stethoscope kaleidoscope xylophone tambourine accordion harmonica saxophone clarinet
      helicopter submarine ambulance fire_engine bulldozer excavator motorcycle_ride skateboard
      rollercoaster merry-go-round trampoline parachute hot_air_balloon astronaut_suit
      constellation observatory planetarium laboratory_coat experiment_kit discovery_box
      imagination celebration decoration invitation congratulation appreciation kindergarten
      elementary_school library_card dictionary encyclopedia vocabulary pronunciation
      alphabetical mathematical geometrical symmetrical rectangular triangular octagonal
      temperature_drop electricity_spark magnetism_force gravity_pull photosynthesis
      hibernation migration camouflage metamorphosis biodiversity ecosystem_web environment
      neighborhood_park community_hall supermarket_cart laundromat_wash veterinarian_care
      photographer_lens choreographer_step archaeologist_dig paleontologist_bone meteorologist
      extraordinary unbelievable unforgettable uncomfortable understandable adventurous
      mysterious miraculous magnificent spectacular marvelous fabulous tremendous wonderful
      enthusiastic energetic empathetic sympathetic optimistic imaginative creative_mind
    `),
  },
  {
    category: 'Difficult Stretch Vocabulary',
    styleTag: 'difficult',
    items: w(`
      curious cleverness bravery patience kindness_act gratitude honesty_rule gentleness
      politeness forgiveness harmony_song melody_line rhythm_beat symphony_hall orchestra_pit
      sculpture_art mosaic_tile origami_bird calligraphy_pen tapestry_cloth silhouette_shadow
      labyrinth_maze treasure_chest compass_needle anchor_chain lighthouse_beam horizon_line
      glacier_ice volcano_lava canyon_wall desert_dune oasis_palm savannah_grass tundra_snow
      archipelago_sea peninsula_tip waterfall_mist avalanche_snow earthquake_shake hurricane_eye
      tornado_spin blizzard_wind drought_dry monsoon_rain eclipse_moon equinox_day solstice_sun
      nebula_cloud supernova_star gravity_field asteroid_belt satellite_dish astronaut_helm
      fossil_bone dinosaur_egg mammoth_tusk sabertooth_cat pyramid_tomb pharaoh_gold
      hieroglyph_sign parchment_scroll quill_feather alchemy_jar elixir_drop phoenix_wing
      pegasus_flight unicorn_horn griffin_claw mermaid_song dragon_scale wizard_cloak
      potion_bottle crystal_ball pendulum_swing hourglass_sand sundial_shadow metronome_tick
      prism_rainbow spectrum_color refraction_ray reflection_pool echo_cave resonance_hum
      chameleon_skin octopus_ink firefly_glow hummingbird_wing albatross_flight pelican_pouch
      platypus_bill porcupine_quill armadillo_shell Pangolin_scale meerkat_watch narwhal_tusk
    `),
  },
];

const PHRASE_BUCKETS: RawCategoryBucket[] = [
  {
    category: 'Greetings & Introductions',
    styleTag: 'core',
    items: p(`
      Hello, my friend!
      Hi there, how are you?
      Good morning, everyone!
      Good afternoon, teacher!
      Good evening, mom and dad!
      Good night, sleep tight!
      See you tomorrow morning!
      Goodbye, have a great day!
      My name is Maya.
      What is your name?
      Nice to meet you!
      I am happy to see you.
      I am six years old.
      How old are you today?
      This is my little sister.
      This is my best buddy.
      Welcome to our classroom!
      Come and play with us!
      Let us be good friends.
      I live in Ho Chi Minh City.
      I love learning English!
      Wave your hands up high!
      Give me a big high five!
      Smile brightly for the camera!
      It is so nice to see you again.
      Have a wonderful weekend!
      Take care and stay safe!
      Can I sit next to you?
      Let us share this sunny bench.
      We make a great team!
    `),
  },
  {
    category: 'Polite Words & Kindness',
    styleTag: 'core',
    items: p(`
      Thank you very much!
      Thanks a lot for helping me.
      You are very welcome!
      Please help me with this.
      Yes, please, I would love one.
      No, thank you, I am full.
      Excuse me, may I pass?
      I am sorry for bumping you.
      That is totally okay!
      Can I help you carry that?
      Let me share my crayons with you.
      Here you are, my friend.
      Kind hands always help others.
      Kind words make hearts happy.
      Please wait for your turn.
      Be gentle with little animals.
      Listen carefully to your friend.
      Are you feeling okay today?
      Do you want a warm hug?
      You did an amazing job!
      I really love your colorful drawing!
      Thank you for sharing your snack.
      May I borrow your green pencil?
      May I go to the restroom, please?
      May I drink some cold water?
      Please hold the door open.
      Always say please and thank you.
      We take care of each other.
      Being kind is a superpower!
      I am proud of how hard you tried!
    `),
  },
  {
    category: 'Classroom & Phonics Fun',
    styleTag: 'core',
    items: p(`
      Open your book to page five.
      Close your notebook neatly.
      Look up at the big board.
      Listen closely to the story.
      Raise your hand before speaking.
      Sit criss-cross on the carpet.
      Form a big friendly circle.
      Line up quietly by the door.
      Take out your sharp pencil.
      Put away all the toys now.
      Color the big apple bright red.
      Draw a smiling yellow sun.
      Cut carefully along the dotted line.
      Glue the shiny star right here.
      Read this new word out loud.
      Spell your name letter by letter.
      Count slowly from one to twenty.
      Sing the happy alphabet song!
      Clap your hands three times!
      Point to the open window.
      I finished all my classwork!
      Teacher, I have a fun question.
      Could you say that one more time?
      Let us practice this sound together.
      Speak clearly and loudly please.
      Time to pack our backpacks!
      Look at the colorful flashcards.
      Match the picture with the word.
      Ready, steady, let us begin!
      Gold star for great effort today!
    `),
  },
  {
    category: 'Home, Family & Routines',
    styleTag: 'core',
    items: p(`
      I love my wonderful family.
      Mom is cooking yummy soup.
      Dad reads bedtime stories to me.
      Grandma grows pretty red roses.
      Grandpa walks with our puppy.
      My room is tidy and clean.
      Time to wake up and shine!
      Wash your hands with warm soap.
      Brush your teeth for two minutes.
      Comb your hair neatly before school.
      Put on your warm blue jacket.
      Tie your shoelaces tightly.
      Eat a healthy breakfast every day.
      Drink a tall glass of milk.
      Pack your lunchbox and bottle.
      Turn off the bedroom light.
      Close the front door gently.
      Help set the dinner table.
      Put your dishes in the sink.
      Feed the hungry little goldfish.
      Water the flowers on the balcony.
      Let us read a picture book!
      Where is my soft teddy bear?
      My hat is under the chair.
      The kitten sleeps on the rug.
      Put on your cozy pajamas.
      Sweet dreams, see you in the morning!
      Good night, moon and stars!
      I helped mom fold the towels.
      Home is my favorite place!
    `),
  },
  {
    category: 'Animals, Nature & Playtime',
    styleTag: 'core',
    items: p(`
      The little puppy wags its tail.
      The fluffy cat purrs softly.
      A blue bird sings in the tree.
      Colorful fish swim in the pond.
      Green frogs leap onto lily pads.
      The brave lion roars loudly.
      The tiny mouse helps the lion.
      Playful monkeys swing on vines.
      The tall giraffe eats fresh leaves.
      Busy bees buzz around flowers.
      Look at the rainbow in the sky!
      It is sunny and warm outside.
      Bring your bright yellow umbrella.
      Soft white clouds float above us.
      Gentle wind blows the green leaves.
      Let us build a big sandcastle!
      Look at this shiny pink seashell!
      Throw the bouncy ball to me!
      Kick the soccer ball into the goal!
      Let us fly a kite in the park!
      Push me higher on the swing!
      Zoom down the yellow slide!
      Build a giant wooden block tower.
      Let us play hide and seek!
      Hop on one foot five times!
      Run fast like a happy cheetah!
      Freeze like a funny statue!
      Playing outside is so much fun!
      Take good care of planet Earth!
      What a bright and joyful day!
    `),
  },
  {
    category: 'Food, Colors & Questions',
    styleTag: 'core',
    items: p(`
      I am very hungry right now!
      May I have a crunchy apple?
      Sweet mangoes are my favorite fruit.
      Do you like strawberry ice cream?
      Yes, I love warm cheese pizza!
      Pass the freshly baked bread, please.
      This orange juice tastes super fresh.
      Peel the yellow banana carefully.
      Wash the purple grapes before eating.
      Carrots help keep our eyes strong.
      What is for lunch at school today?
      My favorite color is sky blue.
      How many stars can you count?
      Two plus three equals five.
      The giant elephant is gray.
      That tiny ant is marching fast.
      What is inside this mystery box?
      Who is standing behind the tree?
      Where did my red cap go?
      Can a penguin fly in the sky?
      No, penguins swim very fast!
      Do you have a pet at home?
      What are you painting right now?
      I am building a space rocket!
      She is dancing to happy music.
      He is riding his red bicycle.
      Look at the speedy silver train!
      Wait safely at the red light.
      Hold my hand when crossing the street.
      Let us learn five new words today!
    `),
  },
  {
    category: 'Playful Kids Idioms',
    styleTag: 'idiom',
    items: p(`
      That puzzle is a piece of cake!
      You are the apple of my eye.
      Hold your horses and wait a second!
      It is raining cats and dogs outside!
      Break a leg on stage today!
      You hit the nail on the head!
      Let the cat out of the bag!
      Rise and shine, sleepy head!
      Sleep tight, do not let the bedbugs bite!
      He is as busy as a bee!
      She is as quiet as a mouse.
      You are as brave as a lion!
      That bunny is as soft as cotton.
      I am feeling under the weather today.
      Keep your chin up and smile!
      Two heads are better than one.
      Practice makes perfect every day.
      Early bird catches the worm!
      A little birdie told me a secret.
      Time flies when we are having fun!
      Do not cry over spilled milk.
      Actions speak louder than words.
      Every cloud has a silver lining.
      You are on top of the world!
      I am all ears, tell me the story!
      Give me a hand with this box!
      Keep an eye on your backpack.
      Let us get the ball rolling!
      Hang in there, you can do it!
      Cross your fingers for good luck!
      Once in a blue moon we see snow.
      That joke cracked me up!
      You have a heart of gold.
      Shake a leg or we will be late!
      Bite your tongue and be polite!
    `),
  },
  {
    category: 'World Cultural Phrases (US, UK, AU, CA, IE, NZ, SG, ZA)',
    styleTag: 'cultural',
    items: p(`
      [AU] G'day mate, how are you going?
      [AU] No worries, happy to help!
      [AU] Good on ya for trying hard!
      [AU] Let us have brekkie in the garden.
      [AU] Grab your sunnies before going out!
      [UK] Cheerio, see you next week!
      [UK] Lovely weather we are having today!
      [UK] Mind the gap when stepping on the train.
      [UK] Fancy a biscuit and warm tea?
      [UK] Brilliant work, well done indeed!
      [UK] Cheers, thanks a million!
      [UK] Pop your coat on the hook, please.
      [UK] It is a bit chilly, grab a jumper!
      [UK] Queue up nicely in a straight line.
      [US] Awesome job, way to go!
      [US] What is up, buddy?
      [US] Let us grab a quick bite to eat.
      [US] You knocked it out of the park!
      [US] Take a rain check for tomorrow.
      [US] High five, you nailed it!
      [CA] How is it going, eh?
      [CA] Grab your warm toque for the snow!
      [CA] Sorry about that, my friend!
      [CA] Have a good one, see you later!
      [IE] What is the craic today?
      [IE] That drawing is grand!
      [IE] Fair play to you for finishing!
      [IE] Thanks a million, pal!
      [NZ] Kia ora, welcome to our school!
      [NZ] Sweet as, let us play now!
      [NZ] Put on your jandals for the beach!
      [NZ] Choice work on that painting!
      [SG] Can lah, let us do it together!
      [SG] Come eat, this soup is shiok!
      [SG] Wait a while, I am coming now!
      [ZA] Howzit, my friend?
      [ZA] That birthday cake is lekker!
      [ZA] See you just now at the park!
    `),
  },
  {
    category: 'Kid-Safe Slang & Colloquial Phrases',
    styleTag: 'slang',
    items: p(`
      Easy peasy lemon squeezy!
      Cool beans, I love that idea!
      Okey dokey, let us go!
      Super duper job today!
      No way, that is so cool!
      My bad, I dropped the eraser!
      You totally rocked that song!
      That robot looks epic!
      Let us hang out after class.
      Chill out and take a deep breath.
      Whoa, that trick is awesome!
      Yay, we crushed that level!
      Oopsie daisy, let us pick it up!
      You are a total rockstar!
      That puppy is mega cute!
      Let us bounce to the playground!
      No biggie, we can fix it!
      For real, did you draw that?
      I am super pumped for art class!
      Sweet, it is Friday afternoon!
      You nailed every single word!
      That magic trick blew my mind!
      High ten, super star!
      Let us grab some yummy grub!
      I am wiped out after soccer!
      Wait a sec, I am right behind you!
      Totally tubular, my friend!
      Way too cool for school!
      Gotcha, I understand now!
      Catch you later, alligator!
      In a while, crocodile!
      See you soon, raccoon!
      Boom, nailed it on the first try!
      Let us gooo, team LiLab!
      Best day ever, hands down!
    `),
  },
];

export const PRE_A1_DATASET = buildLevelDataset('pre_a1', WORD_BUCKETS, PHRASE_BUCKETS);
