import type { CefrLevel } from '@/features/curriculum/schema'
import type { PartOfSpeech, VocabTopic, VocabularyEntryInput } from '../schema'

/**
 * Initial A0–A2 vocabulary bank: 13 practical topics, frequently useful
 * words and natural examples. Every entry is validated by
 * `VocabularyBankSchema` at import. Azerbaijani translations are optional
 * support material; definitions and examples are the teaching content.
 */

interface Extra {
  level?: CefrLevel
  kind?: 'word' | 'expression'
  topics?: VocabTopic[]
  synonyms?: string[]
  antonyms?: string[]
  collocations?: string[]
  wordFamily?: string[]
  note?: string
  noteAz?: string
  respelling?: string
  tags?: string[]
  chapterIds?: string[]
}

function v(
  topic: VocabTopic,
  id: string,
  term: string,
  partOfSpeech: PartOfSpeech,
  definition: string,
  examples: string[],
  az: string,
  extra: Extra = {},
): VocabularyEntryInput {
  const { level = 'A0', kind, topics, note, noteAz, respelling, ...rest } = extra
  return {
    id: `v-${id}`,
    term,
    kind: kind ?? (term.includes(' ') ? 'expression' : 'word'),
    partOfSpeech,
    definition,
    examples,
    translations: { az },
    ...(respelling ? { pronunciation: { respelling } } : {}),
    ...(note ? { grammarNote: noteAz ? { en: note, az: noteAz } : { en: note } } : {}),
    level,
    topics: topics ?? [topic],
    ...rest,
  }
}

const A1: Extra = { level: 'A1' }
const A2: Extra = { level: 'A2' }

