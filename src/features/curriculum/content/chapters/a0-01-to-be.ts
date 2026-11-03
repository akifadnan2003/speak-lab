import type { ChapterInput, LessonInput } from '../../schema'
import { ec, fb, gw, match, mc, ord, qf, sp, st, t } from '../authoring'

/**
 * A0 · Chapter 1 — Sentence structure, subject pronouns and am / is / are.
 *
 * Teaching language: English. Azerbaijani appears only in `az` fields and
 * explains the mechanism (why English needs a subject, what "is" does) rather
 * than translating word for word.
 */

const L01: LessonInput = {
  id: 'a0-01-l01',
  title: 'English sentences: who + what',
  kind: 'grammar',
  estimatedMinutes: 12,
  objectives: ['Recognise the subject + verb order of English sentences', 'Use the seven subject pronouns'],
  blocks: [
    { type: 'heading', text: 'Every English sentence has a subject' },
    {
      type: 'paragraph',
      text: t(
        'An English sentence starts with a subject (who or what) and then a verb (what happens). The subject is never left out: we say "I am a student", not "am a student".',
        'İngilis dilində cümlə mübtəda (kim? nə?) ilə başlayır, sonra fel gəlir. Mübtəda heç vaxt atılmır. Azərbaycan dilində "Tələbəyəm" deyə bilirik, çünki "-yəm" şəkilçisi şəxsi göstərir. İngiliscə isə "I am a student" deməliyik: "I" sözü mütləq lazımdır.',
      ),
    },
    {
      type: 'examples',
      title: 'Subject + verb + the rest',
      items: [
        { en: 'I am a student.', az: 'Mən tələbəyəm.', note: 'subject: I · verb: am' },
        { en: 'She is from Baku.', az: 'O, Bakıdandır.', note: 'subject: She · verb: is' },
        { en: 'They are teachers.', az: 'Onlar müəllimdirlər.', note: 'subject: They · verb: are' },
      ],
    },
    { type: 'heading', text: 'Subject pronouns' },
    {
      type: 'table',
      caption: 'The seven subject pronouns',
      columns: ['Pronoun', 'Who', 'Example'],
      rows: [
        ['I', 'me (the speaker)', 'I am Akif.'],
        ['you', 'one person or many people you talk to', 'You are my friend.'],
        ['he', 'one man or boy', 'He is a doctor.'],
        ['she', 'one woman or girl', 'She is my sister.'],
        ['it', 'one thing, animal or idea', 'It is a book.'],
        ['we', 'me and others', 'We are students.'],
        ['they', 'other people or things', 'They are from Ganja.'],
      ],
    },
    {
      type: 'tip',
      text: t(
        '"I" is always a capital letter, even in the middle of a sentence. "You" is the same for one person and for many people.',
        '"I" həmişə böyük hərflə yazılır, cümlənin ortasında da. "You" həm "sən", həm də "siz" deməkdir – ingilis dilində fərq yoxdur.',
      ),
    },
    {
      type: 'tip',
      tone: 'warning',
      text: t(
        'Azerbaijani "o" can be he, she or it. In English you must choose: he for a man, she for a woman, it for a thing.',
        'Azərbaycan dilində "o" həm kişi, həm qadın, həm də əşya üçün işlənir. İngiliscə seçim etmək lazımdır: kişi üçün he, qadın üçün she, əşya və heyvan üçün it.',
      ),
    },
  ],
  exercises: [
    mc('a0-01-l01-e01', 'Which word is the subject in "She is a teacher"?', ['She', 'is', 'teacher'], 0, {
      explanation: t('The subject comes first and tells us who the sentence is about: She.', 'Mübtəda cümlənin əvvəlində gəlir və kimdən danışıldığını göstərir: She.'),
    }),
    mc('a0-01-l01-e02', 'Choose the pronoun for "my brother".', ['she', 'he', 'it'], 1, {
      explanation: t('A brother is a man, so we say he.', 'Qardaş kişidir, ona görə he.'),
    }),
    mc('a0-01-l01-e03', 'Choose the pronoun for "my mother".', ['he', 'it', 'she'], 2),
    mc('a0-01-l01-e04', 'Choose the pronoun for "a phone".', ['it', 'he', 'they'], 0, {
      explanation: t('Things are it.', 'Əşyalar üçün it işlənir.'),
    }),
    mc('a0-01-l01-e05', 'Choose the pronoun for "Leyla and I".', ['they', 'we', 'you'], 1, {
      explanation: t('"Leyla and I" includes me, so the pronoun is we.', '"Leyla and I" içində mən də varam, deməli we.'),
    }),
    mc('a0-01-l01-e06', 'Choose the pronoun for "Rashad and Nigar".', ['they', 'we', 'he'], 0),
    match(
      'a0-01-l01-e07',
      [
        ['my father', 'he'],
        ['my sister', 'she'],
        ['the car', 'it'],
        ['my friends', 'they'],
        ['you and I', 'we'],
      ],
      { skill: 'grammar', prompt: 'Match each person or thing to its pronoun.' },
    ),
    ord('a0-01-l01-e08', 'I am a student.', {
      hint: t('Start with the subject.', 'Mübtəda ilə başlayın.'),
    }),
    ord('a0-01-l01-e09', 'She is from Baku.'),
    ord('a0-01-l01-e10', 'They are my friends.'),
    mc('a0-01-l01-e11', 'Which sentence is correct?', ['Am a teacher.', 'I am a teacher.', 'Teacher I am.'], 1, {
      explanation: t('English needs the subject: I am a teacher.', 'İngilis dilində mübtəda mütləq deyilir: I am a teacher.'),
    }),
    ec('a0-01-l01-e12', 'am from Ganja.', ['I am from Ganja.', "I'm from Ganja."], {
      hint: t('What is missing at the start?', 'Əvvəldə nə çatmır?'),
      explanation: t('The subject I cannot be left out.', '"I" mübtədası atıla bilməz.'),
    }),
  ],
}

