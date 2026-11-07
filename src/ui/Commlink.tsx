import React, { useState, useEffect, useRef } from 'react';
import { useSimulationStore } from '../engine/store';
import { CHEMICAL_REGISTRY } from '../data/ChemicalRegistry';
import { askLucyAssistant } from '../engine/aiService';
import { audioManager } from '../engine/AudioManager';
import { lucyVoiceEngine } from '../engine/LucyVoiceEngine';
import { generateOfflineLucyResponse, LiveLabSnapshot } from '../services/offlineLucyBrain';
import lucyFacePFP from '../assets/lucy_FACE_PFP_clean.png';
import { t } from '../i18n/uiTranslations';

interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

const Commlink: React.FC = () => {
    const env = useSimulationStore(state => state.env);
    const rawLanguage = useSimulationStore(state => state.language);
    const language = rawLanguage === 'VN' || rawLanguage === 'vi' ? 'vi' : 'en';
    const containers = useSimulationStore(state => state.containers);
    const selectedContainerId = useSimulationStore(state => state.selectedContainerId);
    const pendingReaction = useSimulationStore(state => state.pendingReaction);

    const welcomeEN = "Welcome to the Quantum Reality Engine. I am Professor Lucy. What is your hypothesis?";
    const welcomeVI = "Chào mừng em đến với Quantum Reality Engine. Cô là Giáo sư Lucy. Giả thuyết của em là gì?";

    const [userInput, setUserInput] = useState("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([{ 
        sender: 'ai', 
        text: language === 'vi' ? welcomeVI : welcomeEN 
    }]);
    const [isThinking, setIsThinking] = useState(false);
    const [isVoiceActive, setIsVoiceActive] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [isChatExpanded, setIsChatExpanded] = useState(true);

    // Subscribe to voice speaking state for audio visualization
    useEffect(() => {
        const unsubscribe = lucyVoiceEngine.subscribeSpeaking((speaking) => {
            setIsSpeaking(speaking);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (chatHistory.length === 1 && chatHistory[0].sender === 'ai') {
            const welcomeText = language === 'vi' ? welcomeVI : welcomeEN;
            if (chatHistory[0].text !== welcomeText) {
                setChatHistory([{ sender: 'ai', text: welcomeText }]);
            }
        }
    }, [language, welcomeVI, welcomeEN]);

    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const handleCopy = (text: string, idx: number) => {
        audioManager.playClick();
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const handlePlayVoice = (text: string) => {
        audioManager.playClick();
        if (isSpeaking) {
            lucyVoiceEngine.stop();
        } else {
            lucyVoiceEngine.speak(text, language);
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isThinking]);

    const handleAnalyze = async (query: string | React.MouseEvent) => {
        const textQuery = typeof query === 'string' ? query : (language === 'vi' ? "Báo cáo cho em trạng thái bàn thí nghiệm hiện tại." : "Give me a general status report on the current workbench.");
        setChatHistory(prev => [...prev, { sender: 'user', text: textQuery }]);
        setIsThinking(true);

        const activeContainer = containers.find(c => c.id === selectedContainerId) || containers[0];
        const activeVesselChemicals = activeContainer?.contents 
            ? Object.keys(activeContainer.contents).filter(k => (activeContainer.contents[k] || 0) > 0.001)
            : [];

        const labSnapshot: LiveLabSnapshot = {
            activeVesselChemicals,
            temperature: env.temp,
            pressure: env.pressure,
            ph: activeContainer ? activeContainer.ph : 7.0,
            lastReactionEquation: pendingReaction?.equation ? (language === 'vi' ? pendingReaction.equation.VN : pendingReaction.equation.EN) : undefined,
            lastReactionMessage: pendingReaction?.mechanism ? (language === 'vi' ? pendingReaction.mechanism.VN : pendingReaction.mechanism.EN) : undefined,
            language: language === 'vi' ? 'VN' : 'EN'
        };
        
        try {
            const cleanState = containers.map(c => ({
                id: c.id,
                volume: c.volume,
                pH: c.ph.toFixed(1),
                contents: Object.entries(c.contents).reduce((acc, [chemId, vol]) => {
                    if(!chemId.startsWith('reacted_')) {
                        acc[(CHEMICAL_REGISTRY[chemId]?.name as any)?.[language] || CHEMICAL_REGISTRY[chemId]?.name.EN || chemId] = vol;
                    }
                    return acc;
                }, {} as Record<string, number>),
                temperature: env.temp
            }));

            const sysInstruction = language === 'vi' 
                ? "\n\nSystem Instruction: Giao diện đang ở chế độ tiếng Việt. Bạn PHẢI xưng là 'Cô' (hoặc 'Cô Lucy') và gọi người dùng là 'em', phản hồi hoàn toàn bằng tiếng Việt với ngữ điệu tự nhiên, chuẩn kiến thức hóa học."
                : "\n\nSystem Instruction: The user has selected English. You MUST address the user as 'Researcher' or 'you'.";

            const payloadQuery = textQuery + sysInstruction;

            let response = await askLucyAssistant(payloadQuery, cleanState);
            if (!response || response.includes("Dữ liệu phòng thí nghiệm đã được đồng bộ") || response.includes("Lab data synchronized")) {
                response = generateOfflineLucyResponse(textQuery, labSnapshot);
            }

            setChatHistory(prev => [...prev, { sender: 'ai', text: response }]);

            if (isVoiceActive) {
                lucyVoiceEngine.speak(response, language);
            }
        } catch (err) {
            console.warn("Routing to Offline Lucy Brain:", err);
            const fallbackMsg = generateOfflineLucyResponse(textQuery, labSnapshot);
            setChatHistory(prev => [...prev, { sender: 'ai', text: fallbackMsg }]);
            if (isVoiceActive) {
                lucyVoiceEngine.speak(fallbackMsg, language);
            }
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && userInput.trim()) {
            handleAnalyze(userInput);
            setUserInput("");
        }
    };

    return (
        <div className="scifi-hud-card absolute bottom-5 right-5 z-50 w-[390px] sm:w-[425px] max-w-[92vw] pointer-events-auto bg-gradient-to-br from-[#06182c]/96 via-[#040e1e]/96 to-[#0b071e]/98 backdrop-blur-2xl rounded-3xl border-2 border-cyan-400/50 shadow-[0_15px_55px_rgba(0,0,0,0.9),0_0_35px_rgba(16,185,129,0.2)] p-4 flex flex-col overflow-hidden transition-all duration-300">
            {/* Top Prismatic Chemical Spectrum Ribbon */}
            <div className="absolute top-0 left-5 right-5 h-[3px] rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 via-purple-400 to-amber-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            <div className="absolute -top-14 -left-14 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-14 -right-14 w-32 h-32 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

            {/* Holographic Header */}
            <div className="relative z-10 flex items-center justify-between gap-3">
                <div
                    className="flex items-center gap-3 cursor-pointer group flex-grow"
                    onClick={() => { audioManager.playClick(); setIsChatExpanded(!isChatExpanded); }}
                    onMouseEnter={() => audioManager.playHover()}
                >
                    <div className="relative shrink-0">
                        <div className={`p-0.5 rounded-full bg-gradient-to-tr from-emerald-400 via-cyan-400 to-purple-500 shadow-[0_0_15px_rgba(52,211,153,0.45)] transition-transform duration-300 ${
                            isSpeaking ? 'scale-105 ring-2 ring-emerald-300' : 'group-hover:scale-105'
                        }`}>
                            <img 
                                src={lucyFacePFP} 
                                alt="Lucy Avatar" 
                                className="w-11 h-11 rounded-full border border-slate-950 object-cover"
                            />
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#030914] rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
                    </div>

                    <div className="flex flex-col">
                        <h2 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-emerald-200 tracking-wide font-sans flex items-center gap-2">
                            <span>{t('profLucyTitle', rawLanguage)}</span>
                            <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-950/75 px-1.5 py-0.5 rounded-md border border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                                {t('aiAssistantBadge', rawLanguage)}
                            </span>
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            {isSpeaking ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                    <span className="text-[10px] font-mono font-bold text-cyan-300 tracking-wider uppercase animate-pulse">
                                        {t('statusSpeaking', rawLanguage)}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                                    <span className="text-[10px] font-mono font-bold text-emerald-300/90 tracking-wider uppercase">
                                        {t('statusOnlineOffline', rawLanguage)}
                                    </span>
                                </div>
                            )}
                            {/* Mini Multi-Color Equalizer Bars */}
                            <div className="flex items-center gap-0.5 ml-1">
                                <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                                <span className="w-0.5 h-3.5 bg-cyan-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite_0.1s]" />
                                <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite_0.2s]" />
                                <span className="w-0.5 h-3 bg-amber-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.3s]" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Voice Toggle Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            audioManager.playClick();
                            if (isVoiceActive && isSpeaking) {
                                lucyVoiceEngine.stop();
                            }
                            setIsVoiceActive(!isVoiceActive);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl font-mono text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                            isVoiceActive 
                                ? 'bg-gradient-to-r from-emerald-950/90 to-cyan-950/90 border-emerald-400/60 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
                                : 'bg-[#030914] border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                        title={language === 'vi' ? 'Bật/Tắt Giọng nói của Lucy' : 'Toggle Lucy TTS Voice'}
                    >
                        <span>{isVoiceActive ? '🔊' : '🔇'}</span>
                        <span className="hidden sm:inline">{isVoiceActive ? t('btnVoice', rawLanguage) : t('btnMute', rawLanguage)}</span>
                    </button>

                    <button 
                        onClick={() => { audioManager.playClick(); setIsChatExpanded(!isChatExpanded); }}
                        className="w-7 h-7 rounded-xl bg-cyan-950/60 border border-cyan-500/35 hover:border-cyan-300 text-cyan-300 text-xs font-mono flex items-center justify-center hover:scale-110 transition-all duration-300 cursor-pointer"
                    >
                        <span className={`inline-block transition-transform duration-300 ${isChatExpanded ? 'rotate-0' : 'rotate-180'}`}>
                            ▼
                        </span>
                    </button>
                </div>
            </div>

            {/* Expandable Chat Console */}
            <div className={`relative z-10 transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${isChatExpanded ? 'max-h-[540px] opacity-100 mt-3.5 gap-3' : 'max-h-0 opacity-0 mt-0 gap-0'}`}>
                
                {/* Vivid Color-Coded Quick Action Suggestion Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
                    <button
                        onClick={() => handleAnalyze("What is in my containers right now? Give me a status report.")}
                        disabled={isThinking}
                        className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/45 hover:border-cyan-300 text-[10px] font-mono font-bold text-cyan-200 rounded-xl whitespace-nowrap transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] active:scale-95 cursor-pointer"
                    >
                        🔍 {t('btnStatusReport', rawLanguage)}
                    </button>
                    <button
                        onClick={() => handleAnalyze(language === 'vi' ? "Giải thích màu sắc của các dung dịch, chất chỉ thị và kết tủa trong bình hiện tại!" : "Explain the vivid colors of the solutions, indicators, and precipitates in my containers!")}
                        disabled={isThinking}
                        className="px-2.5 py-1 bg-pink-950/60 hover:bg-pink-900/80 border border-pink-500/45 hover:border-pink-300 text-[10px] font-mono font-bold text-pink-200 rounded-xl whitespace-nowrap transition-all shadow-[0_0_10px_rgba(236,72,153,0.15)] active:scale-95 cursor-pointer"
                    >
                        🎨 {language === 'vi' ? 'Giải Thích Màu' : 'Color Guide'}
                    </button>
                    <button
                        onClick={() => handleAnalyze("Are any of the chemicals currently mixed dangerous or reacting?")}
                        disabled={isThinking}
                        className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/45 hover:border-amber-300 text-[10px] font-mono font-bold text-amber-200 rounded-xl whitespace-nowrap transition-all shadow-[0_0_10px_rgba(245,158,11,0.15)] active:scale-95 cursor-pointer"
                    >
                        ⚡ {t('btnSafetyCheck', rawLanguage)}
                    </button>
                    <button
                        onClick={() => handleAnalyze("Give me an educational chemistry challenge or pop quiz to test my knowledge!")}
                        disabled={isThinking}
                        className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/45 hover:border-emerald-300 text-[10px] font-mono font-bold text-emerald-200 rounded-xl whitespace-nowrap transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] active:scale-95 cursor-pointer"
                    >
                        🎯 {t('btnPopQuiz', rawLanguage)}
                    </button>
                </div>

                {/* Chat Body */}
                <div className="h-[275px] overflow-y-auto flex flex-col gap-2.5 p-3 pt-3.5 pb-3.5 custom-scrollbar bg-[#020814]/80 rounded-2xl border border-cyan-500/25 shadow-inner font-sans text-xs relative select-text scroll-smooth">
                    <div className="relative z-10 flex flex-col gap-2.5 select-text">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} select-text`}>
                                <div className={`px-3.5 py-2.5 rounded-2xl max-w-[92%] whitespace-pre-wrap leading-relaxed shadow-md select-text cursor-text selection:bg-emerald-500/40 selection:text-white ${
                                    msg.sender === 'user' 
                                        ? 'bg-gradient-to-r from-cyan-950/85 via-indigo-950/85 to-purple-950/85 text-cyan-100 border border-cyan-400/45' 
                                        : 'bg-gradient-to-br from-[#07192e]/95 via-[#051224]/95 to-[#0b0d24]/95 text-slate-100 border border-emerald-500/30 border-l-4 border-l-emerald-400'
                                }`}>
                                    <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/10 select-none">
                                        <span className={`block text-[8.5px] font-mono font-bold uppercase tracking-wider ${
                                            msg.sender === 'user' ? 'text-cyan-300' : 'text-emerald-300'
                                        }`}>
                                            {msg.sender === 'user' ? `> ${t('researcherLabel', rawLanguage)}` : `✦ ${t('profLucyTitle', rawLanguage)}`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {msg.sender === 'ai' && (
                                                <button
                                                    onClick={() => handlePlayVoice(msg.text)}
                                                    className="text-[9px] font-mono text-emerald-300 hover:text-white bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                                    title={language === 'vi' ? 'Nghe Giáo sư Lucy đọc' : 'Listen to Prof. Lucy'}
                                                >
                                                    <span>{isSpeaking ? '⏹' : '🔊'}</span>
                                                    <span>{isSpeaking ? (language === 'vi' ? 'DỪNG' : 'STOP') : (language === 'vi' ? 'NGHE' : 'VOICE')}</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleCopy(msg.text, i)}
                                                className="text-[9px] font-mono text-slate-300 hover:text-cyan-200 opacity-75 hover:opacity-100 transition-all flex items-center gap-1 cursor-pointer"
                                                title={language === 'vi' ? 'Sao chép vào khay nhớ tạm' : 'Copy to clipboard'}
                                            >
                                                {copiedIdx === i ? (
                                                    <span className="text-emerald-400 font-bold">✓ {t('btnCopied', rawLanguage)}</span>
                                                ) : (
                                                    <span>📋 {t('btnCopy', rawLanguage)}</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="select-text cursor-text selection:bg-emerald-500/40 selection:text-white text-[12.5px]">
                                        {msg.text}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isThinking && (
                            <div className="flex items-start">
                                <div className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-cyan-950/70 text-emerald-300 font-mono text-[10px] uppercase tracking-wider border border-emerald-400/45 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                    <span>{t('lucyAnalyzing', rawLanguage)}</span>
                                    <span className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Chat Input */}
                <div className="relative flex items-center gap-2 shrink-0">
                    <input
                        type="text"
                        placeholder={t('chatPlaceholder', rawLanguage)}
                        className="text-cyan-100 font-sans text-xs bg-[#020814] h-10 px-3.5 rounded-xl border border-cyan-500/40 flex-grow focus:outline-none focus:border-emerald-400 transition-colors placeholder:text-slate-500 shadow-inner"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isThinking}
                    />
                    <button
                        className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-600 hover:from-emerald-400 hover:via-cyan-400 hover:to-purple-500 rounded-xl text-white font-bold transition-all flex items-center justify-center h-10 w-11 shrink-0 shadow-[0_0_18px_rgba(16,185,129,0.4)] active:scale-95 cursor-pointer"
                        onClick={() => {
                            if(userInput.trim()) {
                                handleAnalyze(userInput);
                                setUserInput("");
                            }
                        }}
                    >
                        <span className="text-sm font-mono font-black">➔</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Commlink;
