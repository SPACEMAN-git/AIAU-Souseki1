"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { HOUSING_CALIBRATION_PROPERTIES } from "@/lib/housing-calibration";
import {
  DEFAULT_HBTI_ANSWERS,
  DEFAULT_HOUSING_DNA_ORDER,
  deriveHbtiProfile,
  HBTI_QUESTIONS,
} from "@/lib/housing-scoring";
import type {
  FiveGridValue,
  HbtiAnswers,
  HbtiQuestionId,
  HousingPreferenceKey,
  PenaltyPreferenceKey,
  PreferenceProfile,
  RewardPreferenceKey,
  SpecificPreferences,
  SwipeFeedback,
  SwipeReaction,
} from "@/lib/housing-scoring";
import { HBTI_QUESTION_COPY, PREFERENCE_LABELS, SPECIFIC_PREFERENCE_COPY, type Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  hasSearchResults: boolean;
  onComplete: (profile: PreferenceProfile) => void;
  onRestart: () => void;
  onContinue: () => void;
};

type TestStage = "priority" | "hbti" | "swipe" | "result";
const QUESTIONS_PER_PAGE = 5;
const SCALE_VALUES: FiveGridValue[] = [-2, -1, 0, 1, 2];
const SWIPE_THRESHOLD = 64;
const REWARD_PREFERENCE_KEYS: RewardPreferenceKey[] = [
  "walk_5", "layout_1k", "area_25", "age_10", "zero_transfer", "walkable_major_area", "pet_friendly", "bath_toilet_separate",
];
const PENALTY_PREFERENCE_KEYS: PenaltyPreferenceKey[] = ["avoid_1r", "avoid_old", "avoid_far_station", "avoid_transfer"];