const L02: LessonInput = {
  id: 'a0-01-l02',
  title: 'am, is, are',
  kind: 'grammar',
  estimatedMinutes: 15,
  objectives: ['Choose am, is or are for each subject', 'Use the contractions I’m, you’re, he’s, she’s, it’s, we’re, they’re'],
  blocks: [
    { type: 'heading', text: 'The verb "be" has three present forms' },
    {
      type: 'paragraph',
      text: t(
        'English uses the verb be to say who you are, where you are from, your job, your age and how you feel. It changes with the subject: I am, he / she / it is, you / we / they are.',
        '"Be" feli kim olduğunuzu, haradan olduğunuzu, peşənizi, yaşınızı və halınızı deməyə kömək edir. Azərbaycan dilində bu işi şəkilçilər görür: "O həkimDİR", "Biz tələbəYİK". İngilis dilində ayrıca söz lazımdır: is, are, am.',
      ),
    },
    {
      type: 'table',
      caption: 'am / is / are with contractions',
      columns: ['Subject', 'Full form', 'Short form (speaking)'],
      rows: [
        ['I', 'I am', "I'm"],
        ['you', 'you are', "you're"],
        ['he', 'he is', "he's"],
        ['she', 'she is', "she's"],
        ['it', 'it is', "it's"],
        ['we', 'we are', "we're"],
        ['they', 'they are', "they're"],
      ],
    },
    {
      type: 'examples',
      items: [
        { en: "I'm twenty years old.", az: 'Mənim iyirmi yaşım var.' },
        { en: "He's a doctor.", az: 'O, həkimdir.' },
        { en: "We're from Azerbaijan.", az: 'Biz Azərbaycandanıq.' },
        { en: "It's cold today.", az: 'Bu gün soyuqdur.' },
      ],
    },
    {
      type: 'tip',
      text: t(
        'In conversation people almost always use the short forms. Say "I\'m", not "I am", unless you want to be very clear or emphatic.',
        'Danışıqda demək olar ki, həmişə qısa formalar işlənir: "I\'m", "she\'s". Tam forma ("I am") yalnız xüsusi vurğu üçün deyilir.',
      ),
    },
    {
      type: 'tip',
      tone: 'warning',
      text: t(
        'Jobs need a or an: "I am a teacher", "She is an engineer". Age uses be, not have: "I am 25", never "I have 25".',
        'Peşə deyəndə "a / an" lazımdır: "I am a teacher". Yaş "be" ilə deyilir: "I am 25". "I have 25 years" səhvdir – bu, Azərbaycan dilindən hərfi tərcümədir.',
      ),
    },
  ],
  exercises: [
    fb('a0-01-l02-e01', 'I ___ a student.', ['am'], { wordBank: ['am', 'is', 'are'] }),
    fb('a0-01-l02-e02', 'She ___ a doctor.', ['is'], { wordBank: ['am', 'is', 'are'] }),
    fb('a0-01-l02-e03', 'They ___ from Baku.', ['are'], { wordBank: ['am', 'is', 'are'] }),
    fb('a0-01-l02-e04', 'We ___ friends.', ['are'], { wordBank: ['am', 'is', 'are'] }),
    fb('a0-01-l02-e05', 'It ___ a new phone.', ['is'], { wordBank: ['am', 'is', 'are'] }),
    fb('a0-01-l02-e06', 'You ___ my teacher and he ___ my friend.', ['are', 'is'], {
      wordBank: ['am', 'is', 'are'],
      explanation: t('you → are; he → is.', 'you ilə are, he ilə is işlənir.'),
    }),
    mc('a0-01-l02-e07', 'Choose the correct sentence.', ['I is a student.', 'I am a student.', 'I are a student.'], 1, {
      explanation: t('I always takes am.', '"I" ilə həmişə "am" gəlir.'),
    }),
    mc('a0-01-l02-e08', 'Choose the correct sentence.', ['She is an engineer.', 'She is engineer.', 'She am an engineer.'], 0, {
      explanation: t('Jobs need a or an. Engineer starts with a vowel sound, so: an engineer.', 'Peşə ilə "a / an" lazımdır. "Engineer" sait səslə başlayır, ona görə "an engineer".'),
    }),
    st('a0-01-l02-e09', 'I am from Ganja.', t('Write it with a short form.', 'Qısa forma ilə yazın.'), ["I'm from Ganja."], {
      hint: t("I am → I'm", 'I am → I\'m'),
    }),
    st('a0-01-l02-e10', 'She is my sister.', t('Write it with a short form.', 'Qısa forma ilə yazın.'), ["She's my sister."]),
    st('a0-01-l02-e11', 'They are teachers.', t('Write it with a short form.', 'Qısa forma ilə yazın.'), ["They're teachers."]),
    st('a0-01-l02-e12', "We're happy.", t('Write it with the full form.', 'Tam forma ilə yazın.'), ['We are happy.']),
    ec('a0-01-l02-e13', 'I have 25 years old.', ['I am 25 years old.', "I'm 25 years old.", 'I am 25.', "I'm 25."], {
      hint: t('Age uses the verb be.', 'Yaş "be" feli ilə deyilir.'),
      explanation: t('In English age uses be: I am 25 (years old).', 'İngilis dilində yaş "be" ilə deyilir: I am 25. "have" səhvdir.'),
    }),
    ec('a0-01-l02-e14', 'He are a teacher.', ['He is a teacher.', "He's a teacher."], {
      explanation: t('he takes is.', '"he" ilə "is" işlənir.'),
    }),
    ec('a0-01-l02-e15', 'My mother is doctor.', ['My mother is a doctor.'], {
      hint: t('Something is missing before the job.', 'Peşədən əvvəl bir söz çatmır.'),
    }),
    ord('a0-01-l02-e16', 'My name is Nigar.'),
    ord('a0-01-l02-e17', 'We are from Azerbaijan.'),
    ord('a0-01-l02-e18', 'It is a big city.'),
  ],
}

