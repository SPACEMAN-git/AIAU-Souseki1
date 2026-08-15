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
  PreferenceProfile,
  SwipeFeedback,
  SwipeReaction,
} from "@/lib/housing-scoring";
import { HBTI_QUESTION_COPY, PREFERENCE_LABELS, type Locale } from "@/lib/i18n";

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

const TEXT = {
  zh: {
    intro: "排序、20 道生活题与房源直觉选择，共同生成你的住房人格。",
    independent: "偏好测试与通勤搜索并列，可以先完成任意一个。",
    steps: ["初步排序", "HBTI", "房源 Swipe", "人格结果"],
    priorityTitle: "先排出你最在意的居住条件",
    priorityHint: "按住 ☰ 上下拖动。这一步只建立初始配比，后续回答会继续校准。",
    priorityNext: "下一步：HBTI →",
    question: "题目", answered: "已回答", page: "页", of: "/",
    disagree: "非常不同意", neutral: "中立", agree: "非常同意",
    previous: "← 上一步", next: "下一页 →", finish: "下一步：房源 Swipe →",
    answerAll: "请回答本页的 5 个问题后继续",
    swipeTitle: "凭直觉选择你会不会住",
    swipeHint: "左滑不喜欢，右滑喜欢；松手后会自动进入下一张。",
    swipeLeft: "不喜欢", swipeRight: "喜欢", demo: "偏好校准 Demo",
    pros: "吸引你的地方", cons: "需要取舍", sampleCommute: "示例通勤",
    result: "你的住房人格", blackbox: "具体配比已作为黑箱保存",
    blackboxHint: "排序、HBTI 与滑卡反应已合并，只用于所有合格房源的个性化 Ranking。",
    evidence: ["初步排序已吸收", "20 道 HBTI 已完成", "3 张房源直觉已校准"],
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
    ],
  },
  ja: {
    intro: "優先順位、20問の暮らし診断、物件の直感選択から住まいタイプを作ります。",
    independent: "好み診断と通勤検索は独立しており、どちらからでも始められます。",
    steps: ["優先順位", "HBTI", "物件 Swipe", "タイプ結果"],
    priorityTitle: "住まい選びの優先順位を並べてください",
    priorityHint: "☰ を押したまま上下にドラッグ。ここで初期バランスを作り、後の回答で調整します。",
    priorityNext: "次へ：HBTI →",
    question: "質問", answered: "回答済み", page: "ページ", of: "/",
    disagree: "まったく同意しない", neutral: "中立", agree: "とても同意する",
    previous: "← 戻る", next: "次へ →", finish: "次へ：物件 Swipe →",
    answerAll: "このページの5問すべてに回答してください",
    swipeTitle: "直感で住みたいか選んでください",
    swipeHint: "左は好みではない、右は好き。離すと自動で次のカードへ進みます。",
    swipeLeft: "好みではない", swipeRight: "好き", demo: "好み校正 Demo",
    pros: "魅力", cons: "妥協点", sampleCommute: "想定通勤",
    result: "あなたの住まいタイプ", blackbox: "具体的な配分は非公開で保存",
    blackboxHint: "優先順位、HBTI、カード反応を統合し、対象物件のパーソナル Ranking だけに使用します。",
    evidence: ["優先順位を反映", "HBTI 20問を反映", "物件3枚の直感を反映"],
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
    ],
  },
  en: {
    intro: "Priority ranking, 20 behavior questions and instinctive home choices create your housing type.",
    independent: "Preference testing and commute search are independent — start with either one.",
    steps: ["Priorities", "HBTI", "Home Swipe", "Your Type"],
    priorityTitle: "Rank what matters most in your home search",
    priorityHint: "Hold ☰ and drag vertically. This creates the starting balance; later answers keep calibrating it.",
    priorityNext: "Next: HBTI →",
    question: "Question", answered: "answered", page: "Page", of: "/",
    disagree: "Strongly disagree", neutral: "Neutral", agree: "Strongly agree",
    previous: "← Back", next: "Next →", finish: "Next: Home Swipe →",
    answerAll: "Answer all five questions on this page to continue",
    swipeTitle: "Choose by instinct: would you live here?",
    swipeHint: "Swipe left to pass or right to like. Releasing automatically opens the next card.",
    swipeLeft: "PASS", swipeRight: "LIKE", demo: "Preference calibration demo",
    pros: "What works", cons: "Trade-offs", sampleCommute: "Sample commute",
    result: "Your Housing Type", blackbox: "Your exact mix is saved as a black box",
    blackboxHint: "Priority order, HBTI and card reactions are combined only for personalized ranking of eligible homes.",
    evidence: ["Priority order learned", "20 HBTI answers learned", "3 home instincts calibrated"],
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
  };
  const dislike: Record<string, string[]> = {
    "dna-compact-near-station": ["租金太高", "房间太小"],
    "dna-large-value-room": ["离车站太远", "房子太旧"],
    "dna-new-lifestyle-home": ["租金太高", "通勤太久"],
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
        <div><span>HBTI</span><h3>Housing Behavior Type Indicator</h3><p>{text.intro}</p></div>
        <small>{text.independent}</small>
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
          <div className="dna-panel-intro"><div><strong>{text.priorityTitle}</strong><small>{text.priorityHint}</small></div><span>01 / 03</span></div>
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
          <div className="dna-panel-intro"><div><strong>{text.swipeTitle}</strong><small>{text.swipeHint}</small></div><span>{swipeIndex + 1} / {HOUSING_CALIBRATION_PROPERTIES.length}</span></div>
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
