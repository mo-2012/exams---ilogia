/**
 * iLogia Exams — seed: subjects, topics, and a real exam bank (Arabic content).
 * Run with: npx tsx db/seed.ts
 * Idempotent: skips seeding when subjects already exist.
 */
import { getDb } from "../api/queries/connection";
import { exams, questionOptions, questions, subjects, topics } from "./schema";

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const db = getDb();
  const existing = await db.select().from(subjects).limit(1);
  if (existing.length) {
    console.log("Seed skipped — subjects already exist.");
    return;
  }

  // ---- subjects -------------------------------------------------------------
  const subjectDefs = [
    { nameAr: "الرياضيات", nameEn: "Mathematics", icon: "calculate", sortOrder: 1 },
    { nameAr: "الفيزياء", nameEn: "Physics", icon: "science", sortOrder: 2 },
    { nameAr: "الكيمياء", nameEn: "Chemistry", icon: "labs", sortOrder: 3 },
    { nameAr: "الأحياء", nameEn: "Biology", icon: "genetics", sortOrder: 4 },
    { nameAr: "اللغة العربية", nameEn: "Arabic", icon: "menu_book", sortOrder: 5 },
    { nameAr: "اللغة الإنجليزية", nameEn: "English", icon: "translate", sortOrder: 6 },
  ];
  const subjectIds: Record<string, number> = {};
  for (const s of subjectDefs) {
    const [row] = await db.insert(subjects).values(s).$returningId();
    subjectIds[s.nameEn] = row.id;
  }

  // ---- topics ----------------------------------------------------------------
  const topicDefs: Array<[string, string, string]> = [
    // [subjectEn, nameAr, nameEn]
    ["Mathematics", "الجبر", "Algebra"],
    ["Mathematics", "الهندسة", "Geometry"],
    ["Mathematics", "التفاضل", "Calculus"],
    ["Physics", "الميكانيكا", "Mechanics"],
    ["Physics", "الكهرباء", "Electricity"],
    ["Chemistry", "الكيمياء العضوية", "Organic Chemistry"],
    ["Chemistry", "الاتزان الكيميائي", "Chemical Equilibrium"],
    ["Biology", "الخلية", "The Cell"],
    ["Arabic", "النحو", "Grammar"],
    ["English", "Grammar", "Grammar"],
  ];
  const topicIds: Record<string, number> = {};
  for (const [subj, nameAr, nameEn] of topicDefs) {
    const [row] = await db
      .insert(topics)
      .values({ subjectId: subjectIds[subj], nameAr, nameEn })
      .$returningId();
    topicIds[`${subj}/${nameEn}`] = row.id;
  }

  // ---- exams + questions -------------------------------------------------------
  type Opt = { text: string; correct?: boolean };
  type Q = {
    type: "mcq_single" | "mcq_multi" | "true_false" | "text";
    text: string;
    marks?: number;
    difficulty?: "easy" | "medium" | "hard";
    explanation?: string;
    options?: Opt[];
  };
  type ExamDef = {
    title: string;
    subject: string;
    topic?: string;
    description: string;
    instructions?: string;
    difficulty: "easy" | "medium" | "hard";
    durationMinutes: number;
    passingScore?: number;
    maxAttempts: number;
    status: "published" | "closed" | "draft";
    reviewPolicy: "immediate" | "after_close" | "never";
    multiSelectScoring?: "all_or_nothing" | "partial";
    startsInDays?: number; // negative = already started
    endsInDays?: number;
    questions: Q[];
  };

  const examDefs: ExamDef[] = [
    {
      title: "المعادلات التربيعية — اختبار قصير",
      subject: "Mathematics",
      topic: "Algebra",
      description:
        "اختبار قصير يقيس إتقان حل المعادلات التربيعية وخصائص الجذور والمميز.",
      instructions:
        "اقرأ كل سؤال بعناية قبل الإجابة. يمكنك التنقل بين الأسئلة ووضع علامة مراجعة. تُحفظ إجاباتك تلقائيًا. يُحتسب الناتج تلقائيًا فور التسليم.",
      difficulty: "medium",
      durationMinutes: 20,
      passingScore: 60,
      maxAttempts: 2,
      status: "published",
      reviewPolicy: "immediate",
      multiSelectScoring: "partial",
      questions: [
        {
          type: "mcq_single",
          text: "ما مجموع جذري المعادلة التربيعية: س² − 5س + 6 = 0؟",
          marks: 1,
          difficulty: "easy",
          explanation: "مجموع الجذور = −ب/أ = −(−5)/1 = 5.",
          options: [
            { text: "5", correct: true },
            { text: "6" },
            { text: "-5" },
            { text: "11" },
          ],
        },
        {
          type: "mcq_single",
          text: "إذا كان مميز المعادلة أس² + ب س + جـ = 0 يساوي صفرًا، فإن للمعادلة:",
          marks: 1,
          difficulty: "medium",
          explanation:
            "عندما يكون المميز ب² − 4أجـ = 0 يوجد جذر حقيقي واحد مكرر.",
          options: [
            { text: "جذران حقيقيان مختلفان" },
            { text: "جذر حقيقي واحد (مكرر)", correct: true },
            { text: "جذران تخيليان" },
            { text: "لا يوجد جذور" },
          ],
        },
        {
          type: "mcq_multi",
          text: "اختر كل الأعداد التي تُعد من جذور المعادلة: س² − 9 = 0",
          marks: 2,
          difficulty: "medium",
          explanation: "س² = 9 ⟹ س = 3 أو س = −3.",
          options: [
            { text: "3", correct: true },
            { text: "-3", correct: true },
            { text: "9" },
            { text: "0" },
          ],
        },
        {
          type: "true_false",
          text: "حاصل ضرب جذري المعادلة س² − 7س + 12 = 0 يساوي 12.",
          marks: 1,
          difficulty: "easy",
          explanation: "حاصل ضرب الجذور = جـ/أ = 12/1 = 12.",
          options: [
            { text: "صح", correct: true },
            { text: "خطأ" },
          ],
        },
        {
          type: "mcq_single",
          text: "ما قيمة المميز للمعادلة: 2س² + 3س − 2 = 0؟",
          marks: 2,
          difficulty: "hard",
          explanation: "المميز = ب² − 4أجـ = 9 − 4(2)(−2) = 9 + 16 = 25.",
          options: [
            { text: "25", correct: true },
            { text: "7" },
            { text: "-7" },
            { text: "17" },
          ],
        },
        {
          type: "text",
          text: "حل المعادلة س² − 4س − 5 = 0 موضحًا خطوات الحل كاملة.",
          marks: 3,
          difficulty: "medium",
          explanation:
            "بالتحليل: (س − 5)(س + 1) = 0 ⟹ س = 5 أو س = −1. يُصحح هذا السؤال يدويًا من المعلم.",
        },
      ],
    },
    {
      title: "قوانين نيوتن للحركة",
      subject: "Physics",
      topic: "Mechanics",
      description: "اختبار في الميكانيكا يغطي قوانين نيوتن الثلاثة وتطبيقاتها.",
      instructions: "الزمن محدود — راقب المؤقت أعلى الشاشة. أجب عن جميع الأسئلة قبل التسليم.",
      difficulty: "medium",
      durationMinutes: 15,
      passingScore: 50,
      maxAttempts: 2,
      status: "published",
      reviewPolicy: "immediate",
      questions: [
        {
          type: "mcq_single",
          text: "ينص قانون نيوتن الأول على أن الجسم الساكن يبقى ساكنًا ما لم تؤثر عليه:",
          marks: 1,
          difficulty: "easy",
          explanation: "القانون الأول (قانون القصور الذاتي): لا يتغير حركة الجسم إلا بقوة محصلة خارجية.",
          options: [
            { text: "قوة محصلة خارجية", correct: true },
            { text: "سرعة ابتدائية" },
            { text: "كتلة إضافية" },
            { text: "طاقة حرارية" },
          ],
        },
        {
          type: "mcq_single",
          text: "الصيغة الرياضية لقانون نيوتن الثاني هي:",
          marks: 1,
          difficulty: "easy",
          explanation: "القوة المحصلة = الكتلة × العجلة: ق = ك × ت.",
          options: [
            { text: "ق = ك × ت", correct: true },
            { text: "ق = ك ÷ ت" },
            { text: "ق = ح × ز" },
            { text: "ق = ط ÷ ك" },
          ],
        },
        {
          type: "true_false",
          text: "وحدة قياس القوة في النظام الدولي هي الجول.",
          marks: 1,
          difficulty: "easy",
          explanation: "وحدة القوة هي النيوتن، أما الجول فهو وحدة الشغل والطاقة.",
          options: [{ text: "صح" }, { text: "خطأ", correct: true }],
        },
        {
          type: "mcq_single",
          text: "جسم كتلته 4 كجم يتحرك بعجلة 3 م/ث². ما مقدار القوة المحصلة المؤثرة عليه؟",
          marks: 2,
          difficulty: "medium",
          explanation: "ق = ك × ت = 4 × 3 = 12 نيوتن.",
          options: [
            { text: "12 نيوتن", correct: true },
            { text: "7 نيوتن" },
            { text: "1.33 نيوتن" },
            { text: "48 نيوتن" },
          ],
        },
        {
          type: "mcq_multi",
          text: "اختر العبارات الصحيحة عن قانون نيوتن الثالث:",
          marks: 2,
          difficulty: "hard",
          explanation:
            "الفعل ورد الفعل متساويان في المقدار ومتعاكسان في الاتجاه ويؤثران على جسمين مختلفين.",
          options: [
            { text: "الفعل ورد الفعل متساويان في المقدار", correct: true },
            { text: "الفعل ورد الفعل يؤثران على الجسم نفسه" },
            { text: "الفعل ورد الفعل متعاكسان في الاتجاه", correct: true },
            { text: "رد الفعل أكبر من الفعل دائمًا" },
          ],
        },
      ],
    },
    {
      title: "الهيدروكربونات الأليفاتية",
      subject: "Chemistry",
      topic: "Organic Chemistry",
      description:
        "اختبار شامل في الكيمياء العضوية يغطي الألكانات والألكينات والألكاينات وخصائصها.",
      difficulty: "hard",
      durationMinutes: 30,
      passingScore: 60,
      maxAttempts: 1,
      status: "published",
      reviewPolicy: "after_close",
      startsInDays: -1,
      endsInDays: 7,
      questions: [
        {
          type: "mcq_single",
          text: "الصيغة العامة للألكانات هي:",
          marks: 1,
          difficulty: "easy",
          explanation: "الألكانات هيدروكربونات مشبعة صيغتها CnH2n+2.",
          options: [
            { text: "CnH2n+2", correct: true },
            { text: "CnH2n" },
            { text: "CnH2n-2" },
            { text: "CnHn" },
          ],
        },
        {
          type: "mcq_single",
          text: "أي المركبات التالية يحتوي رابطة ثلاثية بين ذرتي كربون؟",
          marks: 1,
          difficulty: "medium",
          explanation: "الأسيتيلين (الإيثاين) C2H2 أبسط الألكاينات ويحتوي رابطة ثلاثية.",
          options: [
            { text: "الميثان" },
            { text: "الإيثيلين" },
            { text: "الأسيتيلين", correct: true },
            { text: "البروبان" },
          ],
        },
        {
          type: "true_false",
          text: "تُعد الألكينات هيدروكربونات غير مشبعة.",
          marks: 1,
          difficulty: "easy",
          explanation: "الألكينات تحتوي رابطة ثنائية واحدة على الأقل لذا هي غير مشبعة.",
          options: [{ text: "صح", correct: true }, { text: "خطأ" }],
        },
        {
          type: "mcq_multi",
          text: "اختر كل المواد التي تنتمي إلى عائلة الألكانات:",
          marks: 2,
          difficulty: "medium",
          explanation: "الميثان والبروبان والبيوتان ألكانات؛ أما الإيثيلين فهو ألكين.",
          options: [
            { text: "الميثان", correct: true },
            { text: "الإيثيلين" },
            { text: "البروبان", correct: true },
            { text: "البيوتان", correct: true },
          ],
        },
        {
          type: "mcq_single",
          text: "ما عدد ذرات الهيدروجين في جزيء البيوتان C4H؟",
          marks: 1,
          difficulty: "medium",
          explanation: "من الصيغة العامة للألكانات: H = 2×4 + 2 = 10، والبيوتان C4H10.",
          options: [
            { text: "10", correct: true },
            { text: "8" },
            { text: "12" },
            { text: "6" },
          ],
        },
      ],
    },
    {
      title: "أساسيات النحو العربي",
      subject: "Arabic",
      topic: "Grammar",
      description: "اختبار في قواعد اللغة العربية: الإعراب، الجملة الاسمية والفعلية، وأنواع الخبر.",
      difficulty: "medium",
      durationMinutes: 25,
      passingScore: 50,
      maxAttempts: 3,
      status: "published",
      reviewPolicy: "after_close",
      endsInDays: 14,
      questions: [
        {
          type: "mcq_single",
          text: "ما إعراب كلمة «العلمُ» في جملة: العلمُ نورٌ؟",
          marks: 1,
          difficulty: "easy",
          explanation: "«العلم» مبتدأ مرفوع وعلامة رفعه الضمة، و«نور» خبر مرفوع.",
          options: [
            { text: "مبتدأ مرفوع", correct: true },
            { text: "خبر مرفوع" },
            { text: "فاعل مرفوع" },
            { text: "مفعول به منصوب" },
          ],
        },
        {
          type: "mcq_single",
          text: "الجملة التي تبدأ بفعل تُسمى:",
          marks: 1,
          difficulty: "easy",
          explanation: "الجملة الفعلية تبدأ بفعل، والاسمية تبدأ باسم.",
          options: [
            { text: "جملة اسمية" },
            { text: "جملة فعلية", correct: true },
            { text: "جملة شرطية" },
            { text: "جملة استفهامية" },
          ],
        },
        {
          type: "true_false",
          text: "الفعل الماضي مبني دائمًا.",
          marks: 1,
          difficulty: "medium",
          explanation: "الفعل الماضي مبني على الفتح في الأصل، والأفعال المبنية لا تتغير حركتها بالإعراب.",
          options: [{ text: "صح", correct: true }, { text: "خطأ" }],
        },
        {
          type: "mcq_multi",
          text: "اختر الأفعال التي تُعرب مضارعًا منصوبًا بعد «لن»:",
          marks: 2,
          difficulty: "hard",
          explanation: "«لن» حرف ناصب للمضارع: لن أُهملَ دروسي، لن يتأخرَ المجتهد.",
          options: [
            { text: "لن يكتبَ الدرسَ", correct: true },
            { text: "كتبَ الدرسَ" },
            { text: "لن نهملَ واجبنا", correct: true },
            { text: "يكتبُ الدرسَ" },
          ],
        },
        {
          type: "text",
          text: "أعرب الجملة التالية إعرابًا كاملًا: «يقرأ الطالبُ المجتهدُ الكتابَ الجديدَ».",
          marks: 4,
          difficulty: "hard",
          explanation:
            "يقرأ: فعل مضارع مرفوع بالضمة، الطالب: فاعل مرفوع، المجتهد: صفة مرفوعة، الكتاب: مفعول به منصوب، الجديد: صفة منصوبة. يُصحح يدويًا من المعلم.",
        },
      ],
    },
    {
      title: "Present Perfect — Mini Test",
      subject: "English",
      topic: "Grammar",
      description: "A short English grammar quiz on the present perfect tense and its uses.",
      difficulty: "easy",
      durationMinutes: 10,
      passingScore: 50,
      maxAttempts: 2,
      status: "published",
      reviewPolicy: "immediate",
      questions: [
        {
          type: "mcq_single",
          text: "Choose the correct sentence:",
          marks: 1,
          difficulty: "easy",
          explanation: "Present perfect: have/has + past participle → “She has visited Cairo twice.”",
          options: [
            { text: "She has visited Cairo twice.", correct: true },
            { text: "She have visited Cairo twice." },
            { text: "She has visit Cairo twice." },
            { text: "She visiting Cairo twice." },
          ],
        },
        {
          type: "mcq_single",
          text: "We use “since” with:",
          marks: 1,
          difficulty: "medium",
          explanation: "Since + starting point (since 2015); for + duration (for ten years).",
          options: [
            { text: "a point in time", correct: true },
            { text: "a duration" },
            { text: "a finished action" },
            { text: "future plans" },
          ],
        },
        {
          type: "true_false",
          text: "“I have seen this film yesterday.” is a correct English sentence.",
          marks: 1,
          difficulty: "medium",
          explanation: "Incorrect — finished time words like “yesterday” need the past simple: “I saw this film yesterday.”",
          options: [{ text: "True" }, { text: "False", correct: true }],
        },
        {
          type: "mcq_multi",
          text: "Which sentences correctly use the present perfect? (Select all that apply)",
          marks: 2,
          difficulty: "hard",
          explanation: "Present perfect connects past actions to now without finished time words.",
          options: [
            { text: "They have lived here since 2020.", correct: true },
            { text: "They have lived here yesterday." },
            { text: "I have just finished my homework.", correct: true },
            { text: "I has finished my homework." },
          ],
        },
      ],
    },
    {
      title: "التفاضل — اختبار شامل",
      subject: "Mathematics",
      topic: "Calculus",
      description: "اختبار شامل في قواعد الاشتقاق وتطبيقاتها على المماسات والنهايات.",
      difficulty: "hard",
      durationMinutes: 45,
      passingScore: 70,
      maxAttempts: 1,
      status: "published",
      reviewPolicy: "never",
      startsInDays: 3,
      endsInDays: 10,
      questions: [
        {
          type: "mcq_single",
          text: "مشتقة د(س) = س³ بالنسبة إلى س هي:",
          marks: 1,
          difficulty: "easy",
          explanation: "قاعدة القوة: د′(س) = 3س².",
          options: [
            { text: "3س²", correct: true },
            { text: "س²" },
            { text: "3س" },
            { text: "س³/3" },
          ],
        },
        {
          type: "true_false",
          text: "مشتقة الثابت تساوي صفرًا.",
          marks: 1,
          difficulty: "easy",
          explanation: "الثابت لا يتغير، لذا معدل تغيره (مشتقته) يساوي صفرًا.",
          options: [{ text: "صح", correct: true }, { text: "خطأ" }],
        },
        {
          type: "mcq_single",
          text: "إذا كانت د(س) = س² + 2س، فإن د′(1) تساوي:",
          marks: 2,
          difficulty: "medium",
          explanation: "د′(س) = 2س + 2 ⟹ د′(1) = 2 + 2 = 4.",
          options: [
            { text: "4", correct: true },
            { text: "3" },
            { text: "2" },
            { text: "5" },
          ],
        },
      ],
    },
    {
      title: "الخلية الحية",
      subject: "Biology",
      topic: "The Cell",
      description: "اختبار مراجعة في تركيب الخلية ووظائف عضياتها.",
      difficulty: "easy",
      durationMinutes: 20,
      passingScore: 50,
      maxAttempts: 2,
      status: "closed",
      reviewPolicy: "after_close",
      startsInDays: -20,
      endsInDays: -3,
      questions: [
        {
          type: "mcq_single",
          text: "العضية المسؤولة عن إنتاج الطاقة في الخلية هي:",
          marks: 1,
          difficulty: "easy",
          explanation: "الميتوكوندريا موضع التنفس الخلوي وإنتاج ATP.",
          options: [
            { text: "الميتوكوندريا", correct: true },
            { text: "الريبوسومات" },
            { text: "النواة" },
            { text: "جهاز جولجي" },
          ],
        },
        {
          type: "true_false",
          text: "تحتوي الخلية النباتية على جدار خلوي بينما تفتقر إليه الخلية الحيوانية.",
          marks: 1,
          difficulty: "easy",
          explanation: "الجدار الخلوي السليلوزي من مميزات الخلية النباتية.",
          options: [{ text: "صح", correct: true }, { text: "خطأ" }],
        },
        {
          type: "mcq_multi",
          text: "اختر العضيات المحاطة بغشاء مزدوج:",
          marks: 2,
          difficulty: "hard",
          explanation: "النواة والميتوكوندريا والبلاستيدات الخضراء ذات غشاء مزدوج.",
          options: [
            { text: "النواة", correct: true },
            { text: "الريبوسومات" },
            { text: "الميتوكوندريا", correct: true },
            { text: "البلاستيدات الخضراء", correct: true },
          ],
        },
      ],
    },
  ];

  const now = Date.now();
  for (const def of examDefs) {
    const [examRow] = await db
      .insert(exams)
      .values({
        subjectId: subjectIds[def.subject],
        topicId: def.topic ? topicIds[`${def.subject}/${def.topic}`] : null,
        title: def.title,
        description: def.description,
        instructions: def.instructions ?? null,
        difficulty: def.difficulty,
        durationMinutes: def.durationMinutes,
        passingScore: def.passingScore ?? null,
        maxAttempts: def.maxAttempts,
        startsAt:
          def.startsInDays == null ? null : new Date(now + def.startsInDays * DAY),
        endsAt: def.endsInDays == null ? null : new Date(now + def.endsInDays * DAY),
        status: def.status,
        reviewPolicy: def.reviewPolicy,
        multiSelectScoring: def.multiSelectScoring ?? "all_or_nothing",
      })
      .$returningId();

    let order = 0;
    for (const q of def.questions) {
      const [qRow] = await db
        .insert(questions)
        .values({
          examId: examRow.id,
          type: q.type,
          text: q.text,
          explanation: q.explanation ?? null,
          marks: q.marks ?? 1,
          difficulty: q.difficulty ?? "medium",
          sortOrder: order++,
        })
        .$returningId();
      let oOrder = 0;
      for (const o of q.options ?? []) {
        await db.insert(questionOptions).values({
          questionId: qRow.id,
          text: o.text,
          isCorrect: !!o.correct,
          sortOrder: oOrder++,
        });
      }
    }
  }

  const [examsCount] = await db.select().from(exams);
  console.log(`Seed complete: ${subjectDefs.length} subjects, ${topicDefs.length} topics, ${examDefs.length} exams.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