const L03: LessonInput = {
  id: 'a0-01-l03',
  title: 'Hello! Greetings, countries and jobs',
  kind: 'vocabulary',
  estimatedMinutes: 15,
  objectives: ['Greet people and say goodbye', 'Say your country, nationality and job', 'Understand classroom language'],
  blocks: [
    {
      type: 'vocabulary',
      title: 'Greetings',
      items: [
        { term: 'Hello / Hi', partOfSpeech: 'phrase', definition: 'Greeting at any time. "Hi" is more informal.', translation: 'Salam', example: 'Hi, I\'m Leyla.' },
        { term: 'Good morning', partOfSpeech: 'phrase', definition: 'Greeting before 12:00.', translation: 'Sabahınız xeyir', example: 'Good morning, Mr Aliyev.' },
        { term: 'Good afternoon', partOfSpeech: 'phrase', definition: 'Greeting from 12:00 to about 18:00.', translation: 'Günortanız xeyir' },
        { term: 'Good evening', partOfSpeech: 'phrase', definition: 'Greeting after about 18:00.', translation: 'Axşamınız xeyir' },
        { term: 'How are you?', partOfSpeech: 'phrase', definition: 'A friendly question after hello. Answer: "I\'m fine, thanks. And you?"', translation: 'Necəsən? / Necəsiniz?', example: 'How are you? – I\'m fine, thanks.' },
        { term: 'Nice to meet you', partOfSpeech: 'phrase', definition: 'Say this when you meet someone for the first time.', translation: 'Tanış olmağıma şadam', example: 'Nice to meet you, Rashad.' },
        { term: 'Goodbye / Bye', partOfSpeech: 'phrase', definition: 'When you leave. "Bye" is informal.', translation: 'Sağ olun / Hələlik' },
        { term: 'See you', partOfSpeech: 'phrase', definition: 'Informal goodbye to someone you will meet again.', translation: 'Görüşərik', example: 'See you tomorrow!' },
      ],
    },
    {
      type: 'vocabulary',
      title: 'Countries and nationalities',
      items: [
        { term: 'Azerbaijan → Azerbaijani', partOfSpeech: 'noun', definition: 'Country → nationality. "I am from Azerbaijan. I am Azerbaijani."', translation: 'Azərbaycan → azərbaycanlı' },
        { term: 'Turkey → Turkish', partOfSpeech: 'noun', definition: 'Country → nationality.', translation: 'Türkiyə → türk' },
        { term: 'Russia → Russian', partOfSpeech: 'noun', definition: 'Country → nationality.', translation: 'Rusiya → rus' },
        { term: 'the UK → British', partOfSpeech: 'noun', definition: 'Country → nationality. Note "the".', translation: 'Böyük Britaniya → britaniyalı' },
        { term: 'the USA → American', partOfSpeech: 'noun', definition: 'Country → nationality. Note "the".', translation: 'ABŞ → amerikalı' },
        { term: 'Germany → German', partOfSpeech: 'noun', definition: 'Country → nationality.', translation: 'Almaniya → alman' },
      ],
    },
    {
      type: 'vocabulary',
      title: 'Jobs (always with a / an)',
      items: [
        { term: 'a student', partOfSpeech: 'noun', definition: 'A person who studies at a school or university.', translation: 'tələbə / şagird', example: 'I am a student.' },
        { term: 'a teacher', partOfSpeech: 'noun', definition: 'A person who teaches.', translation: 'müəllim' },
        { term: 'a doctor', partOfSpeech: 'noun', definition: 'A person who helps sick people.', translation: 'həkim' },
        { term: 'an engineer', partOfSpeech: 'noun', definition: 'A person who designs or builds things. Starts with a vowel sound: an.', translation: 'mühəndis', example: 'She is an engineer.' },
        { term: 'a manager', partOfSpeech: 'noun', definition: 'A person who leads a team or a business.', translation: 'menecer' },
        { term: 'a programmer', partOfSpeech: 'noun', definition: 'A person who writes software.', translation: 'proqramçı' },
        { term: 'an accountant', partOfSpeech: 'noun', definition: 'A person who works with money and numbers. Note: an.', translation: 'mühasib' },
      ],
    },
    {
      type: 'vocabulary',
      title: 'Classroom language',
      items: [
        { term: 'Sorry, I don\'t understand.', partOfSpeech: 'phrase', definition: 'Say this when something is not clear.', translation: 'Bağışlayın, başa düşmürəm.' },
        { term: 'Can you repeat that, please?', partOfSpeech: 'phrase', definition: 'Ask someone to say it again.', translation: 'Təkrar edə bilərsiniz?' },
        { term: 'How do you say … in English?', partOfSpeech: 'phrase', definition: 'Ask for a word.', translation: '… ingiliscə necə deyilir?' },
        { term: 'How do you spell it?', partOfSpeech: 'phrase', definition: 'Ask for the letters of a word.', translation: 'Necə yazılır? (hərf-hərf)' },
      ],
    },
    {
      type: 'dialogue',
      title: 'First meeting',
      lines: [
        { speaker: 'Leyla', text: 'Hello! I\'m Leyla. What\'s your name?', az: 'Salam! Mən Leylayam. Adın nədir?' },
        { speaker: 'Tom', text: 'Hi, Leyla. I\'m Tom. Nice to meet you.', az: 'Salam, Leyla. Mən Tomam. Tanış olmağıma şadam.' },
        { speaker: 'Leyla', text: 'Nice to meet you too. Where are you from?', az: 'Mən də. Haradansan?' },
        { speaker: 'Tom', text: 'I\'m from the UK. I\'m a teacher. And you?', az: 'Mən Britaniyadanam. Müəlliməm. Bəs sən?' },
        { speaker: 'Leyla', text: 'I\'m from Baku. I\'m a student.', az: 'Mən Bakıdanam. Tələbəyəm.' },
      ],
    },
  ],
  exercises: [
    match(
      'a0-01-l03-e01',
      [
        ['Good morning', 'before 12:00'],
        ['Good afternoon', '12:00 – 18:00'],
        ['Good evening', 'after 18:00'],
        ['See you', 'an informal goodbye'],
      ],
      { prompt: 'Match the greeting to when you use it.' },
    ),
    match(
      'a0-01-l03-e02',
      [
        ['Azerbaijan', 'Azerbaijani'],
        ['Turkey', 'Turkish'],
        ['the UK', 'British'],
        ['Germany', 'German'],
        ['the USA', 'American'],
      ],
      { prompt: 'Match the country to the nationality.' },
    ),
    fb('a0-01-l03-e03', 'A: Hello, how ___ you?  B: I\'m fine, ___. And you?', ['are', ['thanks', 'thank you']], {
      skill: 'vocabulary',
      wordBank: ['are', 'is', 'thanks', 'hello'],
    }),
    fb('a0-01-l03-e04', 'Nice to ___ you.', ['meet'], { skill: 'vocabulary', wordBank: ['meet', 'see', 'am'] }),
    fb('a0-01-l03-e05', 'I\'m from Turkey. I\'m ___.', ['Turkish'], { skill: 'vocabulary' }),
    mc('a0-01-l03-e06', 'You meet someone for the first time. What do you say?', ['See you!', 'Nice to meet you.', 'Goodbye.'], 1, { skill: 'vocabulary' }),
    mc('a0-01-l03-e07', 'Which job needs "an"?', ['teacher', 'engineer', 'doctor'], 1, {
      skill: 'vocabulary',
      explanation: t('Engineer starts with a vowel sound /e/, so it takes an.', '"Engineer" sait səslə başlayır, ona görə "an".'),
    }),
    mc('a0-01-l03-e08', 'You did not understand. What do you say?', ['How do you spell it?', 'Sorry, I don\'t understand.', 'Nice to meet you.'], 1, { skill: 'vocabulary' }),
    fb('a0-01-l03-e09', 'He works with money. He is an ___.', ['accountant'], { skill: 'vocabulary' }),
    fb('a0-01-l03-e10', 'She writes software. She is a ___.', ['programmer'], { skill: 'vocabulary' }),
    ord('a0-01-l03-e11', 'Where are you from?', { skill: 'vocabulary' }),
    ord('a0-01-l03-e12', 'Can you repeat that, please?', { skill: 'vocabulary' }),
  ],
}