export const VOCABULARY_BANK_INPUT: VocabularyEntryInput[] = [
  // ---------------------------------------------------------------- introductions
  v('introductions', 'hello', 'hello', 'interjection', 'A greeting you can use at any time.', ['Hello! My name is Leyla.', 'Hello, how are you?'], 'salam', { synonyms: ['hi'], chapterIds: ['a0-01'], respelling: 'heh-LOH' }),
  v('introductions', 'name', 'name', 'noun', 'The word people call you by.', ["My name is Rashad. What's your name?"], 'ad', { collocations: ['first name', 'family name'], chapterIds: ['a0-01'] }),
  v('introductions', 'nice-to-meet-you', 'nice to meet you', 'phrase', 'What you say when you meet someone for the first time.', ['Nice to meet you, Tom. – Nice to meet you too.'], 'tanış olmağıma şadam', { chapterIds: ['a0-01'] }),
  v('introductions', 'from', 'from', 'preposition', 'Used to say the place where you were born or live.', ["I'm from Baku. Where are you from?"], '-dan / -dən (haradan)', { chapterIds: ['a0-01'], note: 'Say "I am from + country/city", not "I am of".', noteAz: '"I am from Baku" deyilir; "of" işlənmir.' }),
  v('introductions', 'student', 'student', 'noun', 'A person who studies at a school or university.', ["I'm a student at Baku State University."], 'tələbə', { chapterIds: ['a0-01'], note: 'Jobs need a/an: "a student".', noteAz: 'Peşə ilə "a / an" lazımdır: "a student".' }),
  v('introductions', 'teacher', 'teacher', 'noun', 'A person who teaches.', ['Our teacher is from London.'], 'müəllim', { wordFamily: ['teach', 'teaching'], chapterIds: ['a0-01'] }),
  v('introductions', 'job', 'job', 'noun', 'The work you do to earn money.', ['What is your job? – I am an engineer.'], 'iş, peşə', { synonyms: ['work'], collocations: ['a good job', 'a part-time job'] }),
  v('introductions', 'country', 'country', 'noun', 'A nation with its own government, like Azerbaijan or Turkey.', ['Azerbaijan is a beautiful country.'], 'ölkə', { collocations: ['home country'] }),
  v('introductions', 'city', 'city', 'noun', 'A large town.', ['Baku is a big city by the sea.'], 'şəhər', { antonyms: ['village'] }),
  v('introductions', 'age', 'age', 'noun', 'How old you are.', ['What is your age? – I am 24.'], 'yaş', { note: 'Use "be" for age: "I am 24", never "I have 24 years".', noteAz: 'Yaş "be" ilə deyilir: "I am 24". "I have 24 years" səhvdir.' }),
  v('introductions', 'how-are-you', 'how are you', 'phrase', 'A friendly question after hello. Common answer: "Fine, thanks."', ["How are you? – I'm fine, thanks. And you?"], 'necəsən / necəsiniz', { chapterIds: ['a0-01'] }),
  v('introductions', 'goodbye', 'goodbye', 'interjection', 'What you say when you leave.', ['Goodbye! See you tomorrow.'], 'sağ ol / sağ olun', { synonyms: ['bye', 'see you'], chapterIds: ['a0-01'] }),
  v('introductions', 'spell', 'spell', 'verb', 'To say or write the letters of a word in order.', ['How do you spell your name? – L-E-Y-L-A.'], 'hərf-hərf demək', { wordFamily: ['spelling'], chapterIds: ['a0-01'] }),
  v('introductions', 'nationality', 'nationality', 'noun', 'The country you belong to, as an adjective: Azerbaijani, Turkish.', ['What nationality are you? – I am Azerbaijani.'], 'milliyyət', { ...A1, wordFamily: ['nation', 'national'] }),

  // ----------------------------------------------------------------------- family
  v('family', 'mother', 'mother', 'noun', 'Your female parent.', ['My mother is a doctor.'], 'ana', { synonyms: ['mum'], chapterIds: ['a0-05'] }),
  v('family', 'father', 'father', 'noun', 'Your male parent.', ['My father works in a bank.'], 'ata', { synonyms: ['dad'], chapterIds: ['a0-05'] }),
  v('family', 'parents', 'parents', 'noun', 'Your mother and father.', ['My parents live in Ganja.'], 'valideynlər', { chapterIds: ['a0-05'] }),
  v('family', 'brother', 'brother', 'noun', 'A boy or man with the same parents as you.', ['I have one brother and two sisters.'], 'qardaş', { chapterIds: ['a0-05'] }),
  v('family', 'sister', 'sister', 'noun', 'A girl or woman with the same parents as you.', ['My sister is older than me.'], 'bacı', { chapterIds: ['a0-05'] }),
  v('family', 'husband', 'husband', 'noun', 'The man a woman is married to.', ['Her husband is a programmer.'], 'ər', { antonyms: ['wife'] }),
  v('family', 'wife', 'wife', 'noun', 'The woman a man is married to.', ['His wife is from Sumgait.'], 'arvad, həyat yoldaşı', { antonyms: ['husband'], note: 'Plural: wives.', noteAz: 'Cəm: wives.' }),
  v('family', 'son', 'son', 'noun', 'A male child.', ['They have a son and a daughter.'], 'oğul', { antonyms: ['daughter'] }),
  v('family', 'daughter', 'daughter', 'noun', 'A female child.', ['Their daughter is five years old.'], 'qız (övlad)', { antonyms: ['son'], respelling: 'DAW-tuhr' }),
  v('family', 'grandmother', 'grandmother', 'noun', 'The mother of your mother or father.', ['My grandmother makes the best plov.'], 'nənə', { synonyms: ['grandma'] }),
  v('family', 'grandfather', 'grandfather', 'noun', 'The father of your mother or father.', ['My grandfather is eighty.'], 'baba', { synonyms: ['grandpa'] }),
  v('family', 'uncle', 'uncle', 'noun', 'The brother of your mother or father.', ['My uncle lives in Turkey.'], 'dayı / əmi', { antonyms: ['aunt'] }),
  v('family', 'aunt', 'aunt', 'noun', 'The sister of your mother or father.', ['My aunt is a teacher.'], 'xala / bibi', { antonyms: ['uncle'] }),
  v('family', 'cousin', 'cousin', 'noun', 'The child of your uncle or aunt.', ['I have six cousins.'], 'əmioğlu, xalaqızı və s.', { ...A1, respelling: 'KUZ-uhn' }),
  v('family', 'married', 'married', 'adjective', 'Having a husband or wife.', ["She is married. Her husband's name is Elchin."], 'evli', { antonyms: ['single'], collocations: ['get married', 'married to'], ...A1, note: '"Married to", not "married with".', noteAz: '"Married to" deyilir, "married with" səhvdir.' }),

  // ------------------------------------------------------------------ personality
  v('personality', 'friendly', 'friendly', 'adjective', 'Kind and pleasant to other people.', ['Our neighbours are very friendly.'], 'mehriban', { antonyms: ['unfriendly'], wordFamily: ['friend'], chapterIds: ['a0-04'] }),
  v('personality', 'funny', 'funny', 'adjective', 'Making people laugh.', ["Rashad is funny. He tells good jokes."], 'gülməli, məzəli', { chapterIds: ['a0-04'] }),
  v('personality', 'shy', 'shy', 'adjective', 'Nervous and quiet with other people.', ["I'm a little shy, so I don't talk much in class."], 'utancaq', { antonyms: ['confident'], chapterIds: ['a0-04'] }),
  v('personality', 'kind', 'kind', 'adjective', 'Caring about other people and helping them.', ['She is very kind to animals.'], 'xeyirxah, mehriban', { synonyms: ['nice'], antonyms: ['unkind'], ...A1 }),
  v('personality', 'clever', 'clever', 'adjective', 'Able to learn and understand quickly.', ['My little cousin is very clever.'], 'ağıllı', { synonyms: ['smart', 'intelligent'], ...A1 }),
  v('personality', 'lazy', 'lazy', 'adjective', 'Not wanting to work or do things.', ["I'm lazy on Sundays. I stay in bed."], 'tənbəl', { antonyms: ['hard-working'], ...A1 }),
  v('personality', 'hard-working', 'hard-working', 'adjective', 'Working a lot and with energy.', ['Nigar is a hard-working student.'], 'çalışqan', { antonyms: ['lazy'], ...A1 }),
  v('personality', 'polite', 'polite', 'adjective', 'Behaving well and showing respect.', ['Be polite: say "please" and "thank you".'], 'nəzakətli', { antonyms: ['rude'], ...A1 }),
  v('personality', 'confident', 'confident', 'adjective', 'Sure about yourself and your abilities.', ['She is confident when she speaks English.'], 'özünə inamlı', { antonyms: ['shy'], ...A2, wordFamily: ['confidence'] }),
  v('personality', 'honest', 'honest', 'adjective', 'Telling the truth.', ['He is honest. He never lies.'], 'dürüst', { antonyms: ['dishonest'], ...A2, respelling: 'ON-ist', note: 'Silent h: "an honest man".', noteAz: '"h" oxunmur, ona görə "an honest".' }),
  v('personality', 'patient', 'patient', 'adjective', 'Able to wait calmly without getting angry.', ['Our teacher is very patient with us.'], 'səbirli', { antonyms: ['impatient'], ...A2, wordFamily: ['patience'] }),
  v('personality', 'serious', 'serious', 'adjective', 'Not joking; thinking carefully.', ['My father is a serious man, but he is kind.'], 'ciddi', { ...A1 }),
  v('personality', 'talkative', 'talkative', 'adjective', 'Talking a lot.', ['My sister is very talkative on the phone.'], 'danışqan', { antonyms: ['quiet'], ...A2, wordFamily: ['talk'] }),

  // --------------------------------------------------------------------- emotions
  v('emotions', 'happy', 'happy', 'adjective', 'Feeling good and pleased.', ["I'm happy to be here."], 'xoşbəxt, şad', { antonyms: ['sad'], wordFamily: ['happiness', 'happily'], chapterIds: ['a0-01'] }),
  v('emotions', 'sad', 'sad', 'adjective', 'Feeling unhappy.', ["She is sad because her friend is leaving."], 'kədərli', { antonyms: ['happy'], wordFamily: ['sadness'] }),
  v('emotions', 'tired', 'tired', 'adjective', 'Needing rest or sleep.', ["I'm tired. I want to go to bed."], 'yorğun', { collocations: ['tired of', 'very tired'], chapterIds: ['a0-01'] }),
  v('emotions', 'angry', 'angry', 'adjective', 'Feeling strong displeasure.', ["Don't be angry with me. It was a mistake."], 'qəzəbli, hirsli', { collocations: ['angry with someone', 'angry about something'], ...A1, note: 'Angry *with* a person, angry *about* a thing.', noteAz: 'İnsana "angry with", hadisəyə "angry about".' }),
  v('emotions', 'afraid', 'afraid', 'adjective', 'Feeling fear.', ["I'm afraid of dogs."], 'qorxmuş; qorxan', { synonyms: ['scared'], collocations: ['afraid of'], ...A1, note: 'Only after "be": "I am afraid", never "an afraid man".', noteAz: 'Yalnız "be"-dən sonra: "I am afraid". "An afraid man" səhvdir.' }),
  v('emotions', 'excited', 'excited', 'adjective', 'Very happy and full of energy about something.', ["We're excited about the trip."], 'həyəcanlı (sevincdən)', { collocations: ['excited about'], ...A1, wordFamily: ['exciting', 'excitement'] }),
  v('emotions', 'bored', 'bored', 'adjective', 'Not interested; wanting something to change.', ["I'm bored. Let's go out."], 'darıxmış, bezmiş', { antonyms: ['interested'], ...A1, note: '"I am bored" (feeling) vs "the film is boring" (cause).', noteAz: '"I am bored" – mən darıxıram; "the film is boring" – film darıxdırıcıdır.' }),
  v('emotions', 'worried', 'worried', 'adjective', 'Thinking about problems and feeling nervous.', ["She's worried about her exam."], 'narahat', { collocations: ['worried about'], ...A1, wordFamily: ['worry'] }),
  v('emotions', 'surprised', 'surprised', 'adjective', 'Feeling something unexpected happened.', ['I was surprised to see him at the party.'], 'təəccüblənmiş', { ...A1, wordFamily: ['surprise', 'surprising'] }),
  v('emotions', 'nervous', 'nervous', 'adjective', 'Worried and a little afraid, for example before an exam.', ["I'm nervous before I speak English."], 'həyəcanlı (narahat)', { ...A1, respelling: 'NUR-vuhs' }),
  v('emotions', 'relaxed', 'relaxed', 'adjective', 'Calm and not worried.', ['After the holiday I feel relaxed.'], 'rahat, sakit', { antonyms: ['stressed'], ...A2, wordFamily: ['relax', 'relaxing'] }),
  v('emotions', 'proud', 'proud', 'adjective', 'Feeling pleased about something you or someone close to you did.', ["I'm proud of my sister. She passed her exam."], 'qürurlu', { collocations: ['proud of'], ...A2 }),
  v('emotions', 'lonely', 'lonely', 'adjective', 'Unhappy because you are alone.', ['He felt lonely in the new city.'], 'tənha', { ...A2, note: '"Lonely" is a feeling; "alone" is just being without people.', noteAz: '"Lonely" – tənhalıq hissi; "alone" – sadəcə tək olmaq.' }),

  // --------------------------------------------------------------- daily routines
  v('daily_routines', 'wake-up', 'wake up', 'verb', 'To stop sleeping.', ['I wake up at seven every day.'], 'oyanmaq', { ...A1, chapterIds: ['a1-01'], note: 'Separable: "wake me up".', noteAz: 'Ayrıla bilən: "wake me up".' }),
  v('daily_routines', 'get-up', 'get up', 'verb', 'To leave your bed after sleeping.', ['She gets up at six and goes for a run.'], 'yataqdan qalxmaq', { ...A1, chapterIds: ['a1-01'] }),
  v('daily_routines', 'have-breakfast', 'have breakfast', 'verb', 'To eat the morning meal.', ['We have breakfast together at eight.'], 'səhər yeməyi yemək', { ...A1, chapterIds: ['a1-01'], note: 'Use "have" with meals: have breakfast / lunch / dinner.', noteAz: 'Yeməklərlə "have" işlənir: have breakfast / lunch / dinner.' }),
  v('daily_routines', 'go-to-work', 'go to work', 'verb', 'To travel to your job.', ['He goes to work by metro.'], 'işə getmək', { ...A1, chapterIds: ['a1-01'] }),
  v('daily_routines', 'take-a-shower', 'take a shower', 'verb', 'To wash your body standing under running water.', ['I take a shower before breakfast.'], 'duş qəbul etmək', { ...A1, synonyms: ['have a shower'] }),
  v('daily_routines', 'brush', 'brush', 'verb', 'To clean with a brush, for example your teeth or hair.', ['Brush your teeth twice a day.'], 'fırçalamaq', { ...A1, collocations: ['brush your teeth', 'brush your hair'] }),
  v('daily_routines', 'cook', 'cook', 'verb', 'To prepare food with heat.', ['My mother cooks dinner every evening.'], 'bişirmək', { ...A1, wordFamily: ['cooker', 'cooking'] }),
  v('daily_routines', 'go-to-bed', 'go to bed', 'verb', 'To lie down to sleep.', ['I go to bed at eleven.'], 'yatmağa getmək', { ...A1, chapterIds: ['a1-01'], note: 'No article: "go to bed", not "go to the bed".', noteAz: 'Artiklsiz: "go to bed".' }),
  v('daily_routines', 'usually', 'usually', 'adverb', 'Most of the time.', ['I usually walk to university.'], 'adətən', { ...A1, chapterIds: ['a1-01'], note: 'Goes before the main verb: "I usually walk".', noteAz: 'Əsas feldən əvvəl gəlir: "I usually walk".' }),
  v('daily_routines', 'always', 'always', 'adverb', 'Every time; all the time.', ['She always drinks tea in the morning.'], 'həmişə', { ...A1, antonyms: ['never'], chapterIds: ['a1-01'] }),
  v('daily_routines', 'never', 'never', 'adverb', 'Not at any time.', ['I never eat breakfast at work.'], 'heç vaxt', { ...A1, antonyms: ['always'], chapterIds: ['a1-01'], note: 'Already negative: "I never go", not "I don\'t never go".', noteAz: 'Özü inkardır: "I never go". "don\'t" əlavə edilmir.' }),
  v('daily_routines', 'sometimes', 'sometimes', 'adverb', 'On some occasions but not always.', ['We sometimes watch a film after dinner.'], 'bəzən', { ...A1, chapterIds: ['a1-01'] }),
  v('daily_routines', 'busy', 'busy', 'adjective', 'Having a lot to do.', ["I'm busy on Mondays."], 'məşğul', { ...A1, antonyms: ['free'], collocations: ['busy day', 'busy with'] }),
  v('daily_routines', 'homework', 'homework', 'noun', 'Schoolwork you do at home.', ['I do my homework in the evening.'], 'ev tapşırığı', { ...A1, note: 'Uncountable: "some homework", never "homeworks".', noteAz: 'Sayılmayan isim: "some homework"; "homeworks" səhvdir.' }),

  // -------------------------------------------------------------- university life
  v('university_life', 'university', 'university', 'noun', 'A place of higher education after school.', ['She studies economics at university.'], 'universitet', { ...A1, respelling: 'yoo-nih-VUR-sih-tee', note: '"At university", no article.', noteAz: '"At university" – artiklsiz.' }),
  v('university_life', 'lecture', 'lecture', 'noun', 'A talk given to students by a teacher.', ['The lecture starts at nine.'], 'mühazirə', { ...A1, collocations: ['attend a lecture', 'give a lecture'] }),
  v('university_life', 'exam', 'exam', 'noun', 'A formal test of what you know.', ['I have an English exam on Friday.'], 'imtahan', { ...A1, collocations: ['pass an exam', 'fail an exam', 'take an exam'], note: 'You "take" or "sit" an exam; you do not "give" it.', noteAz: 'İmtahan "take" edilir; "give an exam" səhvdir (bu, müəllimin işidir).' }),
  v('university_life', 'pass', 'pass', 'verb', 'To succeed in an exam or test.', ['She passed all her exams.'], 'imtahandan keçmək', { ...A1, antonyms: ['fail'] }),
  v('university_life', 'fail', 'fail', 'verb', 'To not succeed in an exam or test.', ['I failed my driving test the first time.'], 'kəsilmək', { ...A1, antonyms: ['pass'], wordFamily: ['failure'] }),
  v('university_life', 'subject', 'subject', 'noun', 'An area of study, like history or maths.', ['My favourite subject is history.'], 'fənn', { ...A1 }),
  v('university_life', 'library', 'library', 'noun', 'A building with books you can read or borrow.', ['I study in the library every afternoon.'], 'kitabxana', { ...A1, respelling: 'LY-bruh-ree' }),
  v('university_life', 'degree', 'degree', 'noun', 'The qualification you get when you finish university.', ['He has a degree in engineering.'], 'diplom (ali təhsil dərəcəsi)', { ...A2, collocations: ['a degree in', 'get a degree'] }),
  v('university_life', 'deadline', 'deadline', 'noun', 'The latest time you can finish something.', ['The deadline for the essay is Monday.'], 'son tarix', { ...A2, collocations: ['meet a deadline', 'miss a deadline'] }),
  v('university_life', 'classmate', 'classmate', 'noun', 'A person in the same class as you.', ['My classmates are from different countries.'], 'sinif yoldaşı', { ...A1 }),
  v('university_life', 'timetable', 'timetable', 'noun', 'A list of the times when classes happen.', ['Check the timetable for your lectures.'], 'cədvəl', { ...A1, synonyms: ['schedule'] }),
  v('university_life', 'revise', 'revise', 'verb', 'To study something again before an exam.', ['I revise for two hours every evening.'], 'təkrar etmək (imtahana hazırlaşmaq)', { ...A2, wordFamily: ['revision'] }),
  v('university_life', 'essay', 'essay', 'noun', 'A short piece of writing on one subject.', ['Write a 200-word essay about your city.'], 'esse, inşa', { ...A2 }),

  // ------------------------------------------------------------------------- food
  v('food', 'bread', 'bread', 'noun', 'A basic food made from flour and baked.', ['We eat bread with every meal.'], 'çörək', { chapterIds: ['a1-05'], note: 'Uncountable: "a piece of bread".', noteAz: 'Sayılmayan: "a piece of bread".' }),
  v('food', 'water', 'water', 'noun', 'The clear liquid we drink.', ['Can I have a glass of water, please?'], 'su', { chapterIds: ['a1-05'] }),
  v('food', 'tea', 'tea', 'noun', 'A hot drink made with leaves and water.', ['In Azerbaijan we drink tea from small glasses.'], 'çay', { chapterIds: ['a1-05'], collocations: ['a cup of tea', 'black tea'] }),
  v('food', 'rice', 'rice', 'noun', 'Small white grains cooked and eaten.', ['Plov is made with rice.'], 'düyü', { chapterIds: ['a1-05'] }),
  v('food', 'meat', 'meat', 'noun', 'Food from animals.', ["I don't eat meat on Fridays."], 'ət', { chapterIds: ['a1-05'] }),
  v('food', 'vegetables', 'vegetables', 'noun', 'Plants we eat, like tomatoes and carrots.', ['Eat more vegetables and fruit.'], 'tərəvəz', { chapterIds: ['a1-05'], respelling: 'VEJ-tuh-buhlz' }),
  v('food', 'fruit', 'fruit', 'noun', 'Sweet food from plants, like apples and grapes.', ['Fruit is cheap in summer.'], 'meyvə', { chapterIds: ['a1-05'], note: 'Usually uncountable: "some fruit".', noteAz: 'Adətən sayılmayan: "some fruit".' }),
  v('food', 'hungry', 'hungry', 'adjective', 'Wanting to eat.', ["I'm hungry. Let's have lunch."], 'ac', { antonyms: ['full'], ...A1 }),
  v('food', 'thirsty', 'thirsty', 'adjective', 'Wanting to drink.', ["It's hot and I'm thirsty."], 'susamış', { ...A1 }),
  v('food', 'delicious', 'delicious', 'adjective', 'Tasting very good.', ['This soup is delicious!'], 'dadlı, ləzzətli', { ...A1, synonyms: ['tasty'], respelling: 'dih-LISH-uhs' }),
  v('food', 'order', 'order', 'verb', 'To ask for food or drink in a restaurant.', ["I'd like to order a coffee, please."], 'sifariş vermək', { ...A1, collocations: ['order a meal'] }),
  v('food', 'bill', 'bill', 'noun', 'The paper showing how much you must pay in a restaurant.', ['Can we have the bill, please?'], 'hesab', { ...A1, synonyms: ['check (US)'] }),
  v('food', 'breakfast', 'breakfast', 'noun', 'The first meal of the day.', ['What do you have for breakfast?'], 'səhər yeməyi', { chapterIds: ['a1-01'] }),
  v('food', 'dinner', 'dinner', 'noun', 'The main evening meal.', ['Dinner is at seven tonight.'], 'şam yeməyi', { chapterIds: ['a1-01'] }),

  // ----------------------------------------------------------------------- travel
  v('travel', 'ticket', 'ticket', 'noun', 'A paper or card that lets you travel or enter.', ['Two tickets to Ganja, please.'], 'bilet', { ...A1, collocations: ['buy a ticket', 'return ticket'] }),
  v('travel', 'airport', 'airport', 'noun', 'The place where planes arrive and leave.', ['The airport is 25 kilometres from the city.'], 'hava limanı', { ...A1 }),
  v('travel', 'flight', 'flight', 'noun', 'A journey by plane.', ['Our flight leaves at 6 a.m.'], 'uçuş', { ...A1, wordFamily: ['fly'] }),
  v('travel', 'passport', 'passport', 'noun', 'The official document you need to travel abroad.', ['Show your passport at the desk.'], 'pasport', { ...A1 }),
  v('travel', 'hotel', 'hotel', 'noun', 'A place where you pay to sleep when travelling.', ['We stayed in a small hotel by the sea.'], 'otel', { ...A1, collocations: ['stay in a hotel', 'book a hotel'] }),
  v('travel', 'book', 'book', 'verb', 'To arrange to have a room, ticket or seat.', ['I booked a room for two nights.'], 'sifariş etmək, bron etmək', { ...A1, synonyms: ['reserve'] }),
  v('travel', 'luggage', 'luggage', 'noun', 'The bags you take when you travel.', ['Is this your luggage?'], 'baqaj', { ...A2, synonyms: ['baggage'], note: 'Uncountable: "a piece of luggage".', noteAz: 'Sayılmayan: "a piece of luggage".' }),
  v('travel', 'journey', 'journey', 'noun', 'Travelling from one place to another.', ['The journey to Sheki takes four hours.'], 'səyahət, yol', { ...A2, synonyms: ['trip'], respelling: 'JUR-nee' }),
  v('travel', 'arrive', 'arrive', 'verb', 'To reach a place.', ['We arrived in Baku at midnight.'], 'gəlib çatmaq', { ...A1, antonyms: ['leave'], collocations: ['arrive in a city', 'arrive at a place'], note: '"Arrive in" + city/country, "arrive at" + building.', noteAz: 'Şəhər/ölkə ilə "arrive in", bina ilə "arrive at".' }),
  v('travel', 'leave', 'leave', 'verb', 'To go away from a place.', ['The bus leaves at ten.'], 'tərk etmək, yola düşmək', { ...A1, antonyms: ['arrive'], note: 'Past: left.', noteAz: 'Keçmiş: left.' }),
  v('travel', 'abroad', 'abroad', 'adverb', 'In or to a foreign country.', ['Have you ever been abroad?'], 'xaricdə, xaricə', { ...A2, note: 'No "to": "go abroad".', noteAz: '"to"-suz: "go abroad".' }),
  v('travel', 'return', 'return', 'verb', 'To go back.', ['We return home on Sunday.'], 'qayıtmaq', { ...A2, collocations: ['return ticket'] }),
  v('travel', 'sightseeing', 'sightseeing', 'noun', 'Visiting interesting places as a tourist.', ['We went sightseeing in the Old City.'], 'görməli yerləri gəzmək', { ...A2, collocations: ['go sightseeing'] }),

  // ------------------------------------------------------------------- directions
  v('directions', 'left', 'left', 'noun', 'The side of your body where your heart is.', ['Turn left at the bank.'], 'sol', { antonyms: ['right'], chapterIds: ['a0-08'] }),
  v('directions', 'right', 'right', 'noun', 'The side opposite to left.', ['The pharmacy is on the right.'], 'sağ', { antonyms: ['left'], chapterIds: ['a0-08'] }),
  v('directions', 'straight-on', 'straight on', 'adverb', 'Continuing in the same direction.', ['Go straight on for two minutes.'], 'düz irəli', { chapterIds: ['a0-08'] }),
  v('directions', 'turn', 'turn', 'verb', 'To change direction.', ['Turn right after the school.'], 'dönmək', { chapterIds: ['a0-08'], collocations: ['turn left', 'turn right', 'turn around'] }),
  v('directions', 'next-to', 'next to', 'preposition', 'Beside; at the side of.', ['The café is next to the metro station.'], 'yanında', { chapterIds: ['a0-06'] }),
  v('directions', 'opposite', 'opposite', 'preposition', 'On the other side, facing.', ['The bank is opposite the park.'], 'qarşısında', { ...A1, note: 'No "of": "opposite the bank".', noteAz: '"of" işlənmir: "opposite the bank".' }),
  v('directions', 'between', 'between', 'preposition', 'In the space separating two things.', ['The shop is between the bank and the café.'], 'arasında', { chapterIds: ['a0-06'] }),
  v('directions', 'corner', 'corner', 'noun', 'The place where two streets meet.', ['The bakery is on the corner.'], 'künc, tin', { ...A1, collocations: ['on the corner', 'around the corner'] }),
  v('directions', 'near', 'near', 'preposition', 'Not far from.', ['Is there a pharmacy near here?'], 'yaxın', { antonyms: ['far'], chapterIds: ['a0-08'] }),
  v('directions', 'far', 'far', 'adjective', 'A long distance away.', ["Is the station far? – No, it's five minutes."], 'uzaq', { antonyms: ['near'], chapterIds: ['a0-08'] }),
  v('directions', 'cross', 'cross', 'verb', 'To go from one side of a road to the other.', ['Cross the road at the lights.'], 'keçmək (yolu)', { ...A1 }),
  v('directions', 'excuse-me', 'excuse me', 'phrase', 'Polite words to get attention or to ask for help.', ['Excuse me, where is the station?'], 'bağışlayın, üzr istəyirəm', { chapterIds: ['a0-08'] }),
  v('directions', 'lost', 'lost', 'adjective', 'Not knowing where you are.', ["I'm lost. Can you help me?"], 'azmış, itmiş', { ...A1, collocations: ['get lost'] }),

  // ----------------------------------------------------------------- common verbs
  v('common_verbs', 'be', 'be', 'verb', 'To exist; used to say who or what someone is (am, is, are).', ['I want to be a doctor.', 'I am a student. She is from Baku.'], 'olmaq', { chapterIds: ['a0-01'], wordFamily: ['am', 'is', 'are', 'was', 'were'] }),
  v('common_verbs', 'have', 'have', 'verb', 'To own or hold something.', ['I have two brothers.'], 'malik olmaq (-im var)', { ...A1, note: 'He/she/it: has.', noteAz: 'He/she/it ilə: has.' }),
  v('common_verbs', 'go', 'go', 'verb', 'To move from one place to another.', ['We go to the market on Saturdays.'], 'getmək', { ...A1, note: 'Past: went.', noteAz: 'Keçmiş: went.' }),
  v('common_verbs', 'come', 'come', 'verb', 'To move towards the speaker.', ['Come here, please.'], 'gəlmək', { ...A1, antonyms: ['go'], note: 'Past: came.', noteAz: 'Keçmiş: came.' }),
  v('common_verbs', 'make', 'make', 'verb', 'To create or produce something.', ['My mother makes great tea.'], 'etmək, hazırlamaq', { ...A1, collocations: ['make a mistake', 'make friends', 'make a decision'], note: 'Past: made. "Make" a mistake, "do" homework.', noteAz: 'Keçmiş: made. "Make a mistake", amma "do homework".' }),
  v('common_verbs', 'do', 'do', 'verb', 'To perform an action or task.', ['What do you do at the weekend?'], 'etmək (iş görmək)', { ...A1, collocations: ['do homework', 'do the shopping', 'do exercise'] }),
  v('common_verbs', 'take', 'take', 'verb', 'To get hold of something and move it; also used with transport and time.', ['I take the bus to work.'], 'götürmək; (nəqliyyatla) getmək', { ...A1, collocations: ['take a photo', 'take a break', 'take the bus'], note: 'Past: took.', noteAz: 'Keçmiş: took.' }),
  v('common_verbs', 'get', 'get', 'verb', 'To receive or obtain; also to become.', ['Where can I get a ticket?', 'I got a new phone yesterday.'], 'almaq; olmaq', { ...A1, collocations: ['get up', 'get home', 'get tired'], note: 'Past: got.', noteAz: 'Keçmiş: got.' }),
  v('common_verbs', 'want', 'want', 'verb', 'To wish to have or do something.', ['I want to learn English quickly.'], 'istəmək', { ...A1, note: 'want + to + verb: "I want to go".', noteAz: 'want + to + fel: "I want to go".' }),
  v('common_verbs', 'like', 'like', 'verb', 'To enjoy or find pleasant.', ['I like coffee, but I love tea.'], 'xoşlamaq', { ...A1, antonyms: ['hate'], note: 'like + -ing: "I like swimming".', noteAz: 'like + -ing: "I like swimming".' }),
  v('common_verbs', 'need', 'need', 'verb', 'To require something.', ['We need more time.'], 'ehtiyacı olmaq, lazım olmaq', { ...A1 }),
  v('common_verbs', 'think', 'think', 'verb', 'To use your mind; to have an opinion.', ['I think English is fun.'], 'düşünmək', { ...A1, note: 'Past: thought.', noteAz: 'Keçmiş: thought.' }),
  v('common_verbs', 'know', 'know', 'verb', 'To have information in your mind.', ["I don't know his name."], 'bilmək', { ...A1, note: 'Past: knew. Silent k.', noteAz: 'Keçmiş: knew. "k" oxunmur.' }),
  v('common_verbs', 'speak', 'speak', 'verb', 'To say words; to use a language.', ['She speaks three languages.'], 'danışmaq', { ...A1, collocations: ['speak English', 'speak to someone'], note: 'Past: spoke.', noteAz: 'Keçmiş: spoke.' }),
  v('common_verbs', 'understand', 'understand', 'verb', 'To know the meaning of something.', ["Sorry, I don't understand."], 'başa düşmək', { chapterIds: ['a0-01'], note: 'Past: understood.', noteAz: 'Keçmiş: understood.' }),
  v('common_verbs', 'help', 'help', 'verb', 'To make it easier for someone to do something.', ['Can you help me with this exercise?'], 'kömək etmək', { ...A1, collocations: ['help someone with something'] }),

  // ----------------------------------------------------------------- descriptions
  v('descriptions', 'big', 'big', 'adjective', 'Large in size.', ['Baku is a big city.'], 'böyük', { antonyms: ['small'], synonyms: ['large'], chapterIds: ['a0-04'] }),
  v('descriptions', 'small', 'small', 'adjective', 'Little in size.', ['We live in a small flat.'], 'kiçik', { antonyms: ['big'], chapterIds: ['a0-04'] }),
  v('descriptions', 'old', 'old', 'adjective', 'Having lived or existed for a long time.', ['My grandfather is old, but he is strong.'], 'qoca; köhnə', { antonyms: ['young', 'new'], chapterIds: ['a0-04'] }),
  v('descriptions', 'new', 'new', 'adjective', 'Recently made or bought.', ['Is this a new phone?'], 'yeni, təzə', { antonyms: ['old'], chapterIds: ['a0-04'] }),
  v('descriptions', 'tall', 'tall', 'adjective', 'Having greater height than usual.', ['My brother is very tall.'], 'hündür, ucaboy', { antonyms: ['short'], chapterIds: ['a0-04'] }),
  v('descriptions', 'short', 'short', 'adjective', 'Small in height or length.', ['She has short dark hair.'], 'qısa; qısaboy', { antonyms: ['tall', 'long'], chapterIds: ['a0-04'] }),
  v('descriptions', 'beautiful', 'beautiful', 'adjective', 'Very pleasant to look at.', ['The Caspian Sea is beautiful at sunset.'], 'gözəl', { synonyms: ['pretty', 'lovely'], antonyms: ['ugly'], chapterIds: ['a0-04'], respelling: 'BYOO-tih-fuhl' }),
  v('descriptions', 'expensive', 'expensive', 'adjective', 'Costing a lot of money.', ['This restaurant is too expensive.'], 'bahalı', { antonyms: ['cheap'], ...A1 }),
  v('descriptions', 'cheap', 'cheap', 'adjective', 'Costing little money.', ['Tea is cheap here.'], 'ucuz', { antonyms: ['expensive'], ...A1 }),
  v('descriptions', 'clean', 'clean', 'adjective', 'Not dirty.', ['The kitchen is clean now.'], 'təmiz', { antonyms: ['dirty'], ...A1 }),
  v('descriptions', 'dirty', 'dirty', 'adjective', 'Not clean.', ['My shoes are dirty after the rain.'], 'çirkli', { antonyms: ['clean'], ...A1 }),
  v('descriptions', 'comfortable', 'comfortable', 'adjective', 'Making you feel relaxed and at ease.', ['This chair is very comfortable.'], 'rahat', { antonyms: ['uncomfortable'], ...A2, respelling: 'KUMF-tuh-buhl' }),
  v('descriptions', 'crowded', 'crowded', 'adjective', 'Full of people.', ['The metro is crowded at 8 a.m.'], 'izdihamlı, adamla dolu', { ...A2, wordFamily: ['crowd'] }),
  v('descriptions', 'quiet', 'quiet', 'adjective', 'With little noise.', ['Our street is quiet at night.'], 'sakit', { antonyms: ['noisy'], ...A1, note: 'Not "quite" (= fairly).', noteAz: '"quite" (= kifayət qədər) ilə qarışdırmayın.' }),

  // ------------------------------------------------------------- time expressions
  v('time_expressions', 'today', 'today', 'adverb', 'On this day.', ["It's cold today."], 'bu gün', { chapterIds: ['a0-01'] }),
  v('time_expressions', 'tomorrow', 'tomorrow', 'adverb', 'On the day after today.', ['See you tomorrow!'], 'sabah', { chapterIds: ['a0-01'] }),
  v('time_expressions', 'yesterday', 'yesterday', 'adverb', 'On the day before today.', ['I was at home yesterday.'], 'dünən', { ...A1, chapterIds: ['a1-08'] }),
  v('time_expressions', 'now', 'now', 'adverb', 'At this moment.', ["I'm busy now. Can I call you later?"], 'indi', { chapterIds: ['a0-01'] }),
  v('time_expressions', 'later', 'later', 'adverb', 'At a time after now.', ["Let's talk later."], 'sonra', { ...A1 }),
  v('time_expressions', 'early', 'early', 'adverb', 'Before the usual or expected time.', ['I get up early on weekdays.'], 'tez, erkən', { antonyms: ['late'], ...A1 }),
  v('time_expressions', 'late', 'late', 'adjective', 'After the expected time.', ["Sorry I'm late. The bus was slow."], 'gec', { antonyms: ['early'], chapterIds: ['a0-01'] }),
  v('time_expressions', 'week', 'week', 'noun', 'A period of seven days.', ['I go to the gym three times a week.'], 'həftə', { ...A1, collocations: ['this week', 'next week', 'last week'], chapterIds: ['a1-06'] }),
  v('time_expressions', 'weekend', 'weekend', 'noun', 'Saturday and Sunday.', ['What are you doing at the weekend?'], 'həftə sonu', { ...A1, collocations: ['at the weekend', 'on the weekend (US)'] }),
  v('time_expressions', 'month', 'month', 'noun', 'One of the twelve parts of a year.', ['My birthday is next month.'], 'ay', { ...A1, chapterIds: ['a1-06'] }),
  v('time_expressions', 'ago', 'ago', 'adverb', 'Back in time from now.', ['I moved to Baku two years ago.'], 'əvvəl, bundan qabaq', { ...A1, chapterIds: ['a1-08'], note: 'Goes after the time: "two years ago".', noteAz: 'Zamandan sonra gəlir: "two years ago".' }),
  v('time_expressions', 'oclock', "o'clock", 'adverb', 'Used after the hour to say an exact time.', ["The class starts at nine o'clock."], 'tamam (saat)', { ...A1, chapterIds: ['a1-06'], note: "Only with full hours: nine o'clock, not nine thirty o'clock.", noteAz: "Yalnız tam saatlarla: nine o'clock." }),
  v('time_expressions', 'half-past', 'half past', 'phrase', 'Thirty minutes after the hour.', ["It's half past seven."], 'yarım (saat ... yarım)', { ...A1, chapterIds: ['a1-06'] }),
  v('time_expressions', 'soon', 'soon', 'adverb', 'In a short time from now.', ["See you soon!"], 'tezliklə', { ...A1 }),

  // ---------------------------------------------------------------- communication
  v('communication', 'please', 'please', 'adverb', 'Added to a request to be polite.', ['A coffee, please.'], 'zəhmət olmasa', { chapterIds: ['a0-01'] }),
  v('communication', 'thank-you', 'thank you', 'phrase', 'What you say when someone helps or gives you something.', ['Thank you very much. – You\'re welcome.'], 'təşəkkür edirəm', { synonyms: ['thanks'], chapterIds: ['a0-01'] }),
  v('communication', 'sorry', 'sorry', 'adjective', 'Used to apologise.', ["Sorry, I'm late."], 'bağışlayın, üzr istəyirəm', { chapterIds: ['a0-01'] }),
  v('communication', 'repeat', 'repeat', 'verb', 'To say something again.', ['Can you repeat that, please?'], 'təkrar etmək', { chapterIds: ['a0-01'] }),
  v('communication', 'mean', 'mean', 'verb', 'To have a particular meaning.', ['What does "deadline" mean?'], 'mənasını vermək', { ...A1, note: 'Past: meant. "What does X mean?", not "What means X?".', noteAz: 'Keçmiş: meant. "What does X mean?" deyilir, "What means X?" səhvdir.' }),
  v('communication', 'ask', 'ask', 'verb', 'To say something as a question; to request.', ['Ask the teacher if you don\'t understand.'], 'soruşmaq', { ...A1, antonyms: ['answer'], collocations: ['ask a question', 'ask for help'] }),
  v('communication', 'answer', 'answer', 'verb', 'To say something after a question.', ['Please answer in full sentences.'], 'cavab vermək', { ...A1, antonyms: ['ask'] }),
  v('communication', 'agree', 'agree', 'verb', 'To have the same opinion.', ['I agree with you.'], 'razılaşmaq', { ...A2, antonyms: ['disagree'], collocations: ['agree with someone'], note: '"I agree", not "I am agree".', noteAz: '"I agree" deyilir, "I am agree" səhvdir.' }),
  v('communication', 'explain', 'explain', 'verb', 'To make something clear by describing it.', ['Can you explain this rule again?'], 'izah etmək', { ...A2, wordFamily: ['explanation'] }),
  v('communication', 'call', 'call', 'verb', 'To telephone someone.', ["I'll call you tonight."], 'zəng etmək', { ...A1, synonyms: ['phone', 'ring'] }),
  v('communication', 'message', 'message', 'noun', 'A short piece of written or spoken information you send to someone.', ['Send me a message when you arrive.'], 'mesaj', { ...A1, collocations: ['send a message', 'leave a message'] }),
  v('communication', 'conversation', 'conversation', 'noun', 'A talk between two or more people.', ['We had a long conversation about football.'], 'söhbət', { ...A2, collocations: ['have a conversation'] }),
  v('communication', 'opinion', 'opinion', 'noun', 'What you think about something.', ['In my opinion, the film was too long.'], 'fikir, rəy', { ...A2, collocations: ['in my opinion'] }),
  v('communication', 'of-course', 'of course', 'phrase', 'Yes, certainly.', ['Can I open the window? – Of course.'], 'əlbəttə', { ...A1 }),
]
