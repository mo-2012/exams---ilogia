-- iLogia Exams — جداول جديدة فقط (exam_*) بدون تعديل أي جدول موجود. شغّله من Supabase → SQL Editor.
-- يعتمد على الدالة الموجودة public.is_admin(). التصحيح والوقت على السيرفر، ومفاتيح الإجابات لا تصل للمتصفح.
create table if not exists public.exam_subjects(id bigint generated always as identity primary key,name_ar text not null,sort_order int default 0);
create table if not exists public.exam_exams(id bigint generated always as identity primary key,subject_id bigint references public.exam_subjects(id),title text not null,description text,duration_minutes int not null default 15,passing_score int not null default 50,max_attempts int not null default 2,status text not null default 'published' check(status in('draft','published','closed')));
create table if not exists public.exam_questions(id bigint generated always as identity primary key,exam_id bigint references public.exam_exams(id) on delete cascade,text text not null,options jsonb not null,correct int not null,explanation text,marks int not null default 1,sort_order int default 0);
create table if not exists public.exam_attempts(id bigint generated always as identity primary key,exam_id bigint references public.exam_exams(id),user_id uuid not null references auth.users(id),status text not null default 'in_progress' check(status in('in_progress','submitted','expired')),started_at timestamptz default now(),deadline_at timestamptz not null,submitted_at timestamptz,score int,max_score int,percentage int,passed boolean);
create table if not exists public.exam_answers(attempt_id bigint references public.exam_attempts(id) on delete cascade,question_id bigint references public.exam_questions(id),choice int,primary key(attempt_id,question_id));
alter table public.exam_subjects enable row level security;alter table public.exam_exams enable row level security;alter table public.exam_questions enable row level security;alter table public.exam_attempts enable row level security;alter table public.exam_answers enable row level security;
create policy exam_subjects_r on public.exam_subjects for select to authenticated using(true);
create policy exam_subjects_a on public.exam_subjects for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy exam_exams_r on public.exam_exams for select to authenticated using(status<>'draft' or public.is_admin());
create policy exam_exams_a on public.exam_exams for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy exam_questions_a on public.exam_questions for all to authenticated using(public.is_admin()) with check(public.is_admin()); -- الطلاب لا يقرؤونها مباشرة (فيها مفتاح الإجابة)
create policy exam_attempts_r on public.exam_attempts for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy exam_answers_a on public.exam_answers for select to authenticated using(public.is_admin());

create or replace function public.exam_start(p_exam bigint) returns bigint language plpgsql security definer set search_path=public as $$
declare e exam_exams; a bigint; n int;
begin
 if auth.uid() is null then raise exception 'auth'; end if;
 select * into e from exam_exams where id=p_exam and status='published';
 if not found then raise exception 'exam unavailable'; end if;
 select id into a from exam_attempts where exam_id=p_exam and user_id=auth.uid() and status='in_progress' and deadline_at>now() limit 1;
 if a is not null then return a; end if;
 select count(*) into n from exam_attempts where exam_id=p_exam and user_id=auth.uid();
 if n>=e.max_attempts then raise exception 'max attempts'; end if;
 insert into exam_attempts(exam_id,user_id,deadline_at) values(p_exam,auth.uid(),now()+make_interval(mins=>e.duration_minutes)) returning id into a;
 return a;
end $$;

create or replace function public.exam_save(p_attempt bigint,p_q bigint,p_choice int) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from exam_attempts a join exam_questions q on q.exam_id=a.exam_id where a.id=p_attempt and q.id=p_q and a.user_id=auth.uid() and a.status='in_progress' and now()<=a.deadline_at+interval '90 seconds') then raise exception 'closed'; end if;
 insert into exam_answers values(p_attempt,p_q,p_choice) on conflict(attempt_id,question_id) do update set choice=excluded.choice;
end $$;

create or replace function public.exam_submit(p_attempt bigint) returns void language plpgsql security definer set search_path=public as $$
declare a exam_attempts; s int; m int; ps int;
begin
 select * into a from exam_attempts where id=p_attempt and user_id=auth.uid();
 if not found then raise exception 'not found'; end if;
 if a.status<>'in_progress' then return; end if; -- التسليم لا يتكرر
 select coalesce(sum(q.marks) filter(where w.choice=q.correct),0),coalesce(sum(q.marks),0) into s,m from exam_questions q left join exam_answers w on w.question_id=q.id and w.attempt_id=a.id where q.exam_id=a.exam_id;
 select passing_score into ps from exam_exams where id=a.exam_id;
 update exam_attempts set status=case when now()>deadline_at+interval '90 seconds' then 'expired' else 'submitted' end,submitted_at=now(),score=s,max_score=m,percentage=case when m>0 then round(100.0*s/m) else 0 end,passed=(case when m>0 then round(100.0*s/m) else 0 end)>=ps where id=a.id;