const L04: LessonInput = {
  id: 'a0-01-l04',
  title: "Negatives: I'm not, isn't, aren't",
  kind: 'grammar',
  estimatedMinutes: 12,
  objectives: ['Make negative sentences with be', 'Use the short forms isn’t and aren’t'],
  blocks: [
    { type: 'heading', text: 'Put "not" after am / is / are' },
    {
      type: 'paragraph',
      text: t(
        'To make a sentence negative, add not after the verb be: I am not, he is not, they are not. In speaking we use short forms: I\'m not, he isn\'t, they aren\'t.',
        'İnkar üçün am / is / are-dan SONRA "not" əlavə edilir. Azərbaycan dilində inkar "deyil" sözü ilə düzəlir və cümlənin sonunda gəlir: "O həkim deyil". İngiliscə "not" felin yanındadır: "He is not a doctor" → qısa: "He isn\'t a doctor".',
      ),
    },
    {
      type: 'table',
      caption: 'Negative forms',
      columns: ['Full form', 'Short form 1', 'Short form 2'],
      rows: [
        ['I am not', "I'm not", '—'],
        ['you are not', "you're not", "you aren't"],
        ['he is not', "he's not", "he isn't"],
        ['she is not', "she's not", "she isn't"],
        ['it is not', "it's not", "it isn't"],
        ['we are not', "we're not", "we aren't"],
        ['they are not', "they're not", "they aren't"],
      ],
    },
    {
      type: 'examples',
      items: [
        { en: "I'm not a teacher. I'm a student.", az: 'Mən müəllim deyiləm. Tələbəyəm.' },
        { en: "She isn't from Baku. She's from Ganja.", az: 'O, Bakıdan deyil. Gəncədəndir.' },
        { en: "We aren't tired.", az: 'Biz yorğun deyilik.' },
      ],
    },
    {
      type: 'tip',
      tone: 'warning',
      text: t(
        'There is no "amn\'t". With I, say "I\'m not".',
        '"amn\'t" forması yoxdur. "I" ilə yalnız "I\'m not" deyilir.',
      ),
    },
  ],
  exercises: [
    st('a0-01-l04-e01', 'I am a teacher.', t('Make it negative.', 'İnkar edin.'), ['I am not a teacher.', "I'm not a teacher."], {
      hint: t('Add not after am.', '"am"-dan sonra "not" əlavə edin.'),
    }),
    st('a0-01-l04-e02', 'She is from Baku.', t('Make it negative.', 'İnkar edin.'), ['She is not from Baku.', "She isn't from Baku.", "She's not from Baku."]),
    st('a0-01-l04-e03', 'They are students.', t('Make it negative.', 'İnkar edin.'), ['They are not students.', "They aren't students.", "They're not students."]),
    st('a0-01-l04-e04', 'It is cold.', t('Make it negative with a short form.', 'Qısa forma ilə inkar edin.'), ["It isn't cold.", "It's not cold."]),
    st('a0-01-l04-e05', 'We are late.', t('Make it negative with a short form.', 'Qısa forma ilə inkar edin.'), ["We aren't late.", "We're not late."]),
    fb('a0-01-l04-e06', 'He ___ a doctor. He is an engineer.', [['isn\'t', 'is not', '\'s not']], {
      hint: t('Negative of "is".', '"is"-in inkarı.'),
    }),
    fb('a0-01-l04-e07', "I ___ not tired. I'm fine.", ['am'], { wordBank: ['am', 'is', 'are'] }),
    fb('a0-01-l04-e08', 'They ___ from Turkey. They are from Russia.', [["aren't", 'are not', "'re not"]]),
    mc('a0-01-l04-e09', 'Choose the correct negative.', ["I amn't a student.", "I'm not a student.", 'I not a student.'], 1, {
      explanation: t('There is no amn\'t; use I\'m not.', '"amn\'t" yoxdur; "I\'m not" deyilir.'),
    }),
    mc('a0-01-l04-e10', 'Choose the correct negative.', ['She not is happy.', 'She isn\'t happy.', 'She don\'t happy.'], 1, {
      explanation: t('not goes after is: She isn\'t happy.', '"not" "is"-dən sonra gəlir: She isn\'t happy.'),
    }),
    ec('a0-01-l04-e11', 'We not are from Baku.', ['We are not from Baku.', "We aren't from Baku.", "We're not from Baku."], {
      hint: t('Word order: are + not.', 'Söz sırası: are + not.'),
    }),
    ec('a0-01-l04-e12', 'He no is a teacher.', ['He is not a teacher.', "He isn't a teacher.", "He's not a teacher."], {
      explanation: t('Use not, not "no", and put it after is.', '"no" yox, "not" işlənir və "is"-dən sonra gəlir.'),
    }),
    ord('a0-01-l04-e13', "I'm not from Baku."),
    ord('a0-01-l04-e14', "They aren't teachers."),
  ],
}

