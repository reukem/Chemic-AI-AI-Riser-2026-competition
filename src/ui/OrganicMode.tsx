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
import { OrganicMoleculeGraphic } from './components/OrganicMoleculeGraphic';
import { audioManager } from '../engine/AudioManager';
import { askLucyAssistant } from '../engine/aiService';
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
  color?: string;
}

interface SynthesisQuest {
  id: string;
  targetId: string;
  title: { EN: string; VN: string };
  hint: { EN: string; VN: string };
  rewardLore: { EN: string; VN: string };
  icon: string;
}

const SYNTHESIS_QUESTS: SynthesisQuest[] = [
  {
    id: 'quest_methanol',
    targetId: 'methanol',
    title: { EN: 'Wood Alcohol (Methanol)', VN: 'Cồn Gỗ (Methanol)' },
    hint: { EN: 'Combine Methyl (-CH₃) with Hydroxyl (-OH)', VN: 'Ghép gốc Metyl (-CH₃) với nhóm Hiđroxyl (-OH)' },
    rewardLore: { EN: 'Simplest alcohol, used in racing fuel and antifreeze!', VN: 'Ancol đơn giản nhất, dùng làm nhiên liệu xe đua và chống đông!' },
    icon: '🧪'
  },
  {
    id: 'quest_ethanol',
    targetId: 'ethanol',
    title: { EN: 'Grain Spirit (Ethanol)', VN: 'Cồn Lên Men (Ethanol)' },
    hint: { EN: 'Combine Ethyl (-C₂H₅) with Hydroxyl (-OH)', VN: 'Ghép gốc Etyl (-C₂H₅) với nhóm Hiđroxyl (-OH)' },
    rewardLore: { EN: 'The universal beverage alcohol and clean biofuel!', VN: 'Thành phần trong đồ uống có cồn và nhiên liệu sinh học E5!' },
    icon: '🍷'
  },
  {
    id: 'quest_acetic_acid',
    targetId: 'acetic_acid',
    title: { EN: 'Kitchen Vinegar (Acetic Acid)', VN: 'Giấm Ăn (Axit Axetic)' },
    hint: { EN: 'Combine Methyl (-CH₃) with Carboxyl (-COOH)', VN: 'Ghép gốc Metyl (-CH₃) với nhóm Cacboxyl (-COOH)' },
    rewardLore: { EN: 'Distinctive sharp scent of household vinegar!', VN: 'Mang hương vị chua thanh quen thuộc trong gian bếp gia đình!' },
    icon: '🥗'
  },
  {
    id: 'quest_ethyl_acetate',
    targetId: 'ethyl_acetate',
    title: { EN: 'Fruity Pear Drops (Ethyl Acetate)', VN: 'Hương Lê & Táo (Etyl Axetat)' },
    hint: { EN: 'Combine Acetic Acid with Ethanol (Esterification)', VN: 'Ghép Axit Axetic với Ethanol (Phản ứng Este hóa)' },
    rewardLore: { EN: 'Sweet green-apple scent! Key solvent in nail polish remover.', VN: 'Hương táo và lê dịu ngọt! Dung môi chính trong nước tẩy sơn móng.' },
    icon: '🍏'
  },
  {
    id: 'quest_aspirin',
    targetId: 'aspirin',
    title: { EN: 'Wonder Drug (Aspirin)', VN: 'Thần Dược Giảm Đau (Aspirin)' },
    hint: { EN: 'Combine Salicylic Acid / Phenyl with Acetyl Carboxyl', VN: 'Phản ứng tạo este axetyl của axit salixylic' },
    rewardLore: { EN: 'The world’s most widely consumed antipyretic painkiller!', VN: 'Thuốc hạ sốt, giảm đau phổ biến nhất trong lịch sử y học nhân loại!' },
    icon: '💊'
  }
];

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
      { instanceId: 'init_1', tokenId: 'methyl', x: 140, y: 150 },
      { instanceId: 'init_2', tokenId: 'ethyl', x: 280, y: 150 },
      { instanceId: 'init_3', tokenId: 'hydroxy', x: 210, y: 270 }
    ];
  });

  // Persistent Discoveries
  const [discoveredIds, setDiscoveredIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('chemic_organic_discoveries');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return ['methanol', 'ethanol'];
  });

  useEffect(() => {
    localStorage.setItem('chemic_organic_discoveries', JSON.stringify(discoveredIds));
  }, [discoveredIds]);

  // Sidebar controls & Category Filtering
  const [activeTab, setActiveTab] = useState<'ALL' | 'HYDROCARBONS' | 'FUNCTIONAL' | 'DISCOVERIES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dragging and Snap Connection State
  const [draggedTokenId, setDraggedTokenId] = useState<string | null>(null);
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null);
  const [activeConnectionCoords, setActiveConnectionCoords] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    previewText?: string;
    isValid: boolean;
  } | null>(null);

  // Sparks and VFX
  const [sparks, setSparks] = useState<ReactionSpark[]>([]);

  // Lucy Companion & Floating HUD States
  const [isLucyDrawerOpen, setIsLucyDrawerOpen] = useState(false);
  const [lucySpeechBubble, setLucySpeechBubble] = useState<string>(
    isVi
      ? 'Chào mừng em đến với Xưởng Phân Tử! Hãy kéo các mảnh gần nhau để kiểm tra lực hút liên kết hóa trị nhé!'
      : 'Welcome to the Molecular Studio! Drag fragments close together to observe magnetic covalent bond attraction!'
  );
  const [isLucyThinking, setIsLucyThinking] = useState(false);

  // Detailed Compound Inspection Modal
  const [inspectedCompound, setInspectedCompound] = useState<OrganicTokenData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Discovery Celebration Modal
  const [celebrationCompound, setCelebrationCompound] = useState<OrganicTokenData | null>(null);

  // Active Quest selection
  const [currentQuestIdx, setCurrentQuestIdx] = useState<number>(0);
  const activeQuest = SYNTHESIS_QUESTS[currentQuestIdx % SYNTHESIS_QUESTS.length];
  const isCurrentQuestCompleted = discoveredIds.includes(activeQuest.targetId);

  const totalCraftableCount = Object.keys(CRAFTABLE_COMPOUNDS).length;

  // Filtered sidebar items
  const sidebarItems = useMemo(() => {
    let items: OrganicTokenData[] = [];
    if (activeTab === 'ALL') {
      items = [
        ...Object.values(STARTER_FRAGMENTS),
        ...discoveredIds.map(id => CRAFTABLE_COMPOUNDS[id]).filter(Boolean)
      ];
    } else if (activeTab === 'HYDROCARBONS') {
      items = Object.values(STARTER_FRAGMENTS).filter(f => f.category === 'alkyl' || f.category === 'alkenyl' || f.category === 'aromatic');
    } else if (activeTab === 'FUNCTIONAL') {
      items = Object.values(STARTER_FRAGMENTS).filter(f => f.category === 'functional' || f.category === 'halogen');
    } else if (activeTab === 'DISCOVERIES') {
      items = discoveredIds.map(id => CRAFTABLE_COMPOUNDS[id]).filter(Boolean);
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

  if (subMode === 'PUZZLE') {
    return (
      <OrganicPuzzleView 
        onBackToMenu={() => setOrganicMode(false)}
        onSwitchToSandbox={() => setSubMode('SANDBOX')}
      />
    );
  }

  // Spawn token onto the workbench canvas
  const handleSpawnToken = (tokenId: string, spawnX?: number, spawnY?: number) => {
    audioManager.playClick();
    const canvas = canvasRef.current;
    const defaultX = spawnX ?? (canvas ? canvas.clientWidth / 2 - 50 + (Math.random() * 80 - 40) : 220);
    const defaultY = spawnY ?? (canvas ? canvas.clientHeight / 2 - 50 + (Math.random() * 80 - 40) : 180);

    const newToken: BoardToken = {
      instanceId: `token_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tokenId,
      x: Math.max(20, defaultX),
      y: Math.max(20, defaultY)
    };

    setBoardTokens(prev => [...prev, newToken]);
  };

  // Clear all tokens
  const handleClearBoard = () => {
    audioManager.playClick();
    setBoardTokens([]);
    setLucySpeechBubble(
      isVi 
        ? 'Bàn làm việc đã được dọn sạch bóng! Kéo các mảnh mới từ thanh bên phải để bắt đầu phản ứng mới nhé!'
        : 'Workbench swept clean! Drag fresh fragments from the right library to begin a new synthesis!'
    );
  };

  // Tidy / Auto-arrange
  const handleAutoArrange = () => {
    audioManager.playClick();
    const cols = 4;
    const spacingX = 140;
    const spacingY = 120;
    const startX = 60;
    const startY = 60;

    setBoardTokens(prev => 
      prev.map((t, idx) => ({
        ...t,
        x: startX + (idx % cols) * spacingX,
        y: startY + Math.floor(idx / cols) * spacingY
      }))
    );
  };

  // Update token position
  const handleUpdatePosition = (instanceId: string, x: number, y: number) => {
    setBoardTokens(prev => 
      prev.map(t => (t.instanceId === instanceId ? { ...t, x, y } : t))
    );
  };

  // Magnetic Snapping check with Real-Time Chemical Combination Preview
  const handleDrag = (instanceId: string, currentX: number, currentY: number) => {
    setDraggedTokenId(instanceId);
    const snapDistanceThreshold = 110;

    const draggedToken = boardTokens.find(t => t.instanceId === instanceId);
    if (!draggedToken) return;

    let nearestTarget: BoardToken | null = null;
    let minDistance = Infinity;

    for (const token of boardTokens) {
      if (token.instanceId === instanceId) continue;
      const dx = (token.x + 35) - (currentX + 35);
      const dy = (token.y + 35) - (currentY + 35);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < snapDistanceThreshold && dist < minDistance) {
        minDistance = dist;
        nearestTarget = token;
      }
    }

    if (nearestTarget) {
      setSnapTargetId(nearestTarget.instanceId);
      const testReaction = combineOrganicTokens(draggedToken.tokenId, nearestTarget.tokenId);
      const targetData = ALL_ORGANIC_TOKENS[nearestTarget.tokenId];
      const draggedData = ALL_ORGANIC_TOKENS[draggedToken.tokenId];

      setActiveConnectionCoords({
        x1: currentX + 35,
        y1: currentY + 35,
        x2: nearestTarget.x + 35,
        y2: nearestTarget.y + 35,
        isValid: testReaction.success,
        previewText: testReaction.success 
          ? `+ ${targetData?.displaySymbol} → ${testReaction.compound?.displaySymbol} (${isVi ? testReaction.compound?.vietnameseName : testReaction.compound?.name})`
          : `${draggedData?.displaySymbol} ⊘ ${targetData?.displaySymbol}`
      });
    } else {
      setSnapTargetId(null);
      setActiveConnectionCoords(null);
    }
  };

  // Drag End & Covalent Bond Formation
  const handleDragEnd = async (draggedInstance: BoardToken, endX: number, endY: number) => {
    const targetInstanceId = snapTargetId;
    setDraggedTokenId(null);
    setSnapTargetId(null);
    setActiveConnectionCoords(null);

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

    // Evaluate Reaction
    const result = combineOrganicTokens(draggedInstance.tokenId, targetInstance.tokenId);

    if (result.success && result.compound) {
      audioManager.playLegoSnap();

      // Midpoint for celebratory spark
      const midX = (endX + targetInstance.x) / 2;
      const midY = (endY + targetInstance.y) / 2;

      setSparks(prev => [...prev, {
        id: `spark_${Date.now()}`,
        x: midX,
        y: midY,
        text: `⚡ ${result.compound!.displaySymbol}`,
        color: '#34d399'
      }]);

      const isNew = !discoveredIds.includes(result.compound.id);
      if (isNew) {
        audioManager.playAchievement();
        setDiscoveredIds(prev => [...prev, result.compound!.id]);
        setCelebrationCompound(result.compound);
      }

      setLucySpeechBubble(
        isVi 
          ? `Tuyệt vời! Em đã tổng hợp thành công ${result.compound.vietnameseName} (${result.compound.formula})!`
          : `Brilliant! You successfully synthesized ${result.compound.name} (${result.compound.formula})!`
      );

      // Replace the two parent pieces with the single synthesized product
      setBoardTokens(prev => {
        const filtered = prev.filter(
          t => t.instanceId !== draggedInstance.instanceId && t.instanceId !== targetInstanceId
        );
        return [
          ...filtered,
          {
            instanceId: `token_crafted_${Date.now()}`,
            tokenId: result.compound!.id,
            x: midX,
            y: midY
          }
        ];
      });
    } else {
      audioManager.playFizz();
      handleUpdatePosition(draggedInstance.instanceId, endX, endY);

      const failMsg = getDynamicLucyFailureExplanation(draggedInstance.tokenId, targetInstance.tokenId, isVi);
      setLucySpeechBubble(failMsg);

      setSparks(prev => [...prev, {
        id: `spark_fail_${Date.now()}`,
        x: endX,
        y: endY,
        text: isVi ? '⚠ Không tạo liên kết!' : '⚠ Incompatible Valence!',
        color: '#f43f5e'
      }]);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-[#020611] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      {/* Top Holographic Navigation Bar */}
      <header className="shrink-0 px-6 py-3 border-b border-cyan-950/80 bg-gradient-to-r from-[#030917]/95 via-[#061224]/95 to-[#030917]/95 backdrop-blur-2xl flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          {/* Sub-Mode Segmented Switcher */}
          <div className="flex items-center bg-[#040d1c] p-1 rounded-xl border border-cyan-900/60 shadow-inner">
            <button
              onClick={() => { audioManager.playClick(); setSubMode('SANDBOX'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                subMode === 'SANDBOX'
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧪 {isVi ? 'XƯỞNG TỔNG HỢP' : 'MOLECULAR STUDIO'}
            </button>
            <button
              onClick={() => { audioManager.playClick(); setSubMode('PUZZLE'); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                subMode === 'PUZZLE'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧩 {isVi ? 'CÂU ĐỐ TỔNG HỢP' : 'SYNTHESIS PUZZLE'}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <h1 className="text-sm md:text-base font-black tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-emerald-300">
              {isVi ? 'XƯỞNG HÓA HỮU CƠ LƯỢNG TỬ' : 'QUANTUM MOLECULAR WORKBENCH'}
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 font-mono text-[10px] font-bold">
              VALENCE KINETICS
            </span>
          </div>
        </div>

        {/* Discovery Progress Meter & Main Menu Exit */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-950/80 border border-cyan-900/60 px-3 py-1.5 rounded-xl font-mono text-xs shadow-inner">
            <span className="text-slate-400">{isVi ? 'ĐÃ KHÁM PHÁ:' : 'DISCOVERED:'}</span>
            <span className="text-emerald-400 font-bold text-sm">
              {discoveredIds.length} / {totalCraftableCount}
            </span>
            <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 ml-1">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-300 transition-all duration-500"
                style={{ width: `${(discoveredIds.length / totalCraftableCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoArrange}
              title={isVi ? 'Sắp xếp ngay ngắn các mảnh' : 'Auto-arrange tokens'}
              className="px-3 py-1.5 rounded-xl bg-[#07172c] hover:bg-cyan-950 border border-cyan-800/60 hover:border-cyan-400 text-cyan-300 transition-all active:scale-95 cursor-pointer text-xs font-mono flex items-center gap-1.5"
            >
              <span>📐</span>
              <span className="hidden md:inline">{isVi ? 'Sắp xếp' : 'Tidy'}</span>
            </button>
            <button
              onClick={handleClearBoard}
              title={isVi ? 'Dọn sạch bàn thí nghiệm' : 'Clear all tokens on board'}
              className="px-3 py-1.5 rounded-xl bg-[#180a0c] hover:bg-rose-950 border border-rose-900/60 hover:border-rose-500 text-rose-300 transition-all active:scale-95 cursor-pointer text-xs font-mono flex items-center gap-1.5"
            >
              <span>🧹</span>
              <span className="hidden md:inline">{isVi ? 'Dọn bàn' : 'Clear'}</span>
            </button>
          </div>

          <div className="h-6 w-px bg-cyan-900/60 mx-1" />

          {/* MAIN MENU Button */}
          <button
            onClick={() => { audioManager.playClick(); setOrganicMode(false); }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95 cursor-pointer"
          >
            <span>{isVi ? 'VỀ MENU' : 'MAIN MENU'}</span>
            <span>→</span>
          </button>
        </div>
      </header>

      {/* Gamified Synthesis Quests Mission Bar */}
      <div className="px-6 py-2 bg-[#040e1e]/90 border-b border-cyan-900/50 flex items-center justify-between z-30 font-mono text-xs backdrop-blur-md">
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar">
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span>🎯</span>
            <span>{isVi ? 'NHIỆM VỤ TỔNG HỢP' : 'SYNTHESIS QUEST'}</span>
          </span>
          <div className="flex items-center gap-2 text-slate-200 shrink-0">
            <span className="text-base">{activeQuest.icon}</span>
            <span className="font-bold text-white">{isVi ? activeQuest.title.VN : activeQuest.title.EN}</span>
            <span className="text-slate-400 text-[11px]">— {isVi ? activeQuest.hint.VN : activeQuest.hint.EN}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {isCurrentQuestCompleted ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
              <span>✓</span>
              <span>{isVi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-600/60 text-cyan-300 text-[10px] font-bold">
              {isVi ? 'CHƯA MỞ KHÓA' : 'LOCKED'}
            </span>
          )}
          <button
            onClick={() => { audioManager.playClick(); setCurrentQuestIdx(prev => prev + 1); }}
            className="p-1 px-2 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[10px] font-bold transition-all cursor-pointer"
          >
            {isVi ? 'Đổi Nhiệm Vụ ➔' : 'Next Quest ➔'}
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. Interactive 2D Molecular Workbench */}
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
              const dropX = e.clientX - rect.left - 45;
              const dropY = e.clientY - rect.top - 45;
              handleSpawnToken(tokenId, Math.max(10, dropX), Math.max(10, dropY));
            }
          }}
          className="flex-1 relative overflow-hidden bg-[#02050f] p-4 select-none"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.05) 0%, transparent 80%),
              linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 40px 40px, 40px 40px'
          }}
        >
          {/* Empty Workbench Guidance */}
          {boardTokens.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
              <span className="text-5xl mb-3">⬡</span>
              <p className="font-mono text-sm tracking-wider uppercase text-cyan-300 font-bold">
                {isVi ? 'BÀN THÍ NGHIỆM ĐANG TRỐNG' : 'WORKBENCH IS EMPTY'}
              </p>
              <p className="font-sans text-xs text-slate-400 mt-1 max-w-sm text-center">
                {isVi 
                  ? 'Kéo các nhóm chức từ thư viện bên phải lên bàn thí nghiệm rồi đưa lại gần nhau để tạo liên kết hóa học!' 
                  : 'Drag functional groups from the library onto the workbench and bring them together to forge covalent bonds!'}
              </p>
            </div>
          )}

          {/* Magnetic Covalent Bond Laser Beam SVG */}
          {activeConnectionCoords && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
              <defs>
                <linearGradient id="bondGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={activeConnectionCoords.isValid ? '#34d399' : '#f43f5e'} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={activeConnectionCoords.isValid ? '#22d3ee' : '#e11d48'} stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {/* Outer Glow Line */}
              <line 
                x1={activeConnectionCoords.x1} 
                y1={activeConnectionCoords.y1} 
                x2={activeConnectionCoords.x2} 
                y2={activeConnectionCoords.y2} 
                stroke="url(#bondGlow)" 
                strokeWidth="6" 
                strokeLinecap="round"
                opacity="0.6"
              />
              {/* Core Sharp Bond Line */}
              <line 
                x1={activeConnectionCoords.x1} 
                y1={activeConnectionCoords.y1} 
                x2={activeConnectionCoords.x2} 
                y2={activeConnectionCoords.y2} 
                stroke="#ffffff" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                strokeDasharray="6 4"
                className="animate-[dash_0.5s_linear_infinite]"
              />
            </svg>
          )}

          {/* Floating Reaction Prediction Pill */}
          {activeConnectionCoords && activeConnectionCoords.previewText && (
            <div 
              className={`absolute z-30 font-mono text-[10px] font-bold px-3 py-1 rounded-full shadow-2xl backdrop-blur-xl border transition-all -translate-x-1/2 -translate-y-full pointer-events-none ${
                activeConnectionCoords.isValid 
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                  : 'bg-rose-950/95 border-rose-400 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
              }`}
              style={{
                left: (activeConnectionCoords.x1 + activeConnectionCoords.x2) / 2,
                top: (activeConnectionCoords.y1 + activeConnectionCoords.y2) / 2 - 14
              }}
            >
              {activeConnectionCoords.previewText}
            </div>
          )}

          {/* Render Active Board Tokens */}
          {boardTokens.map(tokenInstance => {
            const data = ALL_ORGANIC_TOKENS[tokenInstance.tokenId];
            if (!data) return null;

            const isBeingDragged = draggedTokenId === tokenInstance.instanceId;
            const isSnapCandidate = snapTargetId === tokenInstance.instanceId;
            const name = isVi ? data.vietnameseName : data.name;

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
                className={`group cursor-grab active:cursor-grabbing p-2.5 rounded-2xl backdrop-blur-xl border-2 flex flex-col items-center justify-center shadow-2xl transition-colors select-none ${
                  isSnapCandidate 
                    ? 'border-emerald-400 bg-emerald-950/90 shadow-[0_0_35px_rgba(52,211,153,0.85)] scale-110' 
                    : isBeingDragged
                      ? 'border-cyan-400 bg-[#071c33]/95 shadow-[0_0_35px_rgba(6,182,212,0.7)]'
                      : 'border-cyan-500/40 bg-[#051324]/85 hover:border-cyan-300 shadow-md'
                }`}
                onDoubleClick={() => {
                  if (data.category === 'compound') {
                    setInspectedCompound(data);
                    setIsModalOpen(true);
                  }
                }}
              >
                {/* Visual Skeletal / Lewis Molecule Graphic */}
                <OrganicMoleculeGraphic
                  id={data.id}
                  category={data.category}
                  displaySymbol={data.displaySymbol}
                  formula={data.formula}
                  valence={data.valence}
                  size="md"
                  color={data.color}
                />

                <span className="text-[10px] font-bold text-slate-200 mt-1 truncate max-w-[95px] text-center">
                  {name}
                </span>

                {/* Inspect Button on hover for compounds */}
                {data.category === 'compound' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedCompound(data);
                      setIsModalOpen(true);
                    }}
                    className="mt-1 px-2 py-0.5 rounded-md bg-cyan-950/80 hover:bg-cyan-800 text-cyan-300 text-[8px] font-mono font-bold tracking-wider uppercase border border-cyan-700/60 transition-all cursor-pointer"
                  >
                    🔍 {isVi ? 'CẤU TRÚC' : 'STRUCTURE'}
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
                animate={{ opacity: 0, scale: 1.6, y: -45 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                style={{ position: 'absolute', left: spark.x, top: spark.y }}
                className="z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 font-mono font-black text-xs md:text-sm px-3 py-1 rounded-full bg-[#051528]/95 border border-cyan-400 shadow-[0_0_20px_#22d3ee] text-cyan-300"
              >
                {spark.text}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Sleek Ergonomic Lucy AI Mentor Dock (Fixed top-left or minimized) */}
          <div className="absolute bottom-4 left-4 z-40 flex items-end gap-3 pointer-events-none">
            {/* Lucy Avatar Bubble */}
            <div 
              onClick={() => { audioManager.playClick(); setIsLucyDrawerOpen(!isLucyDrawerOpen); }}
              className="relative w-12 h-12 rounded-full border-2 border-cyan-400/80 bg-[#051528] p-0.5 shadow-[0_0_20px_rgba(34,211,238,0.5)] cursor-pointer pointer-events-auto hover:scale-105 transition-all group shrink-0"
              title={isVi ? 'Trò chuyện với Giáo sư Lucy' : 'Chat with Professor Lucy'}
            >
              <img 
                src={lucyFacePFP} 
                alt="Lucy Mentor" 
                className="w-full h-full object-cover rounded-full" 
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
            </div>

            {/* Smart Non-Intrusive Speech Bubble */}
            <div className="max-w-md bg-[#051426]/95 border border-cyan-500/50 rounded-2xl p-3 shadow-2xl backdrop-blur-xl pointer-events-auto text-xs font-sans text-slate-200">
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1 mb-1 font-mono text-[9px] text-cyan-400 font-bold uppercase tracking-wider">
                <span>✦ {isVi ? 'GIÁO SƯ LUCY' : 'PROFESSOR LUCY'}</span>
                <span className="text-slate-500">{isVi ? 'Cố Vấn Hữu Cơ' : 'Organic Mentor'}</span>
              </div>
              <p className="leading-relaxed text-[11px] text-slate-200">
                {lucySpeechBubble}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Right-Hand Molecular Library Sidebar */}
        <aside className="w-72 lg:w-80 shrink-0 border-l border-cyan-950/80 bg-[#030917]/95 backdrop-blur-2xl flex flex-col z-30 shadow-2xl">
          {/* Header & Search */}
          <div className="p-3.5 border-b border-cyan-950/80 bg-[#040e20]/90">
            <input
              type="text"
              placeholder={isVi ? 'Tìm kiếm mảnh phân tử (vd: methyl, OH)...' : 'Search fragments or molecules...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#020712] border border-cyan-900/60 text-cyan-200 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
            />

            {/* Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 mt-2.5 font-mono text-[8px] font-bold uppercase">
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('ALL'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'TẤT CẢ' : 'ALL'}
              </button>
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('HYDROCARBONS'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'HYDROCARBONS'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'HIĐROCACBON' : 'HYDROCARB'}
              </button>
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('FUNCTIONAL'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'FUNCTIONAL'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'NHÓM CHỨC' : 'FUNCTION'}
              </button>
              <button
                onClick={() => { audioManager.playClick(); setActiveTab('DISCOVERIES'); }}
                className={`py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeTab === 'DISCOVERIES'
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-[#020712]/60 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {isVi ? 'ĐÃ TỔNG HỢP' : 'DISCOVERED'}
              </button>
            </div>
          </div>

          {/* Draggable Library Items Grid */}
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
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'copy';
                      audioManager.playHover();
                    }}
                    onClick={() => handleSpawnToken(item.id)}
                    className="p-2.5 rounded-xl border border-cyan-900/50 hover:border-cyan-400 bg-gradient-to-b from-[#051426] to-[#020814] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all group"
                  >
                    <OrganicMoleculeGraphic
                      id={item.id}
                      category={item.category}
                      displaySymbol={item.displaySymbol}
                      formula={item.formula}
                      valence={item.valence}
                      size="sm"
                      color={item.color}
                    />

                    <span className="text-[10px] font-bold text-slate-200 mt-1 truncate max-w-[85px] text-center">
                      {isVi ? item.vietnameseName : item.name}
                    </span>

                    <span className="text-[9px] font-mono text-cyan-400/80">
                      {item.displaySymbol}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Discovery Celebration Modal */}
      {celebrationCompound && (
        <div 
          onClick={() => setCelebrationCompound(null)}
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-gradient-to-b from-[#081e36] via-[#051324] to-[#020a16] border-2 border-emerald-400 rounded-3xl p-6 shadow-[0_0_60px_rgba(52,211,153,0.4)] flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-3xl mb-3 shadow-[0_0_20px_#34d399] animate-bounce">
              ✨
            </div>

            <span className="font-mono text-xs text-emerald-400 font-bold uppercase tracking-widest mb-1">
              {isVi ? 'KHÁM PHÁ PHÂN TỬ MỚI!' : 'NEW MOLECULAR DISCOVERY!'}
            </span>

            <h2 className="text-2xl font-black text-white tracking-wide mb-1">
              {isVi ? celebrationCompound.vietnameseName : celebrationCompound.name}
            </h2>

            <span className="font-mono text-cyan-300 font-bold text-sm mb-4">
              {celebrationCompound.formula}
            </span>

            <div className="w-32 h-32 my-2 flex items-center justify-center">
              <OrganicMoleculeGraphic
                id={celebrationCompound.id}
                category={celebrationCompound.category}
                displaySymbol={celebrationCompound.displaySymbol}
                formula={celebrationCompound.formula}
                valence={celebrationCompound.valence}
                size="lg"
                color={celebrationCompound.color}
              />
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed my-3 bg-[#030d1a]/80 p-3 rounded-2xl border border-cyan-900/60">
              {isVi 
                ? (celebrationCompound.vietnameseTrivia || celebrationCompound.vietnameseDescription)
                : (celebrationCompound.trivia || celebrationCompound.description)}
            </p>

            <button
              onClick={() => setCelebrationCompound(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(52,211,153,0.4)] transition-all cursor-pointer"
            >
              {isVi ? 'TIẾP TỤC THÍ NGHIỆM' : 'CONTINUE RESEARCH'}
            </button>
          </div>
        </div>
      )}

      {/* Deep-Dive Compound Inspection Modal */}
      <MolecularCardModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setInspectedCompound(null); }}
        compound={inspectedCompound}
      />
    </div>
  );
};

export default OrganicMode;
