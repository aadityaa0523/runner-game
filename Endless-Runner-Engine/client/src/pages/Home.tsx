import { useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import { Leaderboard } from "@/components/Leaderboard";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, X } from "lucide-react";

export default function Home() {
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <div className="w-full h-screen overflow-hidden relative">
      <GameCanvas />
      
      {/* Overlay UI Buttons */}
      <div className="absolute top-6 right-6 z-40">
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="bg-white/20 hover:bg-white/40 backdrop-blur-md border-2 border-white/50 p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg group"
        >
          {showLeaderboard ? (
            <X className="w-8 h-8 text-white group-hover:text-red-400 transition-colors" />
          ) : (
            <BarChart3 className="w-8 h-8 text-white" />
          )}
        </button>
      </div>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute top-0 right-0 h-full w-full max-w-md z-30 pt-24 px-6 pb-6 bg-white/10 backdrop-blur-xl shadow-2xl border-l border-white/20"
          >
             <Leaderboard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Hint */}
      <div className="absolute bottom-6 left-0 w-full text-center pointer-events-none md:hidden opacity-50">
        <div className="flex justify-center gap-8 text-white font-display text-xl text-stroke">
          <span>TAP LEFT</span>
          <span>TAP JUMP</span>
          <span>TAP RIGHT</span>
        </div>
      </div>
    </div>
  );
}