const L05: LessonInput = {
  id: 'a0-01-l05',
  title: 'Questions and short answers',
  kind: 'grammar',
  estimatedMinutes: 15,
  objectives: ['Make yes/no questions by moving be before the subject', 'Give short answers', 'Ask what, where and who questions with be'],
  blocks: [
    { type: 'heading', text: 'Yes / no questions: move the verb first' },
    {
      type: 'paragraph',
      text: t(
        'To ask a question, put am / is / are before the subject: "You are tired." → "Are you tired?" Your voice goes up at the end.',
        'Sual üçün am / is / are mübtədanın QABAĞINA keçir: "You are tired." → "Are you tired?". Azərbaycan dilində sual "-mı / -mi" şəkilçisi ilə düzəlir və söz sırası dəyişmir. İngiliscə şəkilçi yoxdur, söz sırası dəyişir.',
      ),
    },
    {
      type: 'table',
      caption: 'Statement → question',
      columns: ['Statement', 'Question'],
      rows: [
        ['I am late.', 'Am I late?'],
        ['You are a student.', 'Are you a student?'],
        ['He is from Baku.', 'Is he from Baku?'],
        ['It is cold.', 'Is it cold?'],
        ['They are teachers.', 'Are they teachers?'],
      ],
    },
    { type: 'heading', text: 'Short answers' },
    {
      type: 'table',
      columns: ['Question', 'Yes', 'No'],
      rows: [
        ['Are you a student?', 'Yes, I am.', "No, I'm not."],
        ['Is she a doctor?', 'Yes, she is.', "No, she isn't."],
        ['Are they from Baku?', 'Yes, they are.', "No, they aren't."],
        ['Is it new?', 'Yes, it is.', "No, it isn't."],
      ],
    },
    {
      type: 'tip',
      tone: 'warning',
      text: t(
        'Do not contract a positive short answer: "Yes, I am." never "Yes, I\'m."',
        'Müsbət qısa cavabda qısa forma işlənmir: "Yes, I am." deyilir, "Yes, I\'m." səhvdir.',
      ),
    },
    { type: 'heading', text: 'What, where, who' },
    {
      type: 'examples',
      items: [
        { en: 'What is your name? – My name is Nigar.', az: 'Adın nədir? – Adım Nigardır.' },
        { en: 'Where are you from? – I\'m from Baku.', az: 'Haradansan? – Bakıdanam.' },
        { en: 'Who is she? – She is my sister.', az: 'O kimdir? – O, mənim bacımdır.' },
        { en: "What's this? – It's a pen.", az: 'Bu nədir? – Bu qələmdir.' },
      ],
    },
    {
      type: 'paragraph',
      text: t(
        'The question word comes first, then be, then the subject: What + is + your name?',
        'Sual sözü əvvəl gəlir, sonra be, sonra mübtəda: What + is + your name? "What\'s" = "What is".',
      ),
    },
  ],
  exercises: [
    qf('a0-01-l05-e01', 'You are a student.', ['Are you a student?'], {
      hint: t('Move "are" to the front.', '"are" sözünü əvvələ keçirin.'),
    }),
    qf('a0-01-l05-e02', 'She is from Ganja.', ['Is she from Ganja?']),
    qf('a0-01-l05-e03', 'They are teachers.', ['Are they teachers?']),
    qf('a0-01-l05-e04', 'It is cold today.', ['Is it cold today?']),
    qf('a0-01-l05-e05', 'he / a doctor ?', ['Is he a doctor?'], {
      instruction: t('Make a question from the words.', 'Sözlərdən sual düzəldin.'),
    }),
    qf('a0-01-l05-e06', 'you / from Baku ?', ['Are you from Baku?']),
    qf('a0-01-l05-e07', 'what / your name ?', ['What is your name?', "What's your name?"]),
    qf('a0-01-l05-e08', 'where / they / from ?', ['Where are they from?']),
    qf('a0-01-l05-e09', 'who / she ?', ['Who is she?', "Who's she?"]),
    mc('a0-01-l05-e10', 'Is she a teacher? – Yes, ___', ['she is.', "she's.", 'is she.'], 0, {
      explanation: t('Positive short answers use the full form: Yes, she is.', 'Müsbət qısa cavab tam formada olur: Yes, she is.'),
    }),
    mc('a0-01-l05-e11', 'Are you from Turkey? – No, ___', ["I'm not.", 'I not.', "I amn't."], 0),
    mc('a0-01-l05-e12', 'Are they students? – No, ___', ["they aren't.", 'they not.', "they isn't."], 0),
    fb('a0-01-l05-e13', '___ is your name? – My name is Rashad.', ['What'], { wordBank: ['What', 'Where', 'Who'] }),
    fb('a0-01-l05-e14', '___ are you from? – I\'m from Sumgait.', ['Where'], { wordBank: ['What', 'Where', 'Who'] }),
    fb('a0-01-l05-e15', '___ is he? – He is my brother.', ['Who'], { wordBank: ['What', 'Where', 'Who'] }),
    ord('a0-01-l05-e16', 'Where are you from?'),
    ord('a0-01-l05-e17', 'Is she your sister?'),
    ec('a0-01-l05-e18', 'You are a doctor?', ['Are you a doctor?'], {
      hint: t('Questions start with the verb.', 'Sual fellə başlayır.'),
      explanation: t('Move are to the front: Are you a doctor?', '"are" əvvələ keçir: Are you a doctor?'),
    }),
    ec('a0-01-l05-e19', 'Where you are from?', ['Where are you from?'], {
      explanation: t('After the question word, be comes before the subject.', 'Sual sözündən sonra be mübtədadan əvvəl gəlir.'),
    }),
  ],
}

const L06: LessonInput = {
  id: 'a0-01-l06',
  title: 'The alphabet: spell your name',
  kind: 'pronunciation',
  estimatedMinutes: 10,
  objectives: ['Say the 26 letters', 'Spell your name and your city', 'Group letters by their vowel sound'],
  blocks: [
    {
      type: 'paragraph',
      text: t(
        'You will spell your name on the phone, in a hotel and in every form. Letters are grouped by the sound you hear when you say them.',
        'Adınızı telefonda, oteldə və hər formada hərf-hərf deməli olacaqsınız. Hərflər deyilişdəki sait səsinə görə qruplaşdırılır – bu, yadda saxlamağı asanlaşdırır.',
      ),
    },
    {
      type: 'table',
      caption: 'Letters grouped by sound',
      columns: ['Sound', 'Letters', 'Say it like'],
      rows: [
        ['/eɪ/ as in "day"', 'A H J K', 'ay · aych · jay · kay'],
        ['/iː/ as in "see"', 'B C D E G P T V', 'bee · see · dee · ee · jee · pee · tee · vee'],
        ['/e/ as in "bed"', 'F L M N S X Z', 'ef · el · em · en · es · ex · zed'],
        ['/aɪ/ as in "my"', 'I Y', 'eye · wye'],
        ['/əʊ/ as in "go"', 'O', 'oh'],
        ['/uː/ as in "you"', 'Q U W', 'kyoo · yoo · double-yoo'],
        ['/ɑː/ as in "car"', 'R', 'ar'],
      ],
    },
    {
      type: 'tip',
      text: t(
        'Azerbaijani speakers often mix E and I: English E is "ee" and I is "eye". Also G is "jee", J is "jay".',
        'Ən çox qarışan hərflər: E ("ii" kimi) və I ("ay" kimi). G "cii", J "cey" kimi deyilir. Y hərfi "vay" kimi səslənir.',
      ),
    },
    {
      type: 'dialogue',
      title: 'Spelling on the phone',
      lines: [
        { speaker: 'Receptionist', text: 'What\'s your name, please?' },
        { speaker: 'Nigar', text: 'Nigar Hasanova.' },
        { speaker: 'Receptionist', text: 'How do you spell it?' },
        { speaker: 'Nigar', text: 'N-I-G-A-R, H-A-S-A-N-O-V-A.' },
        { speaker: 'Receptionist', text: 'Thank you.' },
      ],
    },
  ],
  exercises: [
    mc('a0-01-l06-e01', 'Which letter sounds like "eye"?', ['E', 'I', 'A'], 1, { skill: 'pronunciation' }),
    mc('a0-01-l06-e02', 'Which letter sounds like "jee"?', ['G', 'J', 'C'], 0, { skill: 'pronunciation' }),
    mc('a0-01-l06-e03', 'Which letter sounds like "jay"?', ['G', 'J', 'Y'], 1, { skill: 'pronunciation' }),
    mc('a0-01-l06-e04', 'Which letter does NOT have the "ee" sound?', ['B', 'D', 'F'], 2, {
      skill: 'pronunciation',
      explanation: t('F is "ef" (the /e/ group).', 'F "ef" kimi deyilir (/e/ qrupu).'),
    }),
    match(
      'a0-01-l06-e05',
      [
        ['A H J K', '/eɪ/ "day"'],
        ['B C D E', '/iː/ "see"'],
        ['F L M N', '/e/ "bed"'],
        ['I Y', '/aɪ/ "my"'],
        ['Q U W', '/uː/ "you"'],
      ],
      { skill: 'pronunciation', prompt: 'Match the letters to their sound group.' },
    ),
    fb('a0-01-l06-e06', 'How do you ___ it? – B-A-K-U.', ['spell'], { skill: 'pronunciation', wordBank: ['spell', 'say', 'write'] }),
    sp(
      'a0-01-l06-e07',
      t('Say the alphabet from A to Z. Use the sound groups to check yourself.', 'Əlifbanı A-dan Z-yə deyin. Səs qruplarına baxaraq özünüzü yoxlayın.'),
      'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
      ['I said all 26 letters', 'E was "ee" and I was "eye"', 'G was "jee" and J was "jay"'],
    ),
    sp(
      'a0-01-l06-e08',
      t('Spell your first name and your family name aloud, letter by letter.', 'Adınızı və soyadınızı hərf-hərf deyin.'),
      'N-I-G-A-R, H-A-S-A-N-O-V-A.',
      ['I said each letter clearly', 'I paused between the two names'],
      { variations: ['Now spell the name of your city.', 'Now spell your email address (say "at" and "dot").'] },
    ),
  ],
}