const TEXT = {
  zh: {
    steps: ["初步排序", "HBTI", "房源 Swipe", "人格结果"],
    priorityTitle: "先排出你最在意的居住条件",
    specificsTitle: "加入你的具体偏好",
    rewardsTitle: "我特别想要的",
    penaltiesTitle: "我不想妥协的",
    priorityNext: "下一步：HBTI →",
    question: "题目", answered: "已回答", page: "页", of: "/",
    disagree: "非常不同意", neutral: "中立", agree: "非常同意",
    previous: "← 上一步", next: "下一页 →", finish: "下一步：房源 Swipe →",
    answerAll: "请回答本页的 5 个问题后继续",
    swipeTitle: "凭直觉选择你会不会住",
    swipeLeft: "不喜欢", swipeRight: "喜欢", demo: "偏好校准 Demo",
    pros: "吸引你的地方", cons: "需要取舍", sampleCommute: "示例通勤",
    result: "你的住房人格", blackbox: "具体配比已作为黑箱保存",
    blackboxHint: "排序、HBTI 与滑卡反应已合并，只用于所有合格房源的个性化 Ranking。",
    evidence: ["初步排序已吸收", "20 道 HBTI 已完成", "10 张房源直觉已校准"],
    restart: "重新测试", view: "查看 Roomance 推荐 ↓", goSearch: "保存偏好，去搜索目的地 ↑",
    types: {
      commute: ["🚃 Time Saver", "你愿意用一些房租和空间，换取更短、更稳定的通勤。"],
      price: ["💰 Smart Saver", "你会认真控制每月固定支出，在可接受条件里寻找更高性价比。"],
      housing: ["🏠 Comfort Seeker", "你更重视每天回家后的空间与居住品质，愿意为舒适做取舍。"],
      station: ["🚉 Easy Access", "你希望每天从家到车站轻松直接，把步行摩擦降到最低。"],
      lifestyle: ["🌆 City Connector", "你希望住处能连接朋友、餐厅、购物和喜欢的城市生活。"],
    },
    cards: [
      { pros: ["车站步行 3 分", "通勤只需 28 分"], cons: ["面积 21.5㎡", "月总费用 ¥98,000"] },
      { pros: ["面积 29.2㎡", "月总费用 ¥80,000"], cons: ["车站步行 11 分", "築19年"] },
      { pros: ["1DK · 築2年", "生活设施丰富"], cons: ["月总费用 ¥120,000", "通勤 38 分"] },
      { pros: ["月总费用 ¥77,000", "面积 24.4㎡"], cons: ["通勤 49 分", "周边选择较少"] },
      { pros: ["车站步行 1 分", "通勤只需 25 分"], cons: ["面积 18.3㎡", "築24年"] },
      { pros: ["面积 35.6㎡", "築1年"], cons: ["车站步行 14 分", "月总费用 ¥130,000"] },
      { pros: ["餐厅和商店丰富", "车站步行 5 分"], cons: ["月总费用 ¥115,000", "築18年"] },
      { pros: ["月总费用 ¥84,000", "无需换乘"], cons: ["通勤 41 分", "车站步行 8 分"] },
      { pros: ["面积 27㎡", "通勤 32 分"], cons: ["生活设施普通", "不是新房"] },
      { pros: ["面积 32.5㎡ · 築3年", "通勤 29 分"], cons: ["月总费用 ¥148,000", "预算压力较大"] },
    ],
  },
  ja: {
    steps: ["優先順位", "HBTI", "物件 Swipe", "タイプ結果"],
    priorityTitle: "住まい選びの優先順位を並べてください",
    specificsTitle: "具体的な希望を追加",
    rewardsTitle: "特に欲しい条件",
    penaltiesTitle: "避けたい条件",
    priorityNext: "次へ：HBTI →",
    question: "質問", answered: "回答済み", page: "ページ", of: "/",
    disagree: "まったく同意しない", neutral: "中立", agree: "とても同意する",
    previous: "← 戻る", next: "次へ →", finish: "次へ：物件 Swipe →",
    answerAll: "このページの5問すべてに回答してください",
    swipeTitle: "直感で住みたいか選んでください",
    swipeLeft: "好みではない", swipeRight: "好き", demo: "好み校正 Demo",
    pros: "魅力", cons: "妥協点", sampleCommute: "想定通勤",
    result: "あなたの住まいタイプ", blackbox: "具体的な配分は非公開で保存",
    blackboxHint: "優先順位、HBTI、カード反応を統合し、対象物件のパーソナル Ranking だけに使用します。",
    evidence: ["優先順位を反映", "HBTI 20問を反映", "物件10枚の直感を反映"],
    restart: "もう一度", view: "Roomance のおすすめを見る ↓", goSearch: "保存して目的地を検索 ↑",
    types: {
      commute: ["🚃 Time Saver", "家賃や広さを少し譲っても、短く安定した通勤を選ぶタイプです。"],
      price: ["💰 Smart Saver", "毎月の固定費を丁寧に抑え、条件とのバランスが良い部屋を探します。"],
      housing: ["🏠 Comfort Seeker", "帰宅後の広さや住み心地を重視し、快適さのために調整できます。"],
      station: ["🚉 Easy Access", "駅までの移動を軽くして、毎日の小さな負担を減らしたいタイプです。"],
      lifestyle: ["🌆 City Connector", "友人、飲食店、買い物など好きな街とのつながりを大切にします。"],
    },
    cards: [
      { pros: ["駅徒歩3分", "通勤28分"], cons: ["21.5㎡", "月額合計 ¥98,000"] },
      { pros: ["29.2㎡", "月額合計 ¥80,000"], cons: ["駅徒歩11分", "築19年"] },
      { pros: ["1DK・築2年", "生活施設が豊富"], cons: ["月額合計 ¥120,000", "通勤38分"] },
      { pros: ["月額合計 ¥77,000", "24.4㎡"], cons: ["通勤49分", "周辺施設が少なめ"] },
      { pros: ["駅徒歩1分", "通勤25分"], cons: ["18.3㎡", "築24年"] },
      { pros: ["35.6㎡", "築1年"], cons: ["駅徒歩14分", "月額合計 ¥130,000"] },
      { pros: ["飲食店・買物が豊富", "駅徒歩5分"], cons: ["月額合計 ¥115,000", "築18年"] },
      { pros: ["月額合計 ¥84,000", "乗換なし"], cons: ["通勤41分", "駅徒歩8分"] },
      { pros: ["27㎡", "通勤32分"], cons: ["生活施設は普通", "新築ではない"] },
      { pros: ["32.5㎡・築3年", "通勤29分"], cons: ["月額合計 ¥148,000", "予算負担が大きい"] },
    ],
  },
  en: {
    steps: ["Priorities", "HBTI", "Home Swipe", "Your Type"],
    priorityTitle: "Rank what matters most in your home search",
    specificsTitle: "Add your specific preferences",
    rewardsTitle: "I really want",
    penaltiesTitle: "I want to avoid",
    priorityNext: "Next: HBTI →",
    question: "Question", answered: "answered", page: "Page", of: "/",
    disagree: "Strongly disagree", neutral: "Neutral", agree: "Strongly agree",
    previous: "← Back", next: "Next →", finish: "Next: Home Swipe →",
    answerAll: "Answer all five questions on this page to continue",
    swipeTitle: "Choose by instinct: would you live here?",
    swipeLeft: "PASS", swipeRight: "LIKE", demo: "Preference calibration demo",
    pros: "What works", cons: "Trade-offs", sampleCommute: "Sample commute",
    result: "Your Housing Type", blackbox: "Your exact mix is saved as a black box",
    blackboxHint: "Priority order, HBTI and card reactions are combined only for personalized ranking of eligible homes.",
    evidence: ["Priority order learned", "20 HBTI answers learned", "10 home instincts calibrated"],
    restart: "Retake", view: "View Roomance matches ↓", goSearch: "Save and search a destination ↑",
    types: {
      commute: ["🚃 Time Saver", "You trade some rent and space for a shorter, more reliable commute."],
      price: ["💰 Smart Saver", "You protect your monthly budget and look for the strongest value among acceptable homes."],
      housing: ["🏠 Comfort Seeker", "You prioritize space and everyday comfort, and will trade for a better home."],
      station: ["🚉 Easy Access", "You minimize the daily friction between your front door and the station."],
      lifestyle: ["🌆 City Connector", "You value easy access to friends, dining, shopping and the city life you enjoy."],
    },
    cards: [
      { pros: ["3-min station walk", "28-min commute"], cons: ["21.5㎡", "¥98,000 monthly total"] },
      { pros: ["29.2㎡", "¥80,000 monthly total"], cons: ["11-min station walk", "19 years old"] },
      { pros: ["1DK · 2 years old", "Strong amenities"], cons: ["¥120,000 monthly total", "38-min commute"] },
      { pros: ["¥77,000 monthly total", "24.4㎡"], cons: ["49-min commute", "Fewer amenities"] },
      { pros: ["1-min station walk", "25-min commute"], cons: ["18.3㎡", "24 years old"] },
      { pros: ["35.6㎡", "1 year old"], cons: ["14-min station walk", "¥130,000 monthly total"] },
      { pros: ["Rich dining and shopping", "5-min station walk"], cons: ["¥115,000 monthly total", "18 years old"] },
      { pros: ["¥84,000 monthly total", "No transfers"], cons: ["41-min commute", "8-min station walk"] },
      { pros: ["27㎡", "32-min commute"], cons: ["Average amenities", "Not a new build"] },
      { pros: ["32.5㎡ · 3 years old", "29-min commute"], cons: ["¥148,000 monthly total", "High budget pressure"] },
    ],
  },
} as const;

