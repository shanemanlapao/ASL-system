"""
Script to insert 'Bruno's Squeaky Toy (Muting the Microphone)' TLE lesson into Supabase PostgreSQL database.
Creates:
1. Lesson Group under 'technology-and-livelihood-education'
2. Easy, Medium, and Hard lessons with 6 slides each (image_url = None as requested)
3. Easy, Medium, and Hard quizzes with 18 questions and 4 options each, mapped to KCs.
"""

import os
import psycopg2
import psycopg2.extras

def get_db_connection():
    env = {}
    with open('.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()

    conn = psycopg2.connect(
        host=env.get('DB_HOST'),
        port=env.get('DB_PORT', 5432),
        dbname=env.get('DB_NAME'),
        user=env.get('DB_USER'),
        password=env.get('DB_PASSWORD'),
        sslmode=env.get('DB_SSLMODE', 'require')
    )
    return conn

# ── SLIDES DATA ──────────────────────────────────────────────────────────────
EASY_SLIDES = [
    "Ben sat at his computer desk listening carefully to his teacher talk about space.",
    "Bruno the dog trotted inside carrying his favorite bright yellow rubber squeaky duck.",
    "Bruno chewed the toy making loud squeaks that traveled right through Ben's unmuted microphone.",
    "Ana saw green sound waves on Ben's box and sent him a private message to mute.",
    "Ben clicked the microphone button to turn it red, and the squeaky noise stopped immediately.",
    "Now the class could hear the teacher clearly while Bruno played happily on the floor."
]

MEDIUM_SLIDES = [
    "Ben sat at his bedroom desk listening attentively to an exciting science lesson about space, but he forgot to check his microphone icon.",
    "Suddenly, his dog Bruno trotted into the room carrying a bright yellow rubber duck and began chewing it enthusiastically next to Ben's chair.",
    "Because Ben's microphone was unmuted, the loud squeaking sounds echoed through everyone's headphones, making it difficult for the teacher to continue speaking.",
    "Ana noticed the pulsing audio waves on Ben's tile and quickly sent him a polite private message reminding him to mute his microphone.",
    "Ben immediately clicked his microphone button to turn it red, instantly cutting off the sound so the squeaks disappeared from the video conference.",
    "With the call quiet again, Bruno continued playing happily on the rug, and Ben learned that muting while listening shows respect for everyone's learning time."
]

HARD_SLIDES = [
    "Early on a bright morning, Ben sat comfortably at his bedroom desk with his headphones plugged in to attend his online science class, listening with great focus as his teacher began explaining an exciting lesson about the solar system.",
    "Without Ben noticing, his microphone was left unmuted on the screen, and just a few moments later, his playful dog Bruno trotted happily into the bedroom carrying his favorite bright yellow rubber duck in his mouth.",
    "Bruno sat down right beside Ben's chair on the rug and began chewing eagerly on his rubber toy, creating loud, funny squeaking noises that echoed straight through Ben's open microphone and into the headphones of every classmate on the call.",
    "The loud squeaks made it impossible for the teacher to be heard and caused several students to giggle, prompting Ana to notice the bouncing green sound waves around Ben's video tile and quickly send him a polite private message to mute his mic.",
    "The moment Ben saw the private alert and realized his microphone was turned on, he clicked the mute button immediately, turning the microphone icon red with a slash and silencing the squeaking sounds from the meeting in less than a second.",
    "With the video call quiet and peaceful once again, the teacher resumed her lesson smoothly while Bruno happily chewed his toy on the floor, teaching Ben that keeping your microphone muted while listening is an important habit that shows respect for your teacher and classmates."
]

# ── EASY QUESTIONS (18) ──────────────────────────────────────────────────────
EASY_QUESTIONS = [
    {
        "q": "What was Ben doing at his desk in Slide 1?",
        "opts": ["Playing video games", "Listening carefully to his teacher's science lesson", "Eating his lunch", "Sleeping on his keyboard"],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Wearing headphones and watching the teacher speak on screen."
    },
    {
        "q": "What toy did Bruno bring into the bedroom?",
        "opts": ["A leather football", "A yellow rubber squeaky duck", "A plastic frisbee", "A wooden stick"],
        "ans": "B",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "A yellow rubber duck toy in a dog's mouth."
    },
    {
        "q": "What loud sound did Bruno's toy make when he chewed it?",
        "opts": ["Ringing bell sounds", "Loud squeaking noises (squeak, squeak!)", "Roaring sounds", "Whistling train sounds"],
        "ans": "B",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "A rubber toy making a squeak sound."
    },
    {
        "q": "Why did everyone on the video call hear the squeaking sound?",
        "opts": ["Ben's microphone was left unmuted", "The teacher brought a dog to school", "The computer speakers were broken", "Ana played a sound effect"],
        "ans": "A",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "An open, unmuted microphone picking up room sounds."
    },
    {
        "q": "What does 'muting the microphone' mean during an online class?",
        "opts": ["Turning off the computer screen", "Turning off your microphone so others cannot hear your background noises", "Talking louder into the computer", "Closing the meeting window"],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "A microphone icon with a red slash through it."
    },
    {
        "q": "What visual clue showed Ana that Ben's microphone was making noise?",
        "opts": ["Ben's screen went completely dark", "Green sound waves were bouncing around Ben's video box", "Ben was waving his arms", "Bruno jumped onto the camera lens"],
        "ans": "B",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Green audio waves jumping around a video tile."
    },
    {
        "q": "How did Ana politely tell Ben to mute his microphone?",
        "opts": ["She screamed at him over the call", "She sent him a private chat message", "She hung up the phone", "She laughed out loud at him"],
        "ans": "B",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Typing a private direct message on the computer screen."
    },
    {
        "q": "What color did the microphone icon turn when Ben clicked mute?",
        "opts": ["Blue", "Red", "Yellow", "Purple"],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "A red microphone symbol with a line across it."
    },
    {
        "q": "What happened to the squeaking noise right after Ben clicked Mute?",
        "opts": ["It became twice as loud", "It stopped immediately on the call", "It turned into music", "It made the computer freeze"],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Sound waves disappearing and becoming quiet."
    },
    {
        "q": "Where was Bruno sitting while he chewed his rubber toy?",
        "opts": ["On top of Ben's head", "On the floor next to Ben's chair", "Outside on the roof", "In the kitchen sink"],
        "ans": "B",
        "kc": "KC_SYNTAX_PREPOSITION",
        "hint": "A dog sitting on a rug on the floor next to a chair."
    },
    {
        "q": "Where does the sound of an unmuted microphone travel?",
        "opts": ["Into the wastebasket", "Through the internet into the classmates' headphones", "Under the floorboards", "Out the bedroom window only"],
        "ans": "B",
        "kc": "KC_SYNTAX_PREPOSITION",
        "hint": "Sound traveling through headphones into ears."
    },
    {
        "q": "What should you always do when you are listening to the teacher during an online class?",
        "opts": ["Sing into the microphone", "Keep your microphone muted", "Unplug your mouse", "Turn off your room lights"],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Listening quietly with the mute button on."
    },
    {
        "q": "When is the right time to unmute your microphone?",
        "opts": ["Whenever you want to make funny sounds", "When the teacher calls your name to answer or speak", "While your dog is barking", "During tests when everyone is working quietly"],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Raising your hand and unmuting to answer a question."
    },
    {
        "q": "Did Ben have to kick Bruno out of the bedroom after muting?",
        "opts": ["Yes, dogs are not allowed in bedrooms", "No, Bruno could stay and play quietly on the floor because the mic was muted", "Yes, Bruno broke the computer", "Yes, the teacher told Ben to give the dog away"],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Dog playing happily on the floor without bothering anyone."
    },
    {
        "q": "What word describes the sound of Bruno's rubber duck?",
        "opts": ["Silent", "Squeaky", "Whispering", "Deep and scary"],
        "ans": "B",
        "kc": "KC_VOCAB_ADJECTIVE",
        "hint": "A squeaky sound."
    },
    {
        "q": "How did the classroom feel after the squeaking stopped?",
        "opts": ["Loud and angry", "Quiet and peaceful for learning", "Scared and dark", "Cold and boring"],
        "ans": "B",
        "kc": "KC_VOCAB_ADJECTIVE",
        "hint": "A calm, quiet learning environment."
    },
    {
        "q": "What is an example of an unwanted background noise during a video call?",
        "opts": ["The teacher's explanation", "A barking dog, squeaky toy, or loud TV in the next room", "A student answering a question when called on", "The computer clock ticking silently"],
        "ans": "B",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "Pet and household noises interrupting a call."
    },
    {
        "q": "What is the main lesson Ben learned about online meeting manners?",
        "opts": ["Dogs should not have squeaky toys", "Muting your microphone when listening avoids background noise and respects everyone in class", "You should never wear headphones", "Microphones must stay turned on at all times"],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Muting to protect everyone's learning peace."
    }
]

# ── MEDIUM QUESTIONS (18) ────────────────────────────────────────────────────
MEDIUM_QUESTIONS = [
    {
        "q": "What was Ben's initial mistake when he joined his online science lesson in Slide 1?",
        "opts": ["He forgot to turn on his computer monitor.", "He was listening attentively, but forgot to mute his microphone while the teacher was speaking.", "He entered the wrong meeting room code.", "He turned off his internet connection."],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Listening to a lecture while leaving the mic unmuted."
    },
    {
        "q": "How did Bruno's rubber duck create a problem for the whole virtual classroom?",
        "opts": ["The dog jumped and chewed through Ben's computer cable.", "The high-pitched squeaking noise traveled through Ben's unmuted microphone and interrupted the teacher's voice.", "The duck toy turned off Ben's webcam.", "The dog ate Ben's homework papers."],
        "ans": "B",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "Squeaking toy noise overpowering the teacher's voice."
    },
    {
        "q": "In Slide 3, what visual evidence on the screen revealed that the squeaking noise came from Ben's desk?",
        "opts": ["Ben's video tile was flickering black and white.", "Glowing green sound waves or audio pulses were actively vibrating around Ben's video tile.", "Ben was typing in all capital letters.", "The teacher pointed an arrow at Ben's desk."],
        "ans": "B",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Green audio waves pulsing around an active video frame."
    },
    {
        "q": "Why was Ana's decision to send a private direct message the most courteous way to handle the situation?",
        "opts": ["It kept her message secret from her parents.", "It alerted Ben right away without causing public embarrassment or interrupting the teacher further.", "She wanted to show off that she was the smartest student.", "Private messages are the only way to talk in class."],
        "ans": "B",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Sending a private chat to help a classmate quietly."
    },
    {
        "q": "What does a microphone icon with a red slash through it signify in video conferencing software?",
        "opts": ["The computer speakers are broken.", "The microphone is currently muted and cannot transmit any room audio to the call.", "The user has been disconnected from the meeting.", "The camera is turned off."],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "A red microphone with a slash through it."
    },
    {
        "q": "In Slide 2, the story notes that Bruno sat 'next to Ben's chair.' What does the spatial phrase 'next to' indicate?",
        "opts": ["Sitting directly beside the chair leg on the floor", "Sitting on the other side of the house", "Flying high in the sky above the roof", "Hiding underneath the rug"],
        "ans": "A",
        "kc": "KC_SYNTAX_PREPOSITION",
        "hint": "A dog positioned right alongside a wooden desk chair."
    },
    {
        "q": "What is the primary difference between muting your microphone and turning off your audio speakers?",
        "opts": ["They do the exact same thing.", "Muting prevents others from hearing you, while turning off speakers prevents you from hearing others.", "Muting turns off your camera.", "Turning off speakers mutes your microphone automatically."],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Outgoing sound (mic) versus incoming sound (speakers)."
    },
    {
        "q": "What does the word disruptive mean when describing background noise on a school call?",
        "opts": ["Very peaceful and soothing", "Causing an interruption that makes it difficult for others to hear and concentrate", "Making the computer work faster", "Pleasing to the teacher"],
        "ans": "B",
        "kc": "KC_VOCAB_ADJECTIVE",
        "hint": "An unwanted sound breaking the flow of a lesson."
    },
    {
        "q": "What should a student do if they need to speak or answer a question during a muted video conference?",
        "opts": ["Start yelling without touching the computer.", "Raise their virtual or physical hand, wait to be acknowledged by the teacher, and then unmute.", "Unmute and play loud music.", "Leave the meeting and re-enter."],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Raising hand -> called on by teacher -> unmute to speak."
    },
    {
        "q": "Why was Ben able to let Bruno stay in the bedroom after muting his mic?",
        "opts": ["Because the dog promised to stop squeaking.", "Because muting the microphone prevented the squeaking sound from entering the meeting entirely.", "Because the teacher asked to see the dog.", "Because the computer ran out of battery."],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Local pet noise isolated from the online meeting."
    },
    {
        "q": "Which is an example of an unintentional background noise that muting helps prevent?",
        "opts": ["A family member blending a smoothie or washing dishes in the kitchen", "The teacher reading a science worksheet aloud", "A student reading an essay when called upon", "A class educational video shared on the main screen"],
        "ans": "A",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "Kitchen or family sounds echoing in the background."
    },
    {
        "q": "In the story, what does the word attentively tell us about how Ben was listening in Slide 1?",
        "opts": ["He was distracted and playing games.", "He was paying close, focused attention to what the teacher was saying.", "He was asleep.", "He was talking loudly to his dog."],
        "ans": "B",
        "kc": "KC_VOCAB_ADJECTIVE",
        "hint": "Focused, alert listening posture."
    },
    {
        "q": "What is the cause-and-effect relationship between Slide 3 and Slide 5?",
        "opts": ["Because the dog ran outside, the call ended.", "Because Ben clicked the mute button, the squeaking stopped and the lesson resumed peacefully.", "Because the teacher was angry, she gave everyone a zero.", "Because Ana called Ben, the computer crashed."],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Cause: Muting mic -> Effect: Quiet call restored."
    },
    {
        "q": "Where do unmuted microphone noises go when transmitted during a video call?",
        "opts": ["Only into the student's own room", "Directly into the headphones and speakers of every participant on the conference call", "Nowhere, webcams do not send audio", "Only to the school principal"],
        "ans": "B",
        "kc": "KC_SYNTAX_PREPOSITION",
        "hint": "Sound traveling from one microphone into everyone's headphones."
    },
    {
        "q": "What is the 'Golden Rule' of microphone etiquette for online learners?",
        "opts": ["Leave your microphone unmuted at all times so people know you are alive.", "Keep your microphone muted while listening, and unmute only when it is your turn to speak.", "Unmute whenever you hear a loud noise in your house.", "Only teachers are allowed to have microphones."],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Default state: Muted while listening."
    },
    {
        "q": "What should you do immediately if you notice your microphone is unmuted while someone else is speaking?",
        "opts": ["Make a funny sound to test if it works.", "Click the mute button immediately to prevent any accidental room sounds from escaping.", "Pull out your computer plug.", "Pretend that you didn't notice."],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Quickly tapping the mute button to silence an open mic."
    },
    {
        "q": "What is the correct sequence of events in Ben's microphone lesson?",
        "opts": ["Bruno squeaked toy -> Ben muted -> Joined class -> Ana messaged", "Listening with unmuted mic -> Dog squeaked toy -> Classmate sent private alert -> Ben clicked mute -> Lesson resumed", "Ben clicked mute -> Dog ran away -> Classmate yelled -> Started class", "Teacher muted call -> Bruno ate duck -> Ben left class -> Ana smiled"],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Tracking the chronological order of the story."
    },
    {
        "q": "What is the broader lesson about respect in virtual meetings shown in this story?",
        "opts": ["Respect means never adopting pets when you attend online school.", "Respect means actively managing your audio environment so that every classmate can learn without unnecessary distractions.", "Respect means turning off your computer when a dog barks.", "Respect means only typing in the chat and never speaking aloud."],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Respecting everyone's study time by maintaining a quiet digital classroom."
    }
]

# ── HARD QUESTIONS (18) ──────────────────────────────────────────────────────
HARD_QUESTIONS = [
    {
        "q": "Why was Ben unaware that his dog's squeaky toy was making noise on the video call in Slide 2?",
        "opts": ["Ben was wearing headphones that blocked outside bedroom sounds, and he was deeply focused on the teacher's lesson.", "Ben's computer was broken.", "Bruno was playing outside in the garden.", "Ben had fallen asleep at his desk."],
        "ans": "A",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "Wearing headphones while room noises happen unnoticed in the background."
    },
    {
        "q": "How do modern video conferencing platforms visually show who is making background noise during a call?",
        "opts": ["By turning off the person's screen completely", "By displaying pulsing green sound waves, highlights, or bouncing audio bars around the speaker's video tile", "By sending an alarm sound to the whole school", "By turning the whole screen into a red box"],
        "ans": "B",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Pulsing green borders around an active video frame."
    },
    {
        "q": "Why was Ana's decision to use a private chat message rather than speaking out loud an example of mature digital citizenship?",
        "opts": ["Speaking out loud would have added even more noise and interrupted the teacher, whereas a private text solved the problem quietly.", "Ana wanted to hide the fact that she was in class.", "The teacher told Ana she was not allowed to speak all year.", "Ana wanted to make Ben feel bad in private."],
        "ans": "A",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Solving an audio disruption quietly in text rather than adding vocal noise."
    },
    {
        "q": "What could have happened if Ana had chosen to ignore the bouncing green sound waves on Ben's tile?",
        "opts": ["The teacher's voice would have continued to be drowned out, and the class would have lost valuable learning time.", "The computer would have exploded.", "Ben would have received an award.", "The video call would have muted itself automatically."],
        "ans": "A",
        "kc": "KC_COMP_INFERENCE",
        "hint": "An ongoing interruption wasting valuable lesson time."
    },
    {
        "q": "In Slide 5, how does clicking the Mute button physically affect the computer's audio transmission?",
        "opts": ["It turns off the computer's internet connection.", "It digitally cuts off the microphone's input stream, preventing any local sound in the room from being sent across the network.", "It deletes the audio recording software.", "It turns down the teacher's speaking volume."],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Digital switch stopping audio from traveling across the internet."
    },
    {
        "q": "In Slide 3, the phrase 'echoed straight through Ben's open microphone and into the headphones of every classmate' describes what path of sound?",
        "opts": ["Sound traveling only into the trash can", "Sound going from the dog's toy into Ben's mic, across the digital network, and directly into peers' ears", "Sound bouncing out the bedroom window", "Sound remaining completely locked inside the bedroom"],
        "ans": "B",
        "kc": "KC_SYNTAX_PREPOSITION",
        "hint": "Tracing sound from a toy -> into a mic -> across the internet -> into headphones."
    },
    {
        "q": "Why did Ben NOT have to force Bruno to leave the bedroom after he muted his microphone?",
        "opts": ["Because the dog promised to be quiet.", "Because muting the mic isolated the bedroom audio, meaning Bruno's squeaks no longer reached the online meeting.", "Because Bruno hid under the bed.", "Because the teacher asked Bruno to stay on camera."],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Local pet sound contained in the bedroom without leaking into the meeting."
    },
    {
        "q": "What does the word unmuted mean when describing a microphone status during a meeting?",
        "opts": ["Broken and unable to work", "Open and actively transmitting all sounds in the room to everyone on the call", "Turned off and completely silent", "Disconnected from the computer"],
        "ans": "B",
        "kc": "KC_VOCAB_ADJECTIVE",
        "hint": "A live, active microphone symbol broadcasting sound."
    },
    {
        "q": "What is the fundamental difference between muting when listening and muting when speaking?",
        "opts": ["You should stay muted when speaking so nobody hears you.", "You must stay muted while listening to avoid background noise, and unmute only when it is your designated turn to speak.", "You should unmute whenever a dog barks.", "Both mean the exact same thing."],
        "ans": "B",
        "kc": "KC_ICT_MUTE_MICROPHONE",
        "hint": "Muted while listening; unmute only when speaking."
    },
    {
        "q": "Which of the following is a common household situation where an unmuted microphone could cause a privacy and acoustic issue?",
        "opts": ["A parent having a private phone call or vacuuming in the adjacent hallway", "The teacher sharing a digital slide presentation", "A student reading an essay aloud after raising their hand", "Complete silence in an empty room"],
        "ans": "A",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "Vacuuming or private family talking captured by an open mic."
    },
    {
        "q": "In Slide 1, what habit should Ben have practiced immediately upon entering the call?",
        "opts": ["Turn off his computer screen.", "Check his microphone icon to ensure it was muted while the teacher was lecturing.", "Start singing to test his microphone.", "Unplug his internet router."],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Checking and tapping the mute icon as soon as you join a call."
    },
    {
        "q": "How did Ben's emotional state change from Slide 3 to Slide 6?",
        "opts": ["From calm -> furious -> exhausted", "From unaware and surprised -> alert and responsible -> relieved and respectful", "From proud -> bored -> terrified", "From sleepy -> energetic -> confused"],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Surprised face -> focused action -> calm, respectful smile."
    },
    {
        "q": "What is the technical term for the audio problem caused when a microphone picks up sound from its own computer speakers and broadcasts it in a loop?",
        "opts": ["High-speed downloading", "Audio feedback / echo", "Digital screen sharing", "Video blurring"],
        "ans": "B",
        "kc": "KC_ICT_BACKGROUND_NOISE",
        "hint": "Sound looping between speakers and mic creating an echo."
    },
    {
        "q": "In Slide 4, what detail showed that Ana was observant and proactive during the lesson?",
        "opts": ["She left the video call early.", "She spotted the visual sound indicator on Ben's tile and immediately offered a discreet solution.", "She laughed at Ben out loud.", "She closed her computer."],
        "ans": "B",
        "kc": "KC_ICT_PEER_SAFETY",
        "hint": "Seeing a problem on screen and sending a helpful text to fix it."
    },
    {
        "q": "What is the correct sequence of events in Ben's microphone experience?",
        "opts": ["Ben clicked mute -> Dog squeaked toy -> Teacher began lesson -> Ana sent chat", "Joined call with unmuted mic -> Dog chewed squeaky toy -> Classmate sent private alert -> Ben clicked mute -> Quiet lesson restored", "Ana sent chat -> Joined call -> Dog ran away -> Ben clicked mute", "Class ended -> Dog squeaked toy -> Ben joined call -> Teacher stopped talking"],
        "ans": "B",
        "kc": "KC_COMP_INFERENCE",
        "hint": "Step-by-step chronological timeline of the story."
    },
    {
        "q": "In the story, what does the word discreet mean when describing Ana's message?",
        "opts": ["Very noisy and public", "Careful and quiet so as not to attract unwanted attention or cause embarrassment", "Mean and insulting", "Slow and confusing"],
        "ans": "B",
        "kc": "KC_VOCAB_ADJECTIVE",
        "hint": "Communicating privately with care and respect."
    },
    {
        "q": "What should you do if your pet or younger sibling makes loud noise in your room while you are supposed to be speaking during class?",
        "opts": ["Yell at them loudly through the microphone so everyone hears.", "Politely ask the teacher for a brief moment, mute your microphone, settle the situation quietly, and then unmute to speak.", "Throw your computer on the floor.", "Hang up and never return to school."],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "Excusing oneself politely, muting to fix the problem, and unmuting to speak."
    },
    {
        "q": "What is the overarching central lesson of 'Bruno’s Squeaky Toy'?",
        "opts": ["Pets should never be allowed in houses with computers.", "Keeping your microphone muted while listening prevents unintended background noise, respects shared digital space, and ensures everyone can hear and learn.", "Squeaky toys are the only toys dogs enjoy.", "Teachers should never talk about science on video calls."],
        "ans": "B",
        "kc": "KC_ICT_DIGITAL_CITIZENSHIP",
        "hint": "A quiet, respectful digital classroom where everyone can learn together."
    }
]

def ensure_knowledge_components(cur, topic_id):
    kcs = [
        ("KC_ICT_MUTE_MICROPHONE", "Mute Microphone Audio Control", 0.10, 0.20, 0.25, 0.10),
        ("KC_ICT_BACKGROUND_NOISE", "Background Noise Recognition", 0.10, 0.20, 0.25, 0.10),
        ("KC_ICT_PEER_SAFETY", "Peer Safety & Communication", 0.10, 0.20, 0.25, 0.10),
        ("KC_ICT_DIGITAL_CITIZENSHIP", "Digital Citizenship & Etiquette", 0.10, 0.20, 0.25, 0.10),
        ("KC_SYNTAX_PREPOSITION", "Spatial Prepositions", 0.10, 0.20, 0.25, 0.10),
        ("KC_VOCAB_ADJECTIVE", "Descriptive & Audio Vocabulary", 0.10, 0.20, 0.25, 0.10),
        ("KC_COMP_INFERENCE", "Inference & Cause-and-Effect", 0.10, 0.20, 0.25, 0.10),
    ]
    for name, display, prior, learns, guesses, slips in kcs:
        cur.execute(
            """INSERT INTO knowledge_components (topic_id, name, display_name, prior, learns, guesses, slips)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name""",
            (topic_id, name, display, prior, learns, guesses, slips)
        )
    print("Knowledge components registered.")

def insert_tier(cur, group_id, topic_id, difficulty, title, slides, questions):
    # 1. Insert lesson
    cur.execute(
        """INSERT INTO lessons (topic_id, title, difficulty, lesson_group_id)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (lesson_group_id, difficulty) DO UPDATE SET title = EXCLUDED.title
           RETURNING id""",
        (topic_id, f"Bruno's Squeaky Toy ({difficulty.upper()})", difficulty, group_id)
    )
    lesson_id = cur.fetchone()[0]
    print(f"Lesson [{difficulty.upper()}] ID: {lesson_id}")

    # 2. Insert slides (delete old slides first)
    cur.execute("DELETE FROM lesson_slides WHERE lesson_id = %s", (lesson_id,))
    for idx, slide_text in enumerate(slides):
        cur.execute(
            """INSERT INTO lesson_slides (lesson_id, slide_index, description_text, image_url)
               VALUES (%s, %s, %s, NULL)""",
            (lesson_id, idx, slide_text)
        )
    print(f"  Inserted {len(slides)} slides (without images).")

    # 3. Insert Quiz (check if existing)
    cur.execute(
        "SELECT id FROM quizzes WHERE lesson_id = %s AND difficulty = %s",
        (lesson_id, difficulty)
    )
    row = cur.fetchone()
    if row:
        quiz_id = row[0]
        cur.execute("UPDATE quizzes SET title = %s WHERE id = %s", (f"Bruno's Squeaky Toy Quiz ({difficulty.upper()})", quiz_id))
    else:
        cur.execute(
            """INSERT INTO quizzes (title, topic_id, lesson_id, difficulty)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (f"Bruno's Squeaky Toy Quiz ({difficulty.upper()})", topic_id, lesson_id, difficulty)
        )
        quiz_id = cur.fetchone()[0]
    print(f"Quiz [{difficulty.upper()}] ID: {quiz_id}")

    # 4. Insert Questions (delete existing first)
    cur.execute("SELECT id FROM questions WHERE quiz_id = %s", (quiz_id,))
    old_q_ids = [r[0] for r in cur.fetchall()]
    if old_q_ids:
        cur.execute("DELETE FROM student_question_answers WHERE question_id = ANY(%s)", (old_q_ids,))
        cur.execute("DELETE FROM question_options WHERE question_id = ANY(%s)", (old_q_ids,))
        cur.execute("DELETE FROM questions WHERE quiz_id = %s", (quiz_id,))

    for q_data in questions:
        cur.execute(
            """INSERT INTO questions (quiz_id, question_text, correct_option_letter, question_type, image_url, knowledge_component, hint)
               VALUES (%s, %s, %s, 'multiple_choice', NULL, %s, %s) RETURNING id""",
            (quiz_id, q_data["q"], q_data["ans"], q_data["kc"], q_data["hint"])
        )
        q_id = cur.fetchone()[0]
        for opt_idx, opt_text in enumerate(q_data["opts"]):
            opt_letter = chr(65 + opt_idx)
            cur.execute(
                """INSERT INTO question_options (question_id, option_letter, option_text)
                   VALUES (%s, %s, %s)""",
                (q_id, opt_letter, opt_text)
            )
    print(f"  Inserted {len(questions)} questions and options.")

def main():
    conn = get_db_connection()
    cur = conn.cursor()

    topic_id = "technology-and-livelihood-education"
    group_title = "Muting the Microphone: Bruno's Squeaky Toy"

    # Ensure KCs exist
    ensure_knowledge_components(cur, topic_id)

    # 1. Ensure lesson group
    cur.execute(
        "SELECT id FROM lesson_groups WHERE topic_id = %s AND title = %s",
        (topic_id, group_title)
    )
    group_row = cur.fetchone()
    if group_row:
        group_id = group_row[0]
        print(f"Found existing Lesson Group ID: {group_id}")
    else:
        cur.execute(
            """INSERT INTO lesson_groups (topic_id, title, order_index)
               VALUES (%s, %s, 2) RETURNING id""",
            (topic_id, group_title)
        )
        group_id = cur.fetchone()[0]
        print(f"Created Lesson Group ID: {group_id}")

    # 2. Insert Easy, Medium, Hard
    insert_tier(cur, group_id, topic_id, "easy", "Bruno's Squeaky Toy (EASY)", EASY_SLIDES, EASY_QUESTIONS)
    insert_tier(cur, group_id, topic_id, "medium", "Bruno's Squeaky Toy (MEDIUM)", MEDIUM_SLIDES, MEDIUM_QUESTIONS)
    insert_tier(cur, group_id, topic_id, "hard", "Bruno's Squeaky Toy (HARD)", HARD_SLIDES, HARD_QUESTIONS)

    conn.commit()
    cur.close()
    conn.close()
    print("\nSUCCESS! All Easy, Medium, and Hard tiers of Bruno's Squeaky Toy have been inserted into the database!")

if __name__ == "__main__":
    main()