const L07: LessonInput = {
  id: 'a0-01-l07',
  title: 'Speaking: introduce yourself',
  kind: 'speaking',
  estimatedMinutes: 15,
  objectives: ['Introduce yourself in five sentences', 'Use contractions naturally', 'Say sentences about other people'],
  blocks: [
    {
      type: 'paragraph',
      text: t(
        'Say each sentence aloud, then compare with the model. Change the words so the sentence is true for you. Speaking in this lesson is self-checked: nothing is recorded.',
        'Hər cümləni ucadan deyin, sonra nümunə ilə müqayisə edin. Sözləri dəyişin ki, cümlə sizin üçün doğru olsun. Bu dərsdə danışıq özünüz tərəfindən yoxlanılır; heç nə yazılmır.',
      ),
    },
    {
      type: 'examples',
      title: 'A model introduction',
      items: [
        { en: "Hi, I'm Leyla." },
        { en: "I'm from Baku, in Azerbaijan." },
        { en: "I'm 24 years old." },
        { en: "I'm a student." },
        { en: "I'm happy to be here." },
      ],
    },
  ],
  exercises: [
    sp('a0-01-l07-e01', t('Say your name.', 'Adınızı deyin.'), "Hi, I'm Leyla.", ['I used "I\'m"', 'I said my real name'], { cue: 'Hi, I\'m …' }),
    sp('a0-01-l07-e02', t('Say where you are from: city and country.', 'Haradan olduğunuzu deyin: şəhər və ölkə.'), "I'm from Baku, in Azerbaijan.", ['I used "from"', 'I said the city and the country'], { cue: "I'm from …" }),
    sp('a0-01-l07-e03', t('Say your age.', 'Yaşınızı deyin.'), "I'm 24 years old.", ['I used "I\'m", not "I have"', 'I said the number clearly'], { cue: "I'm … years old." }),
    sp('a0-01-l07-e04', t('Say your job or that you are a student.', 'Peşənizi və ya tələbə olduğunuzu deyin.'), "I'm a programmer.", ['I used "a" or "an" before the job', 'I used "I\'m"'], { cue: "I'm a / an …" }),
    sp('a0-01-l07-e05', t('Say how you feel today.', 'Bu gün özünüzü necə hiss etdiyinizi deyin.'), "I'm fine, thanks. I'm a little tired.", ['I used "I\'m"', 'I added one more detail'], { cue: "I'm … today." }),
    sp(
      'a0-01-l07-e06',
      t('Now say all five sentences together, without stopping. Aim for 20 seconds.', 'İndi beş cümləni dayanmadan bir yerdə deyin. Təxminən 20 saniyə.'),
      "Hi, I'm Leyla. I'm from Baku, in Azerbaijan. I'm 24 years old. I'm a student. I'm happy to be here.",
      ['I said five sentences', 'I did not stop for more than three seconds', 'Every sentence had "I\'m"'],
    ),
    sp(
      'a0-01-l07-e07',
      t('Talk about a friend: name, city, job. Use "he" or "she".', 'Bir dostunuz haqqında danışın: ad, şəhər, peşə. "he" və ya "she" işlədin.'),
      "This is my friend Rashad. He's from Ganja. He's an engineer.",
      ['I chose "he" or "she" correctly', 'I used "He\'s" / "She\'s"', 'I said three sentences'],
      { variations: ['Now talk about a woman in your family.', 'Now talk about two friends with "they\'re".'] },
    ),
    sp(
      'a0-01-l07-e08',
      t('Say two sentences that are NOT true about you, with "I\'m not".', '"I\'m not" ilə özünüz haqqında iki yalan cümlə deyin.'),
      "I'm not a doctor. I'm not from London.",
      ['I used "I\'m not"', 'Both sentences were really false'],
    ),
    sp(
      'a0-01-l07-e09',
      t('Describe the room you are in with "It\'s": size, temperature, colour.', 'Olduğunuz otağı "It\'s" ilə təsvir edin: ölçü, temperatur, rəng.'),
      "It's a small room. It's warm. It's white and blue.",
      ['I used "It\'s" three times', 'I used three different words'],
    ),
  ],
}