function primaryDimension(profile: PreferenceProfile): HousingPreferenceKey {
  return (Object.keys(profile.weights) as HousingPreferenceKey[])
    .sort((left, right) => profile.weights[right] - profile.weights[left])[0];
}

function feedbackReasons(propertyId: string, reaction: SwipeReaction) {
  const like: Record<string, string[]> = {
    "dna-compact-near-station": ["通勤时间短", "离车站近"],
    "dna-large-value-room": ["租金便宜", "房间更大"],
    "dna-new-lifestyle-home": ["房子更新", "去喜欢的地方方便"],
    "dna-budget-long-commute": ["租金便宜", "房间更大"],
    "dna-one-minute-old-studio": ["通勤时间短", "离车站近"],
    "dna-large-new-far-station": ["房间更大", "房子更新"],
    "dna-city-life-compact": ["去喜欢的地方方便", "离车站近"],
    "dna-direct-route-value": ["租金便宜", "不需要换乘"],
    "dna-balanced-suburban": ["通勤时间短", "房间更大"],
    "dna-premium-all-rounder": ["通勤时间短", "房间更大", "房子更新"],
  };
  const dislike: Record<string, string[]> = {
    "dna-compact-near-station": ["租金太高", "房间太小"],
    "dna-large-value-room": ["离车站太远", "房子太旧"],
    "dna-new-lifestyle-home": ["租金太高", "通勤太久"],
    "dna-budget-long-commute": ["通勤太久", "生活不方便"],
    "dna-one-minute-old-studio": ["房间太小", "房子太旧"],
    "dna-large-new-far-station": ["离车站太远", "租金太高"],
    "dna-city-life-compact": ["租金太高", "房子太旧"],
    "dna-direct-route-value": ["通勤太久", "离车站太远"],
    "dna-balanced-suburban": ["生活不方便", "房子太旧"],
    "dna-premium-all-rounder": ["租金太高"],
  };
  return reaction > 0 ? like[propertyId] ?? [] : dislike[propertyId] ?? [];
}

