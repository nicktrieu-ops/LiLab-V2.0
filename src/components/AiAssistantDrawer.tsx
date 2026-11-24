import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  Copy,
  Languages,
  MessageSquare,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  buildAcademyContextSummary,
  fetchAuthorizedAcademySnapshot,
  searchAcademySnapshot,
  type AcademySnapshot,
  type SearchHit,
} from '../services/academySearch';
import { sendAiChat, translateText, type ChatHistoryItem } from '../services/aiClient';
import { biText, TRANSLATIONS } from '../i18n';
import type { LangCode, UserProfile } from '../types';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  initialTab?: 'chat' | 'translate';
  onClose: () => void;
  lang: LangCode;
  role: string;
  currentUser?: UserProfile | null;
}

interface RichChatMessage extends ChatHistoryItem {
  hits?: SearchHit[];
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  initialTab = 'chat',
  onClose,
  lang,
  role,
  currentUser = null,
}) => {
  const t = TRANSLATIONS[lang];
  const [tab, setTab] = useState<'chat' | 'translate'>(initialTab);
  const [replyLang, setReplyLang] = useState<'auto' | 'en' | 'vi' | 'bi'>(lang === 'bi' ? 'bi' : 'auto');
  const [snapshot, setSnapshot] = useState<AcademySnapshot | null>(null);
  const [liveHits, setLiveHits] = useState<SearchHit[]>([]);

  const [messages, setMessages] = useState<RichChatMessage[]>([
    {
      sender: 'assistant',
      text: biText(
        lang,
        'Hello! I am the LiLab Vietnamese/English AI Assistant & Search Copilot. Ask any question or search students, teachers, classes, schedules, invoices, banking, and Gemini Notes.',
        'Xin chào! Tôi là Trợ lý AI & Tìm kiếm Song ngữ (Việt / Anh) của Học viện LiLab. Bạn có thể hỏi bất kỳ câu hỏi nào hoặc tìm kiếm học viên, giáo viên, lớp học, lịch dạy, hóa đơn, ngân hàng và Gemini Notes.'
      ),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [sourceText, setSourceText] = useState('');
  const [targetLang, setTargetLang] = useState<'en' | 'vi'>(lang === 'en' ? 'vi' : 'en');
  const [translatedOutput, setTranslatedOutput] = useState('');
  const [translateLoading, setTranslateLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Refresh live authorized Firestore snapshot whenever drawer opens for a logged-in user
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    fetchAuthorizedAcademySnapshot(currentUser)
      .then((snap) => setSnapshot(snap))
      .catch((err) => console.warn('Snapshot load warning:', err));
  }, [isOpen, currentUser]);

  // Instant search preview as user types in the chatbox
  useEffect(() => {
    if (!snapshot || !chatInput.trim()) {
      setLiveHits([]);
      return;
    }
    setLiveHits(searchAcademySnapshot(chatInput, snapshot));
  }, [chatInput, snapshot]);

  if (!isOpen) return null;

  const submitQuery = async (rawPrompt: string) => {
    const userMsg = rawPrompt.trim();
    if (!userMsg || chatLoading) return;
    setChatInput('');
    setLiveHits([]);
    setErrorMsg(null);

    const updatedHistory: RichChatMessage[] = [...messages, { sender: 'user', text: userMsg }];
    setMessages(updatedHistory);
    setChatLoading(true);

    try {
      let activeSnap = snapshot;
      if (currentUser && !activeSnap) {
        activeSnap = await fetchAuthorizedAcademySnapshot(currentUser);
        setSnapshot(activeSnap);
      }

      const hits = activeSnap ? searchAcademySnapshot(userMsg, activeSnap) : [];
      const contextSummary = activeSnap ? buildAcademyContextSummary(activeSnap) : '';

      const reply = await sendAiChat({
        message: userMsg,
        history: updatedHistory.map((m) => ({ sender: m.sender, text: m.text })),
        lang,
        preferredReplyLang: replyLang === 'bi' ? 'auto' : replyLang,
        role,
        contextSummary,
        searchResults: hits,
      });

      setMessages([...updatedHistory, { sender: 'assistant', text: reply, hits }]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuery(chatInput);
  };

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceText.trim() || translateLoading) return;
    setErrorMsg(null);
    setTranslateLoading(true);
    try {
      const result = await translateText({
        text: sourceText.trim(),
        targetLang,
      });
      setTranslatedOutput(result);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setTranslateLoading(false);
    }
  };

  const handleCopy = () => {
    if (!translatedOutput) return;
    navigator.clipboard.writeText(translatedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const quickPrompts =
    lang === 'vi'
      ? [
          'Tìm hóa đơn chưa thanh toán',
          'Tóm tắt giáo trình Tuần 01 Kindness',
          'Giải thích khung Cambridge CEFR -/+',
          'Lịch học và lớp đang hoạt động',
        ]
      : [
          'Search pending invoices & banking',
          'Summarize Week 01 Kindness',
          'Explain Cambridge CEFR -/+',
          'Show active classes & schedules',
        ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#172154]/30 backdrop-blur-[2px] no-print">
      <div className="w-full max-w-lg bg-white h-full border-l border-[#2D3E99]/15 flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2D3E99]/12 flex items-center justify-between bg-[#FDF9EE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2D3E99] text-white flex items-center justify-center">
              {tab === 'chat' ? <MessageSquare className="w-4 h-4" /> : <Languages className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#2D3E99]">{t.aiHelperTitle}</h3>
              <p className="text-xs text-[#172154]/65">
                {currentUser
                  ? biText(lang, 'Live Backend Search & Q&A (VI / EN)', 'Tìm kiếm dữ liệu & Hỏi đáp (Việt / Anh)')
                  : 'Tiếng Việt · English'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Drawer"
            className="p-2 rounded-lg text-[#172154]/70 hover:bg-[#2D3E99]/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs & Reply Language Switch */}
        <div className="px-5 pt-3 pb-2.5 border-b border-[#2D3E99]/10 bg-white space-y-2.5">
          <div className="grid grid-cols-2 p-1 bg-[#FDF9EE] rounded-lg border border-[#2D3E99]/10">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'chat' ? 'bg-[#2D3E99] text-white' : 'text-[#172154]/70 hover:text-[#172154]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              {biText(lang, 'AI Chat & Search', 'Chat & Tìm kiếm AI')}
            </button>
            <button
              type="button"
              onClick={() => setTab('translate')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === 'translate' ? 'bg-[#E61E64] text-white' : 'text-[#172154]/70 hover:text-[#172154]'
              }`}
            >
              <Languages className="w-3.5 h-3.5" />
              {t.translatorTab}
            </button>
          </div>

          {tab === 'chat' && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#172154]/65 font-medium">
                {biText(lang, 'Reply language:', 'Ngôn ngữ trả lời:')}
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-[#FDF9EE] border border-[#2D3E99]/12 rounded-lg">
                {(
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'vi', label: 'Tiếng Việt' },
                    { id: 'en', label: 'English' },
                    { id: 'bi', label: 'EN+VI' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReplyLang(opt.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      replyLang === opt.id
                        ? 'bg-[#2D3E99] text-white'
                        : 'text-[#172154]/70 hover:text-[#172154]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-[#E61E64]/10 border border-[#E61E64]/30 text-xs text-[#b0134a]">
            {errorMsg}
          </div>
        )}

        {tab === 'chat' ? (
          <>
            {/* Quick Suggestion Prompts */}
            <div className="px-5 py-2.5 border-b border-[#2D3E99]/8 flex flex-wrap gap-1.5 bg-[#FDF9EE]/40">
              {quickPrompts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => submitQuery(qp)}
                  disabled={chatLoading}
                  className="px-2.5 py-1 rounded-md bg-white border border-[#2D3E99]/15 text-[11px] font-semibold text-[#2D3E99] hover:bg-[#2D3E99]/5 transition-colors cursor-pointer"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Chat History + Live Matched Records */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className="space-y-2">
                  <div className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        m.sender === 'user'
                          ? 'bg-[#2D3E99] text-white'
                          : 'bg-[#FDF9EE] border border-[#2D3E99]/12 text-[#172154]'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                  {m.hits && m.hits.length > 0 && (
                    <div className="pl-2 space-y-1.5">
                      <div className="text-[11px] font-semibold text-[#E61E64]">
                        {lang === 'vi' ? 'Kết quả dữ liệu Học viện:' : 'Matched Academy Records:'}
                      </div>
                      {m.hits.map((h, hIdx) => (
                        <div
                          key={hIdx}
                          className="p-2.5 rounded-lg bg-white border border-[#2D3E99]/12 text-xs space-y-0.5"
                        >
                          <div className="font-semibold text-[#2D3E99]">
                            {h.category} · {h.title}
                          </div>
                          <div className="text-[#172154]/75">{h.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-[#2D3E99]/70 px-2">
                  {lang === 'vi' ? 'Đang tìm kiếm & phân tích...' : 'Searching & composing reply...'}
                </div>
              )}
            </div>

            {/* Live Instant Search Preview Strip while typing */}
            {liveHits.length > 0 && (
              <div className="px-4 py-2 border-t border-[#2D3E99]/10 bg-[#FDF9EE]/80 max-h-32 overflow-y-auto space-y-1">
                <div className="text-[11px] font-semibold text-[#2D3E99]">
                  {lang === 'vi' ? 'Tìm thấy nhanh trong hệ thống:' : 'Instant Backend Matches:'}
                </div>
                {liveHits.slice(0, 3).map((h, i) => (
                  <div key={i} className="text-xs text-[#172154]/80 truncate">
                    <span className="font-semibold text-[#E61E64]">{h.category}:</span> {h.title} — {h.detail}
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSendChat}
              className="p-4 border-t border-[#2D3E99]/12 bg-[#FDF9EE]/60 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  lang === 'vi'
                    ? 'Hỏi hoặc tìm kiếm (Tiếng Việt / English)...'
                    : 'Ask a question or search records (EN / VI)...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#2D3E99]/20 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2D3E99]"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2.5 rounded-lg bg-[#E61E64] text-white hover:bg-[#c81856] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 bg-[#FDF9EE] p-3 rounded-xl border border-[#2D3E99]/12">
              <span className="text-xs font-semibold text-[#2D3E99]">
                {targetLang === 'vi' ? 'English → Tiếng Việt' : 'Tiếng Việt → English'}
              </span>
              <button
                type="button"
                onClick={() => setTargetLang((prev) => (prev === 'vi' ? 'en' : 'vi'))}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#2D3E99]/15 text-xs font-semibold text-[#172154] hover:bg-[#2D3E99]/5 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {lang === 'vi' ? 'Đổi chiều' : 'Swap'}
              </button>
            </div>

            <form onSubmit={handleTranslate} className="space-y-3">
              <label className="block text-xs font-semibold text-[#172154]">
                {lang === 'vi' ? 'Văn bản gốc' : 'Source Text'}
              </label>
              <textarea
                rows={5}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={
                  targetLang === 'vi'
                    ? 'Paste English teacher notes, CEFR feedback, or homework...'
                    : 'Dán ghi chú tiếng Việt, nhận xét hoặc tin nhắn phụ huynh...'
                }
                className="w-full p-3 rounded-xl border border-[#2D3E99]/20 bg-[#FDF9EE]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#E61E64]"
              />
              <button
                type="submit"
                disabled={translateLoading || !sourceText.trim()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E61E64] text-white text-sm font-semibold hover:bg-[#c81856] transition-colors cursor-pointer disabled:opacity-50"
              >
                {translateLoading
                  ? lang === 'vi'
                    ? 'Đang dịch...'
                    : 'Translating...'
                  : t.translateBtn}
              </button>
            </form>

            {translatedOutput && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#56BEB8]">
                    {lang === 'vi' ? 'Bản dịch' : 'Translation'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-semibold text-[#2D3E99] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? (lang === 'vi' ? 'Đã chép' : 'Copied') : lang === 'vi' ? 'Sao chép' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 text-sm leading-relaxed whitespace-pre-wrap">
                  {translatedOutput}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