const L08: LessonInput = {
  id: 'a0-01-l08',
  title: 'Speaking: meet three people',
  kind: 'speaking',
  estimatedMinutes: 15,
  objectives: ['Ask and answer the four basic questions', 'Give short answers quickly', 'Keep a 30-second conversation going'],
  blocks: [
    {
      type: 'dialogue',
      title: 'Model conversation',
      lines: [
        { speaker: 'A', text: 'Hi! I\'m Sam. What\'s your name?' },
        { speaker: 'B', text: 'Hello, Sam. I\'m Nigar. Nice to meet you.' },
        { speaker: 'A', text: 'Nice to meet you too. Where are you from?' },
        { speaker: 'B', text: 'I\'m from Baku. And you? Are you from the UK?' },
        { speaker: 'A', text: 'No, I\'m not. I\'m from the USA. Are you a student?' },
        { speaker: 'B', text: 'Yes, I am. Are you a teacher?' },
        { speaker: 'A', text: 'Yes, I am. See you in class!' },
      ],
    },
    {
      type: 'tip',
      text: t(
        'Read both parts aloud: first A, then B. Then cover B\'s lines and answer with your own information.',
        'Hər iki rolu ucadan oxuyun: əvvəl A, sonra B. Sonra B-nin sətirlərini örtün və öz məlumatınızla cavab verin.',
      ),
    },
  ],
  exercises: [
    sp('a0-01-l08-e01', t('Ask someone their name.', 'Kiminsə adını soruşun.'), "What's your name?", ['My voice went up at the end', 'I used "What\'s"'], { cue: 'What / your name ?' }),
    sp('a0-01-l08-e02', t('Ask where someone is from.', 'Haradan olduğunu soruşun.'), 'Where are you from?', ['Order: Where + are + you', 'I said "from" at the end'], { cue: 'Where / you from ?' }),
    sp('a0-01-l08-e03', t('Ask if someone is a student.', 'Tələbə olub-olmadığını soruşun.'), 'Are you a student?', ['I started with "Are"', 'I used "a"'], { variations: ['Ask if someone is a teacher.', 'Ask if someone is from Baku.', 'Ask if someone is tired.'] }),
    sp('a0-01-l08-e04', t('Answer "Are you a doctor?" with a true short answer.', '"Are you a doctor?" sualına doğru qısa cavab verin.'), "No, I'm not. I'm a student.", ['I gave a short answer first', 'I added one more sentence'], { variations: ['Are you from Azerbaijan?', 'Are you 30 years old?', 'Are you happy today?'] }),
    sp('a0-01-l08-e05', t('Read the model conversation aloud. Say both parts.', 'Nümunə dialoqu ucadan oxuyun. Hər iki rolu deyin.'), 'Hi! I\'m Sam. What\'s your name? – Hello, Sam. I\'m Nigar…', ['I read all seven lines', 'My voice went up on questions'], { cue: 'Model conversation above' }),
    sp(
      'a0-01-l08-e06',
      t('Now cover B\'s lines and answer A with your own information.', 'İndi B-nin sətirlərini örtün və A-ya öz məlumatınızla cavab verin.'),
      "Hello, Sam. I'm Nigar. Nice to meet you. / I'm from Baku. And you? / Yes, I am. Are you a teacher?",
      ['I answered every question', 'I asked at least one question back', 'I did not read B\'s lines'],
    ),
    sp(
      'a0-01-l08-e07',
      t('Imagine you meet a new colleague called Anna from Germany. Ask her three questions and say what you learn: "She\'s…".', 'Təsəvvür edin ki, Almaniyadan Anna adlı yeni həmkarla tanış olursunuz. Ona üç sual verin və öyrəndiyinizi deyin: "She\'s…".'),
      "Hi Anna, where are you from? Are you an engineer? Are you new here? – She's from Germany. She's an engineer. She's new.",
      ['I asked three questions', 'I used "She\'s" three times'],
    ),
    sp(
      'a0-01-l08-e08',
      t('Introduce two friends to each other with "This is…". Then say one sentence about each with "He\'s" / "She\'s".', 'İki dostu bir-birinə "This is…" ilə tanış edin. Sonra hər biri haqqında "He\'s" / "She\'s" ilə bir cümlə deyin.'),
      "Leyla, this is Rashad. Rashad, this is Leyla. He's a programmer. She's a doctor.",
      ['I used "This is" twice', 'I used "He\'s" and "She\'s"'],
    ),
    sp(
      'a0-01-l08-e09',
      t('Talk for 30 seconds: your name, where you are from, your job, how you feel, and one question for your tutor.', '30 saniyə danışın: adınız, haradan olduğunuz, peşəniz, halınız və tutorunuza bir sual.'),
      "Hi, I'm Rashad. I'm from Ganja. I'm a programmer. I'm a bit tired today. Are you from Baku?",
      ['I spoke for about 30 seconds', 'I ended with a question', 'I used contractions'],
    ),
  ],
}

const L09: LessonInput = {
  id: 'a0-01-l09',
  title: 'Reading: meet Leyla and Rashad',
  kind: 'reading',
  estimatedMinutes: 10,
  objectives: ['Understand a short text about two people', 'Find specific information'],
  blocks: [
    {
      type: 'passage',
      title: 'Two students',
      paragraphs: [
        "Hello! My name is Leyla. I'm 24 years old and I'm from Baku. I'm a student at Baku State University. My favourite subject is history. I'm not married. My best friend is Rashad.",
        "Rashad is 26. He isn't from Baku; he's from Ganja. He's a programmer at a small company. His office is in the city centre. It's a new office and it's very big. Rashad is a good friend, and he's very funny.",
        "We aren't in the same city now, but we're on the phone every day. Rashad's English is good. My English is OK, but I'm a little shy. Our tutor is from London. She's very friendly.",
      ],
    },
  ],
  exercises: [
    mc('a0-01-l09-e01', 'How old is Leyla?', ['24', '26', '22'], 0, { skill: 'reading' }),
    mc('a0-01-l09-e02', 'Where is Rashad from?', ['Baku', 'Ganja', 'London'], 1, { skill: 'reading' }),
    mc('a0-01-l09-e03', 'What is Rashad\'s job?', ['He is a student.', 'He is a programmer.', 'He is a tutor.'], 1, { skill: 'reading' }),
    mc('a0-01-l09-e04', 'Is Leyla married?', ['Yes, she is.', "No, she isn't.", 'The text does not say.'], 1, { skill: 'reading' }),
    mc('a0-01-l09-e05', 'Rashad\'s office is …', ['small and old.', 'new and very big.', 'in Baku.'], 1, { skill: 'reading' }),
    mc('a0-01-l09-e06', 'Where is the tutor from?', ['Ganja', 'Baku', 'London'], 2, { skill: 'reading' }),
    fb('a0-01-l09-e07', "Leyla's favourite subject is ___.", ['history'], { skill: 'reading' }),
    fb('a0-01-l09-e08', 'Leyla and Rashad are on the ___ every day.', ['phone'], { skill: 'reading' }),
    mc('a0-01-l09-e09', 'Which sentence is true?', ['Leyla and Rashad are in the same city.', 'Leyla is a little shy.', 'The tutor is a man.'], 1, {
      skill: 'reading',
      explanation: t('"My English is OK, but I\'m a little shy." The tutor is "she", and they aren\'t in the same city.', 'Mətn deyir: "I\'m a little shy". Tutor qadındır ("she"), və onlar eyni şəhərdə deyillər.'),
    }),
  ],
}