end $$;

create or replace function public.exam_load(p_attempt bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts;
begin
 select * into a from exam_attempts where id=p_attempt and user_id=auth.uid();
 if not found then raise exception 'not found'; end if;
 if a.status='in_progress' and now()>a.deadline_at+interval '90 seconds' then perform exam_submit(p_attempt); a.status:='expired'; end if;
 return jsonb_build_object('status',a.status,'deadline',extract(epoch from a.deadline_at)*1000,'now',extract(epoch from now())*1000,
  'title',(select title from exam_exams where id=a.exam_id),
  'qs',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'t',text,'o',options) order by sort_order,id),'[]') from exam_questions where exam_id=a.exam_id),
  'ans',(select coalesce(jsonb_object_agg(question_id::text,choice),'{}') from exam_answers where attempt_id=a.id));
end $$;

create or replace function public.exam_review(p_attempt bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare a exam_attempts;
begin
 select * into a from exam_attempts where id=p_attempt and user_id=auth.uid();
 if not found then raise exception 'not found'; end if;
 if a.status='in_progress' then raise exception 'not submitted'; end if;
 return jsonb_build_object('title',(select title from exam_exams where id=a.exam_id),'score',a.score,'max',a.max_score,'pct',a.percentage,'passed',a.passed,
  'qs',(select jsonb_agg(jsonb_build_object('t',q.text,'o',q.options,'c',q.correct,'a',w.choice,'x',q.explanation) order by q.sort_order,q.id) from exam_questions q left join exam_answers w on w.question_id=q.id and w.attempt_id=a.id where q.exam_id=a.exam_id));
end $$;

revoke all on function public.exam_start(bigint),public.exam_save(bigint,bigint,int),public.exam_submit(bigint),public.exam_load(bigint),public.exam_review(bigint) from public,anon;
grant execute on function public.exam_start(bigint),public.exam_save(bigint,bigint,int),public.exam_submit(bigint),public.exam_load(bigint),public.exam_review(bigint) to authenticated;

-- ===== الاختبارات: اختباران لكل مادة (6 مواد × 2 = 12 اختبار). صيغة السؤال: [النص,[الخيارات],رقم الصحيح من 0,الشرح]
do $seed$ declare s jsonb; e jsonb; q jsonb; sid bigint; eid bigint; i int; j int; k int:=0;
begin
 if exists(select 1 from exam_subjects) then return; end if;
 for s in select * from jsonb_array_elements($j$[
 {"s":"الرياضيات","e":[
  {"t":"المعادلات التربيعية","d":"الجذور والمميز وحل المعادلات من الدرجة الثانية.","m":15,"q":[
   ["مجموع جذري المعادلة س² − 5س + 6 = 0 يساوي:",["5","6","-5","1"],0,"مجموع الجذور = −ب/أ = 5."],
   ["قيمة المميز للمعادلة 2س² + 3س − 2 = 0 هي:",["25","7","-7","17"],0,"ب² − 4أجـ = 9 + 16 = 25."],
   ["حل المعادلة س² = 49 هو:",["7 فقط","±7","49","-7 فقط"],1,"س = 7 أو س = −7."],
   ["حاصل ضرب جذري المعادلة س² − 7س + 12 = 0 يساوي:",["7","12","-12","-7"],1,"حاصل الضرب = جـ/أ = 12."]]},
  {"t":"أساسيات التفاضل","d":"قواعد الاشتقاق الأساسية.","m":15,"q":[
   ["مشتقة الدالة س³ هي:",["3س²","س²","3س","س³/3"],0,"قاعدة القوة: ن·س^(ن−1)."],
   ["مشتقة الدالة الثابتة 5 هي:",["5","1","0","س"],2,"مشتقة أي ثابت تساوي صفرًا."],
   ["مشتقة الدالة جا(س) هي:",["جتا(س)","-جتا(س)","جا(س)","-جا(س)"],0,"د/دس (جا س) = جتا س."],
   ["مشتقة الدالة 2س⁴ − س هي:",["8س³ − 1","8س³","2س³ − 1","6س³ − 1"],0,"نشتق كل حد على حدة."]]}]},
 {"s":"الفيزياء","e":[
  {"t":"قوانين نيوتن للحركة","d":"القصور الذاتي والقوة ورد الفعل.","m":15,"q":[
   ["يسمى قانون نيوتن الأول بقانون:",["القصور الذاتي","الجذب العام","حفظ الطاقة","أوم"],0,"الجسم يحافظ على حالته ما لم تؤثر عليه قوة محصلة."],
   ["قوة تؤثر على جسم كتلته 5 كجم فتكسبه تسارعًا 3 م/ث². مقدارها:",["15 نيوتن","8 نيوتن","1.67 نيوتن","2 نيوتن"],0,"ق = ك × ت = 15 نيوتن."],
   ["ينص القانون الثالث على أن رد الفعل:",["مساوٍ للفعل في المقدار ومضاد في الاتجاه","أكبر من الفعل ومضاد له","مساوٍ للفعل وفي نفس اتجاهه","يساوي صفرًا"],0,"لكل فعل رد فعل مساوٍ له في المقدار ومضاد له في الاتجاه."],
   ["وحدة قياس القوة في النظام الدولي:",["الجول","الواط","النيوتن","الباسكال"],2,"النيوتن = كجم·م/ث²."]]},
  {"t":"الكهرباء والتيار","d":"قانون أوم والتوصيل والقدرة.","m":15,"q":[
   ["مقاومة 10 أوم يمر بها تيار 2 أمبير، فرق الجهد بين طرفيها:",["20 فولت","5 فولت","12 فولت","0.2 فولت"],0,"ج = ت × م = 20 فولت."],
   ["وحدة قياس شدة التيار الكهربي:",["الفولت","الأمبير","الأوم","الواط"],1,"الأمبير."],
   ["المقاومة المكافئة لمقاومتين 4 و 6 أوم على التوالي:",["10 أوم","2.4 أوم","24 أوم","5 أوم"],0,"في التوالي تُجمع المقاومات."],
   ["جهاز يعمل على 220 فولت ويمر به تيار 2 أمبير، قدرته:",["110 واط","440 واط","222 واط","218 واط"],1,"القدرة = الجهد × التيار."]]}]},
 {"s":"الكيمياء","e":[
  {"t":"الهيدروكربونات","d":"الألكانات والألكينات والألكاينات.","m":15,"q":[
   ["الصيغة العامة للألكانات:",["CnH2n+2","CnH2n","CnH2n−2","CnHn"],0,"مركبات مشبعة."],
   ["أبسط الألكانات:",["الإيثان","الميثان","البروبان","البيوتان"],1,"CH₄."],
   ["الإيثين ينتمي إلى:",["الألكانات","الألكينات","الألكاينات","الأروماتية"],1,"يحتوي رابطة ثنائية."],
   ["نوع الرابطة بين ذرتي الكربون في الإيثاين:",["أحادية","ثنائية","ثلاثية","أيونية"],2,"HC≡CH."]]},
  {"t":"الأحماض والقواعد و pH","d":"الرقم الهيدروجيني وقوة الأحماض.","m":15,"q":[
   ["pH المحلول المتعادل عند 25°م:",["0","7","14","1"],1,"[H⁺] = 10⁻⁷."],
   ["محلول pH له يساوي 3 يكون:",["حمضيًا","قاعديًا","متعادلًا","غير معروف"],0,"أقل من 7 = حمضي."],
   ["حمض الهيدروكلوريك HCl يُعد:",["حمضًا ضعيفًا","حمضًا قويًا","قاعدة قوية","ملحًا"],1,"يتأين كليًا في الماء."],
   ["إذا كان [H⁺] = 10⁻⁴ مول/لتر فإن pH =",["4","10","-4","0.4"],0,"pH = −لو[H⁺]."]]}]},
 {"s":"الأحياء","e":[
  {"t":"الخلية الحية","d":"العضيات ووظائفها.","m":15,"q":[
   ["العضية المسؤولة عن إنتاج الطاقة في الخلية:",["الميتوكوندريا","الريبوسوم","جهاز جولجي","الليسوسوم"],0,"محطة الطاقة (ATP)."],
   ["تحتوي المادة الوراثية DNA في الخلية الحيوانية داخل:",["النواة","الغشاء","الفجوة","الجدار"],0,"النواة تحتوي الكروموسومات."],
   ["توجد البلاستيدات الخضراء في:",["الخلايا النباتية","الخلايا الحيوانية فقط","كل الخلايا","البكتيريا فقط"],0,"تقوم بالبناء الضوئي."],
   ["وظيفة الريبوسومات:",["بناء البروتين","إنتاج الطاقة","تخزين الماء","هضم الفضلات"],0,"تترجم mRNA إلى بروتين."]]},
  {"t":"الوراثة","d":"الجينات والكروموسومات وقوانين مندل.","m":15,"q":[
   ["وحدة الوراثة الأساسية:",["الجين","الريبوسوم","الفجوة","الغشاء"],0,"الجين جزء من DNA."],
   ["عدد الكروموسومات في الخلية الجسمية للإنسان:",["23","46","44","48"],1,"23 زوجًا."],
   ["نسبة الطرز الشكلية في التزاوج Aa × Aa عند السيادة التامة:",["1:1","3:1","1:2:1","9:3:3:1"],1,"3 سائد : 1 متنحٍّ."],
   ["القاعدة التي لا توجد في DNA:",["أدينين","جوانين","يوراسيل","ثايمين"],2,"اليوراسيل في RNA."]]}]},
 {"s":"اللغة العربية","e":[
  {"t":"أساسيات النحو","d":"الإعراب وعلاماته.","m":15,"q":[
   ["حكم الفاعل في الجملة الفعلية:",["مرفوع","منصوب","مجرور","مجزوم"],0,"الفاعل دائمًا مرفوع."],
   ["المفعول به يكون:",["مرفوعًا","منصوبًا","مجرورًا","مجزومًا"],1,"المفعول به منصوب."],
   ["تعمل «إنّ» وأخواتها:",["تنصب الاسم وترفع الخبر","ترفع الاسم وتنصب الخبر","تجزم المضارع","تجر الاسم"],0,"مثل: إنّ العلمَ نورٌ."],
   ["علامة رفع جمع المذكر السالم:",["الواو","الألف","الياء","الضمة فقط"],0,"المعلمون."]]},
  {"t":"البلاغة والمفردات","d":"التشبيه والاستعارة والمعاني.","m":15,"q":[
   ["«كان محمد كالأسد في الشجاعة» نوع الصورة البلاغية:",["تشبيه","استعارة","كناية","جناس"],0,"ذُكر الطرفان وأداة التشبيه."],
   ["جمع كلمة «كتاب»:",["كتب","كاتبون","كتابات","مكاتب"],0,"جمع تكسير."],
   ["ضد كلمة «كرم»:",["بخل","جود","سخاء","عطاء"],0,"البخل ضد الكرم."],
   ["الاستعارة هي:",["تشبيه حُذف أحد طرفيه","تشبيه ذُكر فيه الطرفان","لفظ له معنيان","كلمة مضادة"],0,"أصلها تشبيه حُذف أحد طرفيه."]]}]},
 {"s":"اللغة الإنجليزية","e":[
  {"t":"Present Perfect","d":"Present perfect grammar practice.","m":10,"q":[
   ["She ___ in this city since 2010.",["lives","has lived","lived","is living"],1,"since + present perfect."],
   ["I have never ___ sushi.",["eat","ate","eaten","eating"],2,"have + past participle."],
   ["They have ___ finished their homework.",["just","yesterday","ago","last"],0,"just is used with present perfect."],
   ["How long ___ you known him?",["did","do","have","are"],2,"How long have you known…"]]},
  {"t":"Grammar & Vocabulary","d":"Conditionals, comparatives and vocabulary.","m":10,"q":[
   ["If it rains tomorrow, we ___ at home.",["will stay","stayed","would stay","stay"],0,"First conditional."],
   ["The opposite of ancient is:",["old","modern","huge","slow"],1,"ancient ≠ modern."],
   ["He is ___ than his brother.",["tall","taller","tallest","more tall"],1,"Comparative."],
   ["The past simple of go is:",["goed","gone","went","going"],2,"Irregular verb."]]}]}
 ]$j$::jsonb) loop
  insert into exam_subjects(name_ar,sort_order) values(s->>'s',k) returning id into sid; k:=k+1;
  for e in select * from jsonb_array_elements(s->'e') loop
   insert into exam_exams(subject_id,title,description,duration_minutes) values(sid,e->>'t',e->>'d',(e->>'m')::int) returning id into eid;
   i:=0; for q in select * from jsonb_array_elements(e->'q') loop
    insert into exam_questions(exam_id,text,options,correct,explanation,sort_order) values(eid,q->>0,q->1,(q->>2)::int,q->>3,i); i:=i+1;
   end loop;
  end loop;
 end loop;
end $seed$;
