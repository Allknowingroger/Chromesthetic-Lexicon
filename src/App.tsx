/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  ChevronRight, 
  Loader2, 
  Info, 
  Minimize2, 
  Maximize2,
  Play,
  Pause,
  Filter,
  Volume2
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { STYLES, StyleConcept } from './constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface StyleDetail {
  definition: string;
  etymology: string;
  visualPrompt: string;
  sonification: string;
  dominantHue: string;
}

interface GeneratedAsset {
  imageUrl?: string;
  detail?: StyleDetail;
  loading: boolean;
  error?: string;
}

type Category = StyleConcept['category'] | 'All';

export default function App() {
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [assets, setAssets] = useState<Record<string, GeneratedAsset>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'stream'>('stream');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  
  const filteredStyles = useMemo(() => {
    if (selectedCategory === 'All') return STYLES;
    return STYLES.filter(s => s.category === selectedCategory);
  }, [selectedCategory]);

  const generateStyleData = useCallback(async (styleName: string) => {
    if (assets[styleName]?.detail && !assets[styleName]?.error) return;

    setAssets(prev => ({ 
      ...prev, 
      [styleName]: { ...prev[styleName], loading: true, error: undefined } 
    }));

    try {
      // 1. Generate text details
      const textResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a concise, poetic definition and etymology for the word "${styleName}" in the context of visual aesthetics. 
        Also, describe its "sonification" (how it would sound) and specify a "dominantHue" hex code.
        Finally, suggest a high-quality descriptive prompt for an AI image generator to visualize this concept. 
        Respond in JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              definition: { type: Type.STRING },
              etymology: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
              sonification: { type: Type.STRING },
              dominantHue: { type: Type.STRING },
            },
            required: ["definition", "etymology", "visualPrompt", "sonification", "dominantHue"],
          },
        },
      });

      const detail: StyleDetail = JSON.parse(textResponse.text || '{}');

      // 2. Generate Image
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { text: detail.visualPrompt },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      let imageUrl: string | undefined;
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      setAssets(prev => ({
        ...prev,
        [styleName]: { detail, imageUrl, loading: false }
      }));
    } catch (err) {
      console.error(err);
      setAssets(prev => ({
        ...prev,
        [styleName]: { ...prev[styleName], loading: false, error: "Synthesis failed. Signal interference detected." }
      }));
    }
  }, [assets]);

  const handleStyleClick = (styleName: string) => {
    setActiveStyle(styleName);
    if (!assets[styleName]?.imageUrl) {
      generateStyleData(styleName);
    }
  };

  // Auto-play logic
  useEffect(() => {
    if (!isAutoPlaying) return;

    const timer = setInterval(() => {
      const currentIndex = STYLES.findIndex(s => s.name === activeStyle);
      const nextIndex = (currentIndex + 1) % STYLES.length;
      handleStyleClick(STYLES[nextIndex].name);
    }, 10000); // Cycle every 10 seconds

    return () => clearInterval(timer);
  }, [isAutoPlaying, activeStyle, handleStyleClick]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] font-sans selection:bg-[#F27D26] selection:text-white scroll-smooth">
      {/* Immersive Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-10 transition-all duration-1000">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] blur-[180px] rounded-full animate-pulse transition-colors duration-1000" 
          style={{ backgroundColor: (activeStyle && assets[activeStyle]?.detail?.dominantHue) || '#F27D26' }}
        />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#4f46e5] blur-[150px] rounded-full animate-pulse delay-700" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl px-6 py-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 90 }}
            className="w-10 h-10 bg-[#F27D26] rounded-full flex items-center justify-center font-mono text-white font-black text-sm shadow-[0_0_20px_rgba(242,125,38,0.3)] cursor-pointer"
          >
            CL
          </motion.div>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase">Chromesthetic Lexicon</h1>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 bg-[#F27D26] rounded-full" />
              <p className="text-[9px] font-mono text-black/40 uppercase tracking-[0.3em]">Neural Aesthetic Repository</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0 scrollbar-hide max-w-full">
          <div className="flex gap-2 items-center bg-black/5 p-1 rounded-full border border-black/5">
            {(['All', 'Structural', 'Atmospheric', 'Organic', 'Chromatic', 'Abstract'] as Category[]).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                  selectedCategory === cat ? 'bg-[#1A1A1A] text-white shadow-lg scale-105' : 'text-black/40 hover:text-black'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="h-6 w-[1px] bg-black/10 hidden md:block" />

          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setViewMode(prev => prev === 'grid' ? 'stream' : 'grid')}
              className="text-black/40 hover:text-black transition-all hover:scale-110"
              title="Toggle View Mode"
            >
              {viewMode === 'grid' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>
            <button 
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all ${
                isAutoPlaying ? 'bg-[#F27D26]/10 border-[#F27D26] text-[#F27D26]' : 'border-black/10 text-black/40 hover:border-black/30'
              }`}
            >
              {isAutoPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isAutoPlaying ? 'Streaming' : 'Slideshow'}
            </button>
          </div>
        </div>
      </header>

      <main className="relative p-6 lg:p-20">
        <section className="max-w-4xl mb-32">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-sm mb-8"
          >
            <Sparkles size={12} className="text-[#F27D26]" />
            <span className="text-[10px] font-mono text-[#F27D26] uppercase font-bold tracking-widest italic">Signal Strength: Optimal</span>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl lg:text-9xl font-black tracking-tighter mb-8 leading-[0.85] uppercase"
          >
            Symmetry in <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F27D26] to-[#4f46e5]">the Obscure.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-black/30 text-xl lg:text-2xl font-light leading-relaxed max-w-xl italic"
          >
            A collective of {STYLES.length} rare sensory definitions, expanded by generative intelligence to reveal their hidden visual and auditory forms.
          </motion.p>
        </section>

        {/* Styles Interface */}
        <div className={`grid gap-px bg-black/5 border border-black/5 overflow-hidden rounded-sm shadow-xl transition-all duration-700 ${
          viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' : 'grid-cols-1 md:grid-cols-2'
        }`}>
          <AnimatePresence mode="popLayout">
            {filteredStyles.map((style, idx) => (
              <StyleCard 
                key={style.name}
                style={style}
                index={idx}
                asset={assets[style.name]}
                isActive={activeStyle === style.name}
                onClick={() => handleStyleClick(style.name)}
                viewMode={viewMode}
              />
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {activeStyle && assets[activeStyle] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-white/95 backdrop-blur-2xl overflow-y-auto"
            onClick={() => setActiveStyle(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-black/10 rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col lg:flex-row h-auto lg:h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Image Section */}
              <div className="w-full lg:w-3/5 h-[50vh] lg:h-full bg-gray-100 relative overflow-hidden group">
                <AnimatePresence mode="wait">
                  {assets[activeStyle].loading ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10"
                    >
                      <Loader2 className="w-16 h-16 text-[#F27D26] animate-spin" />
                      <div className="text-center font-mono">
                        <p className="text-xs text-black/40 uppercase tracking-[0.4em] animate-pulse mb-1">Synthesizing Fractal</p>
                        <p className="text-[10px] text-black/20 uppercase tracking-widest">{activeStyle} in progress...</p>
                      </div>
                    </motion.div>
                  ) : assets[activeStyle].imageUrl ? (
                    <motion.img 
                      key="image"
                      src={assets[activeStyle].imageUrl} 
                      alt={activeStyle}
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                      <p className="text-black/20 font-mono mb-6 italic">{assets[activeStyle].error || 'Waiting for signal initialization.'}</p>
                      <button 
                        onClick={() => generateStyleData(activeStyle)}
                        className="px-8 py-3 bg-[#F27D26] text-white text-[10px] font-black uppercase tracking-widest rounded-sm hover:translate-y-[-2px] transition-transform shadow-[0_10px_30px_rgba(242,125,38,0.2)]"
                      >
                        Re-Synthesize
                      </button>
                    </div>
                  )}
                </AnimatePresence>

                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-40 pointer-events-none" />
                <div className="absolute top-8 left-8 flex flex-col gap-2">
                  <p className="text-[10px] font-mono uppercase tracking-[0.5em] text-[#F27D26]">Lexicon entry</p>
                  <p className="text-2xl font-black italic tracking-tighter uppercase text-black">{activeStyle}</p>
                </div>
              </div>

              {/* Data Section */}
              <div className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-between bg-white overflow-y-auto">
                <div>
                  <div className="flex justify-between items-start mb-12">
                    <div className="flex flex-col gap-1">
                      <div 
                        className="w-12 h-1 bg-[#F27D26] mb-4" 
                        style={{ backgroundColor: assets[activeStyle]?.detail?.dominantHue }}
                      />
                      <span className="text-[10px] font-mono text-black/30 uppercase tracking-widest">Aesthetic Protocol</span>
                    </div>
                    <button 
                      onClick={() => setActiveStyle(null)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-black/5 rounded-full transition-colors"
                    >
                      <Minimize2 size={20} />
                    </button>
                  </div>

                  <div className="space-y-12">
                    <section>
                      <h3 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none text-black">
                        {activeStyle}
                      </h3>
                      <p className="text-xl md:text-2xl font-light leading-relaxed text-black/70 border-l-2 border-[#F27D26]/20 pl-6">
                        {assets[activeStyle].detail?.definition || "Awaiting neural definition..."}
                      </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Filter size={12} className="text-[#F27D26]" />
                          <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest font-bold">Etymology</label>
                        </div>
                        <p className="text-xs font-mono text-black/60 leading-relaxed uppercase tracking-wider bg-black/5 p-4 rounded-sm">
                          {assets[activeStyle].detail?.etymology || "Checking roots..."}
                        </p>
                      </section>
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                        <Volume2 size={12} className="text-[#F27D26]" />
                          <label className="text-[10px] font-mono text-black/40 uppercase tracking-widest font-bold">Sonification</label>
                        </div>
                        <p className="text-xs font-mono text-black/50 leading-relaxed italic border border-black/5 p-4 rounded-sm">
                          {assets[activeStyle].detail?.sonification || "Analyzing soundscape..."}
                        </p>
                      </section>
                    </div>
                  </div>
                </div>

                <div className="mt-16 pt-8 border-t border-black/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: assets[activeStyle]?.detail?.dominantHue || '#F27D26' }} />
                    <span className="text-[9px] font-mono text-black/20 uppercase tracking-[0.2em] font-bold">
                      Synthesis Active // PROD_UNIT_09
                    </span>
                  </div>
                  {assets[activeStyle]?.detail?.dominantHue && (
                    <span className="text-[9px] font-mono text-black/40 uppercase tracking-widest">
                      HUE: {assets[activeStyle]?.detail?.dominantHue}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StyleCardProps {
  style: StyleConcept;
  index: number;
  asset?: GeneratedAsset;
  isActive: boolean;
  onClick: () => void;
  viewMode: 'grid' | 'stream';
}

const StyleCard: React.FC<StyleCardProps> = ({ style, index, asset, isActive, onClick, viewMode }) => {
  return (
    <motion.button
      onClick={onClick}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: (index % 12) * 0.03, duration: 0.5 }}
      whileHover={{ scale: 1.01, zIndex: 10 }}
      className={`relative group flex flex-col items-start text-left bg-white p-6 md:p-8 lg:p-10 transition-all hover:bg-[#F5F5F5] border-r border-black/5 ${
        viewMode === 'stream' ? 'min-h-[400px]' : 'min-h-[250px]'
      }`}
    >
      <div className="flex flex-col gap-1 mb-6">
        <span className="text-[10px] font-mono text-black/20 tracking-[0.3em] font-bold uppercase transition-all group-hover:text-[#F27D26]">
          IDX_{(index + 1).toString().padStart(3, '0')}
        </span>
        <span className="text-[8px] font-mono text-black/40 uppercase tracking-widest px-1.5 py-0.5 bg-black/5 inline-block w-fit opacity-0 group-hover:opacity-100 transition-opacity">
          {style.category}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-between w-full">
        <h3 className={`font-black tracking-tighter uppercase leading-[0.8] transition-all group-hover:tracking-normal text-black group-hover:text-[#F27D26] ${
          viewMode === 'stream' ? 'text-4xl md:text-6xl lg:text-7xl xl:text-8xl' : 'text-xl md:text-2xl'
        }`}>
          {style.name}
        </h3>
        
        <div className="flex items-end justify-between w-full mt-8">
          <div className="flex gap-4">
            <div className={`transition-all ${asset?.imageUrl ? 'text-[#F27D26]' : 'text-black/10'}`}>
              <ImageIcon size={18} />
            </div>
            <div className={`transition-all ${asset?.detail ? 'text-black/40' : 'text-black/10'}`}>
              <Info size={18} />
            </div>
          </div>
          
          <div className="flex items-center gap-3 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <span className="text-[9px] font-mono uppercase tracking-[0.2em] font-black text-black/40">Initialize</span>
            <ChevronRight size={14} className="text-[#F27D26]" />
          </div>
        </div>
      </div>

      {/* Edge decoration */}
      <div className="absolute top-0 right-0 w-[1px] h-0 bg-[#F27D26] group-hover:h-full transition-all duration-700" />
      <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-[#F27D26] group-hover:w-full transition-all duration-700 delay-100" />
      
      {/* Dynamic Background */}
      {asset?.imageUrl && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none overflow-hidden grayscale group-hover:grayscale-0">
          <img 
            src={asset.imageUrl} 
            alt="" 
            className="w-full h-full object-cover scale-125 group-hover:scale-100 transition-transform duration-[2000ms]"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Hue Indicator */}
      {asset?.detail?.dominantHue && (
        <div 
          className="absolute top-4 right-4 w-1 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: asset.detail.dominantHue }}
        />
      )}
    </motion.button>
  );
};

