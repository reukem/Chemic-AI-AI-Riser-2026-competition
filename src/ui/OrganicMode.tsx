import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore } from '../engine/store';
import { 
  STARTER_FRAGMENTS, 
  CRAFTABLE_COMPOUNDS, 
  ALL_ORGANIC_TOKENS, 
  OrganicTokenData, 
  SYNTHESIS_REACTIONS 
} from '../data/organicSandboxData';
import { combineOrganicTokens, getDynamicLucyFailureExplanation } from '../engine/organicSandboxEngine';
import { MolecularCardModal } from './components/MolecularCardModal';
import { OrganicPuzzleView } from './OrganicPuzzleView';
import { audioManager } from '../engine/AudioManager';
import { askLucyAssistant } from '../engine/aiService';
import lucyStandingMenu from '../assets/lucy_STANDING_MENU_clean.png';
import lucyFacePFP from '../assets/lucy_FACE_PFP_clean.png';

interface BoardToken {
  instanceId: string;
  tokenId: string;
  x: number;
  y: number;
}

interface ReactionSpark {
  id: string;
  x: number;
  y: number;
  text: string;
}

export const OrganicMode: React.FC = () => {
  const setOrganicMode = useSimulationStore(state => state.setOrganicMode);
  const rawLanguage = useSimulationStore(state => state.language);
  const isVi = String(rawLanguage).toLowerCase().includes('v');

  // Sub-mode switcher: 'SANDBOX' (Infinite Craft) or 'PUZZLE' (Synthesis Wordle)
  const [subMode, setSubMode] = useState<'SANDBOX' | 'PUZZLE'>('SANDBOX');

  // Canvas bounds ref
  const canvasRef = useRef<HTMLDivElement>(null);

  // Active tokens on the workbench canvas
  const [boardTokens, setBoardTokens] = useState<BoardToken[]>(() => {
    return [
      { instanceId: 'init_1', tokenId: 'methyl', x: 180, y: 160 },
      { instanceId: 'init_2', tokenId: 'ethyl', x: 340, y: 160 },
      { instanceId: 'init_3', tokenId: 'hydroxy', x: 260, y: 280 }
    ];
  });

  // Persistent / Session Discovered Compound IDs
  const [discoveredIds, setDiscoveredIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('chemic_organic_discoveries');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Save discoveries to local storage
  useEffect(() => {
    localStorage.setItem('chemic_organic_discoveries', JSON.stringify(discoveredIds));
  }, [discoveredIds]);

  // Sidebar controls
  const [activeTab, setActiveTab] = useState<'ALL' | 'STARTERS' | 'DISCOVERIES' | 'CATALOG'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Drag interaction states
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null);

  // Visual effects
  const [sparks, setSparks] = useState<ReactionSpark[]>([]);

  // Lucy guidance & commentary
  const [lucyMessage, setLucyMessage] = useState<string>(() => 
    isVi 
      ? 'Chào mừng em đến với Xưởng Phân Tử Hữu Cơ! Kéo và ghép các mảnh phân tử vào nhau để tổng hợp các hợp chất hữu cơ có thật nhé!'
      : 'Welcome to the Organic Molecular Sandbox! Drag and combine molecular fragments to synthesize authentic, real-world organic compounds!'
  );
  const [isLucyThinking, setIsLucyThinking] = useState(false);

  // Lucy Organic Chatbot States
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'lucy'; text: string }[]>([
    {
      sender: 'lucy',
      text: isVi 
        ? 'Chào mừng em đến với Xưởng Phân Tử Hữu Cơ! Em có thể hỏi tôi bất cứ điều gì: từ cách tạo este, anken, giải thích cơ chế phản ứng, đến mẹo kết hợp các mảnh đang có trên bàn nhé!'
        : 'Welcome to the Organic Molecular Sandbox! You can ask me anything: synthesis recipes, mechanisms, IUPAC nomenclature, or what you can craft with your current board pieces!'
    }
  ]);
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLucyThinking]);

  // Detailed Card Inspection Modal
  const [inspectedCompound, setInspectedCompound] = useState<OrganicTokenData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Newly synthesized celebration banner
  const [recentDiscovery, setRecentDiscovery] = useState<OrganicTokenData | null>(null);

  // Total craftable count
  const totalCraftableCount = Object.keys(CRAFTABLE_COMPOUNDS).length;

  // Filtered sidebar items
  const sidebarItems = useMemo(() => {
    let items: OrganicTokenData[] = [];
    if (activeTab === 'ALL') {
      items = [
        ...Object.values(STARTER_FRAGMENTS),
        ...discoveredIds.map(id => CRAFTABLE_COMPOUNDS[id]).filter(Boolean)
      ];
    } else if (activeTab === 'STARTERS') {
      items = Object.values(STARTER_FRAGMENTS);
    } else if (activeTab === 'DISCOVERIES') {
      items = discoveredIds.map(id => CRAFTABLE_COMPOUNDS[id]).filter(Boolean);
    } else if (activeTab === 'CATALOG') {
      items = Object.values(CRAFTABLE_COMPOUNDS);
    }

    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.vietnameseName.toLowerCase().includes(q) ||
      item.formula.toLowerCase().includes(q) ||
      item.displaySymbol.toLowerCase().includes(q)
    );
  }, [activeTab, searchQuery, discoveredIds]);

  // If user selected PUZZLE mode, render OrganicPuzzleView seamlessly
  if (subMode === 'PUZZLE') {
    return (
      <OrganicPuzzleView 
        onBackToMenu={() => setOrganicMode(false)}
        onSwitchToSandbox={() => setSubMode('SANDBOX')}
      />
    );
  }

  // Spawn token onto the board
  const handleSpawnToken = (tokenId: string, spawnX?: number, spawnY?: number) => {
    audioManager.playClick();
    const canvas = canvasRef.current;
    const defaultX = spawnX ?? (canvas ? canvas.clientWidth / 2 - 50 + (Math.random() * 80 - 40) : 260);
    const defaultY = spawnY ?? (canvas ? canvas.clientHeight / 2 - 50 + (Math.random() * 80 - 40) : 220);

    const newToken: BoardToken = {
      instanceId: `token_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tokenId,
      x: defaultX,
      y: defaultY
    };

    setBoardTokens(prev => [...prev, newToken]);
  };

  // Clear all tokens from the canvas
  const handleClearBoard = () => {
    audioManager.playClick();
    setBoardTokens([]);
    setLucyMessage(
      isVi 
        ? 'Bàn thí nghiệm đã được dọn sạch bong! Hãy kéo các mảnh gốc từ thư viện bên phải để bắt đầu lại nhé!'
        : 'Workbench swept clean! Drag fragments from the right library to start fresh!'
    );
  };

  // Auto-arrange tokens into an organized grid
  const handleAutoArrange = () => {
    audioManager.playClick();
    const cols = 4;
    const spacingX = 140;
    const spacingY = 120;
    const startX = 60;
    const startY = 70;

    setBoardTokens(prev => 
      prev.map((t, idx) => ({
        ...t,
        x: startX + (idx % cols) * spacingX,
        y: startY + Math.floor(idx / cols) * spacingY
      }))
    );
  };

  // Send message to Lucy with Organic Sandbox context
  const handleSendChatMessage = async (queryText?: string) => {
    const q = (queryText || userInput).trim();
    if (!q || isLucyThinking) return;

    audioManager.playClick();
    setUserInput('');
    setIsChatExpanded(true);
    setChatHistory(prev => [...prev, { sender: 'user', text: q }]);
    setIsLucyThinking(true);

    const currentTokens = boardTokens.map(bt => {
      const tok = ALL_ORGANIC_TOKENS[bt.tokenId];
      return {
        name: tok?.name || bt.tokenId,
        vietnameseName: tok?.vietnameseName,
        formula: tok?.formula || '',
        category: tok?.category
      };
    });

    const remaining = Object.values(CRAFTABLE_COMPOUNDS).filter(c => !discoveredIds.includes(c.id));
    let suggestedHint: string | undefined;
    if (remaining.length > 0) {
      const randTarget = remaining[Math.floor(Math.random() * remaining.length)];
      const matchRx = SYNTHESIS_REACTIONS.find(r => r.resultId === randTarget.id);
      if (matchRx) {
        const inA = ALL_ORGANIC_TOKENS[matchRx.inputs[0]];
        const inB = ALL_ORGANIC_TOKENS[matchRx.inputs[1]];
        const nameA = isVi ? inA?.vietnameseName : inA?.name;
        const nameB = isVi ? inB?.vietnameseName : inB?.name;
        const targetName = isVi ? randTarget.vietnameseName : randTarget.name;
        suggestedHint = isVi 
          ? `Gợi ý của cô Lucy: Hãy thử kết hợp "${nameA}" với "${nameB}" xem, em sẽ tạo ra "${targetName}" (${randTarget.formula}) đấy!`
          : `Lucy's Tip: Try combining "${nameA}" with "${nameB}" to synthesize "${targetName}" (${randTarget.formula})!`;
      }
    }

    const organicContext = {
      boardTokens: currentTokens,
      discoveredCount: discoveredIds.length,
      totalCount: totalCraftableCount,
      remainingTargets: remaining.slice(0, 5).map(c => ({ name: c.name, vietnameseName: c.vietnameseName, formula: c.formula })),
      suggestedHint
    };

    const sysInstruction = isVi 
      ? "\n\nSystem Instruction: Bạn là Giáo sư Lucy đang hỗ trợ học sinh trong Xưởng Hóa Học Hữu Cơ (Organic Molecular Sandbox). Trả lời bằng 100% tiếng Việt tự nhiên, giải thích cơ chế nhóm chức, hóa trị, danh pháp IUPAC ngắn gọn, dễ hiểu."
      : "\n\nSystem Instruction: You are Professor Lucy mentoring a student inside the Organic Molecular Sandbox. Provide concise, expert organic chemistry explanations, IUPAC naming, and synthesis hints in 100% pure English.";

    try {
      const response = await askLucyAssistant(q + sysInstruction, [], 1, organicContext);
      setChatHistory(prev => [...prev, { sender: 'lucy', text: response }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { 
        sender: 'lucy', 
        text: isVi ? 'Tôi đã ghi nhận câu hỏi. Em hãy thử kéo các mảnh có hóa trị phù hợp lại gần nhau nhé!' : 'I noted your question. Try pairing complementary radicals and functional groups!' 
      }]);
    } finally {
      setIsLucyThinking(false);
    }
  };

  // Give a contextual synthesis hint
  const handleAskLucyHint = () => {
    handleSendChatMessage(isVi ? 'Gợi ý cho em chất tiếp theo cần ghép là gì?' : 'Give me a hint on what molecule to synthesize next!');
  };

  // Update token position
  const handleUpdatePosition = (instanceId: string, x: number, y: number) => {
    setBoardTokens(prev => 
      prev.map(t => (t.instanceId === instanceId ? { ...t, x, y } : t))
    );
  };

  // Collision & Snapping check while dragging on canvas
  const handleDrag = (instanceId: string, currentX: number, currentY: number) => {
    setDraggedTokenId(instanceId);
    const snapDistanceThreshold = 85;

    let nearestTarget: BoardToken | null = null;
    let minDistance = Infinity;

    for (const token of boardTokens) {
      if (token.instanceId === instanceId) continue;
      const dx = token.x - currentX;
      const dy = token.y - currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < snapDistanceThreshold && dist < minDistance) {
        minDistance = dist;
        nearestTarget = token;
      }
    }

    if (nearestTarget) {
      setSnapTargetId(nearestTarget.instanceId);
    } else {
      setSnapTargetId(null);
    }
  };

  // Drag end: Attempt combination
  const handleDragEnd = async (draggedInstance: BoardToken, endX: number, endY: number) => {
    setDraggedTokenId(null);
    const targetInstanceId = snapTargetId;
    setSnapTargetId(null);

    // If dropped away from any token, just save new position
    if (!targetInstanceId) {
      handleUpdatePosition(draggedInstance.instanceId, endX, endY);
      return;
    }

    const targetInstance = boardTokens.find(t => t.instanceId === targetInstanceId);
    if (!targetInstance) {
      handleUpdatePosition(draggedInstance.instanceId, endX, endY);
      return;
    }

    const tokenA = ALL_ORGANIC_TOKENS[draggedInstance.tokenId];
    const tokenB = ALL_ORGANIC_TOKENS[targetInstance.tokenId];

    if (!tokenA || !tokenB) return;

    // Test reaction through the engine
    const result = combineOrganicTokens(draggedInstance.tokenId, targetInstance.tokenId);

    if (result.success && result.compound) {
      // SUCCESS: Snap bond & synthesize
      audioManager.playLegoSnap();

      // Trigger spark flash
      const sparkId = `spark_${Date.now()}`;
      const midX = (endX + targetInstance.x) / 2;
      const midY = (endY + targetInstance.y) / 2;

      setSparks(prev => [...prev, {
        id: sparkId,
        x: midX,
        y: midY,
        text: `⚡ ${result.compound!.displaySymbol}`
      }]);

      setTimeout(() => {
        setSparks(prev => prev.filter(s => s.id !== sparkId));
      }, 1000);

      // Check if newly discovered
      const isNew = !discoveredIds.includes(result.compound.id);
      if (isNew) {
        audioManager.playDiscoveryChime();
        setDiscoveredIds(prev => [...prev, result.compound!.id]);
        setRecentDiscovery(result.compound);
        setTimeout(() => setRecentDiscovery(null), 4000);
      }

      // Lucy's praise message
      if (result.reaction) {
        setLucyMessage(isVi ? result.reaction.vietnameseLucyCheer : result.reaction.lucyCheer);
      }

      // Remove the 2 parent tokens, spawn the new compound token at midpoint
      setBoardTokens(prev => {
        const remaining = prev.filter(
          t => t.instanceId !== draggedInstance.instanceId && t.instanceId !== targetInstanceId
        );
        return [
          ...remaining,
          {
            instanceId: `compound_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            tokenId: result.compound!.id,
            x: midX,
            y: midY
          }
        ];
      });
    } else {
      // INCOMPATIBLE BOND: Dynamic failure explanation
      audioManager.playClick();
      handleUpdatePosition(draggedInstance.instanceId, endX, endY);

      // Immediate deterministic message
      setLucyMessage(isVi ? (result.vietnameseReason || 'Không thể liên kết!') : (result.reason || 'Cannot form bond!'));

      // Asynchronously fetch Lucy's witty AI critique via Gemini
      setIsLucyThinking(true);
      getDynamicLucyFailureExplanation(tokenA, tokenB, isVi)
        .then(aiCritique => {
          setLucyMessage(aiCritique);
        })
        .finally(() => {
          setIsLucyThinking(false);
        });
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-[#020611] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      {/* Top Holographic Navigation Bar */}
      <header className="shrink-0 px-6 py-3.5 border-b border-cyan-950/80 bg-gradient-to-r from-[#030917]/95 via-[#061224]/95 to-[#030917]/95 backdrop-blur-2xl flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          {/* Sub-Mode Segmented Switcher (Sandbox vs Puzzle) */}
          <div className="flex items-center bg-[#040d1c] p-1 rounded-xl border border-cyan-900/60 shadow-inner">
            <button
              onClick={() => { audioManager.playClick(); setSubMode('SANDBOX'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                subMode === 'SANDBOX'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧪 {isVi ? 'XƯỞNG TỰ DO' : 'SANDBOX CRAFT'}
            </button>
            <button
              onClick={() => { audioManager.playClick(); setSubMode('PUZZLE'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                subMode === 'PUZZLE'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧩 {isVi ? 'CÂU ĐỐ TỔNG HỢP' : 'SYNTHESIS PUZZLE'}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#a855f7]" />
            <h1 className="text-sm md:text-base font-black tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-200 to-cyan-300">
              {isVi ? 'XƯỞNG PHÂN TỬ HỮU CƠ' : 'ORGANIC MOLECULAR SANDBOX'}
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-800/60 text-purple-300 font-mono text-[10px] font-bold">
              INFINITE CRAFT
            </span>
          </div>
        </div>

        {/* Discovery Progress Meter, Toolbar & Main Menu Exit Button */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-950/70 border border-cyan-900/60 px-3 py-1.5 rounded-xl font-mono text-xs shadow-inner">
            <span className="text-slate-400">{isVi ? 'ĐÃ KHÁM PHÁ:' : 'DISCOVERED:'}</span>
            <span className="text-emerald-400 font-bold text-sm">
              {discoveredIds.length} / {totalCraftableCount}
            </span>
            <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 ml-1">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(discoveredIds.length / totalCraftableCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoArrange}
              title={isVi ? 'Sắp xếp ngay ngắn các mảnh' : 'Auto-arrange tokens'}
              className="p-2 rounded-xl bg-[#07172c] hover:bg-cyan-950 border border-cyan-800/60 hover:border-cyan-400 text-cyan-300 transition-all active:scale-95 cursor-pointer text-xs"
            >
              📐 {isVi ? 'Sắp xếp' : 'Tidy'}
            </button>
            <button
              onClick={handleClearBoard}
              title={isVi ? 'Dọn sạch bàn thí nghiệm' : 'Clear all tokens on board'}
              className="p-2 rounded-xl bg-[#180a0c] hover:bg-rose-950 border border-rose-900/60 hover:border-rose-500 text-rose-300 transition-all active:scale-95 cursor-pointer text-xs"
            >
              🧹 {isVi ? 'Dọn bàn' : 'Clear'}
            </button>
          </div>

          <div className="h-6 w-px bg-cyan-900/60 mx-1" />

          {/* MAIN MENU Button on Right Side */}
          <button
            onClick={() => { audioManager.playClick(); setOrganicMode(false); }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95 cursor-pointer"
          >
            <span>{isVi ? 'VỀ MENU CHÍNH' : 'MAIN MENU'}</span>
            <span>→</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. Interactive 2D Molecular Workbench (Drop Zone Canvas) */}
        <div 
          ref={canvasRef}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const tokenId = e.dataTransfer.getData('text/plain');
            if (tokenId && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const dropX = e.clientX - rect.left - 50;
              const dropY = e.clientY - rect.top - 40;
              handleSpawnToken(tokenId, Math.max(10, dropX), Math.max(10, dropY));
            }
          }}
          className="flex-1 relative overflow-hidden bg-[#02050f] p-4 select-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.04) 0%, transparent 80%),
              linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 40px 40px, 40px 40px'
          }}
        >
          {/* Subtle Ambient Instructions */}
          {boardTokens.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
              <span className="text-4xl mb-2">⚛️</span>
              <p className="font-mono text-sm tracking-wider uppercase text-cyan-300">
                {isVi ? 'BÀN THÍ NGHIỆM ĐANG TRỐNG' : 'WORKBENCH IS EMPTY'}
              </p>
              <p className="font-sans text-xs text-slate-400 mt-1">
                {isVi ? 'Kéo thả các mảnh từ thư viện bên phải lên bàn thí nghiệm để tạo liên kết' : 'Drag fragments from the right library onto workbench to bond molecules'}
              </p>
            </div>
          )}

          {/* Render Active Board Tokens (Draggable Framer Motion Pieces) */}
          {boardTokens.map(tokenInstance => {
            const data = ALL_ORGANIC_TOKENS[tokenInstance.tokenId];
            if (!data) return null;

            const isBeingDragged = draggedTokenId === tokenInstance.instanceId;
            const isSnapCandidate = snapTargetId === tokenInstance.instanceId;

            return (
              <motion.div
                key={tokenInstance.instanceId}
                drag
                dragMomentum={false}
                dragElastic={0.1}
                whileHover={{ scale: 1.05 }}
                whileDrag={{ scale: 1.15, zIndex: 100 }}
                onDrag={(_, info) => {
                  handleDrag(tokenInstance.instanceId, info.point.x, info.point.y);
                }}
                onDragEnd={(_, info) => {
                  handleDragEnd(tokenInstance, info.point.x, info.point.y);
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: isSnapCandidate ? 1.15 : 1, 
                  opacity: 1,
                  x: tokenInstance.x,
                  y: tokenInstance.y
                }}
                transition={{ duration: 0.2 }}
                style={{ position: 'absolute', left: 0, top: 0 }}
                className={`group cursor-grab active:cursor-grabbing p-3 rounded-2xl backdrop-blur-xl border-2 flex flex-col items-center justify-center shadow-lg transition-colors select-none ${
                  isSnapCandidate 
                    ? 'border-emerald-400 bg-emerald-950/80 shadow-[0_0_30px_rgba(52,211,153,0.8)] scale-110' 
                    : isBeingDragged
                      ? 'border-cyan-400 bg-[#071c33]/95 shadow-[0_0_30px_rgba(6,182,212,0.6)]'
                      : 'border-cyan-500/40 bg-[#051324]/85 hover:border-cyan-300'
                }`}
                onDoubleClick={() => {
                  if (data.category === 'compound') {
                    setInspectedCompound(data);
                    setIsModalOpen(true);
                  }
                }}
              >
                {/* Visual Valence Socket / Indicator */}
                <div className="absolute -top-1.5 w-4 h-1.5 rounded-full bg-cyan-400/80 shadow-[0_0_6px_#22d3ee]" />
                {data.valence === 2 && (
                  <div className="absolute -bottom-1.5 w-4 h-1.5 rounded-full bg-cyan-400/80 shadow-[0_0_6px_#22d3ee]" />
                )}

                {/* Formula Symbol */}
                <span 
                  className="font-black text-base font-mono text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] tracking-wide"
                  style={{ color: data.color }}
                >
                  {data.displaySymbol}
                </span>

                {/* Common Name */}
                <span className="text-[10px] font-sans font-bold text-slate-300 group-hover:text-white transition-colors mt-0.5 max-w-[100px] truncate text-center">
                  {isVi ? data.vietnameseName : data.name}
                </span>

                {/* Inspect info badge for discovered compounds */}
                {data.category === 'compound' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedCompound(data);
                      setIsModalOpen(true);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-cyan-900 border border-cyan-400 text-[10px] text-cyan-200 flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
                    title={isVi ? 'Xem thông tin phân tử' : 'Inspect molecule'}
                  >
                    ℹ
                  </button>
                )}
              </motion.div>
            );
          })}

          {/* Reaction Sparks Animation */}
          <AnimatePresence>
            {sparks.map(spark => (
              <motion.div
                key={spark.id}
                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                animate={{ opacity: 0, scale: 1.6, y: -40 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ position: 'absolute', left: spark.x, top: spark.y }}
                className="pointer-events-none z-50 px-3 py-1 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-mono font-black text-sm rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.8)] flex items-center justify-center whitespace-nowrap"
              >
                {spark.text}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* New Discovery Celebration Banner */}
          <AnimatePresence>
            {recentDiscovery && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-900/95 via-indigo-900/95 to-cyan-900/95 border-2 border-emerald-400 px-6 py-3 rounded-2xl shadow-[0_0_40px_rgba(52,211,153,0.5)] flex items-center gap-3 pointer-events-auto cursor-pointer"
                onClick={() => {
                  setInspectedCompound(recentDiscovery);
                  setIsModalOpen(true);
                }}
              >
                <span className="text-2xl animate-bounce">✨</span>
                <div>
                  <span className="block text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300 font-bold">
                    {isVi ? 'PHÁT MINH MỚI ĐƯỢC MỞ KHÓA!' : 'NEW DISCOVERY UNLOCKED!'}
                  </span>
                  <span className="font-black text-base text-white tracking-wide">
                    {isVi ? recentDiscovery.vietnameseName : recentDiscovery.name} ({recentDiscovery.formula})
                  </span>
                </div>
                <span className="text-xs font-mono text-cyan-300 border border-cyan-400/40 px-2 py-0.5 rounded-lg ml-2">
                  {isVi ? 'Bấm để soi' : 'Click to inspect'} ➔
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Organic Lucy Chatbot Assistant */}
          <div className="absolute bottom-4 left-4 z-40 flex flex-col pointer-events-none">
            {isChatExpanded ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="w-80 sm:w-96 max-w-[92vw] rounded-3xl bg-gradient-to-b from-[#08182b]/95 via-[#051222]/95 to-[#030914]/95 border-2 border-cyan-500/40 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.85)] p-3.5 flex flex-col gap-2.5 pointer-events-auto overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <img 
                        src={lucyFacePFP} 
                        alt="Prof. Lucy" 
                        className="w-9 h-9 rounded-full border border-cyan-400 object-cover shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                      />
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-[#030914] rounded-full animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white font-sans tracking-wide">
                          {isVi ? 'GIÁO SƯ LUCY' : 'PROFESSOR LUCY'}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800/60">
                          ORGANIC AI
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        {isVi ? 'SẴN SÀNG HỖ TRỢ GHÉP CHẤT' : 'ONLINE / SYNTHESIS READY'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        audioManager.playClick();
                        setChatHistory([{ 
                          sender: 'lucy', 
                          text: isVi ? 'Đã làm mới cuộc hội thoại! Em cần cô Lucy hướng dẫn phản ứng hay công thức nào?' : 'Chat cleared! What organic synthesis shall we explore?' 
                        }]);
                      }}
                      className="p-1 text-slate-400 hover:text-cyan-300 text-xs font-mono rounded hover:bg-cyan-950/40 transition-colors cursor-pointer"
                      title={isVi ? 'Xóa lịch sử chat' : 'Clear Chat'}
                    >
                      🗑️
                    </button>
                    <button
                      onClick={() => { audioManager.playClick(); setIsChatExpanded(false); }}
                      className="p-1 text-slate-400 hover:text-cyan-300 text-xs font-mono rounded hover:bg-cyan-950/40 transition-colors cursor-pointer"
                      title={isVi ? 'Thu gọn' : 'Minimize'}
                    >
                      ▼
                    </button>
                  </div>
                </div>

                {/* Quick Action Suggestion Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                  <button
                    onClick={() => handleSendChatMessage(isVi ? 'Gợi ý cho em chất tiếp theo cần ghép là gì?' : 'Give me a hint on what molecule to synthesize next!')}
                    disabled={isLucyThinking}
                    className="px-2 py-0.5 bg-[#06172d] hover:bg-cyan-950 border border-cyan-800/60 hover:border-cyan-400 text-[10px] font-mono text-cyan-300 rounded-lg whitespace-nowrap transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    💡 {isVi ? 'Gợi ý ghép chất' : 'Synthesis Hint'}
                  </button>
                  <button
                    onClick={() => handleSendChatMessage(isVi ? 'Soi và phân tích các mảnh phân tử đang có trên bàn của em' : 'Analyze the current fragments on my board')}
                    disabled={isLucyThinking}
                    className="px-2 py-0.5 bg-[#06172d] hover:bg-cyan-950 border border-cyan-800/60 hover:border-cyan-400 text-[10px] font-mono text-cyan-300 rounded-lg whitespace-nowrap transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    🧪 {isVi ? 'Soi các mảnh trên bàn' : 'Analyze Board'}
                  </button>
                  <button
                    onClick={() => handleSendChatMessage(isVi ? 'Giải thích quy tắc ghép hóa trị và tại sao phản ứng có thể thất bại' : 'Explain valence rules and why organic combinations fail')}
                    disabled={isLucyThinking}
                    className="px-2 py-0.5 bg-[#06172d] hover:bg-cyan-950 border border-cyan-800/60 hover:border-cyan-400 text-[10px] font-mono text-cyan-300 rounded-lg whitespace-nowrap transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    ⚡ {isVi ? 'Quy tắc ghép hóa trị' : 'Valence Rules'}
                  </button>
                  <button
                    onClick={() => handleSendChatMessage(isVi ? 'Giải thích quy tắc gọi tên danh pháp IUPAC các nhóm chức hữu cơ' : 'Explain IUPAC nomenclature rules for organic functional groups')}
                    disabled={isLucyThinking}
                    className="px-2 py-0.5 bg-[#06172d] hover:bg-cyan-950 border border-cyan-800/60 hover:border-cyan-400 text-[10px] font-mono text-cyan-300 rounded-lg whitespace-nowrap transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    🌿 {isVi ? 'Danh pháp IUPAC' : 'IUPAC Naming'}
                  </button>
                </div>

                {/* Chat History Messages Scroll Body */}
                <div className="h-44 sm:h-52 overflow-y-auto flex flex-col gap-2 p-2 custom-scrollbar bg-[#020712]/70 rounded-2xl border border-cyan-950/70 shadow-inner font-sans text-xs select-text">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} select-text`}>
                      <div className={`px-3 py-2 rounded-xl max-w-[92%] whitespace-pre-wrap leading-relaxed shadow-sm select-text cursor-text ${
                        msg.sender === 'user' 
                          ? 'bg-cyan-900/40 text-cyan-100 border border-cyan-500/40' 
                          : 'bg-[#08182b]/90 text-slate-200 border border-cyan-900/40'
                      }`}>
                        <div className="flex items-center justify-between gap-3 mb-1 select-none">
                          <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${
                            msg.sender === 'user' ? 'text-cyan-400' : 'text-emerald-400'
                          }`}>
                            {msg.sender === 'user' ? '> YOU' : '✦ PROF. LUCY'}
                          </span>
                          <button
                            onClick={() => {
                              audioManager.playClick();
                              navigator.clipboard.writeText(msg.text);
                              setCopiedIdx(i);
                              setTimeout(() => setCopiedIdx(null), 1500);
                            }}
                            className="text-[9px] font-mono text-slate-400 hover:text-cyan-300 opacity-60 hover:opacity-100 transition-all flex items-center gap-1 cursor-pointer"
                            title={isVi ? 'Sao chép ghi chú' : 'Copy note'}
                          >
                            {copiedIdx === i ? (
                              <span className="text-emerald-400 font-bold">✓</span>
                            ) : (
                              <span>📋</span>
                            )}
                          </button>
                        </div>
                        <div className="select-text cursor-text selection:bg-cyan-500/40 selection:text-white">
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLucyThinking && (
                    <div className="flex items-center gap-2 text-cyan-400 font-mono text-[10px] p-2 bg-[#08182b]/50 rounded-xl border border-cyan-900/30">
                      <span className="animate-spin text-sm">⚛</span>
                      <span className="animate-pulse">
                        {isVi ? 'Cô Lucy đang phân tích phản ứng hữu cơ...' : 'Prof. Lucy is analyzing reaction mechanics...'}
                      </span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={isVi ? 'Hỏi cô Lucy (vd: cách tạo este, phân tích bàn...)' : 'Ask Lucy (e.g. how to make ester, hint...)'}
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && userInput.trim()) {
                        handleSendChatMessage();
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-[#020712] border border-cyan-900/80 focus:border-cyan-400 text-cyan-200 rounded-xl text-xs font-mono placeholder:text-slate-500 outline-none shadow-inner transition-colors"
                  />
                  <button
                    onClick={() => handleSendChatMessage()}
                    disabled={!userInput.trim() || isLucyThinking}
                    className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all active:scale-95 cursor-pointer"
                  >
                    ➤
                  </button>
                </div>
              </motion.div>
            ) : (
              /* Minimized Floating Avatar Pill */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => { audioManager.playClick(); setIsChatExpanded(true); }}
                className="flex items-center gap-2.5 p-2 rounded-2xl bg-gradient-to-r from-[#08182b]/95 to-[#040e1c]/95 border-2 border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-xl pointer-events-auto cursor-pointer hover:scale-105 transition-transform group"
              >
                <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-cyan-950/60 border border-cyan-400/50 p-0.5">
                  <img src={lucyStandingMenu} alt="Lucy" className="w-full h-full object-contain object-bottom" />
                  <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-black rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white font-sans">
                      {isVi ? 'GIÁO SƯ LUCY' : 'PROF. LUCY'}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400">💬</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 max-w-[200px] truncate">
                    {chatHistory[chatHistory.length - 1]?.text.replace(/^[✨⚠️💡📋]\s*/, '') || (isVi ? 'Nhấn để mở chatbot' : 'Click to open chatbot')}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* 2. Infinite Craft Style Discovery Sidebar (Draggable Library) */}
        <aside className="w-80 md:w-96 border-l border-cyan-950/80 bg-gradient-to-b from-[#030917]/95 via-[#051124]/95 to-[#020710]/95 backdrop-blur-2xl flex flex-col shrink-0 z-30">
          {/* Search Bar */}
          <div className="p-3.5 border-b border-cyan-900/40">
            <input 
              type="text"
              placeholder={isVi ? 'Tìm kiếm mảnh phân tử (vd: methyl, OH)...' : 'Search fragments or molecules...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#020712] border border-cyan-900/60 text-cyan-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
            />

            {/* Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 mt-2.5 font-mono text-[9px] font-bold uppercase">
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('ALL'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'Tất cả' : 'All'}
              </button>
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('STARTERS'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'STARTERS'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'Gốc' : 'Starters'}
              </button>
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('DISCOVERIES'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'DISCOVERIES'
                    ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'Đã tạo' : 'Found'} ({discoveredIds.length})
              </button>
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('CATALOG'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'CATALOG'
                    ? 'bg-purple-950 border-purple-400 text-purple-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📚 {isVi ? 'Tra cứu' : 'Catalog'}
              </button>
            </div>
          </div>

          {/* Scrollable Draggable Elements Grid */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {sidebarItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
                <span>🔍</span>
                <p className="mt-2">
                  {isVi ? 'Không tìm thấy mảnh phân tử nào phù hợp!' : 'No matching fragments found!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {sidebarItems.map(item => (
                  <div
                    key={item.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => handleSpawnToken(item.id)}
                    className="p-2.5 rounded-xl bg-[#040e1c]/80 hover:bg-[#081f38] border border-cyan-900/50 hover:border-cyan-400 transition-all cursor-grab active:cursor-grabbing group flex flex-col justify-between shadow-sm active:scale-95 select-none"
                    title={isVi ? 'Kéo thả lên bàn thí nghiệm (hoặc nhấp để tạo)' : 'Drag onto workbench (or click to spawn)'}
                  >
                    <div className="flex items-center justify-between mb-1.5 pointer-events-none">
                      <span 
                        className="font-mono font-black text-xs"
                        style={{ color: item.color }}
                      >
                        {item.displaySymbol}
                      </span>
                      {item.category === 'compound' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedCompound(item);
                            setIsModalOpen(true);
                          }}
                          className="pointer-events-auto text-[10px] text-slate-400 hover:text-cyan-300 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          ℹ️
                        </button>
                      )}
                    </div>

                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white truncate pointer-events-none">
                      {isVi ? item.vietnameseName : item.name}
                    </span>

                    <div className="flex items-center justify-between mt-1 text-[9px] font-mono text-slate-500 pointer-events-none">
                      <span>{item.formula}</span>
                      <span className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                        ✋ DRAG
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Deep-Dive Compound Inspection Modal */}
      <MolecularCardModal
        compound={inspectedCompound}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSpawnOnBoard={(compound) => handleSpawnToken(compound.id)}
        isVi={isVi}
      />
    </div>
  );
};

export default OrganicMode;