export default function HousingDnaTest({ locale, hasSearchResults, onComplete, onRestart, onContinue }: Props) {
  const text = TEXT[locale];
  const [stage, setStage] = useState<TestStage>("priority");
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<HbtiAnswers>({ ...DEFAULT_HBTI_ANSWERS });
  const [answeredIds, setAnsweredIds] = useState<Set<HbtiQuestionId>>(() => new Set());
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);
  const [priorityOrder, setPriorityOrder] = useState<HousingPreferenceKey[]>([...DEFAULT_HOUSING_DNA_ORDER]);
  const [specificPreferences, setSpecificPreferences] = useState<SpecificPreferences>({ rewards: [], penalties: [] });
  const [priorityDragIndex, setPriorityDragIndex] = useState<number | null>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeFeedback[]>([]);
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [swipeDragX, setSwipeDragX] = useState(0);
  const [swipeDragging, setSwipeDragging] = useState(false);

  const pageQuestions = useMemo(
    () => HBTI_QUESTIONS.slice(pageIndex * QUESTIONS_PER_PAGE, (pageIndex + 1) * QUESTIONS_PER_PAGE),
    [pageIndex],
  );
  const pageComplete = pageQuestions.every((question) => answeredIds.has(question.id));
  const progress = Math.round((answeredIds.size / HBTI_QUESTIONS.length) * 100);

  function movePriority(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setPriorityOrder((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setPriorityDragIndex(toIndex);
      return next;
    });
  }

  function handlePriorityMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (priorityDragIndex == null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-priority-index]");
    const targetIndex = target ? Number(target.dataset.priorityIndex) : Number.NaN;
    if (Number.isInteger(targetIndex) && targetIndex !== priorityDragIndex) movePriority(priorityDragIndex, targetIndex);
  }

  function answerQuestion(id: HbtiQuestionId, value: FiveGridValue) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setAnsweredIds((current) => new Set(current).add(id));
  }

  function finishSwipe(reaction: SwipeReaction) {
    const property = HOUSING_CALIBRATION_PROPERTIES[swipeIndex];
    if (!property) return;
    const nextFeedback = [
      ...swipeFeedback,
      { propertyId: property.id, reaction, reasons: feedbackReasons(property.id, reaction) },
    ];
    setSwipeFeedback(nextFeedback);
    setSwipeDragX(0);
    setSwipeDragging(false);
    if (swipeIndex < HOUSING_CALIBRATION_PROPERTIES.length - 1) {
      setSwipeIndex((current) => current + 1);
      return;
    }
    const nextProfile = deriveHbtiProfile(
      answers,
      HOUSING_CALIBRATION_PROPERTIES,
      priorityOrder,
      nextFeedback,
      specificPreferences,
    );
    setProfile(nextProfile);
    setStage("result");
    onComplete(nextProfile);
  }

  function restart() {
    setStage("priority");
    setPageIndex(0);
    setAnswers({ ...DEFAULT_HBTI_ANSWERS });
    setAnsweredIds(new Set());
    setProfile(null);
    setPriorityOrder([...DEFAULT_HOUSING_DNA_ORDER]);
    setSpecificPreferences({ rewards: [], penalties: [] });
    setPriorityDragIndex(null);
    setSwipeIndex(0);
    setSwipeFeedback([]);
    setSwipeDragX(0);
    setSwipeDragging(false);
    onRestart();
  }

  const stageNumber = stage === "priority" ? 1 : stage === "hbti" ? 2 : stage === "swipe" ? 3 : 4;

  if (stage === "result" && profile) {
    const type = text.types[primaryDimension(profile)];
    return (
      <section className="housing-dna standalone-dna hbti-test" id="housing-dna">
        <div className="dna-result hbti-result applied">
          <span className="dna-result-label">{text.result}</span>
          <h4>{type[0]}</h4>
          <p>{type[1]}</p>
          <div className="dna-actions">
            <button type="button" className="secondary-dna" onClick={restart}>{text.restart}</button>
            <button type="button" className="apply-dna" onClick={onContinue}>{hasSearchResults ? text.view : text.goSearch}</button>
          </div>
        </div>
      </section>
    );
  }

  const currentSwipeProperty = HOUSING_CALIBRATION_PROPERTIES[swipeIndex];
  const currentCardCopy = text.cards[swipeIndex];
  const firstQuestion = pageIndex * QUESTIONS_PER_PAGE + 1;
  const lastQuestion = firstQuestion + pageQuestions.length - 1;

  return (
    <section className="housing-dna standalone-dna hbti-test" id="housing-dna">
      <div className="hbti-heading">
        <div><span>HBTI</span><h3>Housing Behavior Type Indicator</h3></div>
      </div>
      <div className="dna-steps">
        {text.steps.map((item, index) => (
          <span className={stageNumber === index + 1 ? "active" : stageNumber > index + 1 ? "done" : ""} key={item}>
            <i>{stageNumber > index + 1 ? "✓" : index + 1}</i>{item}
          </span>
        ))}
      </div>

      {stage === "priority" && (
        <div className="dna-panel priority-stage">
          <div className="dna-panel-intro"><div><strong>{text.priorityTitle}</strong></div><span>01 / 03</span></div>
          <div className="priority-sort-list">
            {priorityOrder.map((key, index) => (
              <div className={`priority-sort-row ${priorityDragIndex === index ? "dragging" : ""}`} data-priority-index={index} key={key}>
                <button
                  type="button"
                  className="priority-drag-handle"
                  aria-label={`${PREFERENCE_LABELS[locale][key]} drag handle`}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setPriorityDragIndex(index);
                  }}
                  onPointerMove={handlePriorityMove}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                    setPriorityDragIndex(null);
                  }}
                  onPointerCancel={() => setPriorityDragIndex(null)}
                >☰</button>
                <span>{index + 1}</span>
                <strong>{PREFERENCE_LABELS[locale][key]}</strong>
                <em>{index === 0 ? "TOP" : `#${index + 1}`}</em>
              </div>
            ))}
          </div>
          <div className="specific-preferences">
            <div className="specific-preferences-heading">
              <strong>{text.specificsTitle}</strong>
            </div>
            <div className="specific-preference-group">
              <b>{text.rewardsTitle}</b>
              <div className="specific-preference-buttons">
                {REWARD_PREFERENCE_KEYS.map((key) => {
                  const selected = specificPreferences.rewards.includes(key);
                  return <button
                    type="button"
                    aria-pressed={selected}
                    className={selected ? "selected reward" : ""}
                    onClick={() => setSpecificPreferences((current) => ({
                      ...current,
                      rewards: selected ? current.rewards.filter((item) => item !== key) : [...current.rewards, key],
                    }))}
                    key={key}
                  >{SPECIFIC_PREFERENCE_COPY[locale][key].label}</button>;
                })}
              </div>
            </div>
            <div className="specific-preference-group penalty">
              <b>{text.penaltiesTitle}</b>
              <div className="specific-preference-buttons">
                {PENALTY_PREFERENCE_KEYS.map((key) => {
                  const selected = specificPreferences.penalties.includes(key);
                  return <button
                    type="button"
                    aria-pressed={selected}
                    className={selected ? "selected penalty" : ""}
                    onClick={() => setSpecificPreferences((current) => ({
                      ...current,
                      penalties: selected ? current.penalties.filter((item) => item !== key) : [...current.penalties, key],
                    }))}
                    key={key}
                  >{SPECIFIC_PREFERENCE_COPY[locale][key].label}</button>;
                })}
              </div>
            </div>
          </div>
          <div className="dna-actions"><span /><button type="button" className="apply-dna" onClick={() => setStage("hbti")}>{text.priorityNext}</button></div>
        </div>
      )}

      {stage === "hbti" && <>
        <div className="hbti-progress-copy">
          <strong>{text.question} {firstQuestion}–{lastQuestion} {text.of} {HBTI_QUESTIONS.length}</strong>
          <span>{text.answered} {answeredIds.size} · {progress}%</span>
        </div>
        <div className="hbti-progress" aria-label={`${progress}%`}><i style={{ width: `${progress}%` }} /></div>
        <div className="hbti-question-list">
          {pageQuestions.map((question, pageQuestionIndex) => {
            const questionNumber = firstQuestion + pageQuestionIndex;
            return (
              <article className={`hbti-question ${answeredIds.has(question.id) ? "answered" : ""}`} key={question.id}>
                <span>{String(questionNumber).padStart(2, "0")}</span>
                <h4>{HBTI_QUESTION_COPY[locale][question.id]}</h4>
                <div className="hbti-scale-labels"><small>{text.disagree}</small><small>{text.neutral}</small><small>{text.agree}</small></div>
                <div className="hbti-scale" role="radiogroup" aria-label={`${text.question} ${questionNumber}`}>
                  {SCALE_VALUES.map((value) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={answeredIds.has(question.id) && answers[question.id] === value}
                      aria-label={value === -2 ? text.disagree : value === 0 ? text.neutral : value === 2 ? text.agree : `${value}`}
                      className={answeredIds.has(question.id) && answers[question.id] === value ? "active" : ""}
                      onClick={() => answerQuestion(question.id, value)}
                      key={value}
                    ><i /></button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        {!pageComplete && <p className="hbti-page-hint">{text.answerAll}</p>}
        <div className="dna-actions hbti-actions">
          <button type="button" className="secondary-dna" onClick={() => pageIndex === 0 ? setStage("priority") : setPageIndex((current) => current - 1)}>{text.previous}</button>
          <span>{text.page} {pageIndex + 1} {text.of} {Math.ceil(HBTI_QUESTIONS.length / QUESTIONS_PER_PAGE)}</span>
          <button
            type="button"
            className="apply-dna"
            disabled={!pageComplete}
            onClick={() => pageIndex === 3 ? setStage("swipe") : setPageIndex((current) => current + 1)}
          >{pageIndex === 3 ? text.finish : text.next}</button>
        </div>
      </>}

      {stage === "swipe" && currentSwipeProperty && currentCardCopy && (
        <div className="dna-panel swipe-test">
          <div className="dna-panel-intro"><div><strong>{text.swipeTitle}</strong></div><span>{swipeIndex + 1} / {HOUSING_CALIBRATION_PROPERTIES.length}</span></div>
          <article
            className={`swipe-card draggable ${swipeDragging ? "dragging" : ""}`}
            style={{ transform: `translateX(${swipeDragX}px) rotate(${swipeDragX / 24}deg)` } as CSSProperties}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setSwipeStartX(event.clientX);
              setSwipeDragging(true);
            }}
            onPointerMove={(event) => {
              if (swipeDragging) setSwipeDragX(event.clientX - swipeStartX);
            }}
            onPointerUp={(event) => {
              const distance = event.clientX - swipeStartX;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              if (Math.abs(distance) >= SWIPE_THRESHOLD) finishSwipe(distance > 0 ? 1 : -1);
              else { setSwipeDragX(0); setSwipeDragging(false); }
            }}
            onPointerCancel={() => { setSwipeDragX(0); setSwipeDragging(false); }}
          >
            <span className={`swipe-stamp dislike ${swipeDragX < -35 ? "visible" : ""}`}>{text.swipeLeft}</span>
            <span className={`swipe-stamp like ${swipeDragX > 35 ? "visible" : ""}`}>{text.swipeRight}</span>
            <div className="swipe-image">
              {currentSwipeProperty.imageUrl ? <img src={`${currentSwipeProperty.imageUrl}?auto=format&fit=crop&w=900&q=78`} alt={currentSwipeProperty.title} draggable={false} /> : <span>DEMO PROPERTY</span>}
              <b>{text.demo}</b>
            </div>
            <div className="swipe-copy">
              <div className="swipe-price"><strong>¥{currentSwipeProperty.monthlyRentYen.toLocaleString()}<small>/{locale === "en" ? "mo" : "月"}</small></strong><span>{currentSwipeProperty.layout} · {currentSwipeProperty.areaSqm}㎡ · {locale === "en" ? `${currentSwipeProperty.buildingAgeYears} years old` : `築${currentSwipeProperty.buildingAgeYears}年`}</span></div>
              <p>🚉 {currentSwipeProperty.station.nameJa} · {locale === "en" ? "Walk" : locale === "ja" ? "徒歩" : "步行"} {currentSwipeProperty.station.walkingMinutes} min · 🚃 {text.sampleCommute} {currentSwipeProperty.commute.finalMinutes} min</p>
              <div className="tradeoff-grid">
                <div><b>{text.pros}</b>{currentCardCopy.pros.map((item) => <span key={item}>✓ {item}</span>)}</div>
                <div><b>{text.cons}</b>{currentCardCopy.cons.map((item) => <span key={item}>△ {item}</span>)}</div>
              </div>
            </div>
          </article>
          <div className="reaction-buttons swipe-choice-buttons">
            <button type="button" onClick={() => finishSwipe(-1)}>← {text.swipeLeft}</button>
            <button type="button" onClick={() => finishSwipe(1)}>{text.swipeRight} →</button>
          </div>
          <div className="dna-actions"><button type="button" className="secondary-dna" onClick={() => { setStage("hbti"); setPageIndex(3); }}>{text.previous}</button><span /></div>
        </div>
      )}
    </section>
  );
}