const L10: LessonInput = {
  id: 'a0-01-l10',
  title: 'Writing: all about you',
  kind: 'writing',
  estimatedMinutes: 10,
  objectives: ['Write five or more sentences about yourself', 'Use am / is / are, a negative and a contraction'],
  blocks: [
    {
      type: 'paragraph',
      text: t(
        'Write a short paragraph about yourself. The checklist below is checked automatically for the required pieces; your tutor reads the rest.',
        'Özünüz haqqında qısa bir abzas yazın. Aşağıdakı siyahı avtomatik yoxlanılır; qalanını tutorunuz oxuyur.',
      ),
    },
    {
      type: 'examples',
      title: 'Model',
      items: [
        {
          en: "Hi! My name is Nigar. I'm 22 years old and I'm from Sumgait. I'm a student. I'm not married. My best friend is Aysel. She's a teacher and she's very kind. We're from the same city.",
        },
      ],
    },
  ],
  exercises: [
    gw(
      'a0-01-l10-e01',
      t('Write about yourself: name, age, city, job, one negative sentence, and one sentence about a friend or family member.', 'Özünüz haqqında yazın: ad, yaş, şəhər, peşə, bir inkar cümlə və bir dost və ya ailə üzvü haqqında bir cümlə.'),
      40,
      [
        { label: 'Your name with "My name is" or "I\'m"', anyOf: ['my name is', "i'm", 'i am'] },
        { label: 'Where you are from', anyOf: ['from'] },
        { label: 'Your age with "years old"', anyOf: ['years old'] },
        { label: 'A negative with "not" / "n\'t"', anyOf: ["i'm not", 'am not', "isn't", "aren't", 'is not', 'are not'] },
        { label: 'A sentence about someone else with "he\'s", "she\'s" or "is"', anyOf: ["he's", "she's", 'he is', 'she is'] },
      ],
      {
        hint: t('Follow the model: five short sentences are enough.', 'Nümunəyə uyğun yazın: beş qısa cümlə kifayətdir.'),
        modelAnswer:
          "Hi! My name is Nigar. I'm 22 years old and I'm from Sumgait. I'm a student. I'm not married. My best friend is Aysel. She's a teacher.",
      },
    ),
  ],
}

const L11: LessonInput = {
  id: 'a0-01-l11',
  title: 'Chapter check',
  kind: 'assessment',
  estimatedMinutes: 15,
  objectives: ['Show you can use subject pronouns and am / is / are in statements, negatives and questions'],
  blocks: [
    {
      type: 'paragraph',
      text: t(
        'Twenty questions, one attempt each. You need 80% to complete the chapter. Explanations appear at the end.',
        'İyirmi sual, hər birinə bir cəhd. Fəsli bitirmək üçün 80% lazımdır. İzahlar sonda göstərilir.',
      ),
    },
  ],
  exercises: [
    mc('a0-01-l11-e01', 'Choose the pronoun for "my father".', ['she', 'he', 'it'], 1),
    mc('a0-01-l11-e02', 'Choose the pronoun for "Leyla and Nigar".', ['we', 'they', 'you'], 1),
    fb('a0-01-l11-e03', 'I ___ a student.', ['am']),
    fb('a0-01-l11-e04', 'She ___ from Ganja.', ['is']),
    fb('a0-01-l11-e05', 'We ___ friends.', ['are']),
    fb('a0-01-l11-e06', 'It ___ a big city.', ['is']),
    st('a0-01-l11-e07', 'He is a doctor.', t('Make it negative.', 'İnkar edin.'), ['He is not a doctor.', "He isn't a doctor.", "He's not a doctor."]),
    st('a0-01-l11-e08', 'They are from Turkey.', t('Make it negative.', 'İnkar edin.'), ['They are not from Turkey.', "They aren't from Turkey.", "They're not from Turkey."]),
    st('a0-01-l11-e09', 'I am tired.', t('Write it with a short form.', 'Qısa forma ilə yazın.'), ["I'm tired."]),
    qf('a0-01-l11-e10', 'You are a teacher.', ['Are you a teacher?']),
    qf('a0-01-l11-e11', 'She is from Baku.', ['Is she from Baku?']),
    qf('a0-01-l11-e12', 'where / you / from ?', ['Where are you from?']),
    qf('a0-01-l11-e13', 'what / his name ?', ['What is his name?', "What's his name?"]),
    mc('a0-01-l11-e14', 'Are you from Azerbaijan? – Yes, ___', ['I am.', "I'm.", 'am I.'], 0),
    mc('a0-01-l11-e15', 'Is he a student? – No, ___', ["he isn't.", 'he not.', "he aren't."], 0),
    ec('a0-01-l11-e16', 'I have 30 years old.', ['I am 30 years old.', "I'm 30 years old.", 'I am 30.', "I'm 30."]),
    ec('a0-01-l11-e17', 'She is engineer.', ['She is an engineer.', "She's an engineer."]),
    ord('a0-01-l11-e18', 'My sister is a doctor.'),
    ord('a0-01-l11-e19', 'Are they from Baku?'),
    match(
      'a0-01-l11-e20',
      [
        ['Good morning', 'before 12:00'],
        ['Nice to meet you', 'first meeting'],
        ['See you', 'goodbye'],
        ['How do you spell it?', 'asking for letters'],
      ],
      { prompt: 'Match the phrase to its use.' },
    ),
  ],
}

export const A0_01: ChapterInput = {
  id: 'a0-01',
  level: 'A0',
  number: 1,
  title: 'Sentence structure, subject pronouns and am / is / are',
  description: 'Build your first English sentences, introduce yourself, say no, and ask simple questions.',
  objectives: [
    'Build subject + verb sentences and use the seven subject pronouns',
    'Use am / is / are with contractions in statements, negatives and questions',
    'Greet people, say your country, nationality and job, and spell your name',
    'Introduce yourself and ask a new person four basic questions',
  ],
  prerequisites: [],
  skills: ['grammar', 'vocabulary', 'pronunciation', 'speaking', 'reading', 'writing'],
  version: 1,
  status: 'authored',
  completion: { passMark: 80, requireAssessment: true, requireSpeaking: true },
  lessons: [L01, L02, L03, L04, L05, L06, L07, L08, L09, L10, L11],
}
